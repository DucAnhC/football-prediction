import type { HandbookRule } from "@/lib/utils";
import type {
  DerivedMatchIndicators,
  PredictionInput,
  PredictionRawData,
} from "@/types/prediction";

export interface PredictionPromptPayload {
  input: PredictionInput;
  rawData: PredictionRawData;
  derivedIndicators: DerivedMatchIndicators;
  handbookRules: readonly HandbookRule[];
}

export interface PredictionPrompt {
  system: string;
  user: string;
}

const OUTPUT_SCHEMA_TEMPLATE = {
  summary: "string",
  match_context: "string",
  key_indicators: [
    {
      label: "string",
      detail: "string",
    },
  ],
  handbook_rules_used: [
    {
      id: "string",
      title: "string",
      reason: "string",
    },
  ],
  risks: ["string"],
  suggested_prediction: {
    outcome: "home-win | draw | away-win",
    goals: "over-2.5 | under-2.5",
    both_teams_to_score: "yes | no | balanced",
    likely_scoreline: "string",
    rationale: "string",
  },
  confidence: "low | medium | high",
  confidence_score: 0,
} as const;

export function buildPredictionPrompt(
  payload: PredictionPromptPayload,
): PredictionPrompt {
  const handbookRules = payload.handbookRules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    section: rule.sectionTitle,
    guidance: rule.content,
    bullets: rule.bullets,
  }));

  return {
    system: [
      "Ban la he thong phan tich bong da phuc vu prediction co cau truc.",
      "Chi duoc su dung du lieu trong prompt va handbook duoc cung cap.",
      "Khong duoc khang dinh ket qua nhu su that chac chan.",
      "Phai tra ve duy nhat mot object JSON hop le theo dung schema yeu cau.",
      "Khong them markdown, khong them giai thich ben ngoai JSON.",
    ].join(" "),
    user: [
      "TASK",
      "Phan tich tran dau va tra ve prediction co cau truc theo schema duoi day.",
      "MATCH_DATA",
      toJson(payload.input),
      "RAW_DATA",
      toJson(payload.rawData),
      "DERIVED_INDICATORS",
      toJson(payload.derivedIndicators),
      "HANDBOOK_RULES",
      toJson(handbookRules),
      "OUTPUT_SCHEMA",
      toJson(OUTPUT_SCHEMA_TEMPLATE),
      "OUTPUT_RULES",
      [
        "- summary phai mo dau bang nghieng chinh cua tran dau.",
        "- key_indicators nen co tu 2 den 4 muc ngan gon, bam sat du lieu.",
        "- handbook_rules_used chi duoc tham chieu tu HANDBOOK_RULES.",
        "- risks phai neu ro bat dinh, bien dong, hoac nhan su neu co.",
        "- confidence_score la so trong khoang 0 den 100.",
      ].join("\n"),
    ].join("\n\n"),
  };
}

function toJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
