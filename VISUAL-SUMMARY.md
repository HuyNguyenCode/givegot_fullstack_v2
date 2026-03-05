# 📅 Calendar & Slots - Visual Summary

## 🎨 UI Screenshots (Text Description)

### 1. Mentor Calendar Manager (Dashboard)

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Manage Your Available Slots                    [Refresh]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💡 How it works: Click time blocks to select your available   │
│  hours. Green blocks are already saved. Orange blocks are      │
│  booked by mentees.                                             │
│                                                                 │
│  [← Previous Week]    Mar 10 - Mar 16, 2026    [Next Week →]   │
│                                                                 │
│  ┌────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐             │
│  │Time│ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │             │
│  ├────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤             │
│  │8:00│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │9:00│ [✓] │ [ ] │ [+] │ [ ] │ [ ] │ [ ] │ [ ] │  ← Green=Saved│
│  │10:0│ [📌]│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │  ← Orange=Booked│
│  │11:0│ [ ] │ [+] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │  ← Purple=Selected│
│  │12:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │13:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │14:0│ [✓] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │15:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │16:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │17:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │18:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │19:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  │20:0│ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │ [ ] │             │
│  └────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘             │
│                                                                 │
│  Legend:                                                        │
│  [+] Selected (not saved)  [✓] Available (saved)               │
│  [📌] Booked by mentee      [ ] Past/Unavailable               │
│                                                                 │
│  [Clear Selection (2)]  [Save 2 Slots] ← Green button         │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Weekly grid layout (Monday-Sunday)
- 8 AM to 8 PM time slots
- Click to toggle selection
- Color-coded status
- Bulk save functionality
- Week navigation

---

### 2. Mentee Booking Calendar (Mentor Profile)

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Available Time Slots                                        │
│  Click a green slot to book a 1-hour session with Alice        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Your Balance: 3 pts                               │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  📅 Week of Mar 10 - Mar 16, 2026                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐ │
│  │ ● Available     │  │ ● Available     │  │ ● Available    │ │
│  │ Monday, Mar 10  │  │ Wednesday, Mar12│  │ Friday, Mar 14 │ │
│  │                 │  │                 │  │                │ │
│  │ 9:00 AM -       │  │ 11:00 AM -      │  │ 2:00 PM -      │ │
│  │ 10:00 AM        │  │ 12:00 PM        │  │ 3:00 PM        │ │
│  │                 │  │                 │  │                │ │
│  │ Click to book   │  │ Click to book   │  │ Click to book  │ │
│  │ • 1 GivePoint   │  │ • 1 GivePoint   │  │ • 1 GivePoint  │ │
│  └─────────────────┘  └─────────────────┘  └────────────────┘ │
│                                                                 │
│  📅 Week of Mar 17 - Mar 23, 2026                              │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                     │
│  │ ● Available     │  │ ● Available     │                     │
│  │ Monday, Mar 17  │  │ Monday, Mar 17  │                     │
│  │ 9:00 AM -       │  │ 2:00 PM -       │                     │
│  │ 10:00 AM        │  │ 3:00 PM         │                     │
│  │ Click to book   │  │ Click to book   │                     │
│  └─────────────────┘  └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Card-based layout
- Grouped by week
- Large, tappable cards
- Balance display
- Clear call-to-action

---

### 3. Booking Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Confirm Booking                                          [X]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────┐         │
│  │ Session with                                      │         │
│  │ Alice Johnson                                     │         │
│  │                                                   │         │
│  │ 📅 Monday, March 10, 2026                         │         │
│  │ 🕐 9:00 AM - 10:00 AM                             │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  Note for Mentor (Optional)                                    │
│  ┌───────────────────────────────────────────────────┐         │
│  │ I'd like to learn about React hooks and state    │         │
│  │ management. I have basic JavaScript knowledge.    │         │
│  │                                                   │         │
│  └───────────────────────────────────────────────────┘         │
│  142/300 characters                                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────┐         │
│  │ ℹ️ Time-Banking Rules                             │         │
│  │ • 1 GivePoint will be held when you book          │         │
│  │ • Point transfers to mentor after session         │         │
│  │ • You can cancel anytime for a full refund        │         │
│  └───────────────────────────────────────────────────┘         │
│                                                                 │
│  [Cancel]  [Confirm Booking (1 pt)] ← Purple gradient button  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Clear session details
- Optional note field
- Character counter
- Rules reminder
- Prominent CTA button

---

### 4. Success Toast (After Booking)

```
                                    ┌─────────────────────────────┐
                                    │ ✅ Booking Confirmed!       │
                                    │ Redirecting to dashboard... │
                                    └─────────────────────────────┘
                                           ↑ Green toast
                                           Bottom-right corner
                                           Auto-dismiss in 2s
```

---

### 5. Error Toast (Concurrency Conflict)

```
                                    ┌─────────────────────────────┐
                                    │ ⚠️ Booking Failed           │
                                    │ Oops! Someone just booked   │
                                    │ this slot. Please choose    │
                                    │ another time.               │
                                    └─────────────────────────────┘
                                           ↑ Red toast
                                           Bottom-right corner
                                           Auto-dismiss in 4s
```

---

## 🔄 User Flow Diagrams

### Flow 1: Mentor Creates Availability

```
┌─────────────┐
│   MENTOR    │
│   (Alice)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ Opens /dashboard            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Sees "Manage Your           │
│ Available Slots" section    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Clicks time blocks:         │
│ • Monday 9-10 AM            │
│ • Monday 2-3 PM             │
│ • Wednesday 11-12 AM        │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Clicks "Save 3 Slots"       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Server validates:           │
│ ✓ No overlaps               │
│ ✓ All in future             │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Database: Create 3 slots    │
│ with isBooked = false       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ ✅ Success toast:            │
│ "Slots Saved! Mentees can   │
│ now book these times"       │
└─────────────────────────────┘
```

---

### Flow 2: Mentee Books a Slot (No Conflict)

```
┌─────────────┐
│   MENTEE    │
│    (Bob)    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ Visits /mentor/alice-id     │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Sees "Available Time Slots" │
│ • Monday 9-10 AM (green)    │
│ • Monday 2-3 PM (green)     │
│ • Wednesday 11-12 AM (green)│
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Clicks Monday 9-10 AM card  │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Modal opens with details    │
│ Adds note: "Learn React"    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Clicks "Confirm Booking"    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ Server: bookSlot()          │
│ BEGIN TRANSACTION           │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ 🔒 SELECT FOR UPDATE        │
│ Lock slot row               │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ ✓ Check: isBooked = false   │
│ ✓ Check: Bob has 3 points   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ • Deduct 1 point from Bob   │
│ • Create Booking record     │
│ • Set isBooked = true       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ COMMIT TRANSACTION          │
│ 🔓 Release lock             │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│ ✅ Success toast             │
│ Redirect to /dashboard      │
└─────────────────────────────┘
```

---

### Flow 3: Concurrent Booking (Conflict)

```
Time: 10:00:00.000

┌─────────────┐              ┌─────────────┐
│   MENTEE A  │              │   MENTEE B  │
│    (Bob)    │              │   (David)   │
└──────┬──────┘              └──────┬──────┘
       │                            │
       │ Clicks "Confirm"           │ Clicks "Confirm"
       │ (same slot)                │ (same slot)
       ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐
│ Transaction A       │      │ Transaction B       │
│ BEGIN               │      │ BEGIN               │
└──────┬──────────────┘      └──────┬──────────────┘
       │                            │
       ▼                            ▼
┌─────────────────────┐      ┌─────────────────────┐
│ SELECT FOR UPDATE   │      │ SELECT FOR UPDATE   │
│ 🔒 LOCK ACQUIRED    │      │ ⏳ WAITING...       │
└──────┬──────────────┘      │ (blocked by A)      │
       │                     └─────────────────────┘
       ▼
┌─────────────────────┐
│ Read: isBooked=false│
│ Check: balance OK   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ • Deduct 1 point    │
│ • Create booking    │
│ • Set isBooked=true │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ COMMIT              │
│ 🔓 LOCK RELEASED    │
└─────────────────────┘
                              ┌─────────────────────┐
                              │ 🔒 LOCK ACQUIRED    │
                              │ (finally!)          │
                              └──────┬──────────────┘
                                     │
                                     ▼
                              ┌─────────────────────┐
                              │ Read: isBooked=TRUE │
                              │ ❌ Already booked!  │
                              └──────┬──────────────┘
                                     │
                                     ▼
                              ┌─────────────────────┐
                              │ Throw Error:        │
                              │ "SLOT_TAKEN"        │
                              └──────┬──────────────┘
                                     │
                                     ▼
                              ┌─────────────────────┐
                              │ ROLLBACK            │
                              └─────────────────────┘

┌─────────────────────┐      ┌─────────────────────┐
│ ✅ Success toast     │      │ ⚠️ Error toast:     │
│ "Booking Confirmed!"│      │ "Oops! Someone just │
│ Redirect to dash    │      │ booked this slot"   │
└─────────────────────┘      └─────────────────────┘
```

---

## 🎨 Color Palette

### Mentor Calendar Manager

| Element         | Color                | Hex Code  | Usage                    |
|-----------------|----------------------|-----------|--------------------------|
| Selected slot   | Purple gradient      | #9333EA   | User is selecting        |
| Available slot  | Green                | #10B981   | Saved to database        |
| Booked slot     | Orange               | #F97316   | Booked by mentee         |
| Past slot       | Gray                 | #F3F4F6   | Disabled                 |
| Save button     | Green gradient       | #059669   | Primary action           |

### Mentee Booking Calendar

| Element         | Color                | Hex Code  | Usage                    |
|-----------------|----------------------|-----------|--------------------------|
| Available card  | Green gradient       | #10B981   | Clickable slots          |
| Card border     | Green                | #34D399   | Emphasis                 |
| Pulse indicator | Green                | #10B981   | Animated dot             |
| Modal header    | Purple-blue gradient | #9333EA   | Confirmation modal       |
| Confirm button  | Purple-blue gradient | #9333EA   | Primary action           |

### Toast Notifications

| Type    | Background | Icon | Border   |
|---------|------------|------|----------|
| Success | Green      | ✅   | Green    |
| Error   | Red        | ⚠️   | Red      |
| Info    | Blue       | ℹ️   | Blue     |

---

## 📊 Database State Visualization

### Before Booking

```
AvailableSlot Table:
┌──────────┬──────────┬──────────────────┬──────────────────┬──────────┐
│ id       │ mentorId │ startTime        │ endTime          │ isBooked │
├──────────┼──────────┼──────────────────┼──────────────────┼──────────┤
│ slot-123 │ alice-id │ 2026-03-10 09:00 │ 2026-03-10 10:00 │ FALSE    │
│ slot-456 │ alice-id │ 2026-03-10 14:00 │ 2026-03-10 15:00 │ FALSE    │
│ slot-789 │ alice-id │ 2026-03-12 11:00 │ 2026-03-12 12:00 │ FALSE    │
└──────────┴──────────┴──────────────────┴──────────────────┴──────────┘

User Table:
┌─────────┬──────┬────────────┐
│ id      │ name │ givePoints │
├─────────┼──────┼────────────┤
│ bob-id  │ Bob  │ 3          │
│ alice-id│ Alice│ 15         │
└─────────┴──────┴────────────┘

Booking Table:
(empty)
```

### After Successful Booking

```
AvailableSlot Table:
┌──────────┬──────────┬──────────────────┬──────────────────┬──────────┐
│ id       │ mentorId │ startTime        │ endTime          │ isBooked │
├──────────┼──────────┼──────────────────┼──────────────────┼──────────┤
│ slot-123 │ alice-id │ 2026-03-10 09:00 │ 2026-03-10 10:00 │ TRUE ✅  │
│ slot-456 │ alice-id │ 2026-03-10 14:00 │ 2026-03-10 15:00 │ FALSE    │
│ slot-789 │ alice-id │ 2026-03-12 11:00 │ 2026-03-12 12:00 │ FALSE    │
└──────────┴──────────┴──────────────────┴──────────────────┴──────────┘

User Table:
┌─────────┬──────┬────────────┐
│ id      │ name │ givePoints │
├─────────┼──────┼────────────┤
│ bob-id  │ Bob  │ 2 (-1) ✅  │
│ alice-id│ Alice│ 15         │
└─────────┴──────┴────────────┘

Booking Table:
┌────────────┬──────────┬─────────┬──────────┬────────┐
│ id         │ mentorId │ menteeId│ slotId   │ status │
├────────────┼──────────┼─────────┼──────────┼────────┤
│ booking-1  │ alice-id │ bob-id  │ slot-123 │ PENDING│
└────────────┴──────────┴─────────┴──────────┴────────┘
```

---

## 🎬 Animation States

### Slot Selection Animation

```
State 1: Idle
┌─────────┐
│         │  ← Gray border, white background
│   —     │
└─────────┘

State 2: Hover
┌─────────┐
│         │  ← Purple border, light purple background
│   +     │  ← Cursor: pointer
└─────────┘

State 3: Selected
┌─────────┐
│         │  ← Purple gradient, white text
│   +     │  ← Scale: 1.05 (slightly larger)
└─────────┘  ← Ring: 2px purple
```

### Available Slot Card Animation

```
State 1: Idle
┌─────────────────┐
│ ● Available     │  ← Green gradient background
│ Monday, Mar 10  │  ← Green border
│ 9:00 AM - 10:00 │  ← Pulse animation on dot
└─────────────────┘

State 2: Hover
┌─────────────────┐
│ ● Available  →  │  ← Darker green gradient
│ Monday, Mar 10  │  ← Shadow: lg
│ 9:00 AM - 10:00 │  ← Scale: 1.05
└─────────────────┘  ← Arrow icon scales 1.1
```

### Toast Notification Animation

```
Timeline:
0ms:    [Toast appears from right] ← slide-in animation
2000ms: [Toast stays visible]
3000ms: [Toast fades out] ← fade-out animation
3500ms: [Toast removed from DOM]
```

---

## 📱 Responsive Design

### Desktop (≥1024px)

```
Mentor Calendar:
┌────────────────────────────────────────────────────┐
│  Full weekly grid (7 columns)                      │
│  All time slots visible (8 AM - 8 PM)              │
└────────────────────────────────────────────────────┘

Mentee Booking:
┌──────────────┬──────────────┬──────────────┐
│  Slot Card   │  Slot Card   │  Slot Card   │  ← 3 columns
└──────────────┴──────────────┴──────────────┘
```

### Tablet (768px - 1023px)

```
Mentor Calendar:
┌────────────────────────────────────────────────────┐
│  Full weekly grid (7 columns, smaller)             │
│  Horizontal scroll if needed                       │
└────────────────────────────────────────────────────┘

Mentee Booking:
┌──────────────┬──────────────┐
│  Slot Card   │  Slot Card   │  ← 2 columns
└──────────────┴──────────────┘
```

### Mobile (<768px)

```
Mentor Calendar:
┌────────────────────────────────────────────────────┐
│  Horizontal scroll enabled                         │
│  Min-width: 800px (scroll to see all days)         │
└────────────────────────────────────────────────────┘

Mentee Booking:
┌──────────────┐
│  Slot Card   │  ← 1 column (stacked)
├──────────────┤
│  Slot Card   │
├──────────────┤
│  Slot Card   │
└──────────────┘
```

---

## 🎯 Key Visual Elements

### Loading States

```
Mentor Calendar (Loading):
┌─────────────────────────────────────┐
│  [Spinner] Loading available slots...│
└─────────────────────────────────────┘

Mentee Calendar (Loading):
┌─────────────────────────────────────┐
│  [Spinner] Loading available slots...│
└─────────────────────────────────────┘

Booking Button (Loading):
┌─────────────────────────────────────┐
│  [Spinner] Booking...               │
└─────────────────────────────────────┘
```

### Empty States

```
No Slots Created Yet:
┌─────────────────────────────────────┐
│           📅                        │
│  No Available Slots Yet             │
│  Alice hasn't set up their          │
│  availability calendar.             │
│  Check back later!                  │
└─────────────────────────────────────┘

No Learning Goals:
┌─────────────────────────────────────┐
│  ⚠️ Set your learning goals first   │
│  [Go to Profile]                    │
└─────────────────────────────────────┘
```

---

## 🎨 Icon Set

| Icon | Unicode | Usage                    |
|------|---------|--------------------------|
| 📅   | U+1F4C5 | Calendar/slots           |
| ✓    | U+2713  | Available slot (saved)   |
| +    | U+002B  | Selected slot (new)      |
| 📌   | U+1F4CC | Booked slot              |
| —    | U+2014  | Empty/disabled slot      |
| ●    | U+25CF  | Pulse indicator          |
| ✅   | U+2705  | Success checkmark        |
| ⚠️   | U+26A0  | Warning/error            |
| 🔒   | U+1F512 | Lock (concurrency)       |
| 🔓   | U+1F513 | Unlock (released)        |
| ⏳   | U+23F3  | Waiting/loading          |
| 🕐   | U+1F550 | Time/clock               |
| ℹ️   | U+2139  | Information              |

---

**This visual summary provides a complete picture of the UI/UX design for the Calendar & Slots feature.**
