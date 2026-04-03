import type { Match, MatchStatus } from "@/types/match";

export type PredictionSource = "mock" | "ai";
export type PredictionConfidence = "low" | "medium" | "high";
export type MatchOutcomeLean = "home-win" | "draw" | "away-win";
export type GoalsLean = "over-2.5" | "under-2.5";
export type BothTeamsToScoreLean = "yes" | "no" | "balanced";
export type IndicatorEdge = "home" | "away" | "balanced";
export type GoalExpectationBand = "low" | "balanced" | "high";
export type RiskLevel = "low" | "medium" | "high";

export interface PredictionInputTeamSnapshot {
  teamId: string;
  name: string;
  shortName: string;
  standingPosition: number;
  points: number;
  goalDifference: number;
  formPoints: number;
  goalsScoredLastFive: number;
  goalsConcededLastFive: number;
  cleanSheets: number;
  attackRating: number;
  midfieldRating: number;
  defenseRating: number;
  transitionRating: number;
  setPieceRating: number;
  absences: readonly string[];
}

export interface PredictionLiveContext {
  minute: number | null;
  phase: Match["clock"]["phase"];
  homePossession: number;
  awayPossession: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
}

export interface PredictionInput {
  matchId: Match["id"];
  leagueId: Match["leagueId"];
  leagueName: string;
  matchStatus: MatchStatus;
  round: string;
  kickoffTime: string;
  venue: string;
  referee: string;
  headline: string;
  homeTeam: PredictionInputTeamSnapshot;
  awayTeam: PredictionInputTeamSnapshot;
  liveContext: PredictionLiveContext | null;
}

export interface PredictionRawData {
  matchId: Match["id"];
  homeFormPoints: number;
  awayFormPoints: number;
  homeGoalsPerMatch: number;
  awayGoalsPerMatch: number;
  homeExpectedGoals: number;
  awayExpectedGoals: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
}

export interface DerivedMatchIndicators {
  attackingEdge: IndicatorEdge;
  controlEdge: IndicatorEdge;
  goalExpectation: GoalExpectationBand;
  bothTeamsToScore: BothTeamsToScoreLean;
  volatility: RiskLevel;
}

export interface PredictionInsight {
  label: string;
  detail: string;
}

export interface PredictionExplanation {
  matchContext: string;
  importantIndicators: readonly PredictionInsight[];
  riskNotes: readonly string[];
}

export interface PredictionHandbookRuleReference {
  id: string;
  title: string;
  reason: string;
}

export interface PredictionSuggestedOutput {
  outcome: MatchOutcomeLean;
  goals: GoalsLean;
  both_teams_to_score: BothTeamsToScoreLean;
  likely_scoreline: string;
  rationale: string;
}

export interface PredictionSchemaOutput {
  summary: string;
  match_context: string;
  key_indicators: readonly PredictionInsight[];
  handbook_rules_used: readonly PredictionHandbookRuleReference[];
  risks: readonly string[];
  suggested_prediction: PredictionSuggestedOutput;
  confidence: PredictionConfidence;
  confidence_score: number;
}

export interface MatchPrediction {
  id: string;
  matchId: Match["id"];
  generatedAt: string;
  source: PredictionSource;
  input: PredictionInput;
  rawData: PredictionRawData;
  derivedIndicators: DerivedMatchIndicators;
  explanation: PredictionExplanation;
  output: PredictionSchemaOutput;
}
