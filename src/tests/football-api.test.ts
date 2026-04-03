import { leagues } from "@/data/leagues";
import { matches } from "@/data/matches";
import {
  getDashboardSnapshotWithFallback,
  getLeaguesWithFallback,
  getMatchByIdWithFallback,
  getMatchContextWithFallback,
  getMatchesWithFallback,
} from "@/lib/api";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFixture = {
  fixture: {
    id: 12001,
    referee: "Michael Oliver",
    date: "2026-03-27T19:00:00+00:00",
    venue: {
      name: "Emirates Stadium",
      city: "London",
    },
    status: {
      long: "Not Started",
      short: "NS",
      elapsed: null,
      extra: null,
    },
  },
  league: {
    id: 39,
    name: "Premier League",
    country: "England",
    logo: "https://media.example.com/premier-league.png",
    season: 2025,
    round: "Regular Season - 30",
  },
  teams: {
    home: {
      id: 42,
      name: "Arsenal",
      logo: "https://media.example.com/arsenal.png",
    },
    away: {
      id: 40,
      name: "Liverpool",
      logo: "https://media.example.com/liverpool.png",
    },
  },
  goals: {
    home: null,
    away: null,
  },
};

const apiLeagueCoveragePayload = {
  response: [
    {
      league: {
        id: 39,
        name: "Premier League",
      },
      seasons: [
        {
          year: 2025,
          coverage: {
            standings: true,
            players: true,
            fixtures: {
              events: true,
              lineups: true,
              statistics_fixtures: true,
            },
          },
        },
      ],
    },
  ],
};

const apiStandingsPayload = {
  response: [
    {
      league: {
        standings: [
          [
            {
              rank: 2,
              team: {
                id: 42,
                name: "Arsenal",
              },
              points: 61,
              goalsDiff: 32,
              form: "WWDWL",
              all: {
                played: 29,
                win: 18,
                draw: 7,
                lose: 4,
                goals: {
                  for: 57,
                  against: 25,
                },
              },
            },
            {
              rank: 1,
              team: {
                id: 40,
                name: "Liverpool",
              },
              points: 66,
              goalsDiff: 38,
              form: "WDWWW",
              all: {
                played: 29,
                win: 20,
                draw: 6,
                lose: 3,
                goals: {
                  for: 64,
                  against: 26,
                },
              },
            },
          ],
        ],
      },
    },
  ],
};

const apiStatisticsPayload = {
  response: [
    {
      team: {
        id: 42,
        name: "Arsenal",
      },
      statistics: [
        { type: "Ball Possession", value: "58%" },
        { type: "Total Shots", value: 14 },
        { type: "Shots on Goal", value: 6 },
        { type: "Shots off Goal", value: 5 },
        { type: "Shots insidebox", value: 8 },
        { type: "Big Chances", value: 2 },
        { type: "Expected Goals", value: "1.84" },
        { type: "Total passes", value: 541 },
        { type: "Passes accurate", value: 488 },
        { type: "Passes %", value: "90%" },
        { type: "Blocked Shots", value: 3 },
        { type: "Corner Kicks", value: 7 },
        { type: "Goalkeeper Saves", value: 2 },
      ],
    },
    {
      team: {
        id: 40,
        name: "Liverpool",
      },
      statistics: [
        { type: "Ball Possession", value: "42%" },
        { type: "Total Shots", value: 9 },
        { type: "Shots on Goal", value: 3 },
        { type: "Shots off Goal", value: 4 },
        { type: "Shots insidebox", value: 5 },
        { type: "Big Chances", value: 1 },
        { type: "Expected Goals", value: "0.96" },
        { type: "Total passes", value: 401 },
        { type: "Passes accurate", value: 344 },
        { type: "Passes %", value: "86%" },
        { type: "Blocked Shots", value: 2 },
        { type: "Corner Kicks", value: 4 },
        { type: "Goalkeeper Saves", value: 4 },
      ],
    },
  ],
};

const apiTeamsPayload = {
  42: {
    response: [
      {
        team: {
          id: 42,
          name: "Arsenal",
          country: "England",
        },
        venue: {
          name: "Emirates Stadium",
          city: "London",
        },
      },
    ],
  },
  40: {
    response: [
      {
        team: {
          id: 40,
          name: "Liverpool",
          country: "England",
        },
        venue: {
          name: "Anfield",
          city: "Liverpool",
        },
      },
    ],
  },
};

const apiCoachesPayload = {
  42: {
    response: [{ id: 1, name: "Mikel Arteta" }],
  },
  40: {
    response: [{ id: 2, name: "Arne Slot" }],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("football api wrapper", () => {
  it("returns mock matches when football API config is missing", async () => {
    const result = await getMatchesWithFallback();

    expect(result.source).toBe("mock");
    expect(result.data).toEqual(matches);
    expect(result.error).toMatch(/FOOTBALL_API_BASE_URL/i);
    expect(result.error).toMatch(/FOOTBALL_API_KEY/i);
  });

  it("normalizes API-Sports fixtures into dashboard matches and leagues", async () => {
    vi.stubEnv("FOOTBALL_API_BASE_URL", "https://example.com");
    vi.stubEnv("FOOTBALL_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = toUrl(input);

      if (url.pathname.endsWith("/fixtures")) {
        return createJsonResponse({ response: [apiFixture] });
      }

      if (url.pathname.endsWith("/leagues")) {
        return createJsonResponse(apiLeagueCoveragePayload);
      }

      if (url.pathname.endsWith("/standings")) {
        return createJsonResponse(apiStandingsPayload);
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const result = await getDashboardSnapshotWithFallback();

    expect(result.source).toBe("api");
    expect(result.data.leagues).toHaveLength(1);
    expect(result.data.matches).toHaveLength(1);
    expect(result.data.leagues[0]).toMatchObject({
      id: "premier-league",
      name: "Premier League",
      currentRound: "Vòng 30",
    });
    expect(result.data.matches[0]).toMatchObject({
      id: "12001",
      leagueId: "premier-league",
      round: "Vòng 30",
      referee: {
        value: "Michael Oliver",
        status: "available",
      },
      venue: {
        name: "Emirates Stadium",
        city: "London",
        status: "available",
      },
    });
    expect(result.data.matches[0].homeTeam.coach.status).toBe("unavailable");
    expect(result.data.matches[0].homeTeam.standing.points).toBe(61);
    expect(result.data.matches[0].awayTeam.standing.points).toBe(66);
  });

  it("falls back to mock leagues when the API request fails", async () => {
    vi.stubEnv("FOOTBALL_API_BASE_URL", "https://example.com");
    vi.stubEnv("FOOTBALL_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const result = await getLeaguesWithFallback();

    expect(result.source).toBe("mock");
    expect(result.data).toEqual(leagues);
    expect(result.error).toMatch(/API-Sports/i);
  });

  it("returns enriched match context with coverage, statistics, and coach metadata", async () => {
    vi.stubEnv("FOOTBALL_API_BASE_URL", "https://example.com");
    vi.stubEnv("FOOTBALL_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = toUrl(input);

      if (url.pathname.endsWith("/fixtures") && url.searchParams.get("id") === "12001") {
        return createJsonResponse({ response: [apiFixture] });
      }

      if (url.pathname.endsWith("/leagues")) {
        return createJsonResponse(apiLeagueCoveragePayload);
      }

      if (url.pathname.endsWith("/standings")) {
        return createJsonResponse(apiStandingsPayload);
      }

      if (url.pathname.endsWith("/fixtures/statistics")) {
        return createJsonResponse(apiStatisticsPayload);
      }

      if (url.pathname.endsWith("/teams")) {
        const teamId = Number(url.searchParams.get("id"));
        return createJsonResponse(apiTeamsPayload[teamId as 42 | 40]);
      }

      if (url.pathname.endsWith("/coachs")) {
        const teamId = Number(url.searchParams.get("team"));
        return createJsonResponse(apiCoachesPayload[teamId as 42 | 40]);
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const contextResult = await getMatchContextWithFallback("12001");

    expect(contextResult.source).toBe("api");
    expect(contextResult.data.coverage).toMatchObject({
      standings: true,
      fixtureStatistics: true,
    });
    expect(contextResult.data.match?.statistics?.home.possession).toBe(58);
    expect(contextResult.data.match?.statistics?.away.passing.completed).toBe(344);
    expect(contextResult.data.match?.homeTeam.coach).toMatchObject({
      value: "Mikel Arteta",
      status: "available",
    });
    expect(contextResult.data.match?.awayTeam.coach).toMatchObject({
      value: "Arne Slot",
      status: "available",
    });
  });

  it("returns a fixture by numeric id from the API layer", async () => {
    vi.stubEnv("FOOTBALL_API_BASE_URL", "https://example.com");
    vi.stubEnv("FOOTBALL_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = toUrl(input);

      if (url.pathname.endsWith("/fixtures") && url.searchParams.get("id") === "12001") {
        return createJsonResponse({ response: [apiFixture] });
      }

      if (url.pathname.endsWith("/leagues")) {
        return createJsonResponse(apiLeagueCoveragePayload);
      }

      if (url.pathname.endsWith("/standings")) {
        return createJsonResponse(apiStandingsPayload);
      }

      if (url.pathname.endsWith("/fixtures/statistics")) {
        return createJsonResponse(apiStatisticsPayload);
      }

      if (url.pathname.endsWith("/teams")) {
        const teamId = Number(url.searchParams.get("id"));
        return createJsonResponse(apiTeamsPayload[teamId as 42 | 40]);
      }

      if (url.pathname.endsWith("/coachs")) {
        const teamId = Number(url.searchParams.get("team"));
        return createJsonResponse(apiCoachesPayload[teamId as 42 | 40]);
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    });

    const result = await getMatchByIdWithFallback("12001");

    expect(result.source).toBe("api");
    expect(result.data?.id).toBe("12001");
    expect(result.data?.referee.value).toBe("Michael Oliver");
    expect(result.data?.homeTeam.coach.value).toBe("Mikel Arteta");
  });

  it("still resolves legacy mock ids through the fallback layer", async () => {
    vi.stubEnv("FOOTBALL_API_BASE_URL", "https://example.com");
    vi.stubEnv("FOOTBALL_API_KEY", "test-key");

    const result = await getMatchByIdWithFallback(matches[0].id);

    expect(result.source).toBe("mock");
    expect(result.data?.id).toBe(matches[0].id);
  });
});

function createJsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function toUrl(input: RequestInfo | URL) {
  if (input instanceof URL) {
    return input;
  }

  if (typeof input === "string") {
    return new URL(input);
  }

  return new URL(input.url);
}
