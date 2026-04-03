import type { MatchStatistics } from "@/types/statistics";
import type { MetadataValue, VenueMetadata } from "@/types/metadata";
import type { Team } from "@/types/team";

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";
export type MatchPhase =
  | "pre-match"
  | "first-half"
  | "half-time"
  | "second-half"
  | "full-time"
  | "delayed";

export interface League {
  id: string;
  slug: string;
  name: string;
  country: string;
  seasonLabel: string;
  currentRound: string;
  logoUrl: string;
  priority: number;
}

export interface MatchClock {
  minute: number | null;
  addedTime: number | null;
  phase: MatchPhase;
  label: string;
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface Match {
  id: string;
  leagueId: League["id"];
  status: MatchStatus;
  round: string;
  kickoffTime: string;
  headline: string;
  venue: VenueMetadata;
  referee: MetadataValue;
  homeTeam: Team;
  awayTeam: Team;
  score: MatchScore;
  clock: MatchClock;
  statistics: MatchStatistics | null;
}
