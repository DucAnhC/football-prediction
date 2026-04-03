import { matches } from "@/data/matches";
import { buildPredictionPrompt } from "@/lib/ai";
import { findHandbookRulesByIds } from "@/lib/utils";
import { buildMockPrediction } from "@/services/prediction";
import { describe, expect, it } from "vitest";

describe("buildPredictionPrompt", () => {
  it("includes the required schema and handbook context", () => {
    const prediction = buildMockPrediction(matches[0]);
    const handbookRules = findHandbookRulesByIds(["SR-01", "SR-02", "SR-03"]);
    const prompt = buildPredictionPrompt({
      input: prediction.input,
      rawData: prediction.rawData,
      derivedIndicators: prediction.derivedIndicators,
      handbookRules,
    });

    expect(prompt.system).toMatch(/JSON hop le/i);
    expect(prompt.user).toContain('"summary"');
    expect(prompt.user).toContain('"match_context"');
    expect(prompt.user).toContain('"key_indicators"');
    expect(prompt.user).toContain('"handbook_rules_used"');
    expect(prompt.user).toContain('"suggested_prediction"');
    expect(prompt.user).toContain('"confidence_score": 0');
    expect(prompt.user).toContain(prediction.input.homeTeam.shortName);
    expect(prompt.user).toContain("SR-01");
    expect(prompt.user).toContain("SR-02");
    expect(prompt.user).toContain("SR-03");
  });
});
