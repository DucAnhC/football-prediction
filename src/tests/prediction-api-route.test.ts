import { GET, POST } from "@/app/api/predictions/route";
import { matches } from "@/data/matches";
import { buildMockPrediction, isPredictionSchemaOutput } from "@/services/prediction";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("prediction api route", () => {
  it("returns a mock prediction for GET by matchId when AI is not configured", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/predictions?matchId=${matches[0].id}`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.matchId).toBe(matches[0].id);
    expect(body.source).toBe("mock");
    expect(isPredictionSchemaOutput(body.output)).toBe(true);
  });

  it("returns an AI prediction when OpenAI responds with valid structured output", async () => {
    const aiOutput = {
      ...buildMockPrediction(matches[0]).output,
      summary: "AI nghiêng về đội chủ nhà với dữ liệu cấu trúc rõ ràng.",
      confidence: "high" as const,
      confidence_score: 78,
    };

    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(aiOutput),
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    const response = await GET(
      new Request(
        `http://localhost/api/predictions?matchId=${matches[0].id}`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("ai");
    expect(body.output.summary).toBe(aiOutput.summary);
    expect(body.output.confidence_score).toBe(78);
  });

  it("falls back to mock prediction when the AI call fails", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    const response = await GET(
      new Request(
        `http://localhost/api/predictions?matchId=${matches[0].id}`,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("mock");
    expect(isPredictionSchemaOutput(body.output)).toBe(true);
  });

  it("accepts a payload match via POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: matches[1],
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.matchId).toBe(matches[1].id);
    expect(isPredictionSchemaOutput(body.output)).toBe(true);
  });

  it("returns 404 for an unknown matchId", async () => {
    const response = await GET(
      new Request("http://localhost/api/predictions?matchId=missing-match"),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/Không tìm thấy trận đấu/i);
  });

  it("returns 400 for an invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: {
            id: "invalid",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/matchId hoặc payload/i);
  });
});
