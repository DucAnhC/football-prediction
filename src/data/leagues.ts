import type { League } from "@/types/match";

export const leagues = [
  {
    id: "premier-league",
    slug: "premier-league",
    name: "Premier League",
    country: "England",
    seasonLabel: "2025/26",
    currentRound: "Matchweek 30",
    logoUrl: "/leagues/premier-league.svg",
    priority: 1,
  },
  {
    id: "la-liga",
    slug: "la-liga",
    name: "La Liga",
    country: "Spain",
    seasonLabel: "2025/26",
    currentRound: "Matchweek 29",
    logoUrl: "/leagues/la-liga.svg",
    priority: 2,
  },
] satisfies readonly League[];
