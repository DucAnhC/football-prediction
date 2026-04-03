interface PageLoadingProps {
  badge: string;
  title: string;
  description: string;
  cardCount?: number;
}

export function PageLoading({
  badge,
  title,
  description,
  cardCount = 3,
}: PageLoadingProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#eef2ff_100%)] font-sans text-slate-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
          <div className="animate-pulse">
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
              {badge}
            </span>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </p>
            <div className="mt-4 h-5 max-w-2xl rounded-xl bg-slate-200" />
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">
              {description}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: cardCount }, (_, index) => (
            <div
              key={`loading-card-${index}`}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70"
            >
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-28 rounded-full bg-slate-200" />
                <div className="h-7 w-3/4 rounded-2xl bg-slate-200" />
                <div className="h-24 rounded-3xl bg-slate-100" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="h-20 rounded-2xl bg-slate-100" />
                  <div className="h-20 rounded-2xl bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
