# Football AI Predictor

Ứng dụng Next.js cho theo dõi bóng đá với bảng điều khiển trận đấu, danh sách trận, trang chi tiết và dự đoán có cấu trúc.

## Tính năng hiện có

- Trang chủ tổng hợp giải đấu lớn, trận nổi bật và điểm nhấn dự đoán
- Danh sách trận với bộ lọc trạng thái: trực tiếp, sắp diễn ra, đã kết thúc
- Trang chi tiết trận với thống kê, phong độ, lịch sử đối đầu và thẻ dự đoán
- API route `/api/predictions` hỗ trợ lấy dự đoán theo `matchId` hoặc theo payload trận đấu
- Tự động dùng dữ liệu mô phỏng khi Football API hoặc OpenAI chưa được cấu hình

## Khởi động dự án

```bash
npm install
npm run dev
```

Mở `http://localhost:3000` để xem ứng dụng.

## Biến môi trường

Tạo `.env.local` từ `.env.example` và cấu hình theo nhu cầu:

- `FOOTBALL_API_BASE_URL`: địa chỉ Football API
- `FOOTBALL_API_KEY`: khóa truy cập Football API nếu nhà cung cấp yêu cầu
- `OPENAI_API_KEY`: khóa OpenAI để bật dự đoán AI thực tế
- `OPENAI_MODEL`: model OpenAI dùng cho Structured Outputs

Nếu chưa cấu hình Football API hoặc OpenAI, ứng dụng vẫn hoạt động bằng dữ liệu mô phỏng và dự đoán mô phỏng.

## Lệnh kiểm tra

```bash
npm run lint
npm run build
npm run test
```
