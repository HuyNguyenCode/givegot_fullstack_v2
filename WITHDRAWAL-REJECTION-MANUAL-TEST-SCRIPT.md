# Manual test script — Atomic withdrawal rejection refund

## 1. Mục tiêu

Xác nhận khi Admin từ chối một yêu cầu rút tiền PENDING:

1. request chuyển thành REJECTED;
2. toàn bộ điểm đã giữ được trả lại ngay cho Mentor;
3. có đúng một ledger `REFUND_WITHDRAWAL_REJECTED`;
4. không thể hoàn trùng, kể cả double-click, refresh, retry hoặc hai Admin xử lý đồng thời.

Chỉ chạy trên staging. Không sửa dữ liệu trực tiếp trong Supabase để tạo kết quả mong muốn.

## 2. Tài khoản và dữ liệu chuẩn bị

- Mentor A: user thường, có ít nhất 20 GivePoints.
- Admin A.
- Admin B hoặc tab admin thứ hai.
- User B: user thường, dùng để test quyền.
- Mỗi test cần request mới thì tạo qua Wallet/Cash-out UI, không insert SQL.
- Dùng số điểm khác nhau để dễ nhận diện: 1, 2, 3, 4, 5.

Ghi cho mỗi request:

| Request | ID | Điểm rút | Số dư trước tạo | Số dư sau tạo | Trạng thái |
|---|---|---:|---:|---:|---|
| R1 | | 1 | | | PENDING |
| R2 | | 2 | | | PENDING |
| R3 | | 3 | | | PENDING |
| R4 | | 4 | | | PENDING |
| R5 | | 5 | | | PENDING |

## 3. SQL chỉ đọc để đối soát

Thay `<REQUEST_ID>`, chạy trong Supabase SQL Editor:

```sql
SELECT
  w.id,
  w.status,
  w."pointsRequested",
  w."mentorId",
  u."givePoints" AS "mentorBalance",
  COUNT(l.id) FILTER (
    WHERE l.type = 'REFUND_WITHDRAWAL_REJECTED'
  ) AS "refundLedgerCount",
  COALESCE(SUM(l.amount) FILTER (
    WHERE l.type = 'REFUND_WITHDRAWAL_REJECTED'
  ), 0) AS "totalRefunded"
FROM "WithdrawRequest" w
JOIN "User" u ON u.id = w."mentorId"
LEFT JOIN "TransactionLog" l
  ON l."referenceId" = 'withdrawal-rejection:' || w.id
WHERE w.id = '<REQUEST_ID>'
GROUP BY w.id, u."givePoints";
```

Xem ledger cụ thể:

```sql
SELECT id, "userId", amount, type, status, "referenceId", "createdAt"
FROM "TransactionLog"
WHERE "referenceId" = 'withdrawal-rejection:<REQUEST_ID>'
ORDER BY "createdAt";
```

Tất cả SQL trong tài liệu này là SELECT, không làm thay đổi database.

## 4. Test cases bắt buộc

### WR-01 — Tạo request phải giữ điểm trước

1. Mentor A ghi lại balance.
2. Tạo R1 rút 1 điểm.
3. Refresh Wallet và Admin Finance.

Expected:

- Balance giảm đúng 1 ngay khi tạo.
- R1 = PENDING.
- Có CASHOUT ledger amount = -1.
- Chưa có REFUND_WITHDRAWAL_REJECTED.

### WR-02 — Reject happy path

1. Ghi baseline R1 bằng SQL.
2. Admin A bấm Từ chối đúng một lần.
3. Refresh Admin Finance, Wallet và History.

Expected:

- UI báo “Đã từ chối yêu cầu và hoàn ngay 1 GivePoints vào ví Mentor.”
- R1 = REJECTED.
- Balance tăng đúng 1, trở về mức trước khi tạo R1.
- Đúng một refund ledger: amount +1, SUCCESS.
- referenceId = `withdrawal-rejection:<R1_ID>`.
- History hiển thị “Hoàn điểm do yêu cầu rút tiền bị từ chối”.
- Không có nút hoàn điểm thủ công.

### WR-03 — Refresh/reopen không hoàn lại lần nữa

1. Refresh Admin Finance nhiều lần.
2. Logout/login lại Mentor A.
3. Mở lại Wallet và History.

Expected:

- Balance không tăng thêm.
- R1 vẫn REJECTED.
- Refund ledger count vẫn bằng 1; totalRefunded vẫn bằng 1.

### WR-04 — Double-click

1. Tạo R2 rút 2 điểm.
2. Admin bấm nhanh nút Từ chối hai lần.
3. Đối soát SQL.

Expected:

- Nút bị disabled trong lúc request đang chạy.
- Chỉ một thao tác thành công.
- Balance chỉ được cộng 2 một lần.
- Refund ledger count = 1; totalRefunded = 2.

### WR-05 — Hai Admin/tab xử lý đồng thời

1. Tạo R3 rút 3 điểm.
2. Mở cùng R3 ở Admin A và Admin B/hai tab.
3. Hai bên bấm Từ chối gần như đồng thời.
4. Đối soát SQL.

Expected:

- Chỉ một bên thành công.
- Bên còn lại thấy request đã/vừa được xử lý.
- R3 = REJECTED.
- Balance chỉ cộng 3 một lần.
- Refund ledger count = 1; totalRefunded = 3.

### WR-06 — Approve không hoàn điểm

1. Tạo R4 rút 4 điểm.
2. Ghi balance sau khi tạo.
3. Admin bấm Duyệt.
4. Đối soát SQL/Wallet/History.

Expected:

- R4 = APPROVED.
- Balance không thay đổi so với sau khi tạo request.
- Không có REFUND_WITHDRAWAL_REJECTED cho R4.
- Không có khoản +4 trong ledger.

### WR-07 — Không thể Reject sau Approve

1. Mở lại/tab cũ của R4.
2. Thử thao tác Từ chối nếu UI/tab cũ còn nút.
3. Đối soát.

Expected:

- Action bị từ chối vì request không còn PENDING.
- R4 vẫn APPROVED.
- Balance không đổi.
- Refund ledger count = 0.

### WR-08 — Không thể Approve sau Reject

1. Mở tab cũ của R2 hoặc R3.
2. Thử bấm Duyệt nếu tab cũ còn nút.
3. Đối soát.

Expected:

- Action bị từ chối.
- Request vẫn REJECTED.
- Balance không đổi.
- Refund ledger count vẫn = 1.

### WR-09 — Mất mạng/đóng tab sau khi bấm Reject

1. Tạo R5 rút 5 điểm.
2. Admin bấm Reject rồi lập tức đóng tab hoặc chuyển Offline trong DevTools.
3. Không đoán kết quả từ toast; mở tab mới, reload Finance và chạy SELECT.

Expected hợp lệ chỉ có một trong hai trạng thái:

- PENDING, balance chưa hoàn, ledger 0; hoặc
- REJECTED, balance +5, ledger đúng 1.

Không chấp nhận:

- REJECTED nhưng chưa hoàn điểm;
- đã hoàn điểm nhưng request còn PENDING;
- ledger có nhưng balance không tăng;
- nhiều hơn một ledger hoặc tổng hoàn lớn hơn +5.

Sau khi biết trạng thái thật, nếu còn PENDING thì Admin có thể Reject lại. Nếu đã REJECTED thì không retry.

### WR-10 — User thường không được xử lý

1. Login User B.
2. Thử mở `/admin/finance`.
3. Nếu dùng DevTools/network replay để gọi action thì chỉ dùng trên staging.

Expected:

- User thường không có quyền xử lý.
- Action trả “Bạn không có quyền xử lý yêu cầu rút tiền.”
- Request, balance và ledger không đổi.

### WR-11 — Request không tồn tại

Chỉ thực hiện qua test tự động hoặc request ID giả trên staging; không sửa URL/code production.

Expected:

- Trả “Không tìm thấy yêu cầu rút tiền.”
- Không thay đổi bất kỳ balance/request/ledger nào.

### WR-12 — Hai request khác nhau của cùng Mentor

1. Mentor A tạo hai request mới, lần lượt 1 và 2 điểm.
2. Reject request 1; giữ request 2 PENDING.
3. Đối soát.
4. Sau đó reject request 2 và đối soát lại.

Expected:

- Lần đầu chỉ +1 và một ledger gắn request 1.
- Request 2 vẫn PENDING và chưa được hoàn.
- Lần sau +2 và một ledger riêng gắn request 2.
- Tổng hoàn = 3; mỗi request có đúng một ledger.

### WR-13 — Số tiền lớn/toàn bộ số dư

1. Mentor có N điểm tạo request rút đúng N.
2. Xác nhận balance về 0.
3. Admin Reject.

Expected:

- Balance trở lại đúng N.
- Không âm, không làm tròn, không đổi tỷ lệ.
- Ledger refund amount = +N.

### WR-14 — Input không hợp lệ khi tạo withdrawal

Thử tạo request với 0, số âm, lớn hơn balance và bank details trống.

Expected:

- Không tạo request.
- Không trừ điểm.
- Không tạo CASHOUT/refund ledger.

### WR-15 — Ledger hiển thị và bất biến

Với một request đã Reject:

- CASHOUT cũ vẫn tồn tại với số âm.
- Refund ledger mới tồn tại với số dương.
- Hai dòng không bị sửa thành một dòng net-zero.
- Tổng hai dòng bằng 0 cho request bị Reject.
- Refresh/history filter không làm mất ledger.

## 5. Edge cases kỹ thuật — không phá staging để manual test

Các case dưới đây được cover bởi:

```powershell
node scripts/test-withdrawal-rejection.cjs
```

- Ledger insert throw: toàn transaction rollback, request PENDING, balance không đổi.
- Wallet update throw: transaction rollback, không ledger.
- `pointsRequested <= 0` do dữ liệu DB hỏng: từ chối xử lý, không credit.
- Non-admin direct server-action call: không transaction.
- Repeat after REJECTED: không hoàn trùng.
- APPROVED path: status-only.

Không tạo trigger lỗi, không sửa `pointsRequested`, không xóa user và không cố tình phá connection trên database dùng chung chỉ để manual-test các case này.

## 6. Regression ngoài rule

- Tạo withdrawal vẫn trừ điểm và tạo CASHOUT + PENDING request trong một transaction.
- Duyệt withdrawal không hoàn/trừ thêm điểm.
- Wallet balance, History và Admin Finance tải bình thường.
- Top-up sandbox vẫn hoạt động.
- Booking create/cancel/complete không đổi ledger.
- BR-11 skill tests vẫn PASS.
- User thường không vào được admin finance.

## 7. Pass/fail record

| Case | PASS/FAIL | Request ID | Balance trước | Balance sau | Refund ledger count | Ghi chú/ảnh |
|---|---|---|---:|---:|---:|---|
| WR-01 | | | | | | |
| WR-02 | | | | | | |
| WR-03 | | | | | | |
| WR-04 | | | | | | |
| WR-05 | | | | | | |
| WR-06 | | | | | | |
| WR-07 | | | | | | |
| WR-08 | | | | | | |
| WR-09 | | | | | | |
| WR-10 | | | | | | |
| WR-11 | automated | | | | | |
| WR-12 | | | | | | |
| WR-13 | | | | | | |
| WR-14 | | | | | | |
| WR-15 | | | | | | |

## 8. Release gate

Chỉ PASS release khi:

- automated commands đều PASS;
- WR-01 đến WR-10 và WR-12 đến WR-15 PASS;
- mỗi rejected request có đúng một positive refund ledger;
- không có partial state;
- migration 003 chạy trước code ở môi trường đích;
- historical REJECTED requests đã được audit riêng, không bulk-refund mù quáng.
