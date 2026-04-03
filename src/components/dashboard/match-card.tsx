import Link from "next/link";
import type { BadgeTone, HomepageMatchCardViewModel } from "@/lib/view-models";

interface MatchCardProps {
  viewModel: HomepageMatchCardViewModel;
}

export function MatchCard({ viewModel }: MatchCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge badge={viewModel.statusBadge} />
            <Badge badge={viewModel.sourceBadge} />
            <Badge badge={viewModel.qualityBadge} subtle />
            {viewModel.insightBadge ? <Badge badge={viewModel.insightBadge} subtle /> : null}
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-sky-700">
            {viewModel.competitionLabel}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{viewModel.title}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {viewModel.roundLabel} - {viewModel.kickoffLabel}
          </p>
        </div>
        <Link
          href={viewModel.href}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
        >
          Xem chi tiết
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamDisplay team={viewModel.homeTeam} align="right" />
        <div className="min-w-[92px] rounded-3xl bg-slate-950 px-4 py-4 text-center text-white">
          <p className="text-3xl font-semibold tracking-tight">{viewModel.scoreLabel}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.25em] text-slate-400">
            {viewModel.clockLabel}
          </p>
        </div>
        <TeamDisplay team={viewModel.awayTeam} align="left" />
      </div>

      {viewModel.venueField || viewModel.contextNote ? (
        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {viewModel.venueField ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                  {viewModel.venueField.label}
                </p>
                <p className="mt-1 font-medium text-slate-900">{viewModel.venueField.value}</p>
                {viewModel.venueField.note ? (
                  <p className="mt-1 text-slate-500">{viewModel.venueField.note}</p>
                ) : null}
              </div>
            ) : null}
            {viewModel.contextNote ? (
              <p className="text-xs leading-5 text-slate-500">{viewModel.contextNote}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

interface TeamDisplayProps {
  team: HomepageMatchCardViewModel["homeTeam"];
  align: "left" | "right";
}

function TeamDisplay({ team, align }: TeamDisplayProps) {
  const textAlignment = align === "right" ? "text-right" : "text-left";
  const contentAlignment = align === "right" ? "items-end" : "items-start";

  return (
    <div className={`flex flex-col ${contentAlignment} gap-3 ${textAlignment}`}>
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold"
        style={{
          backgroundColor: team.primaryColor,
          color: team.secondaryColor,
        }}
      >
        {team.code}
      </div>
      <div className="max-w-[9rem]">
        <p className="break-words text-base font-semibold leading-5 text-slate-950">{team.name}</p>
        <p className="mt-1 text-sm text-slate-500">{team.supportLabel}</p>
      </div>
    </div>
  );
}

function Badge({
  badge,
  subtle = false,
}: {
  badge: HomepageMatchCardViewModel["statusBadge"];
  subtle?: boolean;
}) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getBadgeClassName(badge.tone, subtle)}`}>
      {badge.label}
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
      : "border border-amber-200 bg-amber-100 text-amber-700";
  }

  if (tone === "warning") {
    return subtle
      ? "border border-amber-200 bg-amber-50 text-amber-800"
      : "border border-rose-200 bg-rose-100 text-rose-700";
  }

  return subtle
    ? "border border-slate-200 bg-slate-50 text-slate-700"
    : "border border-slate-300 bg-slate-200 text-slate-700";
}

