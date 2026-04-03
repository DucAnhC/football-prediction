import { matches } from "@/data/matches";
import {
  assertPredictionSchemaOutput,
  buildMockPrediction,
  isPredictionSchemaOutput,
} from "@/services/prediction";
import { describe, expect, it } from "vitest";

describe("prediction schema", () => {
  it("accepts the generated mock prediction output", () => {
    const prediction = buildMockPrediction(matches[0]);

    expect(isPredictionSchemaOutput(prediction.output)).toBe(true);
    expect(() => assertPredictionSchemaOutput(prediction.output)).not.toThrow();
  });

  it("rejects incomplete output objects", () => {
    const invalidOutput = {
      summary: "Lean home team",
    };

    expect(isPredictionSchemaOutput(invalidOutput)).toBe(false);
    expect(() => assertPredictionSchemaOutput(invalidOutput)).toThrow(
      /prediction schema/i,
    );
  });
});
