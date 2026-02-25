# 📱 GiveGot User Flow Guide

Complete visual guide to using the platform from both mentor and mentee perspectives.

---

## 🏠 Homepage (`/`)

**What you see:**
- Welcome message
- Your current GivePoints balance (large card)
- Your profile information
- Two main action buttons:
  - **"Discover Mentors"** (purple) → Go to mentor discovery
  - **"My Dashboard"** (blue) → View your bookings
- How it works explanation (3-step visual)

**Available to:** Everyone

---

## 🔍 Discover Mentors (`/discover`)

**What you see:**
- Page title: "Discover Mentors"
- Your current balance badge at top
- Grid of mentor cards (2-3 per row)

**Each mentor card shows:**
- Profile avatar
- Name and email
- Bio description
- Teaching skills (purple badges)
- "Book Session (1 pt)" button

**Important:** You will NOT see yourself in this list!

**Actions:**
- Click any "Book Session" button → Navigate to booking form

**Available to:** Everyone

---

## 📅 Book Session (`/book/[mentorId]`)

**What you see:**
- "← Back to Discovery" link
- Mentor's full profile (large avatar, bio, skills)
- Time-Banking rules explanation box (blue)
- Your current balance (purple box with warning if < 1 point)
- Booking form:
  - **Session Date** (date picker, minimum tomorrow)
  - **Start Time** (time picker)
  - **Note for Mentor** (optional text area)
- "Cancel" and "Book Session (1 pt)" buttons

**Validation:**
- Must have at least 1 GivePoint
- Date must be in the future
- Time is required

**Actions:**
1. Fill in date and time
2. Optionally add a note
3. Click "Book Session"
4. ✅ Success → 1 point deducted → Redirected to dashboard

**Available to:** Everyone with >= 1 point

---

## 📊 Dashboard (`/dashboard`)

### Top Section: Statistics Cards

**3 cards showing:**
1. **GivePoints** (purple) - Current balance
2. **As Mentor** (green) - Number of mentoring sessions
3. **As Mentee** (blue) - Number of learning sessions

### Middle Section: Action Button
- **"Discover Mentors"** button (purple)

### Bottom Section: Two Lists

---

## 🎓 Mentoring Sessions (Mentor View)

**Shows:** Sessions where YOU are the mentor (people who booked you)

### For Each Booking Card:

**Always visible:**
- Mentee's avatar, name, email
- Session date/time
- Status badge (color-coded)
- Their note (if provided)

**If Status = PENDING (yellow):**
- **Actions available:**
  - ✅ "Accept Booking" (green button) → Changes status to CONFIRMED
  - ❌ "Decline" (red button) → Cancels booking, refunds mentee

**If Status = CONFIRMED (blue):**
- **Message:** "⏰ Session confirmed. Waiting for mentee to mark as complete."
- **No actions** (waiting for mentee)

**If Status = COMPLETED (green):**
- **Message:** "✅ Session completed! You earned 1 GivePoint."
- **Your balance increased by +1**

---

## 📚 Learning Sessions (Mentee View)

**Shows:** Sessions where YOU are the mentee (sessions you booked)

### For Each Booking Card:

**Always visible:**
- Mentor's avatar, name, email
- Session date/time
- Status badge (color-coded)
- Your note (if you wrote one)

**If Status = PENDING (yellow):**
- **Message:** "⏳ Waiting for mentor to accept..."
- **Actions available:**
  - ❌ "Cancel" (red button) → Cancels booking, refunds your point

**If Status = CONFIRMED (blue):**
- **Actions available:**
  - ✅ "Mark as Complete" (blue button) → Completes session, transfers point to mentor
  - ❌ "Cancel" (red button) → Cancels booking, refunds your point

**If Status = COMPLETED (green):**
- **Message:** "✅ Session completed! 1 GivePoint transferred."
- **Your point was transferred to mentor**

---

## 🔄 Complete User Journey Example

### Journey 1: Bob Books Alice (Happy Path)

```
1. Bob starts with: 3 points
2. Alice starts with: 15 points

STEP 1: Bob books Alice
├─> Bob: 3 → 2 points (1 held)
├─> Booking created: PENDING
└─> Alice sees request in dashboard

STEP 2: Alice accepts
├─> Booking status: PENDING → CONFIRMED
└─> Bob's point still held

STEP 3: Bob marks complete
├─> Booking status: CONFIRMED → COMPLETED
├─> Bob: 2 points (final)
└─> Alice: 15 → 16 points (+1 transferred)
```

### Journey 2: Bob Books but Cancels

```
1. Bob starts with: 3 points

STEP 1: Bob books Alice
├─> Bob: 3 → 2 points (1 held)
└─> Booking created: PENDING

STEP 2: Bob cancels
├─> Booking status: PENDING → CANCELLED
├─> Bob: 2 → 3 points (refunded)
└─> Alice: 15 points (unchanged)
```

---

## 🎨 Status Badge Colors

| Status | Color | Meaning |
|--------|-------|---------|
| **PENDING** | Yellow | Waiting for mentor acceptance |
| **CONFIRMED** | Blue | Mentor accepted, waiting for completion |
| **COMPLETED** | Green | Session done, points transferred |
| **CANCELLED** | Red | Booking cancelled, points refunded |

---

## 🎯 Point Balance Rules

### When Points Decrease:
- ✅ When booking a session (mentee)
- ✅ Point is held, not gone forever
- ✅ Refunded if cancelled before completion

### When Points Increase:
- ✅ When mentee completes your session (mentor)
- ✅ +1 point per completed hour
- ✅ New users start with 3 free points

### When Points Stay Same:
- ✅ When mentor accepts booking (no change)
- ✅ When viewing or browsing (no cost)

---

## 🔥 Power User Tips

### Quick Testing:
1. Open two browser windows side-by-side
2. Window 1: Switch to Bob (mentee)
3. Window 2: Switch to Alice (mentor)
4. Book session in Window 1
5. Accept in Window 2
6. Complete in Window 1
7. See real-time balance updates!

### Demo Preparation:
1. Restart dev server to reset all bookings
2. All users back to original point balances
3. Clean slate for demonstration

### Troubleshooting:
- **Balance not updating?** → Refresh the page
- **Can't book?** → Check you have >= 1 point
- **Don't see mentors?** → Make sure you're not viewing as them

---

## 📸 Screenshot Guide for Documentation

Suggested screenshots for your thesis:

1. **DevBar** - Show user switching capability
2. **Discovery Page** - Grid of mentor cards
3. **Booking Form** - Filled out form with validation
4. **Dashboard (Mentor)** - Pending booking request with Accept button
5. **Dashboard (Mentee)** - Confirmed booking with Complete button
6. **Balance Change** - Before/after point transfer

---

## ✅ Pre-Presentation Checklist

24 hours before presenting:
- [ ] Test complete flow end-to-end
- [ ] Verify all 4 mock users load
- [ ] Check all buttons work
- [ ] Prepare talking points
- [ ] Have backup plan (screenshots) if demo fails

1 hour before presenting:
- [ ] Restart dev server (fresh state)
- [ ] Test one quick booking cycle
- [ ] Open app in presentation browser
- [ ] Close unnecessary browser tabs

During presentation:
- [ ] Keep DevBar visible (shows professionalism)
- [ ] Speak while clicking (explain each action)
- [ ] Show balance changes after each step
- [ ] Emphasize the circular economy concept

---

## 🎓 Thesis Defense Talking Points

### Technical Implementation:
- "Built with Next.js 14 App Router for modern React patterns"
- "Used Server Actions for type-safe API endpoints"
- "Implemented React Context for global state management"
- "Mock authentication system for rapid development and testing"

### Business Logic:
- "Time-banking prevents exploitation - everyone's time is valued equally"
- "Point holding mechanism ensures commitment from both parties"
- "Status-based workflow ensures clear process flow"
- "Refund system protects users from bad experiences"

### UX Design:
- "Real-time feedback with status badges and balance updates"
- "Visual hierarchy guides users through the booking process"
- "Defensive design prevents errors (validation, disabled states)"
- "Developer tools (DevBar) separated from user interface"

**Good luck with your thesis! 🎓🚀**
