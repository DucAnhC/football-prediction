import { formatInteger } from "@/lib/utils";

interface LeagueOverviewCardProps {
  name: string;
  country: string;
  seasonLabel: string;
  roundLabel: string;
  matchCount: number;
  featuredClubs: readonly string[];
}

export function LeagueOverviewCard({
  name,
  country,
  seasonLabel,
  roundLabel,
  matchCount,
  featuredClubs,
}: LeagueOverviewCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{country}</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            {name}
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          {seasonLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            Vòng đấu
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{roundLabel}</p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-600">
            Số trận
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatInteger(matchCount, { allowZero: true })}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          Câu lạc bộ nổi bật
        </p>
        {featuredClubs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {featuredClubs.map((club) => (
              <span
                key={club}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
              >
                {club}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Chưa đủ dữ liệu câu lạc bộ để làm nổi bật ở giải này.
          </p>
        )}
      </div>
    </article>
  );
}
