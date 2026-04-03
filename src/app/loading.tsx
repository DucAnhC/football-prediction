import { PageLoading } from "@/components/state/page-loading";

export default function Loading() {
  return (
    <PageLoading
      badge="Đang tải trang chủ"
      title="Đang chuẩn bị bảng điều khiển bóng đá"
      description="Hệ thống đang nạp giải đấu lớn, trận nổi bật và các điểm nhấn dự đoán."
    />
  );
}
