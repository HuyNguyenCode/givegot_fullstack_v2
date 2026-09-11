# PA-02 — Deadline review, no-show và auto-complete

## Phạm vi đã thực hiện

- Thêm timeline chính sách trong chi tiết `Buổi học` và `Buổi giảng dạy`:
  kết thúc buổi học, hạn review/no-show 48 giờ, thời gian khóa tạm thời,
  auto-complete sau 72 giờ và trạng thái GivePoint.
- Thay xác nhận no-show một dòng bằng modal giải thích trước ba kết quả có thể
  xảy ra. Backend hiện hữu vẫn là nơi duy nhất quyết định kết quả thực tế.
- Sau khi xử lý no-show, hiển thị kết quả đúng với verdict trả về từ backend.
- Thêm cron notification tại các mốc còn 24 giờ, còn 2 giờ và quá hạn review.
  Notification được chống lặp theo booking + milestone mà không cần đổi schema.
- Thêm notification cho cả Mentor và Mentee sau khi auto-complete thành công.
- Gia cố auto-complete bằng conditional claim trong cùng transaction để hai cron
  chạy đồng thời không thể chuyển cùng một GivePoint hai lần.
- Thêm lịch chạy hourly cho `/api/cron/review-deadlines` trong `vercel.json`.

## Những phần cố ý không thay đổi

- Không thay schema hoặc migration database.
- Không đổi ngưỡng nghiệp vụ: review gate 48 giờ, auto-complete 72 giờ.
- Không đổi ba nhánh phân xử no-show, mức GivePoint hoặc Trust Score hiện hữu.
- Không đổi luồng booking, cancellation, skill approval, quiz hay withdrawal.
- Notification chạy sau transaction và là best-effort; lỗi notification không
  rollback hoặc làm sai trạng thái booking/GivePoint đã chốt.

## Kiểm thử tự động

- `node scripts/test-pa02-deadlines.cjs`
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`
- ESLint tập trung cho toàn bộ file PA-02.
- Regression scripts của cancellation, skill approval, quiz publication và
  withdrawal rejection.
