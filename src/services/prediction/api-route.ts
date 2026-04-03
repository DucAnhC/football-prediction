import { getMatchByIdWithFallback } from "@/lib/api";
import { buildPrediction } from "@/services/prediction/ai-prediction-service";
import type { Match, MatchPhase, MatchStatus } from "@/types/match";
import type { MetadataValue, VenueMetadata } from "@/types/metadata";
import type { MatchPrediction } from "@/types/prediction";
import type { MatchStatistics } from "@/types/statistics";
import type { FormResult, Team } from "@/types/team";

export interface PredictionApiError {
  status: number;
  message: string;
}

type PredictionApiResult =
  | { prediction: MatchPrediction }
  | { error: PredictionApiError };

const MATCH_STATUSES: readonly MatchStatus[] = [
  "scheduled",
  "live",
  "finished",
  "postponed",
];
const MATCH_PHASES: readonly MatchPhase[] = [
  "pre-match",
  "first-half",
  "half-time",
  "second-half",
  "full-time",
  "delayed",
];
const FORM_RESULTS: readonly FormResult[] = ["W", "D", "L"];
const AVAILABILITY_STATUSES = ["out", "doubtful", "suspended"] as const;
const METADATA_STATUSES = [
  "available",
  "partial",
  "unavailable",
  "not_covered",
  "deferred",
] as const;

export async function buildPredictionFromMatchId(
  matchId: string | null,
): Promise<PredictionApiResult> {
  if (!matchId?.trim()) {
    return {
      error: {
        status: 400,
        message: "Vui lòng cung cấp matchId hợp lệ để lấy dự đoán.",
      },
    };
  }

  const matchResult = await getMatchByIdWithFallback(matchId.trim());
  const match = matchResult.data;

  if (!match) {
    if (matchResult.error && /^\d+$/.test(matchId.trim())) {
      return {
        error: {
          status: 503,
          message: matchResult.error,
        },
      };
    }

    return {
      error: {
        status: 404,
        message: "Không tìm thấy trận đấu từ matchId đã cung cấp.",
      },
    };
  }

  return {
    prediction: await buildPrediction(match),
  };
}

export async function buildPredictionFromPayload(
  body: unknown,
): Promise<PredictionApiResult> {
  if (!isRecord(body)) {
    return {
      error: {
        status: 400,
        message: "Payload dự đoán không hợp lệ.",
      },
    };
  }

  if (typeof body.matchId === "string") {
    return buildPredictionFromMatchId(body.matchId);
  }

  const payload = "payload" in body ? body.payload : body;

  if (!isMatch(payload)) {
    return {
      error: {
        status: 400,
        message: "Vui lòng cung cấp matchId hoặc payload trận đấu hợp lệ.",
      },
    };
  }

  return {
    prediction: await buildPrediction(payload),
  };
}

function isMatch(value: unknown): value is Match {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.leagueId === "string" &&
    isIncluded(MATCH_STATUSES, value.status) &&
    typeof value.round === "string" &&
    typeof value.kickoffTime === "string" &&
    typeof value.headline === "string" &&
    isVenue(value.venue) &&
    isMetadataValue(value.referee) &&
    isTeam(value.homeTeam) &&
    isTeam(value.awayTeam) &&
    isMatchScore(value.score) &&
    isMatchClock(value.clock) &&
    (value.statistics === null || isMatchStatistics(value.statistics))
  );
}

function isVenue(value: unknown): value is VenueMetadata {
  return (
    isRecord(value) &&
    ("name" in value ? value.name === null || typeof value.name === "string" : false) &&
    ("city" in value ? value.city === null || typeof value.city === "string" : false) &&
    ("country" in value
      ? value.country === null || typeof value.country === "string"
      : false) &&
    isIncluded(METADATA_STATUSES, value.status) &&
    (value.note === null || typeof value.note === "string")
  );
}

function isMatchScore(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.home === "number" &&
    typeof value.away === "number"
  );
}

function isMatchClock(value: unknown) {
  return (
    isRecord(value) &&
    (value.minute === null || typeof value.minute === "number") &&
    (value.addedTime === null || typeof value.addedTime === "number") &&
    isIncluded(MATCH_PHASES, value.phase) &&
    typeof value.label === "string"
  );
}

function isTeam(value: unknown): value is Team {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.shortName === "string" &&
    typeof value.code === "string" &&
    typeof value.country === "string" &&
    typeof value.logoUrl === "string" &&
    typeof value.primaryColor === "string" &&
    typeof value.secondaryColor === "string" &&
    isMetadataValue(value.coach) &&
    isTeamForm(value.form) &&
    isTeamStanding(value.standing) &&
    isTeamStrengthRatings(value.strengthRatings) &&
    Array.isArray(value.availabilityNotes) &&
    value.availabilityNotes.every(isAvailabilityNote)
  );
}

function isTeamForm(value: unknown) {
  return (
    isRecord(value) &&
    Array.isArray(value.lastFive) &&
    value.lastFive.every((result) => isIncluded(FORM_RESULTS, result)) &&
    typeof value.scoredInLastFive === "number" &&
    typeof value.concededInLastFive === "number" &&
    typeof value.cleanSheets === "number"
  );
}

function isTeamStanding(value: unknown) {
  return (
    isRecord(value) &&
    isNumberRecord(value, [
      "position",
      "played",
      "won",
      "drawn",
      "lost",
      "goalsFor",
      "goalsAgainst",
      "goalDifference",
      "points",
    ])
  );
}

function isTeamStrengthRatings(value: unknown) {
  return (
    isRecord(value) &&
    isNumberRecord(value, [
      "attack",
      "midfield",
      "defense",
      "transition",
      "setPieces",
    ])
  );
}

function isAvailabilityNote(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.playerName === "string" &&
    typeof value.reason === "string" &&
    isIncluded(AVAILABILITY_STATUSES, value.status)
  );
}

function isMetadataValue(value: unknown): value is MetadataValue {
  return (
    isRecord(value) &&
    ("value" in value ? value.value === null || typeof value.value === "string" : false) &&
    isIncluded(METADATA_STATUSES, value.status) &&
    (value.note === null || typeof value.note === "string")
  );
}

function isMatchStatistics(value: unknown): value is MatchStatistics {
  return (
    isRecord(value) &&
    isTeamMatchStatistics(value.home) &&
    isTeamMatchStatistics(value.away) &&
    isHomeAwayNumbers(value.pressureIndex) &&
    isHomeAwayNumbers(value.territoryControl)
  );
}

function isTeamMatchStatistics(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.possession === "number" &&
    isNumberRecord(value.shots, [
      "total",
      "onTarget",
      "offTarget",
      "insideBox",
      "bigChances",
      "expectedGoals",
    ]) &&
    isNumberRecord(value.passing, [
      "attempted",
      "completed",
      "accuracy",
      "progressivePasses",
      "finalThirdEntries",
    ]) &&
    isNumberRecord(value.defensive, [
      "tacklesWon",
      "interceptions",
      "clearances",
      "blocks",
      "saves",
    ]) &&
    isNumberRecord(value.discipline, [
      "fouls",
      "yellowCards",
      "redCards",
      "offsides",
      "corners",
    ])
  );
}

function isHomeAwayNumbers(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.home === "number" &&
    typeof value.away === "number"
  );
}

function isNumberRecord(value: unknown, keys: readonly string[]) {
  return isRecord(value) && keys.every((key) => typeof value[key] === "number");
}

function isIncluded<T extends string>(
  values: readonly T[],
  candidate: unknown,
): candidate is T {
  return typeof candidate === "string" && values.includes(candidate as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
