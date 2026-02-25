# 🧪 Testing Checklist - GiveGot Platform

Use this checklist to verify all features work correctly for your thesis demo.

---

## ✅ Phase 1: Mock Authentication

### Test 1.1: User Switcher Visibility
- [ ] Open http://localhost:3000
- [ ] See purple DevBar at the top of the page
- [ ] DevBar shows "DEV MODE" badge
- [ ] Current user name and GivePoints visible

### Test 1.2: Switch Users
- [ ] Click the "Switch User" dropdown
- [ ] See all 4 users listed with their point balances
- [ ] Select "Bob Smith"
- [ ] Verify: DevBar updates to show "Bob Smith (3 pts)"
- [ ] Verify: Page content updates immediately

### Test 1.3: Persistence
- [ ] Switch to any user
- [ ] Refresh the browser (F5)
- [ ] Verify: Same user still selected
- [ ] Verify: Balance remains the same

---

## ✅ Phase 2: Mentor Discovery

### Test 2.1: View Mentors
- [ ] From home page, click "Discover Mentors"
- [ ] Navigate to `/discover`
- [ ] See mentor cards displayed in a grid
- [ ] Each card shows: Avatar, Name, Bio, Teaching Skills

### Test 2.2: Current User Filtering
- [ ] Switch to "Alice Johnson" (Mentor)
- [ ] Go to "Discover Mentors"
- [ ] Verify: Alice does NOT appear in the list
- [ ] Switch to "Bob Smith"
- [ ] Verify: Alice DOES appear in the list now

### Test 2.3: Balance Display
- [ ] On discovery page, see your current balance at the top
- [ ] Format: "Your Balance: X GivePoints"
- [ ] Matches the balance in DevBar

---

## ✅ Phase 3: Booking System

### Test 3.1: Create Booking (With Points)

**Setup:** Switch to Bob Smith (3 points)

- [ ] Click "Discover Mentors"
- [ ] Click "Book Session" on Alice Johnson's card
- [ ] Navigate to `/book/user-mentor-1`
- [ ] See Alice's full profile displayed
- [ ] See "Your Current Balance: 3 pts" shown
- [ ] Fill in:
  - [ ] Date: Tomorrow's date
  - [ ] Time: 10:00 AM
  - [ ] Note: "Want to learn React hooks"
- [ ] Click "Book Session (1 pt)"
- [ ] See success message: "1 GivePoint held..."
- [ ] Redirected to `/dashboard`
- [ ] **Verify DevBar:** Bob's balance changed from 3 → 2 pts

### Test 3.2: Create Booking (Without Points)

**Setup:** Switch to user with 0 points (or book 3 sessions with Bob first)

- [ ] Try to book another session
- [ ] See error: "Not enough GivePoints"
- [ ] "Book Session" button is disabled
- [ ] Balance shows in red or warning color

### Test 3.3: View Pending Booking (Mentee Side)

**Setup:** Continue from Test 3.1 (Bob has pending booking)

- [ ] Stay as Bob Smith
- [ ] Go to "My Dashboard"
- [ ] Under "Learning Sessions", see Alice's booking
- [ ] Status badge shows: **PENDING** (yellow)
- [ ] Message: "⏳ Waiting for mentor to accept..."
- [ ] "Cancel" button available

### Test 3.4: Accept Booking (Mentor Side)

**Setup:** Continue from Test 3.3

- [ ] Switch to **Alice Johnson**
- [ ] Go to "My Dashboard"
- [ ] Under "Mentoring Sessions", see Bob's booking
- [ ] See Bob's avatar, name, email
- [ ] See the note: "Want to learn React hooks"
- [ ] Status badge shows: **PENDING** (yellow)
- [ ] Click "Accept Booking"
- [ ] See success message: "Booking confirmed!"
- [ ] Status changes to: **CONFIRMED** (blue)

### Test 3.5: Complete Session (Mentee Side)

**Setup:** Continue from Test 3.4 (booking is confirmed)

- [ ] Switch to **Bob Smith**
- [ ] Go to "My Dashboard"
- [ ] Under "Learning Sessions", see Alice's booking
- [ ] Status shows: **CONFIRMED** (blue)
- [ ] Click "Mark as Complete"
- [ ] See success message: "1 GivePoint transferred to mentor"
- [ ] Status changes to: **COMPLETED** (green)
- [ ] **Switch to Alice** → Verify her balance increased (+1 point)

### Test 3.6: Cancel Booking

**Setup:** Create a new booking

- [ ] As mentee, book a session
- [ ] While status is PENDING, click "Cancel"
- [ ] Confirm cancellation in dialog
- [ ] See success: "Booking cancelled. 1 GivePoint refunded."
- [ ] Verify: Point refunded to mentee
- [ ] Status shows: **CANCELLED** (red)

---

## ✅ Integration Tests

### Test 4.1: Multi-User Scenario

1. **Bob books Alice** (Bob: 3 → 2 pts)
2. **Bob books Carol** (Bob: 2 → 1 pts)
3. **Switch to Alice** → See 1 pending booking
4. **Alice accepts** Bob's booking
5. **Switch to Carol** → See 1 pending booking
6. **Carol accepts** Bob's booking
7. **Switch to Bob** → See 2 confirmed bookings
8. **Bob completes** Alice's session (Alice: 15 → 16 pts)
9. **Bob completes** Carol's session (Carol: 20 → 21 pts)
10. **Verify:** Bob has 1 point left, Alice has 16, Carol has 21

### Test 4.2: Point Transfer Verification

**Initial State:**
- Alice: 15 points
- Bob: 3 points

**After Full Cycle (Bob books Alice):**
- Alice: 16 points (+1 from Bob)
- Bob: 2 points (-1 to Alice)

**Formula:** Mentee pays 1 → Mentor receives 1

### Test 4.3: Status Flow Validation

Check the complete status flow:
- [ ] PENDING → Can accept or cancel
- [ ] CONFIRMED → Can complete or cancel
- [ ] COMPLETED → No actions available (final state)
- [ ] CANCELLED → No actions available (final state)

---

## ✅ UI/UX Tests

### Test 5.1: Responsive Design
- [ ] Test on desktop (1920x1080)
- [ ] Test on tablet (768px width)
- [ ] Test on mobile (375px width)
- [ ] All cards stack properly
- [ ] Buttons remain accessible

### Test 5.2: Visual Feedback
- [ ] Loading spinners show during async operations
- [ ] Success messages appear after actions
- [ ] Error messages show in red
- [ ] Status badges use correct colors
- [ ] Hover effects work on buttons

### Test 5.3: Navigation
- [ ] All links work correctly
- [ ] Back buttons return to previous page
- [ ] "Discover Mentors" accessible from multiple pages
- [ ] "My Dashboard" link works

---

## 🎬 Thesis Presentation Script

**Recommended demo flow for your thesis defense:**

1. **Start:** "This is GiveGot, a time-banking mentorship platform."

2. **Show DevBar:** "For development, I've implemented a user switcher that allows me to demonstrate both mentor and mentee perspectives instantly."

3. **Explain Concept:** "The platform works on time-banking: teach 1 hour, earn 1 point. Use points to learn from others."

4. **Show Discovery:** "Let me switch to Bob, a student with 3 points. He can browse available mentors..."

5. **Book Session:** "Bob finds Alice who teaches React. He books a session, and 1 point is immediately held from his balance."

6. **Mentor Accept:** "Now from Alice's perspective, she sees Bob's request and accepts it."

7. **Complete Flow:** "After the session, Bob marks it as complete, and the point transfers to Alice."

8. **Show Results:** "Alice now has 16 points and can use them to learn other skills. The economy is circular and sustainable."

**Time needed:** 3-5 minutes for full demo

---

## ✅ Final Verification

Before your presentation:
- [ ] All 4 mock users load correctly
- [ ] Can switch between any user
- [ ] Discovery page shows mentors
- [ ] Can book a session with valid points
- [ ] Mentor can see and accept bookings
- [ ] Mentee can complete sessions
- [ ] Points transfer correctly
- [ ] Balance updates in real-time
- [ ] No console errors in browser
- [ ] Professional UI appearance

---

## 📊 Success Metrics

After testing, you should have:
- ✅ 0 TypeScript errors
- ✅ 0 runtime errors
- ✅ All pages render correctly
- ✅ All business logic working
- ✅ Complete booking cycle functional
- ✅ Point transfers accurate
- ✅ User switching seamless

**Your platform is ready for thesis presentation! 🎓**
