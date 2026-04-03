import "server-only";

import { leagues as fallbackLeagues } from "@/data/leagues";
import { matches as fallbackMatches } from "@/data/matches";
import type { League, Match, MatchClock, MatchPhase, MatchStatus } from "@/types/match";
import type {
  MetadataValue,
  VenueMetadata,
} from "@/types/metadata";
import type { MatchStatistics, TeamMatchStatistics } from "@/types/statistics";
import type {
  FormResult,
  Team,
  TeamAvailabilityNote,
  TeamForm,
  TeamStanding,
  TeamStrengthRatings,
} from "@/types/team";

export type FootballDataSource = "api" | "mock";
export type FootballFallbackReason =
  | "missing-config"
  | "request-failed"
  | "invalid-response";

export interface FootballDataResult<T> {
  data: T;
  source: FootballDataSource;
  error?: string;
  fallbackReason?: FootballFallbackReason;
}

export interface FootballDashboardSnapshot {
  matches: readonly Match[];
  leagues: readonly League[];
  selectedDate: string;
}

export interface FootballMatchContext {
  match: Match | undefined;
  league: League | undefined;
  coverage: LeagueCoverage | null;
}

export interface LeagueCoverage {
  leagueId: number;
  season: number;
  standings: boolean | null;
  fixtureStatistics: boolean | null;
  events: boolean | null;
  lineups: boolean | null;
  players: boolean | null;
}

interface FootballApiConfig {
  baseUrl: string | null;
  apiKey: string | null;
  configured: boolean;
}

interface RelevantFixturesSnapshot {
  date: string;
  fixtures: readonly ApiSportsFixture[];
}

interface FixtureNormalizationContext {
  league: League;
  homeStanding?: ApiSportsStandingRow;
  awayStanding?: ApiSportsStandingRow;
  statistics?: MatchStatistics | null;
  homeMetadata?: TeamMetadata | null;
  awayMetadata?: TeamMetadata | null;
}

interface ApiSportsFixture {
  fixture: {
    id: number;
    referee: string | null;
    date: string;
    venue?: {
      name?: string | null;
      city?: string | null;
    } | null;
    status?: {
      long?: string | null;
      short?: string | null;
      elapsed?: number | null;
      extra?: number | null;
    } | null;
  };
  league: {
    id: number;
    name: string;
    country: string | null;
    logo?: string | null;
    season: number;
    round?: string | null;
  };
  teams: {
    home: ApiSportsTeam;
    away: ApiSportsTeam;
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  } | null;
}

interface ApiSportsTeam {
  id: number;
  name: string;
  logo?: string | null;
}

interface ApiSportsStandingRow {
  rank: number;
  team: ApiSportsTeam;
  points: number;
  goalsDiff: number;
  form?: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
}

interface ApiSportsFixtureStatisticsBlock {
  team: {
    id: number;
    name: string;
  };
  statistics: Array<{
    type?: string | null;
    value?: string | number | null;
  }>;
}

interface ApiSportsTeamProfile {
  id: number;
  name: string;
  country: string | null;
  venue: {
    name: string | null;
    city: string | null;
  } | null;
}

interface ApiSportsCoachProfile {
  id: number | null;
  name: string;
}

interface TeamMetadata {
  teamId: number;
  coach: MetadataValue;
  venue: VenueMetadata | null;
}

class FootballApiError extends Error {
  fallbackReason: FootballFallbackReason;

  constructor(message: string, fallbackReason: FootballFallbackReason) {
    super(message);
    this.name = "FootballApiError";
    this.fallbackReason = fallbackReason;
  }
}

const MAJOR_LEAGUE_PRIORITIES = new Map<number, number>([
  [39, 1],
  [140, 2],
  [78, 3],
  [135, 4],
  [61, 5],
  [2, 6],
  [3, 7],
]);

const DEFAULT_TEAM_COLOR_PAIRS = [
  ["#0F172A", "#E2E8F0"],
  ["#0F766E", "#ECFEFF"],
  ["#7C2D12", "#FFEDD5"],
  ["#1D4ED8", "#DBEAFE"],
  ["#7E22CE", "#F3E8FF"],
  ["#B91C1C", "#FEE2E2"],
] as const;

const LIVE_STATUS_CODES = new Set(["1H", "HT", "2H", "ET", "P", "BT", "LIVE"]);
const FINISHED_STATUS_CODES = new Set(["FT", "AET", "PEN"]);
const POSTPONED_STATUS_CODES = new Set([
  "PST",
  "CANC",
  "ABD",
  "AWD",
  "WO",
  "SUSP",
  "INT",
  "DELAYED",
]);

const DEFAULT_FORM: readonly FormResult[] = ["D", "W", "D", "L", "W"];

// TTL strategy:
// - League coverage changes slowly, so it is cached for 24 hours.
// - Team metadata (coach / club profile venue) is cached for 12 hours.
// - Fixture detail is cached for 2 minutes because referee/venue can change close to kickoff.
// - Live fixture statistics should refresh quickly, so they revalidate every 30 seconds.
const CACHE_TTL_SECONDS = {
  leagueCoverage: 60 * 60 * 24,
  teamMetadata: 60 * 60 * 12,
  fixtureDetail: 60 * 2,
  liveFixture: 30,
} as const;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const leagueCoverageCache = new Map<string, CacheEntry<LeagueCoverage | null>>();
const teamMetadataCache = new Map<string, CacheEntry<TeamMetadata | null>>();
const fixtureCoreCache = new Map<string, CacheEntry<ApiSportsFixture | undefined>>();

const fallbackTeams = Array.from(
  new Map(
    fallbackMatches.flatMap((match) => [match.homeTeam, match.awayTeam]).map((team) => [team.id, team]),
  ).values(),
);

const fallbackTeamSeedsByName = new Map(
  fallbackTeams.flatMap((team) => {
    const values = [team.name, team.shortName].map((value) => normalizeLookupKey(value));
    return values.map((value) => [value, team] as const);
  }),
);

const fallbackLeagueSeedsByName = new Map(
  fallbackLeagues.flatMap((league) => {
    const values = [league.name, league.slug].map((value) => normalizeLookupKey(value));
    return values.map((value) => [value, league] as const);
  }),
);

export function isFootballApiConfigured() {
  return getFootballApiConfig().configured;
}

export function buildFootballDataNotice(
  results: ReadonlyArray<{
    source: FootballDataSource;
    error?: string;
    fallbackReason?: FootballFallbackReason;
  }>,
) {
  const fallbackResults = results.filter((result) => result.source === "mock");

  if (fallbackResults.length === 0) {
    return null;
  }

  const missingConfigResult = fallbackResults.find(
    (result) => result.fallbackReason === "missing-config",
  );

  if (missingConfigResult?.error) {
    return missingConfigResult.error;
  }

  return (
    fallbackResults.find((result) => result.error)?.error ??
    "Không thể tải dữ liệu trực tiếp từ API-Sports lúc này. Ứng dụng đang tạm dùng dữ liệu mô phỏng để duy trì trải nghiệm ổn định."
  );
}

export async function getApiSportsFixturesByDate(date: string) {
  const responseItems = await fetchApiSportsResponse(
    "fixtures",
    { date },
    {
      revalidateSeconds: CACHE_TTL_SECONDS.liveFixture,
    },
  );
  const fixtures = responseItems.flatMap((item) => {
    const fixture = parseApiSportsFixture(item);

    return fixture ? [fixture] : [];
  });

  if (responseItems.length > 0 && fixtures.length === 0) {
    throw new FootballApiError(
      "API-Sports trả về dữ liệu trận đấu chưa thể sử dụng.",
      "invalid-response",
    );
  }

  return fixtures;
}

export async function getApiSportsFixtureById(fixtureId: string) {
  if (!isNumericIdentifier(fixtureId)) {
    return undefined;
  }

  return getFixtureCore(fixtureId);
}

async function getFixtureCore(fixtureId: string) {
  const cachedFixture = getCachedValue(fixtureCoreCache, fixtureId);

  if (typeof cachedFixture !== "undefined") {
    return cachedFixture;
  }

  const responseItems = await fetchApiSportsResponse(
    "fixtures",
    { id: fixtureId },
    {
      revalidateSeconds: CACHE_TTL_SECONDS.fixtureDetail,
    },
  );

  for (const item of responseItems) {
    const fixture = parseApiSportsFixture(item);

    if (fixture) {
      setCachedValue(
        fixtureCoreCache,
        fixtureId,
        fixture,
        CACHE_TTL_SECONDS.fixtureDetail,
      );

      return fixture;
    }
  }

  if (responseItems.length > 0) {
    throw new FootballApiError(
      "API-Sports trả về dữ liệu chi tiết trận đấu chưa thể sử dụng.",
      "invalid-response",
    );
  }

  setCachedValue(
    fixtureCoreCache,
    fixtureId,
    undefined,
    CACHE_TTL_SECONDS.fixtureDetail,
  );

  return undefined;
}

async function getLeagueCoverage(leagueId: number, season: number) {
  const cacheKey = getLeagueSeasonKey(leagueId, season);
  const cachedCoverage = getCachedValue(leagueCoverageCache, cacheKey);

  if (cachedCoverage !== undefined) {
    return cachedCoverage;
  }

  try {
    const responseItems = await fetchApiSportsResponse(
      "leagues",
      {
        id: String(leagueId),
        season: String(season),
      },
      {
        revalidateSeconds: CACHE_TTL_SECONDS.leagueCoverage,
      },
    );
    const coverage =
      responseItems
        .flatMap((item) => {
          const parsedCoverage = parseLeagueCoverage(item, leagueId, season);

          return parsedCoverage ? [parsedCoverage] : [];
        })
        .at(0) ?? null;

    setCachedValue(
      leagueCoverageCache,
      cacheKey,
      coverage,
      CACHE_TTL_SECONDS.leagueCoverage,
    );

    return coverage;
  } catch {
    return null;
  }
}

async function getTeamMetadata(teamId: number, fallbackCountry?: string | null) {
  const normalizedCountry = fallbackCountry?.trim() || "Quốc tế";
  const cacheKey = `${teamId}:${normalizeLookupKey(normalizedCountry)}`;
  const cachedMetadata = getCachedValue(teamMetadataCache, cacheKey);

  if (cachedMetadata !== undefined) {
    return cachedMetadata;
  }

  try {
    const [teamProfile, coachMetadata] = await Promise.all([
      getTeamProfile(teamId),
      getCoachMetadata(teamId),
    ]);
    const metadata = {
      teamId,
      coach: coachMetadata,
      venue: buildVenueMetadataFromTeamProfile(teamProfile, normalizedCountry),
    } satisfies TeamMetadata;

    setCachedValue(
      teamMetadataCache,
      cacheKey,
      metadata,
      CACHE_TTL_SECONDS.teamMetadata,
    );

    return metadata;
  } catch {
    const metadata = {
      teamId,
      coach: buildUnavailableMetadata(
        "Thông tin HLV chưa có trong dữ liệu hiện tại.",
      ),
      venue: null,
    } satisfies TeamMetadata;

    setCachedValue(
      teamMetadataCache,
      cacheKey,
      metadata,
      CACHE_TTL_SECONDS.teamMetadata,
    );

    return metadata;
  }
}

async function getTeamProfile(teamId: number) {
  const responseItems = await fetchApiSportsResponse(
    "teams",
    { id: String(teamId) },
    {
      revalidateSeconds: CACHE_TTL_SECONDS.teamMetadata,
    },
  );

  for (const item of responseItems) {
    const teamProfile = parseTeamProfile(item);

    if (teamProfile) {
      return teamProfile;
    }
  }

  return null;
}

async function getCoachMetadata(teamId: number) {
  try {
    const responseItems = await fetchApiSportsResponse(
      "coachs",
      { team: String(teamId) },
      {
        revalidateSeconds: CACHE_TTL_SECONDS.teamMetadata,
      },
    );

    for (const item of responseItems) {
      const coachProfile = parseCoachProfile(item);

      if (coachProfile?.name.trim()) {
        return buildAvailableMetadata(coachProfile.name);
      }
    }
  } catch {
    return buildUnavailableMetadata("Thông tin HLV chưa có trong dữ liệu hiện tại.");
  }

  return buildUnavailableMetadata("Thông tin HLV chưa có trong dữ liệu hiện tại.");
}

export async function getDashboardSnapshotWithFallback(): Promise<
  FootballDataResult<FootballDashboardSnapshot>
> {
  const fallbackSnapshot: FootballDashboardSnapshot = {
    matches: fallbackMatches,
    leagues: fallbackLeagues,
    selectedDate: getCurrentUtcDate(),
  };
  const config = getFootballApiConfig();

  if (!config.configured) {
    return createFallbackResult(
      fallbackSnapshot,
      "missing-config",
      getMissingConfigMessage(config),
    );
  }

  try {
    const snapshot = await getRelevantFixturesSnapshot();
    const leagues = normalizeLeaguesFromFixtures(snapshot.fixtures);
    const matches = await normalizeMatchesFromFixtures(snapshot.fixtures, leagues);

    return {
      data: {
        matches,
        leagues,
        selectedDate: snapshot.date,
      },
      source: "api",
    };
  } catch (error) {
    const footballError = normalizeFootballApiError(error);

    return createFallbackResult(
      fallbackSnapshot,
      footballError.fallbackReason,
      getFallbackMessage(footballError.fallbackReason),
    );
  }
}

export async function getMatchesWithFallback(): Promise<
  FootballDataResult<readonly Match[]>
> {
  const result = await getDashboardSnapshotWithFallback();

  return {
    data: result.data.matches,
    source: result.source,
    error: result.error,
    fallbackReason: result.fallbackReason,
  };
}

export async function getLeaguesWithFallback(): Promise<
  FootballDataResult<readonly League[]>
> {
  const result = await getDashboardSnapshotWithFallback();

  return {
    data: result.data.leagues,
    source: result.source,
    error: result.error,
    fallbackReason: result.fallbackReason,
  };
}

export async function getMatchContextWithFallback(
  matchId: string,
): Promise<FootballDataResult<FootballMatchContext>> {
  const fallbackContext = getFallbackMatchContext(matchId);
  const config = getFootballApiConfig();

  if (!config.configured) {
    return createFallbackResult(
      fallbackContext,
      "missing-config",
      getMissingConfigMessage(config),
    );
  }

  if (!isNumericIdentifier(matchId)) {
    if (fallbackContext.match) {
      return createFallbackResult(
        fallbackContext,
        "invalid-response",
        "Đang hiển thị dữ liệu mô phỏng vì mã trận này không thuộc định dạng fixture của API-Sports.",
      );
    }

    return {
      data: {
        match: undefined,
        league: undefined,
        coverage: null,
      },
      source: "api",
    };
  }

  try {
    const fixture = await getApiSportsFixtureById(matchId);

    if (!fixture) {
      return {
        data: {
          match: undefined,
          league: undefined,
          coverage: null,
        },
        source: "api",
      };
    }

    const coverage = await getLeagueCoverage(fixture.league.id, fixture.league.season);
    const [standingsIndex, statistics, homeMetadata, awayMetadata] = await Promise.all([
      getStandingsIndex([fixture]),
      getFixtureStatisticsSafe(fixture),
      getTeamMetadata(fixture.teams.home.id, fixture.league.country),
      getTeamMetadata(fixture.teams.away.id, fixture.league.country),
    ]);
    const leagueKey = getLeagueSeasonKey(fixture.league.id, fixture.league.season);
    const standingsByTeamId = standingsIndex.get(leagueKey);
    const league = normalizeLeagueFromFixtures([fixture]);
    const match = normalizeFixture(fixture, {
      league,
      homeStanding: standingsByTeamId?.get(fixture.teams.home.id),
      awayStanding: standingsByTeamId?.get(fixture.teams.away.id),
      statistics,
      homeMetadata,
      awayMetadata,
    });

    return {
      data: {
        match,
        league,
        coverage,
      },
      source: "api",
    };
  } catch (error) {
    const footballError = normalizeFootballApiError(error);

    return createFallbackResult(
      fallbackContext,
      footballError.fallbackReason,
      getFallbackMessage(footballError.fallbackReason),
    );
  }
}

export async function getMatchByIdWithFallback(
  matchId: string,
): Promise<FootballDataResult<Match | undefined>> {
  const result = await getMatchContextWithFallback(matchId);

  return {
    data: result.data.match,
    source: result.source,
    error: result.error,
    fallbackReason: result.fallbackReason,
  };
}

async function getRelevantFixturesSnapshot() {
  const today = getCurrentUtcDate();
  const candidateDates = Array.from(
    new Set([today, shiftUtcDate(today, 1), shiftUtcDate(today, -1)]),
  );
  let lastSnapshot: RelevantFixturesSnapshot | null = null;

  for (const date of candidateDates) {
    const fixtures = await getApiSportsFixturesByDate(date);
    const prioritizedFixtures = prioritizeFixtures(fixtures);

    lastSnapshot = {
      date,
      fixtures: prioritizedFixtures,
    };

    if (prioritizedFixtures.length > 0) {
      return lastSnapshot;
    }
  }

  return (
    lastSnapshot ?? {
      date: today,
      fixtures: [],
    }
  );
}

async function normalizeMatchesFromFixtures(
  fixtures: readonly ApiSportsFixture[],
  leagues: readonly League[],
) {
  if (fixtures.length === 0) {
    return [] satisfies readonly Match[];
  }

  const standingsIndex = await getStandingsIndex(fixtures);
  const leagueIndex = new Map(
    leagues.map((league) => [league.id, league] as const),
  );

  return fixtures.map((fixture) => {
    const league = leagueIndex.get(getInternalLeagueId(fixture.league));

    if (!league) {
      throw new FootballApiError(
        "API-Sports trả về giải đấu chưa thể đồng bộ với ứng dụng.",
        "invalid-response",
      );
    }

    const standingsByTeamId = standingsIndex.get(
      getLeagueSeasonKey(fixture.league.id, fixture.league.season),
    );

    return normalizeFixture(fixture, {
      league,
      homeStanding: standingsByTeamId?.get(fixture.teams.home.id),
      awayStanding: standingsByTeamId?.get(fixture.teams.away.id),
      statistics: null,
    });
  });
}

function normalizeLeaguesFromFixtures(fixtures: readonly ApiSportsFixture[]) {
  const groupedFixtures = new Map<string, ApiSportsFixture[]>();

  for (const fixture of fixtures) {
    const key = getLeagueSeasonKey(fixture.league.id, fixture.league.season);
    const existingGroup = groupedFixtures.get(key);

    if (existingGroup) {
      existingGroup.push(fixture);
      continue;
    }

    groupedFixtures.set(key, [fixture]);
  }

  return Array.from(groupedFixtures.values())
    .map((group) => normalizeLeagueFromFixtures(group))
    .sort((left, right) => {
      const priorityDifference = left.priority - right.priority;

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return left.name.localeCompare(right.name);
    });
}

function normalizeLeagueFromFixtures(fixtures: readonly ApiSportsFixture[]) {
  const [fixture] = fixtures;

  if (!fixture) {
    throw new FootballApiError(
      "Không có dữ liệu giải đấu để chuẩn hóa.",
      "invalid-response",
    );
  }

  const seed = getFallbackLeagueSeed(
    fixture.league.name,
    fixture.league.country,
  );
  const priority =
    MAJOR_LEAGUE_PRIORITIES.get(fixture.league.id) ??
    seed?.priority ??
    100 + fixture.league.id;
  const currentRound =
    fixtures
      .map((item) => translateRoundLabel(item.league.round))
      .find(Boolean) ??
    translateRoundLabel(seed?.currentRound) ??
    "Đang cập nhật";

  return {
    id: getInternalLeagueId(fixture.league),
    slug: seed?.slug ?? slugify(fixture.league.name),
    name: fixture.league.name,
    country: fixture.league.country?.trim() || seed?.country || "Quốc tế",
    seasonLabel: formatSeasonLabel(fixture.league.season),
    currentRound,
    logoUrl: fixture.league.logo?.trim() || seed?.logoUrl || "",
    priority,
  } satisfies League;
}

async function getStandingsIndex(fixtures: readonly ApiSportsFixture[]) {
  const uniqueLeagueSeasons = Array.from(
    new Map(
      fixtures.map((fixture) => [
        getLeagueSeasonKey(fixture.league.id, fixture.league.season),
        {
          leagueId: fixture.league.id,
          season: fixture.league.season,
        },
      ]),
    ).values(),
  );
  const settledResponses = await Promise.all(
    uniqueLeagueSeasons.map(async ({ leagueId, season }) => {
      try {
        const coverage = await getLeagueCoverage(leagueId, season);

        if (coverage?.standings === false) {
          return [getLeagueSeasonKey(leagueId, season), new Map<number, ApiSportsStandingRow>()] as const;
        }

        const standings = await getStandingsByLeagueAndSeason(leagueId, season);

        return [
          getLeagueSeasonKey(leagueId, season),
          new Map(standings.map((row) => [row.team.id, row] as const)),
        ] as const;
      } catch {
        return [getLeagueSeasonKey(leagueId, season), new Map<number, ApiSportsStandingRow>()] as const;
      }
    }),
  );

  return new Map(settledResponses);
}

async function getStandingsByLeagueAndSeason(leagueId: number, season: number) {
  const responseItems = await fetchApiSportsResponse("standings", {
    league: String(leagueId),
    season: String(season),
  }, {
    revalidateSeconds: CACHE_TTL_SECONDS.fixtureDetail,
  });
  const rows: ApiSportsStandingRow[] = [];

  for (const item of responseItems) {
    if (!isRecord(item) || !isRecord(item.league) || !Array.isArray(item.league.standings)) {
      continue;
    }

    for (const standingGroup of item.league.standings) {
      if (!Array.isArray(standingGroup)) {
        continue;
      }

      for (const row of standingGroup) {
        const parsedRow = parseApiSportsStandingRow(row);

        if (parsedRow) {
          rows.push(parsedRow);
        }
      }
    }
  }

  return rows;
}

async function getFixtureStatisticsSafe(fixture: ApiSportsFixture) {
  try {
    const coverage = await getLeagueCoverage(fixture.league.id, fixture.league.season);

    if (coverage?.fixtureStatistics === false) {
      return null;
    }

    const responseItems = await fetchApiSportsResponse("fixtures/statistics", {
      fixture: String(fixture.fixture.id),
    }, {
      revalidateSeconds:
        getMatchStatus(fixture.fixture.status?.short) === "live"
          ? CACHE_TTL_SECONDS.liveFixture
          : CACHE_TTL_SECONDS.fixtureDetail,
    });
    const blocks = responseItems.flatMap((item) => {
      const block = parseFixtureStatisticsBlock(item);

      return block ? [block] : [];
    });

    return normalizeFixtureStatistics(fixture, blocks);
  } catch {
    return null;
  }
}

function normalizeFixture(
  fixture: ApiSportsFixture,
  context: FixtureNormalizationContext,
) {
  const status = getMatchStatus(fixture.fixture.status?.short);
  const homeTeam = normalizeTeam(
    fixture.teams.home,
    context.league,
    context.homeStanding,
    context.homeMetadata,
  );
  const awayTeam = normalizeTeam(
    fixture.teams.away,
    context.league,
    context.awayStanding,
    context.awayMetadata,
  );
  const round =
    translateRoundLabel(fixture.league.round) ??
    context.league.currentRound ??
    "Đang cập nhật";

  return {
    id: String(fixture.fixture.id),
    leagueId: context.league.id,
    status,
    round,
    kickoffTime: fixture.fixture.date,
    headline: buildHeadline({
      leagueName: context.league.name,
      homeTeamName: homeTeam.shortName,
      awayTeamName: awayTeam.shortName,
      status,
    }),
    venue: buildVenueMetadata(fixture, context.league),
    referee: buildRefereeMetadata(fixture, status),
    homeTeam,
    awayTeam,
    score: {
      home: fixture.goals?.home ?? 0,
      away: fixture.goals?.away ?? 0,
    },
    clock: buildMatchClock(fixture.fixture.status),
    statistics: context.statistics ?? null,
  } satisfies Match;
}

function normalizeTeam(
  team: ApiSportsTeam,
  league: League,
  standing?: ApiSportsStandingRow,
  metadata?: TeamMetadata | null,
) {
  const seed = getFallbackTeamSeed(team.name);
  const [primaryColor, secondaryColor] = seed
    ? [seed.primaryColor, seed.secondaryColor]
    : getTeamColors(team.id);
  const normalizedStanding = normalizeStanding(standing, seed);
  const normalizedForm = normalizeForm(standing, seed);

  return {
    id: seed?.id ?? String(team.id),
    name: team.name,
    shortName: seed?.shortName ?? buildShortTeamName(team.name),
    code: seed?.code ?? buildTeamCode(team.name),
    country: seed?.country ?? league.country,
    logoUrl: team.logo?.trim() || seed?.logoUrl || "",
    primaryColor,
    secondaryColor,
    coach:
      metadata?.coach ??
      buildUnavailableMetadata("Thông tin HLV chưa có trong dữ liệu hiện tại."),
    form: normalizedForm,
    standing: normalizedStanding,
    strengthRatings:
      seed?.strengthRatings ?? deriveStrengthRatings(normalizedStanding, normalizedForm),
    availabilityNotes: seed?.availabilityNotes ?? ([] satisfies readonly TeamAvailabilityNote[]),
  } satisfies Team;
}

function buildVenueMetadata(
  fixture: ApiSportsFixture,
  league: League,
): VenueMetadata {
  const venueName = normalizeOptionalText(fixture.fixture.venue?.name);
  const venueCity = normalizeOptionalText(fixture.fixture.venue?.city);
  const venueCountry = normalizeOptionalText(league.country);

  if (venueName) {
    return {
      name: venueName,
      city: venueCity,
      country: venueCountry,
      status: "available",
      note: null,
    };
  }

  if (venueCity) {
    return {
      name: null,
      city: venueCity,
      country: venueCountry,
      status: "partial",
      note: "Nguồn hiện tại mới có khu vực tổ chức, chưa có tên sân cụ thể.",
    };
  }

  return {
    name: null,
    city: null,
    country: venueCountry,
    status: "unavailable",
    note: "Chưa có dữ liệu sân đấu từ nguồn hiện tại.",
  };
}

function buildRefereeMetadata(
  fixture: ApiSportsFixture,
  status: MatchStatus,
): MetadataValue {
  const referee = normalizeOptionalText(fixture.fixture.referee);

  if (referee) {
    return buildAvailableMetadata(referee);
  }

  if (status === "scheduled" && isNearKickoff(fixture.fixture.date)) {
    return {
      value: null,
      status: "deferred",
      note: "Trọng tài thường được xác nhận gần giờ bóng lăn.",
    };
  }

  if (status === "scheduled") {
    return {
      value: null,
      status: "unavailable",
      note: "Trọng tài chưa được cung cấp cho trận này.",
    };
  }

  return {
    value: null,
    status: "not_covered",
    note: "Nguồn hiện tại chưa cung cấp trọng tài cho trận này.",
  };
}

function normalizeStanding(
  standing: ApiSportsStandingRow | undefined,
  seed: Team | undefined,
) {
  if (standing) {
    return {
      position: standing.rank,
      played: standing.all.played,
      won: standing.all.win,
      drawn: standing.all.draw,
      lost: standing.all.lose,
      goalsFor: standing.all.goals.for,
      goalsAgainst: standing.all.goals.against,
      goalDifference: standing.goalsDiff,
      points: standing.points,
    } satisfies TeamStanding;
  }

  return (
    seed?.standing ?? {
      position: 0,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    }
  );
}

function normalizeForm(standing: ApiSportsStandingRow | undefined, seed: Team | undefined) {
  if (standing) {
    const played = Math.max(standing.all.played, 1);
    const lastFive = parseFormSequence(standing.form) ?? seed?.form.lastFive ?? DEFAULT_FORM;

    return {
      lastFive,
      scoredInLastFive: Math.max(0, Math.round((standing.all.goals.for / played) * 5)),
      concededInLastFive: Math.max(0, Math.round((standing.all.goals.against / played) * 5)),
      cleanSheets: clampNumber(
        Math.round((1 - standing.all.goals.against / (played * 2)) * 5),
        0,
        5,
      ),
    } satisfies TeamForm;
  }

  return (
    seed?.form ?? {
      lastFive: [],
      scoredInLastFive: 0,
      concededInLastFive: 0,
      cleanSheets: 0,
    }
  );
}

function deriveStrengthRatings(standing: TeamStanding, form: TeamForm) {
  const played = Math.max(standing.played, 1);
  const pointsPerMatch = standing.points / played;
  const goalsForPerMatch = standing.goalsFor / played;
  const goalsAgainstPerMatch = standing.goalsAgainst / played;
  const recentWins = form.lastFive.filter((result) => result === "W").length;

  return {
    attack: clampNumber(Math.round(66 + goalsForPerMatch * 11 + recentWins * 2), 60, 94),
    midfield: clampNumber(Math.round(64 + pointsPerMatch * 12 + recentWins), 60, 92),
    defense: clampNumber(
      Math.round(64 + Math.max(0, 2 - goalsAgainstPerMatch) * 10 + standing.goalDifference / 4),
      60,
      92,
    ),
    transition: clampNumber(
      Math.round(64 + goalsForPerMatch * 6 + Math.max(0, standing.goalDifference) / 6),
      60,
      92,
    ),
    setPieces: clampNumber(Math.round(60 + recentWins * 3 + pointsPerMatch * 6), 58, 88),
  } satisfies TeamStrengthRatings;
}

function normalizeFixtureStatistics(
  fixture: ApiSportsFixture,
  blocks: readonly ApiSportsFixtureStatisticsBlock[],
) {
  const homeBlock = blocks.find((block) => block.team.id === fixture.teams.home.id);
  const awayBlock = blocks.find((block) => block.team.id === fixture.teams.away.id);

  if (!homeBlock || !awayBlock) {
    return null;
  }

  const home = normalizeTeamStatistics(homeBlock);
  const away = normalizeTeamStatistics(awayBlock);

  if (!home || !away) {
    return null;
  }

  const homePressureRaw = calculatePressureScore(home);
  const awayPressureRaw = calculatePressureScore(away);
  const totalPressure = Math.max(homePressureRaw + awayPressureRaw, 1);
  const homeTerritoryRaw = home.possession + home.passing.finalThirdEntries * 0.6;
  const awayTerritoryRaw = away.possession + away.passing.finalThirdEntries * 0.6;
  const totalTerritory = Math.max(homeTerritoryRaw + awayTerritoryRaw, 1);
  const homePressure = Math.round((homePressureRaw / totalPressure) * 100);
  const homeTerritory = Math.round((homeTerritoryRaw / totalTerritory) * 100);

  return {
    home,
    away,
    pressureIndex: {
      home: homePressure,
      away: 100 - homePressure,
    },
    territoryControl: {
      home: homeTerritory,
      away: 100 - homeTerritory,
    },
  } satisfies MatchStatistics;
}

function normalizeTeamStatistics(block: ApiSportsFixtureStatisticsBlock) {
  const hasCoreStats =
    hasStatValue(block, ["Ball Possession"]) &&
    (hasStatValue(block, ["Total Shots"]) ||
      hasStatValue(block, ["Shots on Goal"]) ||
      hasStatValue(block, ["Total passes"]));

  if (!hasCoreStats) {
    return null;
  }

  const possession = readPercentageStat(block, ["Ball Possession"]);
  const totalShots = readNumberStat(block, ["Total Shots"]);
  const onTarget = readNumberStat(block, ["Shots on Goal"]);
  const offTarget = readNumberStat(block, ["Shots off Goal"]);
  const insideBox = readNumberStat(block, ["Shots insidebox"]);
  const bigChances = readNumberStat(block, ["Big Chances"]);
  const expectedGoals = readNumberStat(block, ["Expected Goals"], true);
  const attemptedPasses = readNumberStat(block, ["Total passes"]);
  const accuratePasses = readNumberStat(block, ["Passes accurate"]);
  const passAccuracy = readPercentageStat(block, ["Passes %"]);
  const blockedShots = readNumberStat(block, ["Blocked Shots"]);
  const corners = readNumberStat(block, ["Corner Kicks"]);

  return {
    possession,
    shots: {
      total: totalShots,
      onTarget,
      offTarget,
      insideBox,
      bigChances,
      expectedGoals:
        expectedGoals || estimateExpectedGoals(totalShots, onTarget, bigChances),
    },
    passing: {
      attempted: attemptedPasses,
      completed: accuratePasses,
      accuracy: passAccuracy,
      progressivePasses: Math.max(0, Math.round(accuratePasses * 0.08)),
      finalThirdEntries: Math.max(insideBox * 2, corners * 3),
    },
    defensive: {
      tacklesWon: readNumberStat(block, ["Tackles"]),
      interceptions: readNumberStat(block, ["Interceptions"]),
      clearances: readNumberStat(block, ["Clearances"]),
      blocks: blockedShots,
      saves: readNumberStat(block, ["Goalkeeper Saves"]),
    },
    discipline: {
      fouls: readNumberStat(block, ["Fouls"]),
      yellowCards: readNumberStat(block, ["Yellow Cards"]),
      redCards: readNumberStat(block, ["Red Cards"]),
      offsides: readNumberStat(block, ["Offsides"]),
      corners,
    },
  } satisfies TeamMatchStatistics;
}

function calculatePressureScore(statistics: TeamMatchStatistics) {
  return (
    statistics.shots.total * 1.4 +
    statistics.shots.onTarget * 3.2 +
    statistics.shots.bigChances * 4 +
    statistics.discipline.corners * 1.6 +
    statistics.possession * 0.4 +
    statistics.passing.finalThirdEntries * 0.6
  );
}

function estimateExpectedGoals(
  totalShots: number,
  onTarget: number,
  bigChances: number,
) {
  return Number((onTarget * 0.22 + (totalShots - onTarget) * 0.05 + bigChances * 0.28).toFixed(2));
}

function readNumberStat(
  block: ApiSportsFixtureStatisticsBlock,
  aliases: readonly string[],
  allowDecimal = false,
) {
  const value = readStatValue(block, aliases);

  if (typeof value === "number") {
    return allowDecimal ? Number(value.toFixed(2)) : Math.round(value);
  }

  if (typeof value === "string") {
    const numericValue = Number.parseFloat(value.replace("%", "").trim());

    if (Number.isFinite(numericValue)) {
      return allowDecimal ? Number(numericValue.toFixed(2)) : Math.round(numericValue);
    }
  }

  return 0;
}

function readPercentageStat(
  block: ApiSportsFixtureStatisticsBlock,
  aliases: readonly string[],
) {
  return clampNumber(readNumberStat(block, aliases), 0, 100);
}

function readStatValue(
  block: ApiSportsFixtureStatisticsBlock,
  aliases: readonly string[],
) {
  const aliasKeys = new Set(aliases.map((alias) => normalizeLookupKey(alias)));

  for (const item of block.statistics) {
    const typeKey = normalizeLookupKey(item.type ?? "");

    if (aliasKeys.has(typeKey)) {
      return item.value ?? null;
    }
  }

  return null;
}

function hasStatValue(
  block: ApiSportsFixtureStatisticsBlock,
  aliases: readonly string[],
) {
  return readStatValue(block, aliases) !== null;
}

function buildHeadline({
  leagueName,
  homeTeamName,
  awayTeamName,
  status,
}: {
  leagueName: string;
  homeTeamName: string;
  awayTeamName: string;
  status: MatchStatus;
}) {
  if (status === "live") {
    return `${homeTeamName} và ${awayTeamName} đang tạo ra diễn biến đáng chú ý tại ${leagueName}.`;
  }

  if (status === "finished") {
    return `${homeTeamName} và ${awayTeamName} vừa khép lại màn so tài tại ${leagueName}.`;
  }

  if (status === "postponed") {
    return `${homeTeamName} và ${awayTeamName} chưa thể thi đấu đúng lịch tại ${leagueName}.`;
  }

  return `${homeTeamName} chạm trán ${awayTeamName} tại ${leagueName}.`;
}

function buildMatchClock(
  status: ApiSportsFixture["fixture"]["status"],
) {
  const shortStatus = status?.short?.trim().toUpperCase() ?? "";
  const minute = typeof status?.elapsed === "number" ? status.elapsed : null;
  const addedTime = typeof status?.extra === "number" ? status.extra : null;
  const phase = getMatchPhase(shortStatus);

  if (shortStatus === "HT") {
    return {
      minute,
      addedTime,
      phase,
      label: "Nghỉ giữa hiệp",
    } satisfies MatchClock;
  }

  if (LIVE_STATUS_CODES.has(shortStatus) && minute !== null) {
    const extra = addedTime ? `+${addedTime}` : "";

    return {
      minute,
      addedTime,
      phase,
      label: `${minute}${extra}'`,
    } satisfies MatchClock;
  }

  if (FINISHED_STATUS_CODES.has(shortStatus)) {
    return {
      minute,
      addedTime,
      phase,
      label: "Đã kết thúc",
    } satisfies MatchClock;
  }

  if (POSTPONED_STATUS_CODES.has(shortStatus)) {
    return {
      minute,
      addedTime,
      phase,
      label: "Hoãn",
    } satisfies MatchClock;
  }

  return {
    minute,
    addedTime,
    phase,
    label: translateStatusLongLabel(status?.long) ?? "Sắp diễn ra",
  } satisfies MatchClock;
}

function getMatchStatus(shortStatus: string | null | undefined): MatchStatus {
  const normalizedStatus = shortStatus?.trim().toUpperCase() ?? "";

  if (LIVE_STATUS_CODES.has(normalizedStatus)) {
    return "live";
  }

  if (FINISHED_STATUS_CODES.has(normalizedStatus)) {
    return "finished";
  }

  if (POSTPONED_STATUS_CODES.has(normalizedStatus)) {
    return "postponed";
  }

  return "scheduled";
}

function getMatchPhase(shortStatus: string): MatchPhase {
  if (shortStatus === "1H") {
    return "first-half";
  }

  if (shortStatus === "HT") {
    return "half-time";
  }

  if (LIVE_STATUS_CODES.has(shortStatus)) {
    return "second-half";
  }

  if (FINISHED_STATUS_CODES.has(shortStatus)) {
    return "full-time";
  }

  if (POSTPONED_STATUS_CODES.has(shortStatus)) {
    return "delayed";
  }

  return "pre-match";
}

function translateStatusLongLabel(value: string | null | undefined) {
  const normalizedValue = normalizeLookupKey(value ?? "");

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === "not started" || normalizedValue === "time to be defined") {
    return "Sắp diễn ra";
  }

  if (normalizedValue === "match finished") {
    return "Đã kết thúc";
  }

  if (normalizedValue === "halftime") {
    return "Nghỉ giữa hiệp";
  }

  if (normalizedValue === "postponed") {
    return "Hoãn";
  }

  return null;
}

async function fetchApiSportsResponse(
  path: string,
  searchParams: Record<string, string>,
  options?: {
    revalidateSeconds?: number;
  },
) {
  const config = getFootballApiConfig();

  if (!config.configured || !config.baseUrl || !config.apiKey) {
    throw new FootballApiError(getMissingConfigMessage(config), "missing-config");
  }

  const requestUrl = new URL(path, ensureTrailingSlash(config.baseUrl));

  for (const [key, value] of Object.entries(searchParams)) {
    requestUrl.searchParams.set(key, value);
  }

  let response: Response;

  try {
    response = await fetch(requestUrl, {
      headers: {
        "x-apisports-key": config.apiKey,
      },
      cache: options?.revalidateSeconds ? "force-cache" : "no-store",
      next: options?.revalidateSeconds
        ? { revalidate: options.revalidateSeconds }
        : undefined,
    });
  } catch {
    throw new FootballApiError(
      "Không thể kết nối tới API-Sports lúc này.",
      "request-failed",
    );
  }

  if (!response.ok) {
    throw new FootballApiError(
      `API-Sports phản hồi với mã lỗi ${response.status}.`,
      "request-failed",
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new FootballApiError(
      "API-Sports trả về phản hồi không phải JSON hợp lệ.",
      "invalid-response",
    );
  }

  if (!isRecord(payload) || !Array.isArray(payload.response)) {
    throw new FootballApiError(
      "API-Sports trả về cấu trúc dữ liệu không hợp lệ.",
      "invalid-response",
    );
  }

  return payload.response;
}

function getFootballApiConfig(): FootballApiConfig {
  const baseUrl = process.env.FOOTBALL_API_BASE_URL?.trim() || null;
  const apiKey = process.env.FOOTBALL_API_KEY?.trim() || null;

  return {
    baseUrl,
    apiKey,
    configured: Boolean(baseUrl && apiKey),
  };
}

function getFallbackMatchContext(matchId: string) {
  const match = fallbackMatches.find((item) => item.id === matchId);
  const league = match
    ? fallbackLeagues.find((item) => item.id === match.leagueId)
    : undefined;

  return {
    match,
    league,
    coverage: null,
  } satisfies FootballMatchContext;
}

function createFallbackResult<T>(
  data: T,
  fallbackReason: FootballFallbackReason,
  error: string,
) {
  return {
    data,
    source: "mock" as const,
    error,
    fallbackReason,
  };
}

function getMissingConfigMessage(config: FootballApiConfig) {
  const missingVariables = [
    !config.baseUrl ? "FOOTBALL_API_BASE_URL" : null,
    !config.apiKey ? "FOOTBALL_API_KEY" : null,
  ].filter((value): value is string => Boolean(value));

  return `Chưa cấu hình đầy đủ ${missingVariables.join(" và ")}. Ứng dụng đang dùng dữ liệu mô phỏng. Hãy cập nhật tệp .env.local để bật dữ liệu trực tiếp từ API-Sports.`;
}

function getFallbackMessage(fallbackReason: FootballFallbackReason) {
  if (fallbackReason === "missing-config") {
    return getMissingConfigMessage(getFootballApiConfig());
  }

  if (fallbackReason === "invalid-response") {
    return "API-Sports trả về dữ liệu chưa thể sử dụng. Ứng dụng đang tạm dùng dữ liệu mô phỏng để giữ trải nghiệm ổn định.";
  }

  return "Không thể tải dữ liệu trực tiếp từ API-Sports lúc này. Ứng dụng đang tạm dùng dữ liệu mô phỏng để bạn vẫn theo dõi được các trận đấu.";
}

function normalizeFootballApiError(error: unknown) {
  if (error instanceof FootballApiError) {
    return error;
  }

  return new FootballApiError(
    "Không thể tải dữ liệu trực tiếp từ API-Sports lúc này.",
    "request-failed",
  );
}

function prioritizeFixtures(fixtures: readonly ApiSportsFixture[]) {
  if (fixtures.length === 0) {
    return fixtures;
  }

  return [...fixtures].sort((left, right) => {
    const leftPriority = MAJOR_LEAGUE_PRIORITIES.get(left.league.id) ?? 999;
    const rightPriority = MAJOR_LEAGUE_PRIORITIES.get(right.league.id) ?? 999;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.fixture.date.localeCompare(right.fixture.date);
  });
}

function getInternalLeagueId(league: ApiSportsFixture["league"]) {
  return (
    getFallbackLeagueSeed(league.name, league.country)?.id ??
    `league-${league.id}`
  );
}

function getLeagueSeasonKey(leagueId: number, season: number) {
  return `${leagueId}:${season}`;
}

function getCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
) {
  if (!shouldUseInMemoryCache()) {
    return undefined;
  }

  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);

    return undefined;
  }

  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlSeconds: number,
) {
  if (!shouldUseInMemoryCache()) {
    return;
  }

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function shouldUseInMemoryCache() {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

function buildAvailableMetadata(value: string): MetadataValue {
  return {
    value,
    status: "available",
    note: null,
  };
}

function buildUnavailableMetadata(note: string): MetadataValue {
  return {
    value: null,
    status: "unavailable",
    note,
  };
}

function buildVenueMetadataFromTeamProfile(
  teamProfile: ApiSportsTeamProfile | null,
  fallbackCountry: string,
) {
  if (!teamProfile?.venue?.name && !teamProfile?.venue?.city) {
    return null;
  }

  return {
    name: teamProfile.venue?.name ?? null,
    city: teamProfile.venue?.city ?? null,
    country: teamProfile.country ?? fallbackCountry,
    status: "partial",
    note: "Tham chiếu từ hồ sơ đội bóng, chưa phải xác nhận riêng cho từng trận.",
  } satisfies VenueMetadata;
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function isNearKickoff(kickoffTime: string) {
  const kickoffTimestamp = new Date(kickoffTime).getTime();

  if (Number.isNaN(kickoffTimestamp)) {
    return false;
  }

  const diffMinutes = (kickoffTimestamp - Date.now()) / 60000;

  return diffMinutes >= 0 && diffMinutes <= 120;
}

function getFallbackTeamSeed(teamName: string) {
  return fallbackTeamSeedsByName.get(normalizeLookupKey(teamName));
}

function getFallbackLeagueSeed(
  leagueName: string,
  leagueCountry?: string | null,
) {
  const seed = fallbackLeagueSeedsByName.get(normalizeLookupKey(leagueName));

  if (!seed || !leagueCountry?.trim()) {
    return undefined;
  }

  return normalizeLookupKey(seed.country) === normalizeLookupKey(leagueCountry)
    ? seed
    : undefined;
}

function getCurrentUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function shiftUtcDate(date: string, days: number) {
  const nextDate = new Date(`${date}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return nextDate.toISOString().slice(0, 10);
}

function formatSeasonLabel(season: number) {
  const nextSeason = String((season + 1) % 100).padStart(2, "0");

  return `${season}/${nextSeason}`;
}

function translateRoundLabel(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const trimmedValue = value.trim();
  const matchweekMatch = trimmedValue.match(/^matchweek\s+(\d+)$/i);

  if (matchweekMatch) {
    return `Vòng ${matchweekMatch[1]}`;
  }

  const regularSeasonMatch = trimmedValue.match(/^regular season\s*-\s*(\d+)$/i);

  if (regularSeasonMatch) {
    return `Vòng ${regularSeasonMatch[1]}`;
  }

  const roundMatch = trimmedValue.match(/^round\s+(\d+)$/i);

  if (roundMatch) {
    return `Vòng ${roundMatch[1]}`;
  }

  if (/^round of 16$/i.test(trimmedValue)) {
    return "Vòng 16 đội";
  }

  if (/^quarter[- ]finals?$/i.test(trimmedValue)) {
    return "Tứ kết";
  }

  if (/^semi[- ]finals?$/i.test(trimmedValue)) {
    return "Bán kết";
  }

  if (/^final$/i.test(trimmedValue)) {
    return "Chung kết";
  }

  return trimmedValue;
}

function parseApiSportsFixture(value: unknown): ApiSportsFixture | null {
  if (!isRecord(value) || !isRecord(value.fixture) || !isRecord(value.league) || !isRecord(value.teams)) {
    return null;
  }

  const homeTeam = parseApiSportsTeam(value.teams.home);
  const awayTeam = parseApiSportsTeam(value.teams.away);

  if (
    typeof value.fixture.id !== "number" ||
    typeof value.fixture.date !== "string" ||
    !homeTeam ||
    !awayTeam ||
    typeof value.league.id !== "number" ||
    typeof value.league.name !== "string" ||
    typeof value.league.season !== "number"
  ) {
    return null;
  }

  return {
    fixture: {
      id: value.fixture.id,
      referee: typeof value.fixture.referee === "string" ? value.fixture.referee : null,
      date: value.fixture.date,
      venue: isRecord(value.fixture.venue)
        ? {
            name:
              typeof value.fixture.venue.name === "string" ? value.fixture.venue.name : null,
            city:
              typeof value.fixture.venue.city === "string" ? value.fixture.venue.city : null,
          }
        : null,
      status: isRecord(value.fixture.status)
        ? {
            long: typeof value.fixture.status.long === "string" ? value.fixture.status.long : null,
            short:
              typeof value.fixture.status.short === "string" ? value.fixture.status.short : null,
            elapsed:
              typeof value.fixture.status.elapsed === "number"
                ? value.fixture.status.elapsed
                : null,
            extra:
              typeof value.fixture.status.extra === "number"
                ? value.fixture.status.extra
                : null,
          }
        : null,
    },
    league: {
      id: value.league.id,
      name: value.league.name,
      country: typeof value.league.country === "string" ? value.league.country : null,
      logo: typeof value.league.logo === "string" ? value.league.logo : null,
      season: value.league.season,
      round: typeof value.league.round === "string" ? value.league.round : null,
    },
    teams: {
      home: homeTeam,
      away: awayTeam,
    },
    goals: isRecord(value.goals)
      ? {
          home: typeof value.goals.home === "number" ? value.goals.home : null,
          away: typeof value.goals.away === "number" ? value.goals.away : null,
        }
      : null,
  };
}

function parseApiSportsTeam(value: unknown): ApiSportsTeam | null {
  if (!isRecord(value) || typeof value.id !== "number" || typeof value.name !== "string") {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    logo: typeof value.logo === "string" ? value.logo : null,
  };
}

function parseApiSportsStandingRow(value: unknown): ApiSportsStandingRow | null {
  if (!isRecord(value) || !isRecord(value.all) || !isRecord(value.all.goals)) {
    return null;
  }

  const team = parseApiSportsTeam(value.team);

  if (
    !team ||
    typeof value.rank !== "number" ||
    typeof value.points !== "number" ||
    typeof value.goalsDiff !== "number" ||
    typeof value.all.played !== "number" ||
    typeof value.all.win !== "number" ||
    typeof value.all.draw !== "number" ||
    typeof value.all.lose !== "number" ||
    typeof value.all.goals.for !== "number" ||
    typeof value.all.goals.against !== "number"
  ) {
    return null;
  }

  return {
    rank: value.rank,
    team,
    points: value.points,
    goalsDiff: value.goalsDiff,
    form: typeof value.form === "string" ? value.form : null,
    all: {
      played: value.all.played,
      win: value.all.win,
      draw: value.all.draw,
      lose: value.all.lose,
      goals: {
        for: value.all.goals.for,
        against: value.all.goals.against,
      },
    },
  };
}

function parseFixtureStatisticsBlock(value: unknown): ApiSportsFixtureStatisticsBlock | null {
  if (!isRecord(value) || !isRecord(value.team) || !Array.isArray(value.statistics)) {
    return null;
  }

  if (typeof value.team.id !== "number" || typeof value.team.name !== "string") {
    return null;
  }

  return {
    team: {
      id: value.team.id,
      name: value.team.name,
    },
    statistics: value.statistics.map((item) =>
      isRecord(item)
        ? {
            type: typeof item.type === "string" ? item.type : null,
            value:
              typeof item.value === "string" || typeof item.value === "number"
                ? item.value
                : null,
          }
        : {
            type: null,
            value: null,
          },
    ),
  };
}

function parseLeagueCoverage(
  value: unknown,
  leagueId: number,
  season: number,
): LeagueCoverage | null {
  if (!isRecord(value) || !Array.isArray(value.seasons)) {
    return null;
  }

  for (const item of value.seasons) {
    if (!isRecord(item) || item.year !== season || !isRecord(item.coverage)) {
      continue;
    }

    const fixtureCoverage = isRecord(item.coverage.fixtures)
      ? item.coverage.fixtures
      : null;

    return {
      leagueId,
      season,
      standings: readBooleanValue(item.coverage.standings),
      fixtureStatistics: fixtureCoverage
        ? readBooleanValue(fixtureCoverage.statistics_fixtures)
        : null,
      events: fixtureCoverage ? readBooleanValue(fixtureCoverage.events) : null,
      lineups: fixtureCoverage ? readBooleanValue(fixtureCoverage.lineups) : null,
      players: readBooleanValue(item.coverage.players),
    };
  }

  return null;
}

function parseTeamProfile(value: unknown): ApiSportsTeamProfile | null {
  if (!isRecord(value) || !isRecord(value.team)) {
    return null;
  }

  if (typeof value.team.id !== "number" || typeof value.team.name !== "string") {
    return null;
  }

  return {
    id: value.team.id,
    name: value.team.name,
    country: typeof value.team.country === "string" ? value.team.country : null,
    venue: isRecord(value.venue)
      ? {
          name: typeof value.venue.name === "string" ? value.venue.name : null,
          city: typeof value.venue.city === "string" ? value.venue.city : null,
        }
      : null,
  };
}

function parseCoachProfile(value: unknown): ApiSportsCoachProfile | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  return {
    id: typeof value.id === "number" ? value.id : null,
    name: value.name,
  };
}

function parseFormSequence(value: string | null | undefined) {
  const results = value
    ?.trim()
    .split("")
    .filter((result): result is FormResult => result === "W" || result === "D" || result === "L")
    .slice(-5);

  if (!results || results.length === 0) {
    return null;
  }

  if (results.length >= 5) {
    return results as readonly FormResult[];
  }

  return [...DEFAULT_FORM.slice(0, 5 - results.length), ...results] as readonly FormResult[];
}

function buildShortTeamName(name: string) {
  const trimmedName = name.trim();

  if (trimmedName.length <= 20) {
    return trimmedName;
  }

  const words = trimmedName.split(/\s+/).filter(Boolean);
  const firstThreeWords = words.slice(0, 3).join(" ");

  if (firstThreeWords.length > 0 && firstThreeWords.length <= 24) {
    return firstThreeWords;
  }

  const firstTwoWords = words.slice(0, 2).join(" ");

  if (firstTwoWords.length > 0) {
    return firstTwoWords;
  }

  return trimmedName;
}

function buildTeamCode(name: string) {
  const significantWords = name
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter((word) => word.length > 0 && !["FC", "CF", "SC", "AC"].includes(word.toUpperCase()));

  if (significantWords.length >= 3) {
    return significantWords
      .slice(0, 3)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
  }

  return significantWords.join("").slice(0, 3).toUpperCase().padEnd(3, "X");
}

function getTeamColors(teamId: number) {
  return DEFAULT_TEAM_COLOR_PAIRS[Math.abs(teamId) % DEFAULT_TEAM_COLOR_PAIRS.length];
}

function normalizeLookupKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value: string) {
  return normalizeLookupKey(value).replace(/\s+/g, "-");
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isNumericIdentifier(value: string) {
  return /^\d+$/.test(value.trim());
}

function readBooleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
