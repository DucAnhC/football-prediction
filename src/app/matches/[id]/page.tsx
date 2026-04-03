import Link from "next/link";
import { notFound } from "next/navigation";
import { PredictionCard } from "@/components/prediction/prediction-card";
import { matches as fallbackMatches } from "@/data/matches";
import {
  buildFootballDataNotice,
  getMatchContextWithFallback,
} from "@/lib/api";
import {
  buildMatchDetailViewModel,
  type BadgeTone,
  type MatchDetailFieldViewModel,
} from "@/lib/view-models";
import {
  formatDecimal,
  formatInteger,
  formatPercentage,
  formatUtcDateTime,
  hasFormData,
  hasStandingData,
} from "@/lib/utils";
import { buildMockPrediction } from "@/services/prediction";
import type { Match } from "@/types/match";
import type { FormResult } from "@/types/team";

interface MatchDetailPageProps {
  params: Promise<{ id: string }>;
}

interface HeadToHeadEntry {
  summary: string;
  meetings: readonly string[];
}

const headToHeadByPair: Record<string, HeadToHeadEntry> = {
  "arsenal::liverpool": {
    summary: "5 lần gặp gần nhất: Arsenal thắng 2, Liverpool thắng 1 và hai đội hòa 2 trận.",
    meetings: [
      "04/01/2026 - Arsenal 2-1 Liverpool",
      "11/08/2025 - Liverpool 1-1 Arsenal",
      "18/05/2025 - Arsenal 0-0 Liverpool",
    ],
  },
  "manchester-city::tottenham": {
    summary: "5 lần gặp gần nhất: Man City thắng 3, Tottenham thắng 2 và chưa có trận hòa.",
    meetings: [
      "22/11/2025 - Tottenham 1-2 Man City",
      "03/05/2025 - Man City 1-2 Tottenham",
      "14/12/2024 - Tottenham 0-3 Man City",
    ],
  },
  "barcelona::real-madrid": {
    summary: "5 lần gặp gần nhất: Real Madrid thắng 2, Barcelona thắng 2 và hai đội hòa 1 trận.",
    meetings: [
      "26/10/2025 - Barcelona 1-2 Real Madrid",
      "21/04/2025 - Real Madrid 2-2 Barcelona",
      "12/01/2025 - Real Madrid 1-3 Barcelona",
    ],
  },
};

export async function generateStaticParams() {
  return fallbackMatches.map((match) => ({ id: match.id }));
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { id } = await params;
  const contextResult = await getMatchContextWithFallback(id);
  const match = contextResult.data.match;

  if (!match) {
    notFound();
  }

  const league = contextResult.data.league;
  const prediction = buildMockPrediction(match, league?.name);
  const comparisonStats = buildComparisonStats(match);
  const headToHead = getHeadToHead(match);
  const dataNotice = buildFootballDataNotice([contextResult]);
  const detailViewModel = buildMatchDetailViewModel({
    match,
    league,
    source: contextResult.source,
    coverage: contextResult.data.coverage,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#eef2ff_100%)] font-sans text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Link href="/matches" className="rounded-full border border-slate-300 px-4 py-2 transition hover:border-slate-900 hover:text-slate-950">
              Quay lại danh sách trận
            </Link>
            <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-700">
              {detailViewModel.competitionLabel}
            </span>
            <ToneBadge badge={detailViewModel.statusBadge} />
            <ToneBadge badge={detailViewModel.sourceBadge} subtle />
            <ToneBadge badge={detailViewModel.qualityBadge} subtle />
          </div>

          {dataNotice ? (
            <div className="mt-4">
              <DataNotice message={dataNotice} />
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
            {detailViewModel.dataQualityNote}
          </div>

          {detailViewModel.coverageNotice ? (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
              {detailViewModel.coverageNotice}
            </div>
          ) : null}

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
            <div>
              <p className="text-sm font-medium text-slate-500">{detailViewModel.roundLabel}</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                {detailViewModel.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                {detailViewModel.headline}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MetaTile
                  field={{
                    label: "Giờ bóng lăn",
                    value: detailViewModel.kickoffLabel,
                    note: null,
                    state: "available",
                  }}
                />
                <MetaTile field={detailViewModel.metadataFields.venue} />
                <MetaTile field={detailViewModel.metadataFields.location} />
                <MetaTile field={detailViewModel.metadataFields.referee} />
                <MetaTile field={detailViewModel.metadataFields.homeCoach} />
                <MetaTile field={detailViewModel.metadataFields.awayCoach} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm shadow-slate-950/20">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <TeamScoreBlock name={match.homeTeam.shortName} code={match.homeTeam.code} align="right" />
                <div className="min-w-[108px] text-center">
                  <p className="text-4xl font-semibold tracking-tight">{detailViewModel.scoreLabel}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                    {detailViewModel.clockLabel}
                  </p>
                </div>
                <TeamScoreBlock name={match.awayTeam.shortName} code={match.awayTeam.code} align="left" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <SectionTitle
              title="Thống kê chính"
              description={detailViewModel.statisticsDescription}
            />
            {comparisonStats.length > 0 ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {comparisonStats.map((item) => (
                  <ComparisonCard
                    key={item.label}
                    label={item.label}
                    homeValue={item.homeValue}
                    awayValue={item.awayValue}
                  />
                ))}
              </div>
            ) : (
              <EmptyInfoCard message="Chưa đủ dữ liệu để hiển thị phần so sánh đáng tin cậy cho trận này." />
            )}
          </article>

          <PredictionCard
            prediction={prediction}
            updatedLabel={formatUtcDateTime(prediction.generatedAt)}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <SectionTitle
              title="Phong độ gần đây"
              description="Hiển thị kết quả 5 trận gần nhất cùng số bàn thắng, số bàn thua và số trận giữ sạch lưới của từng đội."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <FormPanel
                teamName={match.homeTeam.shortName}
                lastFive={match.homeTeam.form.lastFive}
                scored={match.homeTeam.form.scoredInLastFive}
                conceded={match.homeTeam.form.concededInLastFive}
                cleanSheets={match.homeTeam.form.cleanSheets}
              />
              <FormPanel
                teamName={match.awayTeam.shortName}
                lastFive={match.awayTeam.form.lastFive}
                scored={match.awayTeam.form.scoredInLastFive}
                conceded={match.awayTeam.form.concededInLastFive}
                cleanSheets={match.awayTeam.form.cleanSheets}
              />
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
            <SectionTitle
              title="Lịch sử đối đầu"
              description="Tóm tắt nhanh những lần chạm trán gần đây để bổ sung bối cảnh trước trận đấu."
            />
            <p className="mt-6 text-sm leading-6 text-slate-600">{headToHead.summary}</p>
            <div className="mt-5 space-y-3">
              {headToHead.meetings.map((meeting) => (
                <div key={meeting} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {meeting}
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function DataNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
      {message}
    </div>
  );
}

function buildComparisonStats(match: Match) {
  if (match.statistics) {
    return [
      {
        label: "Kiểm soát bóng",
        homeValue: formatPercentage(match.statistics.home.possession),
        awayValue: formatPercentage(match.statistics.away.possession),
      },
      {
        label: "Sút trúng đích",
        homeValue: formatInteger(match.statistics.home.shots.onTarget),
        awayValue: formatInteger(match.statistics.away.shots.onTarget),
      },
      {
        label: "xG",
        homeValue: formatDecimal(match.statistics.home.shots.expectedGoals, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 1,
        }),
        awayValue: formatDecimal(match.statistics.away.shots.expectedGoals, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 1,
        }),
      },
      {
        label: "Kiểm soát khu vực",
        homeValue: formatPercentage(match.statistics.territoryControl.home),
        awayValue: formatPercentage(match.statistics.territoryControl.away),
      },
    ];
  }

  if (!hasStandingData(match.homeTeam.standing) && !hasStandingData(match.awayTeam.standing)) {
    return [];
  }

  return [
    {
      label: "Điểm hiện tại",
      homeValue: hasStandingData(match.homeTeam.standing)
        ? formatInteger(match.homeTeam.standing.points)
        : "Chưa rõ",
      awayValue: hasStandingData(match.awayTeam.standing)
        ? formatInteger(match.awayTeam.standing.points)
        : "Chưa rõ",
    },
    {
      label: "Vị trí BXH",
      homeValue: hasStandingData(match.homeTeam.standing)
        ? formatInteger(match.homeTeam.standing.position)
        : "Chưa rõ",
      awayValue: hasStandingData(match.awayTeam.standing)
        ? formatInteger(match.awayTeam.standing.position)
        : "Chưa rõ",
    },
    {
      label: "Bàn thắng 5 trận",
      homeValue: hasFormData(match.homeTeam.form)
        ? formatInteger(match.homeTeam.form.scoredInLastFive)
        : "Chưa rõ",
      awayValue: hasFormData(match.awayTeam.form)
        ? formatInteger(match.awayTeam.form.scoredInLastFive)
        : "Chưa rõ",
    },
    {
      label: "Giữ sạch lưới",
      homeValue: hasFormData(match.homeTeam.form)
        ? formatInteger(match.homeTeam.form.cleanSheets)
        : "Chưa rõ",
      awayValue: hasFormData(match.awayTeam.form)
        ? formatInteger(match.awayTeam.form.cleanSheets)
        : "Chưa rõ",
    },
  ];
}

function getHeadToHead(match: Match) {
  const key = [match.homeTeam.id, match.awayTeam.id].sort().join("::");

  return (
    headToHeadByPair[key] ?? {
      summary: "Chưa có dữ liệu đối đầu riêng cho cặp đấu này.",
      meetings: ["Thông tin đối đầu sẽ được bổ sung khi lớp dữ liệu được mở rộng hơn."],
    }
  );
}

function ToneBadge({
  badge,
  subtle = false,
}: {
  badge: { label: string; tone: BadgeTone };
  subtle?: boolean;
}) {
  return (
    <span className={`rounded-full px-3 py-1 font-medium ${getBadgeClassName(badge.tone, subtle)}`}>
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

function MetaTile({ field }: { field: MatchDetailFieldViewModel }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{field.label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-950">{field.value}</p>
      {field.note ? <p className="mt-2 text-xs leading-5 text-slate-500">{field.note}</p> : null}
    </div>
  );
}

function EmptyInfoCard({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
      {message}
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-sky-700">Chi tiết trận</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function TeamScoreBlock({ name, code, align }: { name: string; code: string; align: "left" | "right" }) {
  const alignment = align === "right" ? "items-end text-right" : "items-start text-left";

  return (
    <div className={`flex flex-col ${alignment} gap-3`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white">
        {code}
      </div>
      <p className="max-w-[9rem] break-words text-base font-semibold leading-5">{name}</p>
    </div>
  );
}

function ComparisonCard({ label, homeValue, awayValue }: { label: string; homeValue: string; awayValue: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
        <p className="text-right font-semibold text-slate-950">{homeValue}</p>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">so với</span>
        <p className="font-semibold text-slate-950">{awayValue}</p>
      </div>
    </div>
  );
}

function FormPanel({
  teamName,
  lastFive,
  scored,
  conceded,
  cleanSheets,
}: {
  teamName: string;
  lastFive: readonly FormResult[];
  scored: number;
  conceded: number;
  cleanSheets: number;
}) {
  if (!hasFormData({ lastFive, scoredInLastFive: scored, concededInLastFive: conceded, cleanSheets })) {
    return (
      <div className="rounded-3xl bg-slate-50 p-5">
        <p className="text-lg font-semibold text-slate-950">{teamName}</p>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Chưa đủ dữ liệu phong độ để hiển thị phần này một cách đáng tin cậy.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-slate-50 p-5">
      <p className="text-lg font-semibold text-slate-950">{teamName}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {lastFive.map((result, index) => (
          <span
            key={`${teamName}-${result}-${index}`}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${getFormClassName(result)}`}
          >
            {result}
          </span>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-slate-500">Bàn thắng</p>
          <p className="mt-1 font-semibold text-slate-950">{scored}</p>
        </div>
        <div>
          <p className="text-slate-500">Thủng lưới</p>
          <p className="mt-1 font-semibold text-slate-950">{conceded}</p>
        </div>
        <div>
          <p className="text-slate-500">Giữ sạch lưới</p>
          <p className="mt-1 font-semibold text-slate-950">{cleanSheets}</p>
        </div>
      </div>
    </div>
  );
}

function getFormClassName(result: FormResult) {
  if (result === "W") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (result === "D") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-rose-100 text-rose-700";
}

