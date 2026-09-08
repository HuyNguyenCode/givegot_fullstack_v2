# BR-11 — Hướng dẫn kiểm thử, migration và triển khai

## 0. Lưu ý bắt buộc
Bản code này cần schema mới. CHƯA chạy migration trên database hiện tại.
Không khởi động/triển khai bản mới với schema cũ: Prisma có thể báo thiếu cột.
Không dùng db push thay migration SQL: sẽ bỏ qua snapshot, phân loại legacy và constraint.
Không chạy migrate reset, seed hoặc backfill trên production để “thử xem”.

## 1. Kiểm tra offline (không đổi database)
Tại F:\givegot\givegot-v2:
```powershell
node node_modules/prisma/build/index.js validate
node scripts/test-skill-approval.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js src/lib/skill-embedding.ts src/lib/skill-publication.ts prisma/backfill-skill-embeddings.ts
git diff --check
```
Kỳ vọng: schema valid, 3 nhóm PASS, TypeScript/lint không lỗi.
Test mock không thay thế PostgreSQL/Gemini end-to-end.

## 2. Chuẩn bị staging trước khi chạy app
1. Backup đầy đủ database, kiểm tra restore được vào database staging riêng có pgvector.
2. Ghi lại số lượng Skill, UserSkill, Booking, Review, TransactionLog; lưu một số ID UserSkill có isVerified=true và roadmap.
3. Cấu hình môi trường staging dùng DB bản sao và tài khoản/email thử nghiệm. Không dán connection string vào báo cáo/log.
4. Tạm dừng app/worker đang ghi staging. DBA review rồi chạy toàn bộ prisma/migrations-manual/002_skill_embedding_readiness.sql bằng SQL editor/connection trực tiếp tới STAGING. Script chạy một lần; không chạy lại mù quáng.
5. Xác nhận snapshot br11_audit không được cấp quyền cho anon/authenticated. Không public schema audit.
6. Chạy lại Prisma Client generation khi đã đóng tiến trình giữ DLL:
```powershell
npm run db:generate
```
Nếu EPERM query_engine-windows.dll.node: đóng dev server/Node process của chính dự án bằng cách bình thường, rồi thử lại. Không xóa node_modules hay kill toàn bộ Node để giải quyết.
7. Sau generate thành công, chạy lại bước 1, rồi npm run dev với cấu hình staging.
8. Nếu kiểm tra production build: npm run build chỉ với môi trường staging; chưa thực hiện trong lần bàn giao.

## 3. SQL đối soát trên staging sau migration
```sql
SELECT status, "embeddingStatus", COUNT(*)
FROM "Skill" GROUP BY status, "embeddingStatus"
ORDER BY status, "embeddingStatus";

-- Kỳ vọng: 0 hàng READY vi phạm.
SELECT id, name FROM "Skill"
WHERE "embeddingStatus" = 'READY'
AND (status <> 'APPROVED' OR embedding IS NULL
     OR vector_dims(embedding) <> 768 OR (embedding <#> embedding) >= 0);

-- Kỳ vọng ngay sau migration: 0.
SELECT COUNT(*) FROM "Skill"
WHERE status <> 'APPROVED' AND embedding IS NOT NULL;

-- Đối chiếu backup; vector APPROVED hợp lệ cũ phải tiếp tục READY.
SELECT s.id, s.name FROM "Skill" s
JOIN br11_audit."_BR11SkillEmbeddingBackup" b ON b.id = s.id
WHERE b.status = 'APPROVED' AND b.embedding IS NOT NULL
  AND vector_dims(b.embedding) = 768 AND (b.embedding <#> b.embedding) < 0
  AND s."embeddingStatus" <> 'READY';
```
Số lượng/ID UserSkill, Booking, Review, TransactionLog phải không đổi do migration.
Kiểm tra riêng các skill legacy từng đổi tên: vector 768 chiều không chứng minh nội dung vector đúng tên.

## 4. Checklist chức năng — ba tài khoản A (user), B (người ngoài), C (admin)
1. A thêm skill mới vào GIVE và WANT, lưu profile.
   - Thấy skill trong hồ sơ riêng, trạng thái chờ duyệt; DB PENDING/NOT_STARTED, embedding null, attempts=0.
   - B không thấy skill qua dropdown, semantic/keyword search, public profile, bảng nhu cầu hoặc nhãn top skill.
   - Các skill READY khác của A vẫn được tìm thấy.
2. C chuẩn hóa tên rồi duyệt bằng nút.
   - APPROVED trước khi gọi AI; PROCESSING trong lúc chạy; READY sau khi vector được lưu.
   - B chỉ thấy skill sau READY. Vector 768 chiều và tên đã chuẩn hóa.
   - Matching notification/email chỉ gửi sau READY khi có người WANT và mentor GIVE.
3. C duyệt bằng form sửa; C tạo trực tiếp APPROVED.
   - Cùng điều kiện công bố như nút duyệt.
4. Giả lập Gemini lỗi chỉ trên staging (API key thử nghiệm không hợp lệ).
   - Skill APPROVED/FAILED, chưa công bố, error hiển thị, attempts tăng 1.
   - Không có thông báo “mentor đã sẵn sàng”; hồ sơ/skill liên kết không mất.
   - Khôi phục cấu hình key, khởi động lại staging nếu cần; bấm retry: READY.
5. Retry lỗi đến 3 lượt.
   - Không gọi AI lần 4; UI báo số lượt/disable retry. Cần xử lý nguyên nhân, không spam retry.
   - Không tự reset bộ đếm bằng thao tác production ngoài quy trình review.
6. Hai admin/tab bấm retry đồng thời.
   - Chỉ một worker claim và gọi AI; chỉ worker thắng được publish.
   - Click lại skill đã READY không tạo lại vector hay thông báo.
7. C đổi tên skill READY.
   - Trong một transaction: version tăng, vector cũ null, readiness reset.
   - Skill tạm ẩn đến khi vector tên mới READY. UserSkill/quiz/roadmap/booking không mất.
8. C chỉ đổi category hoặc lưu không đổi tên/trạng thái.
   - Version/vector READY giữ nguyên; không gọi AI lại; không gửi matching lặp.
9. Thu hồi duyệt khi AI đang chạy; hoặc đổi tên lần nữa trong lúc AI chạy.
   - Token/version cũ không ghi được; skill không tự được công bố lại bởi response cũ.
10. Mở form admin cũ, admin khác đổi trạng thái/tên, rồi lưu form cũ.
    - Báo cần tải lại, không âm thầm ghi đè quyết định mới.
11. Giả lập worker bị dừng trên staging.
    - PROCESSING chưa quá 5 phút: retry không claim.
    - Quá 5 phút, nếu còn lượt: worker mới claim; response worker cũ không ghi đè.
    - Nếu đã hết 3 lượt: cần admin kỹ thuật can thiệp theo quy trình, không tự chạy vô hạn.
12. A lưu lại profile đang có skill đã xác thực và roadmap.
    - ID UserSkill còn được chọn không đổi, isVerified và roadmap còn nguyên.
    - Chỉ xóa link user thực sự bỏ chọn; skill pending/rejected đã liên kết vẫn giữ được.
    - Skill approved nhưng FAILED không cho người chưa liên kết chọn mới.
13. A xóa hết GIVE hoặc WANT.
    - Xóa đúng loại link; vector tương ứng null; loại còn lại không bị ảnh hưởng.
14. Người thường gọi các server action admin trực tiếp.
    - Tạo/duyệt/sửa/từ chối/retry bị từ chối; không có ghi DB hoặc gọi AI.
    - Người ngoài không lấy được skill riêng tư qua các getter hồ sơ; owner/admin vẫn xem được.
15. Maintenance trên staging (tùy chọn, có gọi AI):
    - Chỉ sau review quota, chạy node node_modules/tsx/dist/cli.mjs prisma/backfill-skill-embeddings.ts.
    - PENDING/REJECTED không gọi AI; READY không tạo lại; dùng cùng giới hạn/claim.
    - Script không gửi matching email hàng loạt. User aggregate backfill chỉ chạy lúc đã tạm dừng ghi.

## 5. Regression ngoài BR-11
- Đặt booking với mentor có skill READY; xác nhận, hủy pending và confirmed; số dư/Trust/ledger đúng chính sách đã chốt.
- Mở booking cũ khi skill liên quan bị thu hồi: không mất booking, chat, Meet, lịch sử hay quyền xử lý tranh chấp.
- Review gate 48h và màu Trust 45/85 giữ nguyên.
- Ví: xem lịch sử, thử nạp/rút ở sandbox; không có giao dịch ngoài ý muốn do duyệt skill.
- Quiz đã hoàn thành: badge/isVerified không mất sau lưu profile; làm quiz mới và xem lại kết quả.
- Roadmap đã lưu: mở lại sau thêm/sửa skill khác, không mất dữ liệu.
- Search keyword/semantic/fallback và leaderboard: giữ mentor/skill READY cũ; chỉ loại skill chưa công bố.
- Hai thiết bị/tài khoản: refresh/reopen profile để xem trạng thái mới. Chưa thêm live subscription cho trạng thái skill.
Chụp trước/sau và lưu ID giao dịch; báo lỗi kèm bước tái hiện, trạng thái skill, version/attempts. Không gửi API key hoặc connection string.

## 6. Tiêu chí được triển khai thật
- Generate, typecheck, offline test, staging SQL và toàn bộ checklist đạt.
- Đã review snapshot/constraint/quyền DB, backup/restore, quota AI và thời gian bảo trì.
- User xác nhận riêng việc áp dụng migration thật. Chưa có bước production nào được thực hiện.
- Thứ tự: dừng writers cũ -> backup -> migration -> đối soát -> deploy code/client mới -> smoke test -> mở traffic.
Không để writer cũ chạy song song: code cũ không duy trì readiness/version, có thể bị constraint chặn.

## 7. Rollback
Ưu tiên roll-forward nếu chỉ lỗi config/AI, vì không làm mất quyết định kiểm duyệt mới.
Nếu cần quay về code cũ:
1. Dừng traffic và worker, snapshot lại dữ liệu hiện tại.
2. Không drop cột/table hoặc restore toàn DB một cách máy móc.
3. DBA chuẩn bị rollback tương thích với writer cũ và constraint READY; code cũ không hiểu readiness nên không được mở traffic chỉ bằng git revert.
4. Snapshot br11_audit hỗ trợ đối chiếu/khôi phục vector, nhưng chỉ khôi phục có chọn lọc khi name/status vẫn phù hợp; không ghi đè thay đổi mới.
5. Kiểm tra lại booking/ledger/quiz/roadmap trước mở traffic.
Chưa cung cấp/chạy destructive rollback tự động.

## Giới hạn thông báo
Notification/email vẫn best-effort: process chết sau READY trước khi gửi có thể thiếu thông báo; không có outbox đảm bảo exactly-once. Đây không phải bằng chứng skill chưa được công bố.
