import { LeagueOverviewCard } from "@/components/dashboard/league-overview-card";
import { MatchCard } from "@/components/dashboard/match-card";
import { PredictionHighlightCard } from "@/components/dashboard/prediction-highlight-card";
import { PredictionReferenceCard } from "@/components/dashboard/prediction-reference-card";
import { SectionHeading } from "@/components/dashboard/section-heading";
import {
  buildFootballDataNotice,
  getDashboardSnapshotWithFallback,
} from "@/lib/api";
import {
  buildHomepageMatchCardViewModel,
  buildPredictionHighlightViewModel,
  getCompetitionDisplayTier,
  getPredictionDisplayTier,
} from "@/lib/view-models";
import { formatUtcDateTime as formatUtcDateTimeLabel } from "@/lib/utils";
import { buildMockPredictions } from "@/services/prediction";
import type { League, Match } from "@/types/match";
import type { MatchPrediction } from "@/types/prediction";

const statusOrder = {
  live: 0,
  scheduled: 1,
  finished: 2,
  postponed: 3,
} as const;

const CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT = 20;

const countryCopy = {
  England: "Anh",
  Spain: "Tây Ban Nha",
  Germany: "Đức",
  Italy: "Ý",
  France: "Pháp",
  Europe: "Châu Âu",
  World: "Thế giới",
  International: "Quốc tế",
} as const;

export default async function Home() {
  const snapshotResult = await getDashboardSnapshotWithFallback();
  const leagueById = new Map(
    snapshotResult.data.leagues.map((league) => [league.id, league] as const),
  );
  const leaguePriorityById = new Map(
    snapshotResult.data.leagues.map((league) => [league.id, league.priority] as const),
  );
  const orderedLeagues = [...snapshotResult.data.leagues].sort(
    (left, right) => left.priority - right.priority,
  );
  const orderedMatches: Match[] = [...snapshotResult.data.matches].sort((left, right) =>
    compareMatchesForDisplay(left, right, leaguePriorityById),
  );
  const predictions = buildMockPredictions(
    orderedMatches,
    new Map(orderedLeagues.map((league) => [league.id, league.name] as const)),
  );
  const predictionByMatchId = new Map(
    predictions.map((prediction) => [prediction.matchId, prediction] as const),
  );
  const dataNotice = buildFootballDataNotice([snapshotResult]);

  const leaguesWithMatches = orderedLeagues.filter((league) =>
    orderedMatches.some((match) => match.leagueId === league.id),
  );
  const majorLeagues = leaguesWithMatches
    .filter(
      (league) =>
        league.priority <= CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT &&
        getCompetitionDisplayTier(league) === "major",
    )
    .slice(0, 4);
  const majorLeagueIds = new Set(majorLeagues.map((league) => league.id));
  const leagueSummaries = majorLeagues.map((league) => buildLeagueSummary(league, orderedMatches));

  const liveMatches = orderedMatches.filter((match) => match.status === "live");
  const scheduledMatches = orderedMatches.filter((match) => match.status === "scheduled");
  const finishedMatches = orderedMatches.filter((match) => match.status === "finished");

  const featuredLiveMatches = pickMatchesForSection(liveMatches, leagueById, 4);
  const featuredScheduledMatches = pickMatchesForSection(scheduledMatches, leagueById, 4);

  const liveMatchCards = featuredLiveMatches.map((match) =>
    buildHomepageMatchCardViewModel({
      match,
      league: leagueById.get(match.leagueId),
      kickoffLabel: formatUtcDateTimeLabel(match.kickoffTime),
      dataSource: snapshotResult.source,
    }),
  );
  const scheduledMatchCards = featuredScheduledMatches.map((match) =>
    buildHomepageMatchCardViewModel({
      match,
      league: leagueById.get(match.leagueId),
      kickoffLabel: formatUtcDateTimeLabel(match.kickoffTime),
      dataSource: snapshotResult.source,
      prediction: predictionByMatchId.get(match.id),
    }),
  );

  const predictionItems = scheduledMatches.flatMap((match) => {
    const prediction = predictionByMatchId.get(match.id);

    if (!prediction) {
      return [];
    }

    return [{
      match,
      prediction,
      league: leagueById.get(match.leagueId),
    }];
  });

  const sortedPredictionItems = [...predictionItems].sort((left, right) =>
    comparePredictionItems(left, right, leaguePriorityById, majorLeagueIds),
  );
  const strongPredictionCards = sortedPredictionItems
    .filter(({ prediction }) => getPredictionDisplayTier(prediction) === "strong")
    .slice(0, 3)
    .map(({ match, prediction, league }) =>
      buildPredictionHighlightViewModel({
        match,
        league,
        prediction,
        updatedLabel: formatUtcDateTimeLabel(prediction.generatedAt),
      }),
    );
  const mediumPredictionCards = sortedPredictionItems
    .filter(({ prediction }) => getPredictionDisplayTier(prediction) === "medium")
    .slice(0, 4)
    .map(({ match, prediction, league }) =>
      buildPredictionHighlightViewModel({
        match,
        league,
        prediction,
        updatedLabel: formatUtcDateTimeLabel(prediction.generatedAt),
      }),
    );
  const weakSignalCount = scheduledMatches.filter((match) => {
    const prediction = predictionByMatchId.get(match.id);

    return prediction && getPredictionDisplayTier(prediction) === "weak";
  }).length;

  const statusSummary = [
    { label: "Trực tiếp", value: liveMatches.length },
    { label: "Sắp diễn ra", value: scheduledMatches.length },
    { label: "Đã kết thúc", value: finishedMatches.length },
  ];

  const hasPredictionSurface =
    strongPredictionCards.length > 0 || mediumPredictionCards.length > 0;
  const hasMainSections =
    liveMatchCards.length > 0 ||
    scheduledMatchCards.length > 0 ||
    hasPredictionSurface ||
    leagueSummaries.length > 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_40%,#eef2ff_100%)] font-sans text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                  Bảng điều khiển bóng đá
                </span>
                <SourceBadge source={snapshotResult.source} />
              </div>
              <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Theo dõi trận trực tiếp, lịch sắp diễn ra và insight trước trận trên cùng một màn hình.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Trang chủ ưu tiên hiển thị dữ liệu lõi đáng tin trước. Insight trước trận được tách
                riêng và chỉ đẩy lên khi mức tín hiệu đủ rõ để không tạo cảm giác chắc chắn quá mức.
              </p>

              {dataNotice ? (
                <div className="mt-4">
                  <DataNotice message={dataNotice} />
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sky-700">
                  {liveMatches.length} trận trực tiếp
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  {scheduledMatches.length} trận sắp diễn ra
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
                  {strongPredictionCards.length} insight đủ nổi bật
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  {mediumPredictionCards.length} nhận định tham khảo
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700">
                  {weakSignalCount} tín hiệu yếu giữ trong thẻ trận
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {statusSummary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-sm font-medium text-slate-500">{item.label}</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {liveMatchCards.length > 0 ? (
          <section className="space-y-5">
            <SectionHeading
              title="Trực tiếp nổi bật"
              description="Khu vực này chỉ giữ dữ liệu lõi có giá trị theo dõi nhanh: giải đấu, trạng thái, tỷ số và một mức chất lượng dữ liệu ngắn gọn."
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {liveMatchCards.map((viewModel) => (
                <MatchCard key={viewModel.id} viewModel={viewModel} />
              ))}
            </div>
          </section>
        ) : null}

        {scheduledMatchCards.length > 0 ? (
          <section className="space-y-5">
            <SectionHeading
              title="Sắp diễn ra đáng chú ý"
              description="Các trận trước giờ bóng lăn được giữ gọn ở dữ liệu lịch đấu và bối cảnh cơ bản. Insight chỉ xuất hiện như nhãn ngắn, không trộn lẫn với dữ liệu trực tiếp."
            />
            <div className="grid gap-4 xl:grid-cols-2">
              {scheduledMatchCards.map((viewModel) => (
                <MatchCard key={viewModel.id} viewModel={viewModel} />
              ))}
            </div>
          </section>
        ) : null}

        {hasPredictionSurface ? (
          <section className="space-y-5">
            <SectionHeading
              title="Nhận định tham khảo"
              description="Insight trước trận được gom riêng để dễ đọc đúng ngữ cảnh. Mức đủ rõ sẽ đứng trước, còn tín hiệu vừa phải vẫn được giữ lại như nhận định tham khảo thay vì biến mất hoàn toàn."
            />
            {strongPredictionCards.length > 0 ? (
              <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                {strongPredictionCards.map((viewModel) => (
                  <PredictionHighlightCard key={viewModel.id} viewModel={viewModel} />
                ))}
              </div>
            ) : null}
            {mediumPredictionCards.length > 0 ? (
              <div className="space-y-4">
                {strongPredictionCards.length > 0 ? (
                  <p className="text-sm leading-6 text-slate-600">
                    Các trận bên dưới vẫn có dữ liệu dự đoán, nhưng mức chắc chắn mới ở ngưỡng tham khảo.
                  </p>
                ) : null}
                <div className="grid gap-4 xl:grid-cols-2">
                  {mediumPredictionCards.map((viewModel) => (
                    <PredictionReferenceCard
                      key={`reference-${viewModel.id}`}
                      viewModel={viewModel}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {leagueSummaries.length > 0 ? (
          <section className="space-y-5">
            <SectionHeading
              title="Giải đấu lớn hôm nay"
              description="Chỉ giữ lại các giải quen thuộc thực sự có mặt trong dữ liệu hôm nay, tránh đẩy các giải ít bối cảnh lên vị trí nổi bật."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {leagueSummaries.map((league) => (
                <LeagueOverviewCard
                  key={league.id}
                  name={league.name}
                  country={league.countryLabel}
                  seasonLabel={league.seasonLabel}
                  roundLabel={league.roundLabel}
                  matchCount={league.matchCount}
                  featuredClubs={league.featuredClubs}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!hasMainSections ? (
          <EmptySectionCard
            title="Hiện chưa có dữ liệu đủ tốt để làm nổi bật trên trang chủ."
            description="Khi nguồn dữ liệu có trận trực tiếp, lịch đáng chú ý hoặc insight đủ rõ hơn, các khối nội dung sẽ tự xuất hiện lại."
          />
        ) : null}
      </main>
    </div>
  );
}

function buildLeagueSummary(league: League, matches: readonly Match[]) {
  const leagueMatches = matches.filter((match) => match.leagueId === league.id);
  const featuredClubs = Array.from(
    new Set(
      leagueMatches.flatMap((match) => [
        match.homeTeam.shortName,
        match.awayTeam.shortName,
      ]),
    ),
  ).slice(0, 4);

  return {
    ...league,
    countryLabel:
      countryCopy[league.country as keyof typeof countryCopy] ?? league.country,
    roundLabel: formatRound(league.currentRound),
    matchCount: leagueMatches.length,
    featuredClubs,
  };
}

function formatRound(value: string) {
  return value.replace("Matchweek", "Vòng");
}

function pickMatchesForSection(
  matches: readonly Match[],
  leagueById: ReadonlyMap<string, League>,
  limit: number,
) {
  const preferredMatches = matches.filter((match) => {
    const tier = getCompetitionDisplayTier(leagueById.get(match.leagueId));

    return tier !== "limited";
  });

  return (preferredMatches.length > 0 ? preferredMatches : matches).slice(0, limit);
}

function compareMatchesForDisplay(
  left: Match,
  right: Match,
  leaguePriorityById: ReadonlyMap<string, number>,
) {
  const leftLeaguePriority = leaguePriorityById.get(left.leagueId) ?? 999;
  const rightLeaguePriority = leaguePriorityById.get(right.leagueId) ?? 999;
  const leftIsCuratedLeague = leftLeaguePriority <= CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT;
  const rightIsCuratedLeague = rightLeaguePriority <= CURATED_MAJOR_LEAGUE_PRIORITY_LIMIT;

  if (leftIsCuratedLeague !== rightIsCuratedLeague) {
    return leftIsCuratedLeague ? -1 : 1;
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

function comparePredictionItems(
  left: PredictionDisplayItem,
  right: PredictionDisplayItem,
  leaguePriorityById: ReadonlyMap<string, number>,
  majorLeagueIds: ReadonlySet<string>,
) {
  const leftTier = getPredictionDisplayTier(left.prediction);
  const rightTier = getPredictionDisplayTier(right.prediction);
  const leftTierScore = leftTier === "strong" ? 0 : leftTier === "medium" ? 1 : 2;
  const rightTierScore = rightTier === "strong" ? 0 : rightTier === "medium" ? 1 : 2;

  if (leftTierScore !== rightTierScore) {
    return leftTierScore - rightTierScore;
  }

  const leftMajor = majorLeagueIds.has(left.match.leagueId);
  const rightMajor = majorLeagueIds.has(right.match.leagueId);

  if (leftMajor !== rightMajor) {
    return leftMajor ? -1 : 1;
  }

  const leftCompetitionTier = getCompetitionDisplayTier(left.league);
  const rightCompetitionTier = getCompetitionDisplayTier(right.league);

  if (leftCompetitionTier !== rightCompetitionTier) {
    return leftCompetitionTier === "limited" ? 1 : -1;
  }

  const scoreDifference =
    right.prediction.output.confidence_score - left.prediction.output.confidence_score;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return compareMatchesForDisplay(left.match, right.match, leaguePriorityById);
}

interface PredictionDisplayItem {
  match: Match;
  prediction: MatchPrediction;
  league: League | undefined;
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

function DataNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
      {message}
    </div>
  );
}

function EmptySectionCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm shadow-slate-200/70">
      <p className="text-lg font-semibold text-slate-950">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
