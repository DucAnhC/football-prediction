import type { MetadataValue } from "@/types/metadata";

export type FormResult = "W" | "D" | "L";

export interface TeamForm {
  lastFive: readonly FormResult[];
  scoredInLastFive: number;
  concededInLastFive: number;
  cleanSheets: number;
}

export interface TeamStanding {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TeamStrengthRatings {
  attack: number;
  midfield: number;
  defense: number;
  transition: number;
  setPieces: number;
}

export interface TeamAvailabilityNote {
  playerName: string;
  reason: string;
  status: "out" | "doubtful" | "suspended";
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  code: string;
  country: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  coach: MetadataValue;
  form: TeamForm;
  standing: TeamStanding;
  strengthRatings: TeamStrengthRatings;
  availabilityNotes: readonly TeamAvailabilityNote[];
}
