import type { BadgeTone, PredictionHighlightViewModel } from "@/lib/view-models";

interface PredictionReferenceCardProps {
  viewModel: PredictionHighlightViewModel;
}

export function PredictionReferenceCard({ viewModel }: PredictionReferenceCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge badge={viewModel.tierBadge} />
            <Badge badge={viewModel.sourceBadge} subtle />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">{viewModel.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{viewModel.subtitle}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Mức tin cậy</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{viewModel.confidenceText}</p>
          <p className="mt-1 text-sm text-slate-600">{viewModel.confidenceLabel}</p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{viewModel.summary}</p>

      <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        {viewModel.note}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
        {viewModel.chips.map((chip) => (
          <Chip key={chip} label={chip} />
        ))}
      </div>

      <p className="mt-4 text-xs text-slate-500">Cập nhật {viewModel.updatedLabel}</p>
    </article>
  );
}

function Badge({
  badge,
  subtle = false,
}: {
  badge: PredictionHighlightViewModel["tierBadge"];
  subtle?: boolean;
}) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClassName(badge.tone, subtle)}`}>
      {badge.label}
    </span>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
      {label}
    </span>
  );
}

function getBadgeClassName(tone: BadgeTone, subtle: boolean) {
  if (tone === "positive") {
    return subtle
      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border border-emerald-200 bg-emerald-100 text-emerald-700";
  }

  if (tone === "info") {
    return subtle
      ? "border border-sky-200 bg-sky-50 text-sky-700"
      : "border border-amber-200 bg-amber-50 text-amber-800";
  }

  if (tone === "warning") {
    return subtle
      ? "border border-amber-200 bg-amber-50 text-amber-800"
      : "border border-amber-200 bg-amber-100 text-amber-800";
  }

  return subtle
    ? "border border-slate-200 bg-slate-50 text-slate-700"
    : "border border-slate-300 bg-slate-100 text-slate-700";
}
