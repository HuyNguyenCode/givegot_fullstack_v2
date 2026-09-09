# PA-01 — Minh bạch booking và hủy lịch

Ngày: 2026-09-08. Phạm vi: UX/UI và contract trả kết quả của cancellation; không đổi policy tài chính/Trust hiện có, không migration database.

## Đã thay đổi

- `src/components/MenteeBookingCalendar.tsx`: thay lời hứa hoàn điểm sai bằng thông tin đúng: giữ 1 GivePoint khi booking, pending hoàn 100%/không Trust penalty, confirmed theo mốc 12 giờ; thêm link chính sách hủy.
- `src/app/policies/cancellation/page.tsx`: trang chính sách công khai, diễn giải đúng bốn nhánh pending, mentee early/late và mentor early/late.
- `src/actions/booking.ts`: thêm `getCancellationPreview()` chỉ đọc. Preview kiểm tra booking tồn tại, người gọi là participant, trạng thái có thể hủy và trả policy/timing/điểm/Trust/suspension theo dữ liệu hiện tại. `cancelBooking()` giữ nguyên transaction, chỉ trả thêm `cancellation` sau khi transaction thành công để UI làm biên nhận từ kết quả đã commit.
- `src/components/CancellationImpactDialog.tsx`: modal dùng chung thay confirm chung chung; hiển thị thời gian còn lại, GivePoint, Trust trước/sau, cảnh báo đình chỉ và receipt có mã booking/link `/history` sau khi thành công.
- `src/components/CancellationImpactDialog.tsx`: refresh Dashboard/lịch chỉ chạy sau khi người dùng đóng biên nhận. Điều này ngăn Mentee bị unmount modal trước khi nhìn thấy kết quả đã commit.
- `src/actions/booking.ts` + `src/components/CancellationReceiptDetails.tsx`: thêm truy vấn chỉ-đọc dựng lại biên nhận từ `TransactionLog` và `TrustHistory`; không thêm cột, không migration. Cả hai participant có thể xem outcome khi mở một booking `CANCELLED`.
- Sửa regression tại mốc 12 giờ: biên nhận trả về ngay sau `cancelBooking()` giờ đây dùng đúng outcome trả từ transaction đã commit, không tính lại early/late bằng một lần gọi đồng hồ thứ hai.
- Sửa audit ambiguity của booking pending: nếu log lịch sử không chứng minh được ai hủy, receipt trả `unknown` và UI nói rõ dữ liệu cũ không lưu actor; không còn tự gán Mentee là người hủy. Booking bị Mentor từ chối vẫn được nhận diện từ `BOOKING_DECLINED`.
- `src/components/SessionDetailDialog.tsx`, `src/components/UnifiedDashboardCalendar.tsx`: khi click một item bị hủy ở Lịch giảng dạy/Lịch học hoặc calendar tổng hợp, hiển thị chi tiết hủy, GivePoint, Trust và link lịch sử. `src/components/CancelBookingDialog.tsx`, `src/app/dashboard/page.tsx`: tiếp tục dùng modal chung; accept/decline/report/chat/review/slot flows không thay đổi.
- `scripts/test-cancellation-preview.cjs`: regression test preview, post-commit receipt lifecycle và receipt của hủy/từ chối.

## Policy được phản ánh, không thay đổi

- Pending: hoàn 1 GivePoint cho Mentee, không đổi Trust.
- Confirmed, Mentee hủy từ 12 giờ trở lên: hoàn 1 GivePoint, −2 Trust.
- Confirmed, Mentee hủy dưới 12 giờ: 1 GivePoint bồi thường Mentor, −10 Trust.
- Confirmed, Mentor hủy: hoàn 1 GivePoint cho Mentee; −5 Trust từ 12 giờ trở lên hoặc −20 Trust dưới 12 giờ.
- Trust mới dưới 30 dẫn tới đình chỉ, theo server flow sẵn có.
