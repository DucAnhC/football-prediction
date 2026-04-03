interface SectionHeadingProps {
  title: string;
  description: string;
}

export function SectionHeading({
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-sky-700">Tổng quan</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      <p className="max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
