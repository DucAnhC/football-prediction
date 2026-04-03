"use client";

import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  void error;

  return (
    <html lang="vi">
      <body>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe_0%,#f8fafc_42%,#eef2ff_100%)] font-sans text-slate-950">
          <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
            <div className="rounded-[32px] border border-white/80 bg-white/90 p-8 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur sm:p-10">
              <p className="text-sm font-medium text-amber-700">Đã xảy ra lỗi</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Không thể hoàn tất yêu cầu này vào lúc này.
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Bạn có thể thử tải lại, quay về trang chủ hoặc truy cập lại trang này sau ít giây.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Thử tải lại
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                >
                  Về trang chủ
                </Link>
              </div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
