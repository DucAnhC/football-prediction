import Link from "next/link";
import { SectionHeading } from "@/components/dashboard/section-heading";
import { MatchListItem } from "@/components/matches/match-list-item";
import {
  buildFootballDataNotice,
  getDashboardSnapshotWithFallback,
} from "@/lib/api";
import { buildMatchListCardViewModel, getCompetitionDisplayTier } from "@/lib/view-models";
import { formatUtcDateTime as formatUtcDateTimeLabel } from "@/lib/utils";
import type { League, Match } from "@/types/match";

interface MatchesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type MatchFilter = "all" | "live" | "upcoming" | "finished";

const statusOrder = {
  live: 0,
  scheduled: 1,
  finished: 2,
  postponed: 3,
} as const;

const CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT = 20;

const filterOptions: Array<{
  key: MatchFilter;
  label: string;
  description: string;
}> = [
  {
    key: "all",
    label: "Tất cả",
    description: "Xem toàn bộ trận đấu hiện có trong nguồn dữ liệu hiện tại.",
  },
  {
    key: "live",
    label: "Trực tiếp",
    description: "Tập trung vào các trận đang diễn ra.",
  },
  {
    key: "upcoming",
    label: "Sắp diễn ra",
    description: "Theo dõi những trận chuẩn bị bóng lăn.",
  },
  {
    key: "finished",
    label: "Đã kết thúc",
    description: "Rà soát các trận đã hoàn thành.",
  },
];

export default async function MatchesPage({
  searchParams,
}: MatchesPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawStatus = Array.isArray(resolvedSearchParams.status)
    ? resolvedSearchParams.status[0]
    : resolvedSearchParams.status;
  const currentFilter = isMatchFilter(rawStatus) ? rawStatus : "all";
  const snapshotResult = await getDashboardSnapshotWithFallback();
  const leagueById = new Map(
    snapshotResult.data.leagues.map((league) => [league.id, league] as const),
  );
  const leaguePriorityById = new Map(
    snapshotResult.data.leagues.map((league) => [league.id, league.priority] as const),
  );
  const orderedMatches: Match[] = [...snapshotResult.data.matches].sort((left, right) =>
    compareMatchesForDisplay(left, right, leaguePriorityById, leagueById),
  );
  const filteredMatches = orderedMatches.filter((match) =>
    shouldIncludeMatch(match, currentFilter),
  );
  const matchCards = filteredMatches.map((match) =>
    buildMatchListCardViewModel({
      match,
      league: leagueById.get(match.leagueId),
      kickoffLabel: formatUtcDateTimeLabel(match.kickoffTime),
      dataSource: snapshotResult.source,
    }),
  );
  const dataNotice = buildFootballDataNotice([snapshotResult]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#eef2ff_100%)] font-sans text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_0.95fr]">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                  Danh sách trận đấu
                </span>
                <SourceBadge source={snapshotResult.source} />
              </div>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Lọc trận theo trạng thái và quét nhanh dữ liệu lõi trước khi mở trang chi tiết.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Trang danh sách ưu tiên thẻ gọn, chỉ giữ các trường đáng tin như giải đấu, thời gian,
                tỷ số và nhãn chất lượng dữ liệu. Metadata yếu sẽ được dời xuống trang chi tiết.
              </p>
              {dataNotice ? (
                <div className="mt-4">
                  <DataNotice message={dataNotice} />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {filterOptions.slice(1).map((option) => (
                <div
                  key={option.key}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-sm font-medium text-slate-500">{option.label}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {orderedMatches.filter((match) => shouldIncludeMatch(match, option.key)).length}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeading
            title="Bộ lọc trạng thái"
            description="Mỗi trạng thái có một liên kết riêng để dễ chia sẻ. Danh sách vẫn ưu tiên giải quen thuộc trước, rồi mới đến các giải ít bối cảnh hoặc bị hoãn."
          />
          <div className="flex flex-wrap gap-3">
            {filterOptions.map((option) => {
              const isActive = option.key === currentFilter;
              const href = option.key === "all" ? "/matches" : `/matches?status=${option.key}`;
              const count = orderedMatches.filter((match) =>
                shouldIncludeMatch(match, option.key),
              ).length;

              return (
                <Link
                  key={option.key}
                  href={href}
                  className={`inline-flex items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-950 hover:text-slate-950"
                  }`}
                >
                  <span>{option.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="text-sm leading-6 text-slate-600">
            {filterOptions.find((option) => option.key === currentFilter)?.description}
          </p>
        </section>

        <section className="space-y-5">
          <SectionHeading
            title="Danh sách trận"
            description="Mỗi thẻ chỉ giữ lại thông tin cốt lõi đáng tin và một nhãn ngắn cho biết mức độ đầy đủ của dữ liệu hiện tại."
          />

          {matchCards.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {matchCards.map((viewModel) => (
                <MatchListItem key={viewModel.id} viewModel={viewModel} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm shadow-slate-200/70">
              <p className="text-lg font-semibold text-slate-950">
                Không tìm thấy dữ liệu phù hợp với bộ lọc này.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Hãy chuyển sang bộ lọc khác hoặc quay về danh sách tất cả để tiếp tục theo dõi.
              </p>
              <Link
                href="/matches"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Xem tất cả trận đấu
              </Link>
            </div>
          )}
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

function isMatchFilter(value: string | undefined): value is MatchFilter {
  return value === "all" || value === "live" || value === "upcoming" || value === "finished";
}

function shouldIncludeMatch(match: Match, filter: MatchFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "upcoming") {
    return match.status === "scheduled";
  }

  return match.status === filter;
}

function compareMatchesForDisplay(
  left: Match,
  right: Match,
  leaguePriorityById: ReadonlyMap<string, number>,
  leagueById: ReadonlyMap<string, League>,
) {
  const leftLeaguePriority = leaguePriorityById.get(left.leagueId) ?? 999;
  const rightLeaguePriority = leaguePriorityById.get(right.leagueId) ?? 999;
  const leftLeague = leaguePriorityById.has(left.leagueId)
    ? leftLeaguePriority <= CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT
    : false;
  const rightLeague = leaguePriorityById.has(right.leagueId)
    ? rightLeaguePriority <= CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT
    : false;

  if (leftLeague !== rightLeague) {
    return leftLeague ? -1 : 1;
  }

  const leftTier = getCompetitionDisplayTier(leagueById.get(left.leagueId));
  const rightTier = getCompetitionDisplayTier(leagueById.get(right.leagueId));

  if (leftTier !== rightTier) {
    return leftTier === "limited" ? 1 : -1;
  }

  const statusDifference = statusOrder[left.status] - statusOrder[right.status];

  if (statusDifference !== 0) {
    return statusDifference;
  }

  if (leftLeaguePriority !== rightLeaguePriority) {
    return leftLeaguePriority - rightLeaguePriority;
  }

  return left.kickoffTime.localeCompare(right.kickoffTime);
}

function SourceBadge({ source }: { source: "api" | "mock" }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
        source === "api"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {source === "api" ? "Dữ liệu trực tiếp" : "Dữ liệu mô phỏng"}
    </span>
  );
}
