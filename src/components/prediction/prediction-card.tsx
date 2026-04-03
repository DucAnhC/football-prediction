import type { ReactNode } from "react";
import type {
  MatchPrediction,
  PredictionHandbookRuleReference,
} from "@/types/prediction";
import {
  clampToPercentage,
  formatPercentage,
  formatText,
} from "@/lib/utils";

interface PredictionCardProps {
  prediction: MatchPrediction;
  updatedLabel?: string;
  title?: string;
  variant?: "compact" | "full";
}

const confidenceCopy = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
} as const;

const outcomeCopy = {
  "home-win": "Chủ nhà thắng",
  draw: "Hòa",
  "away-win": "Đội khách thắng",
} as const;

const goalsCopy = {
  "over-2.5": "Tài 2.5",
  "under-2.5": "Xỉu 2.5",
} as const;

const bttsCopy = {
  yes: "Có",
  no: "Không",
  balanced: "Cân bằng",
} as const;

const volatilityCopy = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
} as const;

export function PredictionCard({
  prediction,
  updatedLabel,
  title,
  variant = "full",
}: PredictionCardProps) {
  const displayTitle =
    title ??
    `${prediction.input.homeTeam.shortName} gặp ${prediction.input.awayTeam.shortName}`;
  const isScheduled = prediction.input.matchStatus === "scheduled";
  const cardTitle = isScheduled
    ? "Nhận định trước trận"
    : prediction.input.matchStatus === "live"
      ? "Góc nhìn dữ liệu trực tiếp"
      : "Tóm tắt dữ liệu trận";
  const referenceNote = isScheduled
    ? prediction.output.confidence === "low"
      ? "Tín hiệu còn yếu, nên chỉ xem như tham khảo nhanh."
      : "Giữ vai trò tham khảo trước giờ bóng lăn."
    : "Không nên đọc như một dự đoán chắc chắn cho kết quả trận.";
  const visibleIndicators = limitItems(
    prediction.output.key_indicators,
    variant,
    prediction.output.confidence === "low" ? 1 : 2,
  );
  const visibleRules = limitItems(
    prediction.output.handbook_rules_used,
    variant,
    prediction.output.confidence === "low" ? 1 : 2,
  );
  const visibleRisks = limitItems(
    prediction.output.risks,
    variant,
    prediction.output.confidence === "low" ? 1 : 2,
  );
  const confidenceLabel = formatPercentage(prediction.output.confidence_score, {
    fallback: "Đang cập nhật",
  });
  const confidenceMeter = clampToPercentage(prediction.output.confidence_score);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              {cardTitle}
            </p>
            <SourceBadge source={prediction.source} />
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            {displayTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {prediction.input.leagueName} - {formatRoundLabel(prediction.input.round)}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-4 py-3 text-right text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Mức độ tin cậy
          </p>
          <p className="mt-1 text-sm font-semibold uppercase">
            {confidenceCopy[prediction.output.confidence]}
          </p>
          <p className="mt-1 text-2xl font-semibold">{confidenceLabel}</p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-5 text-white">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300">
            Tóm tắt nhanh
          </p>
          <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-slate-200">
            {referenceNote}
          </span>
        </div>
        <p className="mt-2 text-base font-semibold leading-7 text-white">
          {formatText(prediction.output.summary)}
        </p>
        <div className="mt-4 h-2 rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-sky-400"
            style={{ width: `${confidenceMeter}%` }}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          {formatText(prediction.output.match_context)}
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label={isScheduled ? "Xu hướng" : "Tín hiệu"}
          value={outcomeCopy[prediction.output.suggested_prediction.outcome]}
        />
        <MetricTile
          label="Tổng bàn"
          value={goalsCopy[prediction.output.suggested_prediction.goals]}
        />
        <MetricTile
          label="Hai đội ghi bàn"
          value={
            bttsCopy[prediction.output.suggested_prediction.both_teams_to_score]
          }
        />
        <MetricTile
          label="Tỷ số dễ thấy"
          value={formatText(prediction.output.suggested_prediction.likely_scoreline)}
        />
      </div>

      <div className={`mt-5 grid gap-4 ${getSectionGridClassName(variant)}`}>
        <SectionCard title="Chỉ báo chính">
          <ul className="space-y-3 text-sm text-slate-600">
            {visibleIndicators.map((indicator) => (
              <li key={indicator.label}>
                <p className="font-semibold text-slate-950">{indicator.label}</p>
                <p className="mt-1 leading-6">{indicator.detail}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={isScheduled ? "Gợi ý dự đoán" : "Điểm đáng chú ý"}>
          <p className="text-lg font-semibold text-slate-950">
            {outcomeCopy[prediction.output.suggested_prediction.outcome]}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {formatText(prediction.output.suggested_prediction.rationale)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            <SuggestionChip
              label={goalsCopy[prediction.output.suggested_prediction.goals]}
            />
            <SuggestionChip
              label={
                prediction.output.suggested_prediction.both_teams_to_score ===
                "yes"
                  ? "BTTS Có"
                  : prediction.output.suggested_prediction.both_teams_to_score ===
                      "no"
                    ? "BTTS Không"
                    : "BTTS Cân bằng"
              }
            />
            <SuggestionChip
              label={`Biến động ${volatilityCopy[prediction.derivedIndicators.volatility]}`}
            />
          </div>
        </SectionCard>
      </div>

      <div className={`mt-5 grid gap-4 ${getSectionGridClassName(variant)}`}>
        <SectionCard title="Quy tắc áp dụng">
          {variant === "compact" ? (
            <div className="flex flex-wrap gap-2">
              {visibleRules.map((rule) => (
                <RuleBadge key={rule.id} rule={rule} />
              ))}
            </div>
          ) : (
            <ul className="space-y-3 text-sm text-slate-600">
              {visibleRules.map((rule) => (
                <li key={rule.id}>
                  <p className="font-semibold text-slate-950">
                    {rule.id} - {rule.title}
                  </p>
                  <p className="mt-1 leading-6">{rule.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Rủi ro cần lưu ý">
          <p className="text-sm font-medium text-slate-500">
            Mức biến động: {volatilityCopy[prediction.derivedIndicators.volatility]}
          </p>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            {visibleRisks.map((risk) => (
              <li key={risk} className="flex gap-2">
                <span className="mt-2 h-2 w-2 rounded-full bg-amber-400" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {updatedLabel ? (
        <p className="mt-4 text-xs text-slate-500">Cập nhật {updatedLabel}</p>
      ) : null}
    </article>
  );
}

interface MetricTileProps {
  label: string;
  value: string;
}

function MetricTile({ label, value }: MetricTileProps) {
  return (
    <div className="rounded-2xl bg-sky-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-700">
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
        {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function SuggestionChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-sky-700">
      {label}
    </span>
  );
}

function RuleBadge({ rule }: { rule: PredictionHandbookRuleReference }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
      {rule.id} {rule.title}
    </span>
  );
}

function SourceBadge({ source }: { source: MatchPrediction["source"] }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${source === "mock" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      {source === "mock" ? "Dữ liệu mô phỏng" : "Từ AI"}
    </span>
  );
}

function getSectionGridClassName(variant: PredictionCardProps["variant"]) {
  return variant === "full" ? "lg:grid-cols-2" : "";
}

function formatRoundLabel(value: string) {
  return value.replace("Matchweek", "Vòng");
}

function limitItems<T>(
  items: readonly T[],
  variant: PredictionCardProps["variant"],
  compactCount: number,
) {
  return variant === "compact" ? items.slice(0, compactCount) : items;
}
