import { PageLoading } from "@/components/state/page-loading";

export default function MatchesLoading() {
  return (
    <PageLoading
      badge="Đang tải danh sách trận"
      title="Đang chuẩn bị danh sách trận đấu"
      description="Hệ thống đang nạp bộ lọc trạng thái và dữ liệu trận đấu để bạn theo dõi nhanh hơn."
    />
  );
}
