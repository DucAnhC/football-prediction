import { PageLoading } from "@/components/state/page-loading";

export default function MatchDetailLoading() {
  return (
    <PageLoading
      badge="Đang tải chi tiết trận"
      title="Đang chuẩn bị thông tin trận đấu"
      description="Thống kê, phong độ, lịch sử đối đầu và dự đoán đang được sắp xếp để hiển thị đầy đủ."
      cardCount={2}
    />
  );
}
