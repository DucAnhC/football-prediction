import type { FootballDataSource, LeagueCoverage } from "@/lib/api";
import {
  formatInteger,
  formatMetadataNote,
  formatMetadataValue,
  formatPercentage,
  formatScoreValue,
  formatText,
  formatUtcDateTime,
  formatVenueLocation,
  hasStandingData,
} from "@/lib/utils";
import type { League, Match, MatchStatus } from "@/types/match";
import type { MetadataStatus, MetadataValue, VenueMetadata } from "@/types/metadata";
import type { MatchPrediction } from "@/types/prediction";
import type { Team } from "@/types/team";

export type CompetitionDisplayTier = "major" | "standard" | "limited";
export type PredictionDisplayTier = "strong" | "medium" | "weak";
export type BadgeTone = "positive" | "info" | "warning" | "muted";

export interface DisplayBadgeViewModel {
  label: string;
  tone: BadgeTone;
}

export interface MatchTeamViewModel {
  code: string;
  name: string;
  supportLabel: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface MatchCompactFieldViewModel {
  label: string;
  value: string;
  note: string | null;
  state: MetadataStatus;
}

export interface HomepageMatchCardViewModel {
  id: string;
  href: string;
  competitionLabel: string;
  roundLabel: string;
  kickoffLabel: string;
  title: string;
  statusBadge: DisplayBadgeViewModel;
  sourceBadge: DisplayBadgeViewModel;
  qualityBadge: DisplayBadgeViewModel;
  homeTeam: MatchTeamViewModel;
  awayTeam: MatchTeamViewModel;
  scoreLabel: string;
  clockLabel: string;
  venueField: MatchCompactFieldViewModel | null;
  contextNote: string | null;
  insightBadge: DisplayBadgeViewModel | null;
}

export type MatchListCardViewModel = HomepageMatchCardViewModel;

export interface MatchDetailFieldViewModel {
  label: string;
  value: string;
  note: string | null;
  state: MetadataStatus;
}

export interface MatchDetailViewModel {
  competitionLabel: string;
  roundLabel: string;
  title: string;
  headline: string;
  kickoffLabel: string;
  statusBadge: DisplayBadgeViewModel;
  sourceBadge: DisplayBadgeViewModel;
  qualityBadge: DisplayBadgeViewModel;
  dataQualityNote: string;
  scoreLabel: string;
  clockLabel: string;
  coverageNotice: string | null;
  statisticsDescription: string;
  metadataFields: {
    venue: MatchDetailFieldViewModel;
    location: MatchDetailFieldViewModel;
    referee: MatchDetailFieldViewModel;
    homeCoach: MatchDetailFieldViewModel;
    awayCoach: MatchDetailFieldViewModel;
  };
}

export interface PredictionHighlightViewModel {
  id: string;
  title: string;
  subtitle: string;
  updatedLabel: string;
  sourceBadge: DisplayBadgeViewModel;
  tierBadge: DisplayBadgeViewModel;
  confidenceLabel: string;
  confidenceText: string;
  summary: string;
  note: string;
  chips: readonly string[];
}

const STRONG_INSIGHT_MIN_SCORE = 75;
const MEDIUM_INSIGHT_MIN_SCORE = 60;
const MAJOR_LEAGUE_PRIORITY_LIMIT = 20;
const LIMITED_COMPETITION_PATTERNS = [
  /\bfriendly\b/i,
  /\bfriendlies\b/i,
  /\breserve\b/i,
  /\breserves\b/i,
  /\byouth\b/i,
  /\bu(?:17|18|19|20|21|23)\b/i,
] as const;

const statusCopy = {
  live: "Trực tiếp",
  scheduled: "Sắp diễn ra",
  finished: "Đã kết thúc",
  postponed: "Hoãn",
} as const satisfies Record<MatchStatus, string>;

const confidenceCopy = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
} as const;

const predictionOutcomeCopy = {
  "home-win": "Chủ nhà nhỉnh hơn",
  draw: "Kịch bản hòa",
  "away-win": "Đội khách nhỉnh hơn",
} as const;

const predictionGoalsCopy = {
  "over-2.5": "Tài 2.5",
  "under-2.5": "Xỉu 2.5",
} as const;

interface CompactCardInput {
  match: Match;
  league?: League;
  kickoffLabel?: string;
  dataSource: FootballDataSource;
  prediction?: MatchPrediction;
  variant: "homepage" | "list";
}

export function buildHomepageMatchCardViewModel(
  input: Omit<CompactCardInput, "variant">,
): HomepageMatchCardViewModel {
  return buildCompactMatchCardViewModel({
    ...input,
    variant: "homepage",
  });
}

export function buildMatchListCardViewModel(
  input: Omit<CompactCardInput, "variant" | "prediction">,
): MatchListCardViewModel {
  return buildCompactMatchCardViewModel({
    ...input,
    variant: "list",
  });
}

export function buildMatchDetailViewModel({
  match,
  league,
  source,
  coverage,
}: {
  match: Match;
  league?: League;
  source: FootballDataSource;
  coverage: Pick<LeagueCoverage, "fixtureStatistics" | "standings"> | null;
}): MatchDetailViewModel {
  const qualityBadge = buildDataQualityBadge({
    match,
    league,
    dataSource: source,
    coverage,
  });

  return {
    competitionLabel: league?.name ?? "Chưa rõ giải đấu",
    roundLabel: formatRoundLabel(match.round),
    title: `${match.homeTeam.shortName} gặp ${match.awayTeam.shortName}`,
    headline: formatText(match.headline, "Chưa có mô tả ngắn cho trận đấu này."),
    kickoffLabel: formatUtcDateTime(match.kickoffTime),
    statusBadge: buildStatusBadge(match.status),
    sourceBadge: buildSourceBadge(source),
    qualityBadge,
    dataQualityNote: buildDetailQualityNote(qualityBadge, source),
    scoreLabel: buildScoreLabel(match),
    clockLabel: buildClockLabel(match),
    coverageNotice: buildCoverageNotice(source, coverage),
    statisticsDescription: buildStatisticsDescription(match, source, coverage),
    metadataFields: {
      venue: buildVenueField(match.venue),
      location: buildLocationField(match.venue),
      referee: buildRefereeField(match.referee),
      homeCoach: buildCoachField(match.homeTeam, "Đội chủ nhà"),
      awayCoach: buildCoachField(match.awayTeam, "Đội khách"),
    },
  };
}

export function buildPredictionHighlightViewModel({
  match,
  league,
  prediction,
  updatedLabel,
}: {
  match: Match;
  league?: League;
  prediction: MatchPrediction;
  updatedLabel: string;
}): PredictionHighlightViewModel {
  const tier = getPredictionDisplayTier(prediction);

  return {
    id: prediction.id,
    title: `${match.homeTeam.shortName} gặp ${match.awayTeam.shortName}`,
    subtitle: `${league?.name ?? prediction.input.leagueName} - ${formatRoundLabel(
      prediction.input.round,
    )}`,
    updatedLabel,
    sourceBadge:
      prediction.source === "mock"
        ? { label: "Dữ liệu mô phỏng", tone: "warning" }
        : { label: "Từ AI", tone: "positive" },
    tierBadge: buildPredictionTierBadge(tier),
    confidenceLabel: formatPercentage(prediction.output.confidence_score, {
      fallback: "Chưa rõ",
    }),
    confidenceText: confidenceCopy[prediction.output.confidence],
    summary: formatText(prediction.output.summary),
    note:
      tier === "strong"
        ? "Đủ tín hiệu để đẩy lên nhóm nổi bật."
        : "Có dữ liệu dự đoán, nhưng hiện chỉ nên đọc như nhận định tham khảo.",
    chips: [
      predictionOutcomeCopy[prediction.output.suggested_prediction.outcome],
      predictionGoalsCopy[prediction.output.suggested_prediction.goals],
      `Tỷ số dễ thấy ${prediction.output.suggested_prediction.likely_scoreline}`,
    ],
  };
}

export function getPredictionDisplayTier(prediction: MatchPrediction): PredictionDisplayTier {
  if (
    prediction.output.confidence_score >= STRONG_INSIGHT_MIN_SCORE &&
    prediction.output.confidence === "high"
  ) {
    return "strong";
  }

  if (
    prediction.output.confidence_score >= MEDIUM_INSIGHT_MIN_SCORE &&
    prediction.output.confidence !== "low"
  ) {
    return "medium";
  }

  return "weak";
}

export function getCompetitionDisplayTier(league?: League): CompetitionDisplayTier {
  if (!league) {
    return "standard";
  }

  if (league.priority <= MAJOR_LEAGUE_PRIORITY_LIMIT) {
    return "major";
  }

  if (LIMITED_COMPETITION_PATTERNS.some((pattern) => pattern.test(league.name))) {
    return "limited";
  }

  return "standard";
}

function buildCompactMatchCardViewModel({
  match,
  league,
  kickoffLabel = formatUtcDateTime(match.kickoffTime),
  dataSource,
  prediction,
  variant,
}: CompactCardInput): HomepageMatchCardViewModel {
  const competitionTier = getCompetitionDisplayTier(league);
  const qualityBadge = buildDataQualityBadge({
    match,
    league,
    dataSource,
    prediction: variant === "homepage" ? prediction : undefined,
    coverage: null,
  });

  return {
    id: match.id,
    href: `/matches/${match.id}`,
    competitionLabel: league?.name ?? "Chưa rõ giải đấu",
    roundLabel: formatRoundLabel(match.round),
    kickoffLabel,
    title: `${match.homeTeam.shortName} gặp ${match.awayTeam.shortName}`,
    statusBadge: buildStatusBadge(match.status),
    sourceBadge: buildSourceBadge(dataSource),
    qualityBadge,
    homeTeam: buildCompactTeamViewModel(match.homeTeam, competitionTier),
    awayTeam: buildCompactTeamViewModel(match.awayTeam, competitionTier),
    scoreLabel: buildScoreLabel(match),
    clockLabel: buildClockLabel(match),
    venueField: buildCompactVenueField(match.venue, competitionTier),
    contextNote: buildCompactContextNote(qualityBadge, dataSource, match.status),
    insightBadge:
      variant === "homepage" && match.status === "scheduled" && prediction
        ? buildPredictionTierBadge(getPredictionDisplayTier(prediction))
        : null,
  };
}

function buildCompactTeamViewModel(
  team: Team,
  competitionTier: CompetitionDisplayTier,
): MatchTeamViewModel {
  return {
    code: team.code,
    name: team.shortName,
    supportLabel: buildCompactTeamSupportLabel(team, competitionTier),
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
  };
}

function buildCompactTeamSupportLabel(
  team: Team,
  competitionTier: CompetitionDisplayTier,
) {
  if (hasStandingData(team.standing) && team.standing.position > 0) {
    if (competitionTier === "major") {
      return `Hạng ${formatInteger(team.standing.position)}`;
    }

    if (team.standing.points > 0) {
      return `${formatInteger(team.standing.points)} điểm`;
    }
  }

  return formatText(team.country, "Đội bóng");
}

function buildDataQualityBadge({
  match,
  league,
  dataSource,
  prediction,
  coverage,
}: {
  match: Match;
  league?: League;
  dataSource: FootballDataSource;
  prediction?: MatchPrediction;
  coverage: Pick<LeagueCoverage, "fixtureStatistics" | "standings"> | null;
}): DisplayBadgeViewModel {
  if (dataSource === "mock") {
    return {
      label: "Dữ liệu dự phòng",
      tone: "warning",
    };
  }

  const competitionTier = getCompetitionDisplayTier(league);
  const venueState = getVenueState(match.venue);
  const metadataStates = [
    venueState,
    match.referee.status,
    match.homeTeam.coach.status,
    match.awayTeam.coach.status,
  ];
  const availableCount = metadataStates.filter((state) => state === "available").length;
  const partialCount = metadataStates.filter((state) => state === "partial").length;
  const limitedLiveContext =
    match.status === "live" &&
    (competitionTier === "limited" || coverage?.fixtureStatistics === false);

  if (limitedLiveContext) {
    return {
      label: "Chỉ có dữ liệu trực tiếp",
      tone: "info",
    };
  }

  if (
    match.status === "scheduled" &&
    prediction &&
    getPredictionDisplayTier(prediction) !== "weak"
  ) {
    return {
      label: "Insight tham khảo",
      tone: "info",
    };
  }

  if (match.statistics && availableCount >= 2) {
    return {
      label: "Đủ dữ liệu",
      tone: "positive",
    };
  }

  if (availableCount > 0 || partialCount > 0) {
    return {
      label: "Thiếu metadata",
      tone: "warning",
    };
  }

  return {
    label: "Dữ liệu cơ bản",
    tone: "muted",
  };
}

function buildCompactVenueField(
  venue: VenueMetadata,
  competitionTier: CompetitionDisplayTier,
): MatchCompactFieldViewModel | null {
  const venueState = getVenueState(venue);

  if (competitionTier === "limited") {
    return null;
  }

  if (venueState === "available") {
    return {
      label: "Sân",
      value: formatText(venue.name, "Chưa rõ sân đấu"),
      note: formatVenueLocation(venue, ""),
      state: venueState,
    };
  }

  if (venueState === "partial") {
    return {
      label: "Địa điểm",
      value: formatVenueLocation(venue, "Chưa rõ địa điểm"),
      note: formatMetadataNote(
        { value: null, status: venueState, note: venue.note },
        "Chưa có tên sân cụ thể.",
      ),
      state: venueState,
    };
  }

  return null;
}

function buildCompactContextNote(
  qualityBadge: DisplayBadgeViewModel,
  dataSource: FootballDataSource,
  status: MatchStatus,
) {
  if (dataSource === "mock") {
    return "Đang dùng dữ liệu dự phòng để duy trì trải nghiệm ổn định.";
  }

  if (qualityBadge.label === "Chỉ có dữ liệu trực tiếp") {
    return "Ưu tiên tỷ số và thời gian thực, chưa mở rộng metadata phụ.";
  }

  if (qualityBadge.label === "Thiếu metadata") {
    return "Tỷ số và lịch thi đấu vẫn ổn, nhưng metadata phụ chưa đủ đầy.";
  }

  if (qualityBadge.label === "Insight tham khảo") {
    return "Có dữ liệu trước trận, nhưng chưa nên đọc như một kèo chắc chắn.";
  }

  if (status === "finished") {
    return "Trang này giữ trọng tâm vào tỷ số và bối cảnh cốt lõi sau trận.";
  }

  return null;
}

function buildVenueField(venue: VenueMetadata): MatchDetailFieldViewModel {
  const state = getVenueState(venue);

  if (state === "available") {
    return {
      label: "Sân đấu",
      value: formatText(venue.name, "Chưa rõ sân đấu"),
      note: formatVenueLocation(venue, ""),
      state,
    };
  }

  if (state === "partial") {
    return {
      label: "Sân đấu",
      value: "Chưa có tên sân cụ thể",
      note: formatText(venue.note, "Nguồn hiện tại mới có khu vực tổ chức."),
      state,
    };
  }

  return {
    label: "Sân đấu",
    value: state === "not_covered" ? "Nguồn chưa cung cấp" : "Chưa có dữ liệu sân đấu",
    note: formatText(venue.note, "Chưa có dữ liệu sân đấu từ nguồn hiện tại."),
    state,
  };
}

function buildLocationField(venue: VenueMetadata): MatchDetailFieldViewModel {
  const state = getVenueState(venue);
  const locationLabel = formatVenueLocation(venue, "");

  if (locationLabel) {
    return {
      label: "Địa điểm",
      value: locationLabel,
      note:
        state === "partial"
          ? "Nguồn hiện tại mới xác nhận ở mức khu vực tổ chức."
          : null,
      state,
    };
  }

  return {
    label: "Địa điểm",
    value: "Chưa có dữ liệu địa điểm",
    note: formatText(venue.note, "Chưa có dữ liệu địa điểm từ nguồn hiện tại."),
    state,
  };
}

function buildRefereeField(referee: MetadataValue): MatchDetailFieldViewModel {
  if (referee.status === "available") {
    return {
      label: "Trọng tài",
      value: formatMetadataValue(referee, "Chưa có dữ liệu trọng tài"),
      note: "Nguồn hiện tại đã có thông tin trọng tài cho trận này.",
      state: referee.status,
    };
  }

  if (referee.status === "deferred") {
    return {
      label: "Trọng tài",
      value: "Chờ xác nhận sát giờ bóng lăn",
      note: formatMetadataNote(referee, "Trọng tài thường được xác nhận gần giờ bóng lăn."),
      state: referee.status,
    };
  }

  return {
    label: "Trọng tài",
    value:
      referee.status === "not_covered"
        ? "Nguồn chưa cung cấp"
        : "Chưa có dữ liệu trọng tài",
    note: formatMetadataNote(referee, "Trọng tài chưa được cung cấp cho trận này."),
    state: referee.status,
  };
}

function buildCoachField(
  team: Team,
  teamLabel: string,
): MatchDetailFieldViewModel {
  if (team.coach.status === "available") {
    return {
      label: `HLV ${teamLabel.toLowerCase()}`,
      value: formatMetadataValue(team.coach, "Chưa có thông tin HLV"),
      note: `${teamLabel}: ${team.shortName}`,
      state: team.coach.status,
    };
  }

  return {
    label: `HLV ${teamLabel.toLowerCase()}`,
    value:
      team.coach.status === "not_covered"
        ? "Nguồn chưa cung cấp"
        : team.coach.status === "deferred"
          ? "Chờ cập nhật"
          : "Chưa có thông tin HLV",
    note: formatMetadataNote(
      team.coach,
      "Thông tin HLV chưa có trong dữ liệu hiện tại.",
    ),
    state: team.coach.status,
  };
}

function buildDetailQualityNote(
  qualityBadge: DisplayBadgeViewModel,
  source: FootballDataSource,
) {
  if (source === "mock") {
    return "Trang chi tiết đang chạy bằng dữ liệu dự phòng, nên chỉ nên dùng để theo dõi nhanh và đối chiếu sơ bộ.";
  }

  if (qualityBadge.label === "Đủ dữ liệu") {
    return "Trang này có đủ dữ liệu cốt lõi và phần metadata chính để theo dõi trận đấu một cách rõ ràng hơn.";
  }

  if (qualityBadge.label === "Thiếu metadata") {
    return "Tỷ số, thời gian và bối cảnh chính vẫn dùng được, nhưng một phần metadata phụ chưa được nguồn hiện tại gửi về.";
  }

  if (qualityBadge.label === "Chỉ có dữ liệu trực tiếp") {
    return "Giải đấu này hiện chủ yếu có dữ liệu tỷ số và trạng thái trực tiếp, nên các phần mở rộng được giữ ở mức tối thiểu.";
  }

  if (qualityBadge.label === "Insight tham khảo") {
    return "Phần trước trận có tín hiệu dữ liệu, nhưng vẫn nên đọc như nhận định tham khảo thay vì một khẳng định chắc chắn.";
  }

  return "Trang đang ưu tiên dữ liệu cốt lõi và chỉ mở rộng khi thông tin thật sự sẵn có.";
}

function buildStatisticsDescription(
  match: Match,
  source: FootballDataSource,
  coverage: Pick<LeagueCoverage, "fixtureStatistics" | "standings"> | null,
) {
  if (match.statistics) {
    return "So sánh các chỉ số nổi bật của trận đấu hiện tại.";
  }

  if (source === "mock") {
    return "Dữ liệu chi tiết đang ở chế độ mô phỏng, nên phần so sánh tạm dựa trên phong độ và vị trí hiện có.";
  }

  if (coverage?.fixtureStatistics === false) {
    return "Nguồn hiện tại chưa phủ thống kê trận cho giải này, nên phần so sánh tạm dựa vào phong độ và bảng xếp hạng.";
  }

  return "Chưa có thống kê trực tiếp, nên trang chỉ giữ phần bối cảnh ở mức an toàn và dễ hiểu.";
}

function buildCoverageNotice(
  source: FootballDataSource,
  coverage: Pick<LeagueCoverage, "fixtureStatistics" | "standings"> | null,
) {
  if (source !== "api" || !coverage) {
    return null;
  }

  if (coverage.fixtureStatistics === false && coverage.standings === false) {
    return "Nguồn hiện tại không phủ đầy đủ thống kê trận và bảng xếp hạng cho giải này, nên trang đang hiển thị bối cảnh ở mức tối thiểu.";
  }

  if (coverage.fixtureStatistics === false) {
    return "Nguồn hiện tại chưa có thống kê trận cho giải này, nên một số chỉ số chi tiết sẽ vắng mặt.";
  }

  return null;
}

function buildPredictionTierBadge(tier: PredictionDisplayTier): DisplayBadgeViewModel {
  if (tier === "strong") {
    return {
      label: "Điểm nhấn",
      tone: "positive",
    };
  }

  if (tier === "medium") {
    return {
      label: "Tham khảo",
      tone: "info",
    };
  }

  return {
    label: "Tín hiệu yếu",
    tone: "warning",
  };
}

function buildStatusBadge(status: MatchStatus): DisplayBadgeViewModel {
  return {
    label: statusCopy[status],
    tone:
      status === "live"
        ? "warning"
        : status === "scheduled"
          ? "info"
          : status === "finished"
            ? "positive"
            : "muted",
  };
}

function buildSourceBadge(source: FootballDataSource): DisplayBadgeViewModel {
  return source === "api"
    ? {
        label: "Dữ liệu trực tiếp",
        tone: "positive",
      }
    : {
        label: "Dữ liệu mô phỏng",
        tone: "warning",
      };
}

function buildScoreLabel(match: Match) {
  if (match.status === "scheduled" || match.status === "postponed") {
    return "- : -";
  }

  return `${formatScoreValue(match.score.home)} : ${formatScoreValue(match.score.away)}`;
}

function buildClockLabel(match: Match) {
  if (match.status === "scheduled") {
    return "Sắp diễn ra";
  }

  if (match.status === "finished") {
    return "Đã kết thúc";
  }

  if (match.status === "postponed") {
    return "Hoãn";
  }

  return formatText(match.clock.label, "Đang cập nhật");
}

function getVenueState(venue: VenueMetadata): MetadataStatus {
  if (venue.status === "available" || venue.status === "partial") {
    return venue.status;
  }

  if (formatText(venue.name, "")) {
    return "available";
  }

  if (formatText(venue.city, "")) {
    return "partial";
  }

  return venue.status;
}

function formatRoundLabel(value: string) {
  return value.replace("Matchweek", "Vòng");
}
