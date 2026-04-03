import Link from "next/link";

export default function MatchNotFound() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#eef2ff_100%)] font-sans text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <div className="rounded-[32px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-10">
          <p className="text-sm font-medium text-sky-700">Không tìm thấy trận đấu</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Không tìm thấy dữ liệu phù hợp cho trận đấu này.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Hãy quay lại danh sách trận để chọn một cặp đấu hợp lệ hoặc tiếp tục từ trang chủ.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/matches" className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              Về danh sách trận
            </Link>
            <Link href="/" className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950">
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
