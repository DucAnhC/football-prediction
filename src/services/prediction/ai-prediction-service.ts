import { buildPredictionPrompt } from "@/lib/ai";
import {
  createStructuredOpenAiResponse,
  getOpenAiModel,
  isOpenAiConfigured,
} from "@/lib/api/openai";
import { loadHandbookRules } from "@/lib/utils";
import { buildMockPrediction } from "@/services/prediction/mock-prediction-service";
import {
  assertPredictionSchemaOutput,
  predictionSchemaJson,
} from "@/services/prediction/schema";
import type { Match } from "@/types/match";
import type { MatchPrediction, PredictionSchemaOutput } from "@/types/prediction";

export async function buildPrediction(match: Match): Promise<MatchPrediction> {
  const fallbackPrediction = buildMockPrediction(match);

  if (!isOpenAiConfigured()) {
    return fallbackPrediction;
  }

  try {
    const handbookRules = loadHandbookRules();
    const prompt = buildPredictionPrompt({
      input: fallbackPrediction.input,
      rawData: fallbackPrediction.rawData,
      derivedIndicators: fallbackPrediction.derivedIndicators,
      handbookRules,
    });
    const aiOutput = await createStructuredOpenAiResponse<PredictionSchemaOutput>({
      model: getOpenAiModel(),
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      schemaName: "football_prediction_output",
      schema: predictionSchemaJson,
    });

    assertPredictionSchemaOutput(aiOutput);

    return {
      ...fallbackPrediction,
      id: `prediction-${match.id}-ai`,
      generatedAt: new Date().toISOString(),
      source: "ai",
      explanation: {
        matchContext: aiOutput.match_context,
        importantIndicators: aiOutput.key_indicators,
        riskNotes: aiOutput.risks,
      },
      output: aiOutput,
    };
  } catch (error) {
    console.error("Falling back to mock prediction because AI prediction failed.", error);
    return fallbackPrediction;
  }
}
