# BR-11 — Nhật ký thay đổi và phạm vi
Ngày: 2026-09-04. Trạng thái: code/migration được chuẩn bị; CHƯA áp dụng database thật.

## Quy tắc triển khai
- Giữ Skill.status: PENDING / APPROVED / REJECTED.
- Bổ sung Skill.embeddingStatus: NOT_STARTED / PROCESSING / READY / FAILED.
- Chỉ APPROVED + READY được công bố; constraint SQL yêu cầu READY có vector hợp lệ.
- Embedding dùng tên skill đã chuẩn hóa; quiz/isVerified là khái niệm khác.
- Không có AI/background job tự chạy lúc migration. Mỗi request tạo tối đa một lần; tối đa 3 lượt cho một phiên bản. Đây là retry chủ động, không phải scheduler.

## Lịch sử
1. Bản đầu chuyển tạo Skill.embedding từ user sang admin, lọc dữ liệu hồ sơ và backfill. Chưa có readiness riêng.
2. Review phát hiện approved-but-no-vector có thể công bố sớm, backfill thiếu chốt lúc ghi, dữ liệu cũ chưa đối soát.
3. Bản hiện tại thay thế cơ chế đó bằng readiness/version/token, sửa đồng bộ các đường công bố, bổ sung migration và kiểm thử. Các ghi chú cũ về “không thay schema” không còn áp dụng cho bản này.

## Tracking theo file
- prisma/schema.prisma: thêm enum và 6 trường readiness, version, attempts, token, startedAt, error; không đổi/xóa status, ID hay quan hệ.
- prisma/migrations-manual/002_skill_embedding_readiness.sql: migration manual chạy một lần trong transaction. Snapshot Skill trước sửa vector vào schema br11_audit; giữ APPROVED có vector hợp lệ ở READY; các trường hợp khác NOT_STARTED và vector null; thêm constraint bảo vệ READY. Không thay UserSkill, Booking, Review, TransactionLog.
- src/lib/skill-publication.ts: điều kiện công bố chung + nhãn tiếng Việt.
- src/lib/skill-embedding.ts: claim nguyên tử; version/token chống worker cũ; lease 5 phút; giới hạn 3 lượt; xác thực 768 số hữu hạn, vector khác zero; lỗi thành FAILED; không gọi AI với PENDING/REJECTED; READY không tạo lại.
- src/actions/admin.ts: auth cho đọc moderation, tạo/duyệt/sửa/từ chối/retry; đổi tên/trạng thái tăng version, reset attempts và xóa vector cũ trong cùng transaction; sửa category không reset vector; edit/approve chống ghi đè phiên bản cũ; chỉ worker công bố thành công mới gọi thông báo matching cũ; revalidate trang liên quan.
- src/actions/user.ts: available skills và cross-match chỉ dùng published skills; user đã liên kết vẫn giữ pending/rejected trong hồ sơ; người ngoài không đọc được skill chưa công bố qua getter hồ sơ; owner API lấy readiness; chỉ xóa UserSkill bị bỏ chọn, giữ ID/isVerified/roadmap còn dùng; profile vector chỉ dùng published skills và không ghi [] khi AI lỗi.
- src/actions/mentor.ts: SQL semantic, keyword, fallback và mảng skill trả về cùng lọc published; không đổi trọng số/công thức similarity.
- src/actions/analytics.ts: thống kê skill và top-skill không lộ skill chưa công bố; không đổi công thức Trust Score hoặc thứ tự xếp hạng Mentor.
- src/app/admin/skills/page.tsx: hiển thị readiness/attempts/error, nút retry; form edit gửi version đã tải.
- src/app/profile/page.tsx: mục owner-only các skill chưa công bố; refresh sau lưu. Flow quiz sau đó được harden riêng ở mục Option 1 bên dưới.
- prisma/backfill-skill-embeddings.ts: dùng chung worker có claim/version/token; không tự chạy; không gửi matching email hàng loạt.
- prisma/backfill-embeddings.ts: chỉ lấy published skills; xóa vector tổng hợp khi không còn published skill. Chạy maintenance khi đã tạm dừng ghi.
- scripts/test-skill-approval.cjs: test module TypeScript thật bằng mock DB/AI/auth/email; không gửi dữ liệu hay email ra ngoài.
- BR11-TEST-GUIDE.md: quy trình staging, SQL đối soát, checklist chức năng, rollout/rollback.

## Các chức năng không sửa nghiệp vụ
Booking/cancel/review, ví/VNPay/rút tiền, Trust Score, đình chỉ, chat/Meet và roadmap API không bị thay đổi bởi phần BR-11 ban đầu. Quiz chỉ được harden theo mục Option 1 bên dưới.
Giữ UserSkill ID còn dùng để không mất verification/roadmap khi lưu profile.
Các thay đổi 48h và màu Trust đã chốt trước không bị chỉnh lại.

## Kết quả và giới hạn
- Audit profile publication trước merge: tách `SkillNotReadyError` cho APPROVED nhưng embedding chưa READY. PROCESSING/NOT_STARTED báo hệ thống đang chuẩn bị; FAILED báo admin cần kiểm tra/thử lại. PENDING và REJECTED vẫn có message riêng.
- Đổi caller mới sang `getPublishedSkillNames`; helper lọc bằng `PUBLISHED_SKILL_WHERE` (APPROVED + READY). Giữ alias `getApprovedSkillNames` để không break caller cũ.
- Regression test xác nhận: APPROVED+READY save được; pending đã liên kết được giữ; APPROVED+PROCESSING/FAILED trả đúng message; verified GIVE giữ ID/isVerified; WANT giữ ID/roadmap.
- Contract admin hậu-commit có `persisted` và `publicationOutcome`; approval/create đã commit không trả failure sai lệch khi bước công bố hậu-commit lỗi.
- Schema validate: PASS.
- TypeScript noEmit: PASS.
- Test offline: PASS nhóm moderation/AI, concurrency, privacy, profile, migration source.
- Migration BR-11 đã chạy thành công trên database staging tách biệt ngày 2026-09-08; chưa chạy production hoặc backfill. Đối soát sau migration được ghi tại `BR11-STAGING-BACKUP-NOTE.md`.
- Prisma Client đã generate lại thành công sau khi user chủ động dừng dev server.
- Lint module mới (worker, publication, skill backfill): PASS; không khẳng định toàn repo sạch lint.
- Không chứng minh được tính nguyên tử PostgreSQL bằng mock. Phải chạy checklist concurrency trên staging.
- Notification/email giữ cơ chế best-effort cũ: nếu process chết sau READY trước khi gửi, có thể thiếu thông báo. Chưa thêm transactional outbox/exactly-once delivery.
- Backfill công bố skill nhưng không broadcast thông báo hàng loạt, giữ phạm vi maintenance cũ.
- Migration xác định vector cũ hợp lệ theo kích thước và khác zero; không chứng minh vector đó tương ứng đúng tên hiện tại. Cần rà dữ liệu legacy từng đổi tên.
- Sau 3 lượt lỗi hoặc crash, cần admin kỹ thuật kiểm tra nguyên nhân. Không có vòng retry vô hạn hay nút reset không giới hạn.
- NOT_STARTED cho skill chưa duyệt không đồng nghĩa user mất các booking/quyền lợi đã phát sinh.

## Regression hardening — partial success sau DB commit
- Audit các risk #7–#10: worker đã bắt lỗi Gemini và READY short-circuit, nên lỗi dịch vụ thông thường không làm approval/create trả failure và sửa category/lưu không đổi không gọi AI lại.
- Harden thêm `prepareSkillForSearch`: lỗi bất ngờ ở bước hậu-commit (embedding/notification/cache refresh) không thể biến một create/approval đã lưu DB thành response `success:false`.
- Response thành công giờ có `persisted: true` và `publicationOutcome`: `PUBLISHED`, `SAVED_NOT_PUBLISHED`, hoặc `NOT_APPLICABLE`. Contract phân biệt rõ “đã lưu moderation/create” với “đã công bố”.
- Khi embedding chưa READY, message nói rõ skill đã được duyệt nhưng chưa công bố và hướng admin xem trạng thái/retry; UI reload danh sách và đã có readiness/error/attempts/retry riêng.
- Việt hóa message create/update/reject liên quan; từ chối trả thông báo rõ skill không xuất hiện trong tìm kiếm.
- Thêm regression test cho cả approval và create APPROVED khi embedding throw sau commit: response vẫn thành công/persisted, publication outcome chưa hoàn tất, DB mock vẫn APPROVED/FAILED.
- Test sau hardening: ba nhóm BR-11 PASS; TypeScript noEmit PASS; ESLint các file admin/embedding PASS; diff check PASS (chỉ cảnh báo line ending).

## Option 1 — chặn xác thực skill chưa công bố
- `src/app/profile/page.tsx`: chỉ hiển thị nút làm bài khi skill đạt `APPROVED + READY`; hiển thị nhãn riêng cho chưa lưu, chờ duyệt, bị từ chối, đang chuẩn bị và lỗi cần Admin xử lý. Huy hiệu xác thực cũ được giữ trong DB nhưng chỉ hiển thị khi skill đang được công bố.
- `src/actions/quiz.ts`: yêu cầu đăng nhập; chỉ chủ sở hữu của `UserSkill` loại GIVE và skill `APPROVED + READY` được tạo quiz hoặc lưu `isVerified`; dùng conditional `updateMany` để kiểm tra lại nguyên tử tại thời điểm ghi, kể cả khi Admin đổi trạng thái lúc quiz đang mở; lookup chi tiết skill chỉ cho chính chủ.
- `src/components/QuizModal.tsx`: không báo đã lưu huy hiệu trước khi server xác nhận; hiển thị lỗi partial-success rõ ràng và khóa nút đóng trong lúc đang ghi.
- `scripts/test-quiz-publication.cjs`: regression test offline cho unauthenticated, unpublished/wrong-owner, published owner và final conditional write.
- Không thay schema, không migration, không xóa `isVerified`, không đổi flow lưu profile/roadmap/booking/matching.
- Giới hạn được giữ theo lựa chọn Option 1: đáp án và chấm điểm quiz vẫn nằm phía client; chuyển toàn bộ attempt/scoring sang server là Option 2 riêng, chưa thực hiện.
