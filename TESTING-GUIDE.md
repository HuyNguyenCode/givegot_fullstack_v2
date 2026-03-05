# 🧪 Complete Testing Guide - GiveGot Platform

## 🎯 Overview

This guide provides step-by-step testing instructions for all features of the GiveGot platform, with a focus on the new Authentication and Transaction History features.

---

## ⚡ Quick Start (5 minutes)

### Prerequisites

```bash
# 1. Ensure database is set up
npm run db:push

# 2. Run backfill scripts
npm run db:backfill-transactions

# 3. Start dev server
npm run dev
```

### Verify Setup

1. Open `http://localhost:3000`
2. ✅ DevBar visible at top (purple gradient)
3. ✅ Can switch between users
4. ✅ No console errors

---

## 🧪 Test Suite 1: Transaction Logging (15 minutes)

### Test 1.1: Booking Creation Logging

**Objective:** Verify that booking a session logs a -1 transaction

**Steps:**

1. Switch to **Bob Smith** (DevBar)
2. Note current balance (e.g., 3 pts)
3. Navigate to `/discover`
4. Click on **Alice Johnson**
5. Click a green available slot
6. In modal, click **"Confirm Booking (1 pt)"**
7. Wait for success toast
8. Navigate to `/history`

**Expected Results:**

✅ **Bookings Tab:**
- New booking appears at top
- Status: 🟡 PENDING
- Role: 👨‍🎓 Mentee
- With: Alice Johnson
- Points: -1

✅ **Ledger Tab:**
- New transaction at top
- Type: 🔴 Booking Created
- Amount: -1
- Balance after: 2 pts (3 - 1)

✅ **Summary Cards:**
- Current Balance: 2 pts
- Total Spent: +1 (incremented)
- Bookings Created: +1 (incremented)

**Pass Criteria:** All 3 checks pass

---

### Test 1.2: Session Completion Logging

**Objective:** Verify that completing a session logs a +1 transaction for mentor

**Steps:**

1. Continue from Test 1.1 (Bob has pending booking)
2. Switch to **Alice Johnson**
3. Navigate to `/dashboard`
4. Find Bob's booking request
5. Click **"Accept Booking"**
6. Wait for success alert
7. Switch to **Bob Smith**
8. Navigate to `/dashboard`
9. Find the confirmed booking
10. Click **"Complete Session"**
11. Submit 5-star review
12. Switch to **Alice Johnson**
13. Navigate to `/history`

**Expected Results:**

✅ **Alice's Bookings Tab:**
- Booking status: ✅ COMPLETED
- Role: 👨‍🏫 Mentor
- Points: +1

✅ **Alice's Ledger Tab:**
- New transaction at top
- Type: 🟢 Session Completed
- Amount: +1
- Related To: Bob Smith
- Balance increased by 1

✅ **Alice's Summary Cards:**
- Current Balance: +1 from before
- Total Earned: +1 (incremented)
- Sessions Done: +1 (incremented)

**Pass Criteria:** All 3 checks pass

---

### Test 1.3: Cancellation Refund Logging

**Objective:** Verify that cancelling a booking logs a +1 refund

**Steps:**

1. Switch to **Bob Smith**
2. Book another session with **Carol Designer**
3. Note balance after booking (e.g., 1 pt)
4. Navigate to `/dashboard`
5. Find the pending booking
6. Click **"Cancel Booking"**
7. Confirm cancellation
8. Navigate to `/history`

**Expected Results:**

✅ **Bookings Tab:**
- Booking status: ❌ CANCELLED
- Points: +1 (refund shown)

✅ **Ledger Tab:**
- Two transactions visible:
  1. 🔵 Booking Cancelled | +1 | Balance: 2 pts
  2. 🔴 Booking Created | -1 | Balance: 1 pt

✅ **Summary Cards:**
- Current Balance: 2 pts (back to original)
- Total Spent: Same as before (net zero)

**Pass Criteria:** All 3 checks pass

---

### Test 1.4: Mentor Decline Refund Logging

**Objective:** Verify that mentor declining logs a +1 refund

**Steps:**

1. Switch to **David Lee**
2. Book a session with **Emma Python**
3. Note David's balance (e.g., 2 pts)
4. Switch to **Emma Python**
5. Navigate to `/dashboard`
6. Find David's booking request
7. Click **"Decline"** button
8. Confirm decline
9. Switch to **David Lee**
10. Navigate to `/history`

**Expected Results:**

✅ **David's Bookings Tab:**
- Booking status: ❌ CANCELLED
- Points: +1 (refund shown)

✅ **David's Ledger Tab:**
- Two transactions:
  1. 🔵 Booking Declined | +1 | Balance: 2 pts
  2. 🔴 Booking Created | -1 | Balance: 1 pt

✅ **Summary Cards:**
- Current Balance: 2 pts (refunded)

**Pass Criteria:** All 3 checks pass

---

## 🧪 Test Suite 2: History Page UI (10 minutes)

### Test 2.1: Summary Cards

**Objective:** Verify summary statistics are accurate

**Steps:**

1. Switch to any user with transaction history
2. Navigate to `/history`
3. Note the 5 summary cards

**Expected Results:**

✅ **Current Balance:**
- Matches user's actual givePoints
- Purple card with coin icon

✅ **Total Earned:**
- Sum of all positive transactions
- Green card with up arrow

✅ **Total Spent:**
- Absolute sum of all negative transactions
- Red card with down arrow

✅ **Sessions Done:**
- Count of BOOKING_COMPLETED transactions
- Blue card with checkmark

✅ **Bookings Made:**
- Count of BOOKING_CREATED transactions
- Orange card with calendar icon

**Pass Criteria:** All 5 cards show accurate data

---

### Test 2.2: Bookings Tab

**Objective:** Verify bookings table displays correctly

**Steps:**

1. On `/history` page
2. Click **"My Bookings"** tab (should be default)
3. Review the table

**Expected Results:**

✅ **Table Structure:**
- Columns: Date | Session Time | Role | With | Status | Points | Review
- All bookings displayed
- Sorted by date (newest first)

✅ **Data Accuracy:**
- Dates formatted correctly (MMM d, yyyy)
- Times formatted correctly (h:mm a)
- Role badges correct (Mentor/Mentee)
- Other user's avatar and name shown
- Status color-coded correctly
- Point impact accurate (-1, +1, or 0)
- Reviews shown with stars

✅ **Interactivity:**
- Hover effect on rows
- Table scrolls horizontally on mobile

**Pass Criteria:** All checks pass

---

### Test 2.3: Ledger Tab

**Objective:** Verify transaction ledger displays correctly

**Steps:**

1. On `/history` page
2. Click **"GivePoint Ledger"** tab
3. Review the table

**Expected Results:**

✅ **Table Structure:**
- Columns: Date & Time | Transaction Type | Related To | Amount | Balance Impact
- All transactions displayed
- Sorted by date (newest first)

✅ **Data Accuracy:**
- Timestamps precise (h:mm:ss a)
- Transaction types labeled correctly
- Related booking info shown (user + time)
- Amount color-coded (green +, red -)
- Running balance calculated correctly

✅ **Running Balance Verification:**
```
Example:
Current Balance: 5 pts

Transaction 0: +1 → Balance after: 5 pts ✅
Transaction 1: -1 → Balance after: 4 pts ✅ (5 - 1)
Transaction 2: +1 → Balance after: 5 pts ✅ (5 - 1 + 1)
Transaction 3: +3 → Balance after: 2 pts ✅ (5 - 1 + 1 - 3)
```

**Pass Criteria:** Running balance is correct for all rows

---

### Test 2.4: Empty States

**Objective:** Verify empty states display correctly

**Steps:**

1. Create a new user with no bookings
2. Navigate to `/history`

**Expected Results:**

✅ **Bookings Tab (Empty):**
- 📅 Calendar icon
- "No Bookings Yet" heading
- Helpful message
- Two action buttons: "Discover Mentors" and "Manage Availability"

✅ **Ledger Tab (Empty):**
- 💰 Coin icon
- "No Transactions Yet" heading
- Helpful message
- "Start Exploring" button

**Pass Criteria:** Both empty states render correctly

---

## 🧪 Test Suite 3: DevBar Control (5 minutes)

### Test 3.1: Development Mode

**Objective:** Verify DevBar works in dev mode

**Steps:**

1. Verify `.env` has:
   ```env
   NEXT_PUBLIC_SHOW_DEV_BAR="true"
   ```
2. Restart dev server: `npm run dev`
3. Open `http://localhost:3000`

**Expected Results:**

✅ **DevBar Visible:**
- Purple gradient bar at top
- "DEV MODE" badge visible
- Current user displayed with avatar
- Points shown in real-time
- User switcher dropdown visible

✅ **User Switching:**
- Select different user from dropdown
- Page refreshes
- New user loaded
- Balance updates
- All features work for new user

**Pass Criteria:** DevBar fully functional

---

### Test 3.2: Production Mode

**Objective:** Verify DevBar is hidden in production mode

**Steps:**

1. Edit `.env`:
   ```env
   NEXT_PUBLIC_SHOW_DEV_BAR="false"
   ```
2. Restart dev server: `npm run dev`
3. Open `http://localhost:3000`

**Expected Results:**

✅ **DevBar Hidden:**
- No purple bar at top
- No user switcher
- No "DEV MODE" badge
- Page starts with regular content

✅ **User Switching Disabled:**
- Open browser console
- Try to call `switchUser()` (if exposed)
- Should log warning: "User switching is only available in dev mode"

**Pass Criteria:** DevBar completely hidden

**Cleanup:**
```env
# Set back to dev mode
NEXT_PUBLIC_SHOW_DEV_BAR="true"
```
Restart server.

---

## 🧪 Test Suite 4: Decline Booking Flow (5 minutes)

### Test 4.1: Mentor Declines Booking

**Objective:** Verify decline button works and logs refund

**Steps:**

1. Switch to **Bob Smith**
2. Book a session with **Frank Williams**
3. Note Bob's balance (e.g., 2 pts → 1 pt)
4. Switch to **Frank Williams**
5. Navigate to `/dashboard`
6. Find Bob's booking in "Incoming Requests"
7. Click **"Decline"** button
8. Confirm decline in alert
9. Wait for success message

**Expected Results:**

✅ **Immediate UI Updates:**
- Booking disappears from dashboard
- Success alert: "Booking declined. Point refunded to mentee."

✅ **Database Changes:**
- Booking status: CANCELLED
- Slot released (isBooked = false)
- Bob's balance: 2 pts (refunded)

✅ **Transaction Logged:**
- Switch to Bob
- Go to `/history` → Ledger tab
- See 🔵 Booking Declined | +1 pt

**Pass Criteria:** All 3 checks pass

---

## 🧪 Test Suite 5: Concurrency Control (10 minutes)

### Test 5.1: Simultaneous Booking Attempt

**Objective:** Verify only one user can book the same slot

**Setup:**

1. Switch to **Alice Johnson**
2. Create a new available slot (tomorrow, 10-11 AM)
3. Open **two browser windows** side-by-side
4. Window 1: Login as Bob
5. Window 2: Login as David

**Steps:**

1. **Window 1 (Bob):** Navigate to Alice's profile
2. **Window 2 (David):** Navigate to Alice's profile
3. **Both windows:** See the same green available slot
4. **Window 1:** Click slot → Modal opens
5. **Window 2:** Click slot → Modal opens
6. **Both windows:** Click "Confirm Booking" at the same time
7. Wait for responses

**Expected Results:**

✅ **Window 1 (Bob):**
- ✅ Success toast: "Slot booked! 1 GivePoint held."
- ✅ Redirected to dashboard
- ✅ Balance decreased by 1
- ✅ Transaction logged

✅ **Window 2 (David):**
- ❌ Error toast: "Oops! Someone just booked this slot. Please choose another time."
- ❌ Modal stays open
- ❌ Balance unchanged
- ❌ No transaction logged

✅ **Database State:**
- Slot marked as booked (isBooked = true)
- Only 1 booking created (Bob's)
- Only 1 transaction logged (Bob's)

**Pass Criteria:** Only one booking succeeds, other fails gracefully

---

### Test 5.2: Rapid Sequential Bookings

**Objective:** Verify transaction isolation works correctly

**Steps:**

1. Create 3 available slots for Alice
2. As Bob, rapidly book all 3 slots (click, confirm, click, confirm, click, confirm)
3. Navigate to `/history`

**Expected Results:**

✅ **All 3 bookings succeed:**
- 3 separate booking records
- 3 separate transaction logs
- Balance: 3 → 0 (3 bookings × -1)

✅ **No race conditions:**
- No duplicate bookings
- No missing transactions
- Balance matches transaction sum

**Pass Criteria:** All bookings succeed, all transactions logged

---

## 🧪 Test Suite 6: Balance Integrity (10 minutes)

### Test 6.1: Balance Matches Transaction Sum

**Objective:** Verify balance always matches sum of transactions

**Steps:**

1. For each user in the system:
   - Navigate to `/history`
   - Note current balance from summary card
   - Switch to Ledger tab
   - Manually sum all transaction amounts
   - Add 3 (initial bonus if not logged)
   - Compare to current balance

**Expected Results:**

✅ **Formula:**
```
Current Balance = Initial Bonus + Sum(All Transactions)
Current Balance = 3 + Sum(TransactionLog.amount)
```

✅ **For each user:**
- Balance matches calculation
- No discrepancies
- All transactions accounted for

**Pass Criteria:** Balance matches for all users

---

### Test 6.2: Transaction Atomicity

**Objective:** Verify transactions are atomic (all-or-nothing)

**Steps:**

1. Switch to **Bob Smith**
2. Ensure Bob has 0 points
3. Try to book a session (should fail)
4. Navigate to `/history` → Ledger tab

**Expected Results:**

✅ **Booking Fails:**
- Error message: "Not enough GivePoints. You have 0, need at least 1."
- No booking created

✅ **No Transaction Logged:**
- Ledger tab shows no new transaction
- Balance unchanged (still 0)

✅ **Database Consistency:**
- No orphaned transaction logs
- No partial bookings
- Slot still available

**Pass Criteria:** Failed booking does not create transaction log

---

## 🧪 Test Suite 7: UI/UX Testing (10 minutes)

### Test 7.1: Responsive Design

**Objective:** Verify UI works on all screen sizes

**Steps:**

1. Navigate to `/history`
2. Open browser DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M)
4. Test these breakpoints:
   - Mobile: 375px
   - Tablet: 768px
   - Desktop: 1280px
   - Large: 1920px

**Expected Results:**

✅ **Mobile (375px):**
- Summary cards: 1 column (stacked)
- Tabs: Full width
- Table: Horizontal scroll enabled
- All content readable

✅ **Tablet (768px):**
- Summary cards: 2 columns
- Tabs: Full width
- Table: Horizontal scroll enabled

✅ **Desktop (1280px+):**
- Summary cards: 5 columns (all visible)
- Tabs: Full width
- Table: All columns visible, no scroll

**Pass Criteria:** UI adapts correctly to all screen sizes

---

### Test 7.2: Color Coding

**Objective:** Verify all status colors are correct

**Steps:**

1. Navigate to `/history`
2. Review all bookings and transactions

**Expected Results:**

✅ **Booking Status Colors:**
- COMPLETED: Green background
- CONFIRMED: Blue background
- PENDING: Yellow background
- CANCELLED: Red background

✅ **Transaction Type Colors:**
- BOOKING_CREATED: Red text
- BOOKING_COMPLETED: Green text
- BOOKING_CANCELLED: Blue text
- BOOKING_DECLINED: Blue text
- INITIAL_BONUS: Purple text

✅ **Point Amount Colors:**
- Positive (+1, +3): Green text
- Negative (-1): Red text
- Zero (0): Gray text

**Pass Criteria:** All colors match specification

---

### Test 7.3: Navigation Flow

**Objective:** Verify all navigation links work

**Steps:**

1. Start at homepage (`/`)
2. Click each navigation button:
   - Discover
   - Dashboard
   - History
   - Profile

**Expected Results:**

✅ **All Links Work:**
- `/discover` - Mentor discovery page loads
- `/dashboard` - Dashboard loads
- `/history` - History page loads
- `/profile` - Profile editor loads

✅ **Quick Actions (on History page):**
- "Go to Dashboard" → `/dashboard`
- "Discover Mentors" → `/discover`

**Pass Criteria:** All navigation links work

---

## 🧪 Test Suite 8: Edge Cases (15 minutes)

### Test 8.1: Zero Balance Booking

**Objective:** Verify user cannot book with 0 points

**Steps:**

1. Switch to a user with 0 points (or book until 0)
2. Try to book a session
3. Check error handling

**Expected Results:**

✅ **Booking Blocked:**
- Error message: "Not enough GivePoints. You have 0, need at least 1."
- No booking created
- No transaction logged
- Balance unchanged

**Pass Criteria:** Cannot book with insufficient points

---

### Test 8.2: Multiple Cancellations

**Objective:** Verify user cannot cancel the same booking twice

**Steps:**

1. Book a session
2. Cancel it (get refund)
3. Try to cancel again (via direct API call or UI bug)

**Expected Results:**

✅ **Second Cancel Fails:**
- Error message: "Cannot cancel booking with status: CANCELLED"
- No additional refund
- No duplicate transaction log

**Pass Criteria:** Cannot cancel already-cancelled booking

---

### Test 8.3: Complete Without Review

**Objective:** Verify session completion requires review

**Steps:**

1. Book and accept a session
2. Try to complete without submitting review

**Expected Results:**

✅ **Completion Blocked:**
- Review form validation prevents submission
- No point transfer
- Status remains CONFIRMED

**Pass Criteria:** Cannot complete without review

---

## 🧪 Test Suite 9: Data Integrity (10 minutes)

### Test 9.1: Transaction Log Immutability

**Objective:** Verify transaction logs cannot be modified

**Steps:**

1. Open Prisma Studio: `npx prisma studio`
2. Navigate to TransactionLog table
3. Try to edit a transaction record
4. Try to delete a transaction record

**Expected Results:**

✅ **Immutability:**
- Can view records
- Cannot edit amount, type, or userId
- Cannot delete records (or should be prevented in code)

**Note:** Prisma Studio allows edits, but production code should never update/delete transaction logs.

**Pass Criteria:** No code paths that modify transaction logs

---

### Test 9.2: Balance Consistency Check

**Objective:** Verify all user balances match transaction sums

**Steps:**

1. Run this SQL query:
   ```sql
   SELECT 
     u.name,
     u."givePoints" as current_balance,
     3 + COALESCE(SUM(t.amount), 0) as calculated_balance,
     u."givePoints" - (3 + COALESCE(SUM(t.amount), 0)) as difference
   FROM "User" u
   LEFT JOIN "TransactionLog" t ON t."userId" = u.id
   GROUP BY u.id, u.name, u."givePoints"
   HAVING u."givePoints" != (3 + COALESCE(SUM(t.amount), 0));
   ```

**Expected Results:**

✅ **Query Returns 0 Rows:**
- All users have matching balances
- No discrepancies
- Perfect data integrity

**Pass Criteria:** Query returns 0 rows

---

### Test 9.3: Orphaned Slot Check

**Objective:** Verify no slots are marked booked without a booking

**Steps:**

1. Run this SQL query:
   ```sql
   SELECT s.*
   FROM "AvailableSlot" s
   LEFT JOIN "Booking" b ON b."slotId" = s.id
   WHERE s."isBooked" = true AND b.id IS NULL;
   ```

**Expected Results:**

✅ **Query Returns 0 Rows:**
- All booked slots have bookings
- No orphaned slots
- Data consistency maintained

**Pass Criteria:** Query returns 0 rows

---

## 🧪 Test Suite 10: Performance Testing (10 minutes)

### Test 10.1: History Page Load Time

**Objective:** Verify history page loads quickly

**Steps:**

1. Open browser DevTools → Network tab
2. Navigate to `/history`
3. Note load time

**Expected Results:**

✅ **Load Time:**
- Initial load: < 2 seconds
- API calls: < 500ms each
- Total queries: 3 (parallel)

✅ **Network Waterfall:**
- 3 API calls start simultaneously
- No sequential dependencies
- Parallel execution visible

**Pass Criteria:** Page loads in < 2 seconds

---

### Test 10.2: Transaction Logging Overhead

**Objective:** Verify logging doesn't slow down bookings

**Steps:**

1. Book a session
2. Note total time from click to success
3. Check server logs for transaction timing

**Expected Results:**

✅ **Timing:**
- Total booking time: < 500ms
- Transaction log insert: < 10ms
- Overhead: < 5% of total time

✅ **Server Logs:**
```
🔒 Attempting atomic slot booking: { slotId, menteeId }
✅ Slot booked successfully: booking-id
📝 Transaction logged: -1 point (BOOKING_CREATED)
Total time: 147ms
```

**Pass Criteria:** Logging adds < 10ms overhead

---

## 🧪 Test Suite 11: Security Testing (10 minutes)

### Test 11.1: DevBar Security

**Objective:** Verify DevBar cannot be enabled in production

**Steps:**

1. Set `.env`:
   ```env
   NEXT_PUBLIC_SHOW_DEV_BAR="false"
   ```
2. Build for production: `npm run build`
3. Start production server: `npm start`
4. Try to access DevBar via:
   - URL manipulation
   - Browser console
   - LocalStorage editing

**Expected Results:**

✅ **DevBar Inaccessible:**
- Not visible in DOM
- Cannot be enabled via console
- localStorage changes have no effect
- User switching disabled

**Pass Criteria:** DevBar completely disabled

---

### Test 11.2: Transaction Log Access Control

**Objective:** Verify users can only see their own transactions

**Steps:**

1. Switch to **Bob Smith**
2. Navigate to `/history`
3. Note Bob's transactions
4. Open browser DevTools → Network tab
5. Find API call to `/actions/transactions`
6. Copy request
7. Modify `userId` parameter to Alice's ID
8. Replay request

**Expected Results:**

✅ **Access Denied:**
- Request fails or returns empty
- Cannot view other users' transactions
- Server validates userId matches session

**Note:** This test assumes proper authorization is implemented in server actions.

**Pass Criteria:** Cannot access other users' transactions

---

## 🧪 Test Suite 12: Backfill Script Testing (5 minutes)

### Test 12.1: Idempotent Backfill

**Objective:** Verify backfill script can be run multiple times safely

**Steps:**

1. Run backfill script:
   ```bash
   npm run db:backfill-transactions
   ```
2. Note output (should create transactions)
3. Run script again immediately:
   ```bash
   npm run db:backfill-transactions
   ```

**Expected Results:**

✅ **First Run:**
- Creates INITIAL_BONUS for all users
- Creates BOOKING_CREATED for all mentee bookings
- Creates BOOKING_COMPLETED for completed sessions
- Creates BOOKING_CANCELLED for cancelled bookings

✅ **Second Run:**
- Skips existing transactions (checks for duplicates)
- No duplicate INITIAL_BONUS
- No duplicate booking transactions
- Script completes successfully

**Pass Criteria:** Script is idempotent (safe to run multiple times)

---

## 📊 Test Results Summary

### Test Suite Results

| Suite | Tests | Duration | Status |
|-------|-------|----------|--------|
| 1. Transaction Logging | 4 | 15 min | ⏳ Pending |
| 2. History Page UI | 4 | 10 min | ⏳ Pending |
| 3. DevBar Control | 2 | 5 min | ⏳ Pending |
| 4. Decline Booking | 1 | 5 min | ⏳ Pending |
| 5. Concurrency Control | 2 | 10 min | ⏳ Pending |
| 6. Balance Integrity | 3 | 10 min | ⏳ Pending |
| 7. UI/UX | 3 | 10 min | ⏳ Pending |
| 8. Edge Cases | 3 | 15 min | ⏳ Pending |
| 9. Data Integrity | 3 | 10 min | ⏳ Pending |
| 10. Performance | 2 | 10 min | ⏳ Pending |
| 11. Security | 2 | 10 min | ⏳ Pending |
| 12. Backfill Script | 1 | 5 min | ⏳ Pending |
| **Total** | **30** | **115 min** | **0% Complete** |

---

## 🎯 Priority Testing Order

### Critical (Must Test Before Demo)

1. **Transaction Logging** (Suite 1) - 15 min
2. **History Page UI** (Suite 2) - 10 min
3. **DevBar Control** (Suite 3) - 5 min
4. **Decline Booking** (Suite 4) - 5 min

**Total: 35 minutes**

### Important (Should Test Before Production)

5. **Concurrency Control** (Suite 5) - 10 min
6. **Balance Integrity** (Suite 6) - 10 min
7. **Data Integrity** (Suite 9) - 10 min

**Total: 30 minutes**

### Nice to Have (Test When Time Permits)

8. **UI/UX** (Suite 7) - 10 min
9. **Edge Cases** (Suite 8) - 15 min
10. **Performance** (Suite 10) - 10 min
11. **Security** (Suite 11) - 10 min
12. **Backfill Script** (Suite 12) - 5 min

**Total: 50 minutes**

---

## 🎓 Testing for Thesis Demo

### 10-Minute Demo Test Flow

**Preparation:**
1. Run all backfill scripts
2. Restart dev server
3. Open browser to homepage

**Demo Script:**

**Minute 1-2: Introduction**
- Show homepage
- Explain time-banking concept
- Show DevBar (development mode)

**Minute 3-4: Booking Flow**
- Switch to Bob
- Discover → Alice's profile
- Show calendar with available slots
- Book a slot
- Show transaction logged

**Minute 5-6: History Page**
- Navigate to `/history`
- Show summary cards
- Show bookings tab
- Show ledger tab with running balance

**Minute 7-8: Mentor Flow**
- Switch to Alice
- Dashboard → Accept booking
- Show updated status

**Minute 9: Completion**
- Switch to Bob
- Complete session with review
- Switch to Alice
- Show +1 transaction in history

**Minute 10: Concurrency Demo**
- Open 2 windows
- Show simultaneous booking attempt
- Demonstrate graceful failure

**Backup Slides:**
- Architecture diagram
- Database schema
- Transaction flow chart
- Code snippets

---

## 🐛 Known Issues & Limitations

### Current Limitations

1. **No Email Notifications**
   - Users not notified of booking status changes
   - Workaround: Check dashboard regularly

2. **No Rate Limiting**
   - API endpoints not rate-limited
   - Potential for abuse
   - Recommendation: Add rate limiting middleware

3. **No CAPTCHA**
   - Booking form has no bot protection
   - Recommendation: Add reCAPTCHA

4. **Manual Testing Only**
   - No automated test suite
   - Recommendation: Add Jest + React Testing Library

### Non-Issues (Expected Behavior)

1. **"Slot already taken" errors**
   - This is correct concurrency control
   - Not a bug, working as designed

2. **DevBar visible in development**
   - Intentional for testing
   - Will be hidden in production

3. **Transaction logs cannot be deleted**
   - Intentional immutability
   - Ensures audit trail integrity

---

## 📝 Test Report Template

### Test Execution Report

**Date:** _____________
**Tester:** _____________
**Environment:** [ ] Development [ ] Production

#### Test Results

| Suite | Tests Passed | Tests Failed | Notes |
|-------|--------------|--------------|-------|
| Transaction Logging | __ / 4 | __ | |
| History Page UI | __ / 4 | __ | |
| DevBar Control | __ / 2 | __ | |
| Decline Booking | __ / 1 | __ | |
| Concurrency Control | __ / 2 | __ | |
| Balance Integrity | __ / 3 | __ | |
| UI/UX | __ / 3 | __ | |
| Edge Cases | __ / 3 | __ | |
| Data Integrity | __ / 3 | __ | |
| Performance | __ / 2 | __ | |
| Security | __ / 2 | __ | |
| Backfill Script | __ / 1 | __ | |
| **Total** | **__ / 30** | **__** | |

#### Critical Issues Found

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

#### Recommendations

1. _____________________________________________
2. _____________________________________________
3. _____________________________________________

#### Sign-off

- [ ] All critical tests passed
- [ ] No blocking issues
- [ ] Ready for production

**Tester Signature:** _____________
**Date:** _____________

---

## 🎉 Testing Complete!

Once all tests pass, you're ready to:

1. ✅ Deploy to production
2. ✅ Present to thesis committee
3. ✅ Demo to stakeholders
4. ✅ Launch to users

**Good luck with your thesis presentation!** 🎓🚀

---

## 📞 Quick Reference

### Test Commands

```bash
# Start dev server
npm run dev

# Run backfill scripts
npm run db:backfill-transactions

# Check database
npx prisma studio

# View server logs
npm run dev  # Check terminal output

# Build for production
npm run build

# Start production server
npm start
```

### Test URLs

- Homepage: `http://localhost:3000`
- Discover: `http://localhost:3000/discover`
- Dashboard: `http://localhost:3000/dashboard`
- History: `http://localhost:3000/history`
- Profile: `http://localhost:3000/profile`
- Mentor Profile: `http://localhost:3000/mentor/[id]`

### Test Users (from seed)

1. **Alice Johnson** - Mentor (React, Node.js)
2. **Bob Smith** - Mentee (wants to learn React)
3. **Carol Designer** - Mentor (UI/UX)
4. **David Lee** - Mentee (wants to learn Python)
5. **Emma Python** - Mentor (Python, Data Science)
6. **Frank Williams** - Mentor (DevOps)

---

**Status:** ✅ **TESTING GUIDE COMPLETE**

**Total Test Time:** ~115 minutes (full suite)
**Critical Tests:** ~35 minutes (minimum for demo)

**All test scenarios documented and ready to execute!** 🧪✅
