import type {
  PredictionHandbookRuleReference,
  PredictionInsight,
  PredictionSchemaOutput,
  PredictionSuggestedOutput,
} from "@/types/prediction";

export const predictionSchemaJson = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "match_context",
    "key_indicators",
    "handbook_rules_used",
    "risks",
    "suggested_prediction",
    "confidence",
    "confidence_score",
  ],
  properties: {
    summary: {
      type: "string",
    },
    match_context: {
      type: "string",
    },
    key_indicators: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail"],
        properties: {
          label: {
            type: "string",
          },
          detail: {
            type: "string",
          },
        },
      },
    },
    handbook_rules_used: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "reason"],
        properties: {
          id: {
            type: "string",
          },
          title: {
            type: "string",
          },
          reason: {
            type: "string",
          },
        },
      },
    },
    risks: {
      type: "array",
      items: {
        type: "string",
      },
    },
    suggested_prediction: {
      type: "object",
      additionalProperties: false,
      required: [
        "outcome",
        "goals",
        "both_teams_to_score",
        "likely_scoreline",
        "rationale",
      ],
      properties: {
        outcome: {
          type: "string",
          enum: ["home-win", "draw", "away-win"],
        },
        goals: {
          type: "string",
          enum: ["over-2.5", "under-2.5"],
        },
        both_teams_to_score: {
          type: "string",
          enum: ["yes", "no", "balanced"],
        },
        likely_scoreline: {
          type: "string",
        },
        rationale: {
          type: "string",
        },
      },
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    confidence_score: {
      type: "number",
      minimum: 0,
      maximum: 100,
    },
  },
} as const;

export function isPredictionSchemaOutput(value: unknown): value is PredictionSchemaOutput {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.summary === "string" &&
    typeof value.match_context === "string" &&
    isPredictionInsightList(value.key_indicators) &&
    isHandbookRuleList(value.handbook_rules_used) &&
    isStringList(value.risks) &&
    isSuggestedOutput(value.suggested_prediction) &&
    (value.confidence === "low" ||
      value.confidence === "medium" ||
      value.confidence === "high") &&
    typeof value.confidence_score === "number"
  );
}

export function assertPredictionSchemaOutput(
  value: unknown,
): asserts value is PredictionSchemaOutput {
  if (!isPredictionSchemaOutput(value)) {
    throw new Error("Prediction output does not satisfy the prediction schema.");
  }
}

function isPredictionInsightList(value: unknown): value is readonly PredictionInsight[] {
  return Array.isArray(value) && value.every(isPredictionInsight);
}

function isPredictionInsight(value: unknown): value is PredictionInsight {
  return isRecord(value) && typeof value.label === "string" && typeof value.detail === "string";
}

function isHandbookRuleList(
  value: unknown,
): value is readonly PredictionHandbookRuleReference[] {
  return Array.isArray(value) && value.every(isHandbookRule);
}

function isHandbookRule(value: unknown): value is PredictionHandbookRuleReference {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.reason === "string"
  );
}

function isSuggestedOutput(value: unknown): value is PredictionSuggestedOutput {
  return (
    isRecord(value) &&
    (value.outcome === "home-win" || value.outcome === "draw" || value.outcome === "away-win") &&
    (value.goals === "over-2.5" || value.goals === "under-2.5") &&
    (value.both_teams_to_score === "yes" ||
      value.both_teams_to_score === "no" ||
      value.both_teams_to_score === "balanced") &&
    typeof value.likely_scoreline === "string" &&
    typeof value.rationale === "string"
  );
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
