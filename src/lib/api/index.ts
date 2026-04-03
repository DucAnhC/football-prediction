export type {
  FootballDashboardSnapshot,
  FootballDataResult,
  FootballDataSource,
  FootballFallbackReason,
  LeagueCoverage,
  FootballMatchContext,
} from "./football";
export {
  buildFootballDataNotice,
  getDashboardSnapshotWithFallback,
  getMatchContextWithFallback,
  getLeaguesWithFallback,
  getMatchByIdWithFallback,
  getMatchesWithFallback,
  isFootballApiConfigured,
} from "./football";
