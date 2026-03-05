# GiveGot - Time-Banking Mentorship Platform

> **Graduation Thesis Project** - Teach 1 hour, earn 1 point. Learn from experts.

A Next.js-based mentorship platform implementing time-banking economics where teaching time earns points that can be spent on learning.

---

## 🚀 Quick Start

### First Time Setup

```bash
# Install dependencies
npm install

# Push database schema
npx prisma db push --accept-data-loss

# Generate Prisma client
npx prisma generate

# Seed database
npm run db:seed

# Backfill AI embeddings
npm run db:backfill-embeddings

# Backfill transaction history
npm run db:backfill-transactions

# Start development server
npm run dev
```

### Daily Development

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**NEW:** Check out `START-HERE-AUTH-HISTORY.md` for the latest features!

---

## ✨ Features Implemented

### Phase 1: Foundation ✅
- ✅ **Mock Authentication System** - Switch between users instantly via DevBar
- ✅ **User Context** - Real-time state management across the app
- ✅ **Prisma ORM** - Database schema and client setup
- ✅ **Mock Data Fallback** - Works without database connection

### Phase 2: Mentor Discovery ✅
- ✅ **Mentor Discovery Page** (`/discover`) - Browse available mentors
- ✅ **Skill Display** - See what each mentor teaches
- ✅ **Smart Filtering** - Current user excluded from mentor list
- ✅ **Profile Cards** - Beautiful UI with avatars and bios

### Phase 3: Booking System ✅
- ✅ **Book Sessions** (`/book/[mentorId]`) - Schedule 1-hour sessions
- ✅ **Point Validation** - Must have >= 1 point to book
- ✅ **Point Holding** - 1 point held when booking (PENDING status)
- ✅ **Mentor Acceptance** - Mentor can accept/decline bookings
- ✅ **Session Completion** - Mentee marks complete → point transfers
- ✅ **Cancellation** - Either party can cancel with point refund
- ✅ **Full Dashboard** (`/dashboard`) - Manage all bookings

### Phase 4: Calendar & Available Slots ✅
- ✅ **Mentor Calendar Manager** - Weekly grid view for setting availability
- ✅ **Available Slots** - Mentors create 1-hour time slots
- ✅ **Slot-Based Booking** - Mentees book from available slots
- ✅ **Concurrency Control** - Database-level locking prevents double-booking
- ✅ **Atomic Transactions** - `SELECT FOR UPDATE` ensures data consistency
- ✅ **Graceful Error Handling** - User-friendly messages for booking conflicts
- ✅ **Slot Release** - Cancelled bookings free up slots immediately

### Phase 5: Authentication & Transaction History ✅ **NEW!**
- ✅ **NextAuth Integration** - Production-ready authentication (Google OAuth + Credentials)
- ✅ **DevBar Control** - Environment-based visibility (`NEXT_PUBLIC_SHOW_DEV_BAR`)
- ✅ **Transaction Logging** - Complete audit trail for all GivePoint changes
- ✅ **Booking History** - Professional UI showing all bookings with color-coded statuses
- ✅ **Transaction Ledger** - Detailed view of all point movements with running balance
- ✅ **Summary Statistics** - Real-time balance, earned, spent, sessions, and bookings
- ✅ **Decline Booking** - Mentors can decline with automatic refund
- ✅ **Backfill Script** - Migrate existing data to transaction logs

---

## 🎯 Time-Banking Logic

### Booking Flow:

```
1. MENTEE books session
   └─> Deduct 1 point from mentee (held)
   └─> Status: PENDING

2. MENTOR accepts booking
   └─> Status: CONFIRMED
   └─> Point still held

3. MENTEE completes session
   └─> Transfer 1 point to mentor
   └─> Status: COMPLETED
```

### Business Rules:
- New users start with **3 free GivePoints**
- **1 hour = 1 GivePoint**
- Points must be available to book
- Points transfer only after completion
- Cancellation refunds the held point

---

## 🎨 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **Prisma** | Database ORM |
| **PostgreSQL** | Database (via Supabase) with pgvector |
| **Server Actions** | API endpoints |
| **NextAuth v5** | Authentication (Google OAuth + Credentials) |
| **bcryptjs** | Password hashing |
| **date-fns** | Date manipulation and formatting |

---

## 📁 Project Structure

```
givegot-v2/
├── src/
│   ├── actions/
│   │   ├── user.ts          # User management actions
│   │   ├── mentor.ts        # Mentor discovery actions
│   │   ├── booking.ts       # Booking CRUD operations
│   │   └── slots.ts         # ✨ NEW: Slot management (availability)
│   ├── app/
│   │   ├── page.tsx         # Home/Welcome page
│   │   ├── discover/        # Mentor discovery
│   │   ├── book/[mentorId]/ # Booking form
│   │   ├── dashboard/       # User dashboard
│   │   └── layout.tsx       # Root layout with UserProvider
│   ├── components/
│   │   ├── UserSwitcher.tsx          # DevBar for mock auth
│   │   ├── MentorCalendarManager.tsx # ✨ NEW: Mentor availability calendar
│   │   └── MenteeBookingCalendar.tsx # ✨ NEW: Mentee booking interface
│   ├── contexts/
│   │   └── UserContext.tsx  # User state management
│   ├── lib/
│   │   ├── prisma.ts        # Prisma client singleton
│   │   └── mock-data.ts     # Mock users & bookings storage
│   └── types/
│       └── index.ts         # TypeScript definitions
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Database seeding script
└── .env                     # Environment variables
```

---

## 🧪 Testing the Complete Flow

### Scenario 1: Full Booking Cycle

**Step 1: Book as Mentee**
1. Switch to **Bob Smith** (3 points)
2. Go to **Discover Mentors**
3. Click **Book Session** on Alice Johnson
4. Fill date/time and note
5. Submit → Bob now has **2 points** (1 held)

**Step 2: Accept as Mentor**
1. Switch to **Alice Johnson** (15 points)
2. Go to **My Dashboard**
3. See Bob's booking under "Mentoring Sessions"
4. Click **Accept Booking**
5. Status → **CONFIRMED**

**Step 3: Complete as Mentee**
1. Switch to **Bob Smith**
2. Go to **My Dashboard**
3. See Alice's session under "Learning Sessions"
4. Click **Mark as Complete**
5. ✅ Alice now has **16 points** (+1 from Bob)

### Scenario 2: Insufficient Points

1. Switch to **Bob Smith** (currently 2 points after booking)
2. Go to **Discover Mentors**
3. Book 2 more sessions to drain points
4. Try booking a 3rd session
5. ❌ Error: "Not enough GivePoints"

### Scenario 3: Cancel & Refund

1. Book a session as mentee (1 point held)
2. Before mentor accepts, click **Cancel**
3. ✅ Point refunded immediately

---

## 🎭 Mock Users Available

| Name | Role | Points | Skills |
|------|------|--------|--------|
| Alice Johnson | Mentor | 15 | ReactJS, NodeJS |
| Bob Smith | Mentee | 3 | Learning web dev |
| Carol Designer | Mentor | 20 | UI/UX Design |
| David Lee | Mentee | 3 | Learning Python |

---

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server

# Database (when connected)
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database
npm run db:seed          # Seed with sample data

# Production
npm run build            # Build for production
npm run start            # Start production server
```

---

## 🎓 For Thesis Presentation

### Demo Flow:

1. **Introduction** (Home page)
   - Explain time-banking concept
   - Show current user and balance

2. **Discovery** (Discover page)
   - Browse available mentors
   - Show filtering (current user excluded)

3. **Booking** (Book page)
   - Book a session with date/time
   - Show point validation
   - Demonstrate point holding

4. **Mentor Perspective** (Dashboard - switch users)
   - Accept booking request
   - Show status change

5. **Completion** (Dashboard - switch back)
   - Complete the session
   - Show point transfer
   - Display updated balances

### Key Selling Points:
- ✅ **Instant user switching** for demo purposes
- ✅ **Visual feedback** with status badges and animations
- ✅ **Real-time updates** when switching perspectives
- ✅ **Professional UI** with modern design
- ✅ **Complete business logic** implemented

---

## 🐛 Troubleshooting

### Database Connection Failed?
- Currently using `USE_MOCK_DATA="true"` in `.env`
- App works perfectly without database
- To connect to Supabase: See `GET-SUPABASE-CREDENTIALS.md`

### Port Already in Use?
```bash
# Kill process on port 3000 (Windows)
npx kill-port 3000

# Or change port
npm run dev -- -p 3001
```

### Mock Data Reset?
Restart the dev server to reset all bookings and user points.

---

## 📝 Environment Variables

```env
# Database (optional if using mock data)
DATABASE_URL="..."
DIRECT_URL="..."

# Mock Data Mode
USE_MOCK_DATA="true"  # Set to "false" when database is connected

# Supabase (optional)
SUPABASE_URL="..."
SUPABASE_SERVICE_ROLE="..."

# AI Features (for future)
GEMINI_API_KEY="..."
```

---

## 🎯 Next Features (Future Phases)

- [x] ✅ Calendar view for scheduled sessions (COMPLETED!)
- [x] ✅ Concurrency control for bookings (COMPLETED!)
- [ ] Recurring slots (e.g., "Every Monday 9-10 AM")
- [ ] Timezone support (store UTC, display local)
- [ ] Email notifications (slot booked, session reminder)
- [ ] Variable slot durations (30min, 1hr, 2hr)
- [ ] Session history and analytics
- [ ] Rating and reputation system

---

## 📄 License

This is a graduation thesis project.

---

## 🙏 Acknowledgments

Built with Next.js 14 App Router, Prisma ORM, and Tailwind CSS.

**For questions or issues, please refer to the documentation files:**
- `SETUP.md` - Initial setup instructions
- `STATUS.md` - Current project status
- `PHASE-2-3-COMPLETE.md` - Feature documentation
- `GET-SUPABASE-CREDENTIALS.md` - Database connection help

**Calendar & Slots Documentation:**
- `CALENDAR-QUICK-START.md` - Quick start guide (5 minutes)
- `CALENDAR-SLOTS-FEATURE.md` - Comprehensive feature documentation
- `CONCURRENCY-CONTROL-EXPLAINED.md` - Deep dive into locking mechanism
- `IMPLEMENTATION-SUMMARY.md` - High-level implementation overview
- `VISUAL-SUMMARY.md` - UI/UX flows and mockups
- `BOOKING-FLOW-MIGRATION.md` - Migration guide
- `BEFORE-AFTER-COMPARISON.md` - Visual comparison
- `FIXES-QUICK-REFERENCE.md` - Bug fixes reference

**Authentication & History Documentation:** ✨ NEW!
- `AUTH-QUICK-START.md` - Setup authentication in 5 minutes
- `AUTH-AND-HISTORY-IMPLEMENTATION.md` - Complete auth & history docs
- `AUTH-HISTORY-VISUAL-GUIDE.md` - Visual UI/UX guide
- `COMPLETE-IMPLEMENTATION-SUMMARY.md` - Full platform overview
- `TESTING-GUIDE.md` - Comprehensive testing guide (30 tests)
- `DEPLOYMENT-CHECKLIST.md` - Production deployment checklist
