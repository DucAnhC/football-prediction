# Beads Backlog

## B-001 Foundation Structure
Status: done
Priority: high

### Goal
Tạo nền tảng dữ liệu và cấu trúc code cho app bóng đá.

### Scope
- Tạo thư mục:
  - src/lib/ai
  - src/lib/api
  - src/lib/utils
  - src/services/prediction
- Hoàn thiện types:
  - src/types/match.ts
  - src/types/team.ts
  - src/types/statistics.ts
  - src/types/prediction.ts
- Hoàn thiện mock data:
  - src/data/leagues.ts
  - src/data/matches.ts
  - src/data/predictions.ts

### Rules
- Chỉ làm phần foundation
- Không build full UI
- Không refactor file không liên quan
- Code phải typed rõ ràng

### Done When
- Types compile được
- Mock data import được
- npm run lint pass
- npm run build pass

---

## B-002 Dashboard UI
Status: done
Depends on: B-001
Priority: high

### Goal
Làm homepage dashboard bằng mock data.

### Scope
- Dùng src/app/page.tsx
- Hiển thị danh sách giải đấu lớn
- Hiển thị các trận nổi bật
- Hiển thị trạng thái trận
- Hiển thị khu prediction highlight đơn giản

### Rules
- Chỉ sửa file cần thiết cho homepage
- Dùng dữ liệu từ src/data
- UI gọn, dễ nhìn, responsive cơ bản

### Done When
- Homepage render được
- Dữ liệu lấy từ src/data
- UI responsive cơ bản
- npm run lint pass
- npm run build pass

---

## B-003 Matches List Page
Status: done
Depends on: B-002
Priority: high

### Goal
Tạo trang danh sách trận đấu bằng mock data.

### Scope
- Tạo route src/app/matches/page.tsx
- Hiển thị danh sách trận
- Có filter: live / upcoming / finished
- Hiển thị rõ league name
- Mỗi trận có:
  - home team
  - away team
  - match status
  - kickoff time hoặc score
  - link sang match detail page placeholder

### Rules
- Chưa build full match detail
- Chưa dùng real API
- Giữ code đơn giản, dễ mở rộng

### Done When
- Trang /matches render được
- Filter hoạt động
- Dùng dữ liệu từ src/data/matches.ts
- npm run lint pass
- npm run build pass

---

## B-004 Match Detail Page
Status: done
Depends on: B-003
Priority: high

### Goal
Tạo trang chi tiết trận đấu bằng mock data.

### Scope
- Tạo route src/app/matches/[id]/page.tsx
- Hiển thị:
  - tên 2 đội
  - trạng thái trận
  - tỉ số
  - thời gian thi đấu
  - thống kê chính
  - phong độ gần đây
  - head-to-head cơ bản
- Có khu prediction card placeholder

### Rules
- Chưa gọi AI thật
- Dùng mock data
- Nếu không tìm thấy trận thì có empty/not-found state

### Done When
- Trang detail render được theo id
- Có not-found state cơ bản
- Hiển thị được stats/form/h2h mock
- npm run lint pass
- npm run build pass

---

## B-005 Prediction Schema + Mock Pipeline
Status: done
Depends on: B-004
Priority: high

### Goal
Tạo bộ khung prediction có cấu trúc.

### Scope
- Tạo prediction schema rõ ràng
- Tạo mock prediction service trong src/services/prediction
- Tạo utility để map match data -> prediction input
- Đảm bảo output gồm:
  - summary
  - match_context
  - key_indicators
  - handbook_rules_used
  - risks
  - suggested_prediction
  - confidence

### Rules
- Chưa gọi model thật
- Chưa cần handbook parser phức tạp
- Ưu tiên typed output rõ ràng

### Done When
- Prediction mock service trả về đúng schema
- Có thể render mock prediction ổn định
- npm run lint pass
- npm run build pass
- npm run test pass

---

## B-006 Prediction UI
Status: done
Depends on: B-005
Priority: high

### Goal
Hiển thị prediction card đẹp, dễ đọc.

### Scope
- Tạo component prediction card tái sử dụng
- Render:
  - summary
  - key indicators
  - handbook rules used
  - risks
  - suggested prediction
  - confidence
- Dùng ở homepage highlight hoặc match detail page

### Rules
- Chỉ dùng mock prediction
- UI phải dễ scan, không quá nhiều chữ trên một khối

### Done When
- Prediction card render ổn
- Tái sử dụng được
- npm run lint pass
- npm run build pass

---

## B-007 Handbook Loader
Status: done
Depends on: B-005
Priority: medium

### Goal
Tạo bộ đọc handbook từ docs/handbook.

### Scope
- Load file handbook markdown
- Trích xuất section/rule cơ bản
- Trả về dữ liệu có cấu trúc để dùng cho prediction

### Rules
- Chỉ cần parser đơn giản
- Không làm semantic retrieval phức tạp
- Ưu tiên dễ hiểu, dễ maintain

### Done When
- Handbook load được
- Có thể lấy ra danh sách rule cơ bản
- npm run lint pass
- npm run build pass
- npm run test pass

---

## B-008 Prompt Builder
Status: done
Depends on: B-007
Priority: medium

### Goal
Tạo prompt builder cho dự đoán bóng đá.

### Scope
- Nhận:
  - match data
  - indicators
  - handbook rules liên quan
- Trả về prompt có cấu trúc rõ ràng cho model

### Rules
- Không gọi model thật
- Prompt phải ép output theo schema prediction

### Done When
- Prompt builder hoạt động
- Có test cơ bản cho output format
- npm run lint pass
- npm run build pass
- npm run test pass

---

## B-009 Prediction API Route
Status: done
Depends on: B-008
Priority: medium

### Goal
Tạo API route nội bộ cho dự đoán.

### Scope
- Tạo route API trong app/api
- Nhận match id hoặc payload
- Trả về mock prediction trước
- Thiết kế theo hướng dễ thay bằng model thật sau này

### Rules
- Chưa cần tích hợp OpenAI thật
- Validate input cơ bản

### Done When
- API route trả về prediction mock hợp lệ
- FE gọi được route này
- npm run lint pass
- npm run build pass

---

## B-010 Real Football API Integration
Status: done
Depends on: B-004
Priority: medium

### Goal
Tích hợp nguồn dữ liệu bóng đá thật.

### Scope
- Tạo wrapper trong src/lib/api
- Đưa config về .env
- Thay mock fetch ở một vài điểm chính

### Rules
- Không hardcode secret
- Có fallback khi API lỗi
- Tách riêng external API layer

### Done When
- Lấy được dữ liệu thật ở ít nhất một flow
- Có error state cơ bản
- npm run lint pass
- npm run build pass

---

## B-011 Real AI Prediction Integration
Status: done
Depends on: B-009
Priority: low

### Goal
Tích hợp model thật cho prediction.

### Scope
- Gọi model từ server side
- Dùng prompt builder + handbook loader
- Parse output về prediction schema

### Rules
- Chỉ chạy phía server
- Không để lộ API key
- Có fallback nếu model fail

### Done When
- Prediction route trả về output thật theo schema
- Có fallback/error handling
- npm run lint pass
- npm run build pass

---

## B-012 Polish + QA
Status: done
Depends on: B-006
Priority: medium

### Goal
Dọn UI, kiểm thử và hoàn thiện flow.

### Scope
- Rà lại responsive
- Sửa text/UI inconsistency
- Bổ sung loading/empty/error states
- Kiểm tra lại route chính

### Rules
- Không thêm feature mới
- Chỉ polish và fix

### Done When
- Flow chính ổn định
- UI đồng nhất hơn
- npm run lint pass
- npm run build pass
- npm run test pass







