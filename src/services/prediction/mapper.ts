import type { Match } from "@/types/match";
import type { PredictionInput, PredictionRawData } from "@/types/prediction";
import type { FormResult, Team } from "@/types/team";

export function buildPredictionInput(
  match: Match,
  leagueName: string,
): PredictionInput {
  return {
    matchId: match.id,
    leagueId: match.leagueId,
    leagueName,
    matchStatus: match.status,
    round: match.round,
    kickoffTime: match.kickoffTime,
    venue: match.venue.name ?? match.venue.note ?? "Chưa có dữ liệu sân đấu từ nguồn hiện tại",
    referee:
      match.referee.value ??
      match.referee.note ??
      "Trọng tài chưa được cung cấp cho trận này",
    headline: match.headline,
    homeTeam: buildPredictionInputTeam(match.homeTeam),
    awayTeam: buildPredictionInputTeam(match.awayTeam),
    liveContext: match.statistics
      ? {
          minute: match.clock.minute,
          phase: match.clock.phase,
          homePossession: match.statistics.home.possession,
          awayPossession: match.statistics.away.possession,
          homeShotsOnTarget: match.statistics.home.shots.onTarget,
          awayShotsOnTarget: match.statistics.away.shots.onTarget,
          homeExpectedGoals: match.statistics.home.shots.expectedGoals,
          awayExpectedGoals: match.statistics.away.shots.expectedGoals,
        }
      : null,
  };
}

export function buildPredictionRawData(match: Match): PredictionRawData {
  const homeGoalsPerMatch = getGoalsPerMatch(match.homeTeam);
  const awayGoalsPerMatch = getGoalsPerMatch(match.awayTeam);
  const homeExpectedGoals = match.statistics
    ? roundToTwo(match.statistics.home.shots.expectedGoals)
    : estimateExpectedGoals(match.homeTeam, match.awayTeam, true);
  const awayExpectedGoals = match.statistics
    ? roundToTwo(match.statistics.away.shots.expectedGoals)
    : estimateExpectedGoals(match.awayTeam, match.homeTeam, false);

  return {
    matchId: match.id,
    homeFormPoints: calculateFormPoints(match.homeTeam.form.lastFive),
    awayFormPoints: calculateFormPoints(match.awayTeam.form.lastFive),
    homeGoalsPerMatch,
    awayGoalsPerMatch,
    homeExpectedGoals,
    awayExpectedGoals,
    homeShotsOnTarget: match.statistics
      ? match.statistics.home.shots.onTarget
      : roundToTwo(Math.max(2.6, homeExpectedGoals * 2.75)),
    awayShotsOnTarget: match.statistics
      ? match.statistics.away.shots.onTarget
      : roundToTwo(Math.max(2.1, awayExpectedGoals * 2.7)),
  };
}

export function calculateFormPoints(results: readonly FormResult[]) {
  return results.reduce((total, result) => total + getFormValue(result), 0);
}

function buildPredictionInputTeam(team: Team) {
  return {
    teamId: team.id,
    name: team.name,
    shortName: team.shortName,
    standingPosition: team.standing.position,
    points: team.standing.points,
    goalDifference: team.standing.goalDifference,
    formPoints: calculateFormPoints(team.form.lastFive),
    goalsScoredLastFive: team.form.scoredInLastFive,
    goalsConcededLastFive: team.form.concededInLastFive,
    cleanSheets: team.form.cleanSheets,
    attackRating: team.strengthRatings.attack,
    midfieldRating: team.strengthRatings.midfield,
    defenseRating: team.strengthRatings.defense,
    transitionRating: team.strengthRatings.transition,
    setPieceRating: team.strengthRatings.setPieces,
    absences: team.availabilityNotes.map(
      (note) => `${note.playerName} (${note.status})`,
    ),
  };
}

function estimateExpectedGoals(
  team: Team,
  opponent: Team,
  isHomeTeam: boolean,
) {
  const goalsPerMatch = getGoalsPerMatch(team) || 1;
  const attackFactor = team.strengthRatings.attack / 100;
  const transitionFactor = team.strengthRatings.transition / 220;
  const defenseResistance = opponent.strengthRatings.defense / 190;
  const venueBonus = isHomeTeam ? 0.18 : 0.04;

  return roundToTwo(
    Math.max(
      0.8,
      goalsPerMatch * 0.72 + attackFactor * 0.62 + transitionFactor - defenseResistance + venueBonus,
    ),
  );
}

function getFormValue(result: FormResult) {
  if (result === "W") {
    return 3;
  }

  if (result === "D") {
    return 1;
  }

  return 0;
}

function getGoalsPerMatch(team: Team) {
  const fallbackAverage =
    team.form.scoredInLastFive > 0 ? team.form.scoredInLastFive / 5 : 1;

  return roundToTwo(
    safeAverage(team.standing.goalsFor, team.standing.played, fallbackAverage),
  );
}

function safeAverage(total: number, count: number, fallback: number) {
  if (!Number.isFinite(total) || !Number.isFinite(count) || count <= 0) {
    return fallback;
  }

  return total / count;
}

function roundToTwo(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}
