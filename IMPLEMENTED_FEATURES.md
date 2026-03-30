# GiveGot v2 – Implemented Features (Comprehensive Documentation)

> **Last Updated:** March 8, 2026  
> **Document Purpose:** Exhaustive technical inventory of all implemented features, user flows, and backend logic.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Onboarding & Dev Mode](#2-onboarding--dev-mode)
3. [Profile Management](#3-profile-management)
4. [Discover / Mentor Search](#4-discover--mentor-search)
5. [Booking & Scheduling](#5-booking--scheduling)
6. [Review & Rating](#6-review--rating)
7. [Point / Transaction Ledger](#7-point--transaction-ledger)
8. [AI & Semantic Features](#8-ai--semantic-features)
9. [Database Schema & Prisma](#9-database-schema--prisma)

---

## 1. Authentication

### 1.1 Implementation Overview

- **Stack:** NextAuth.js v5 with JWT strategy
- **Adapter:** PrismaAdapter (User, Account, Session stored in PostgreSQL)
- **Providers:** Google OAuth + Credentials (email/password with bcrypt)

### 1.2 Granular Features

| Feature | Details |
|---------|---------|
| **Google OAuth** | `GoogleProvider` with `allowDangerousEmailAccountLinking: true` to link Google account to existing User with same email |
| **Credentials Login** | Email + password; password verified via `bcrypt.compare()` against `User.password` |
| **Session Strategy** | JWT (not database sessions for stateless auth) |
| **Session Callbacks** | `jwt()` stores `user.id` in token; `session()` exposes `session.user.id` to client |
| **Custom Sign-In Page** | `/auth/signin` set via `pages: { signIn: '/auth/signin' }` |

### 1.3 User Flow: Sign-In Page (`/auth/signin`)

1. User lands on `/auth/signin`.
2. **Option A – Google:**
   - Clicks "Sign in with Google".
   - Redirects to Google OAuth.
   - On success, NextAuth creates/links User + Account via PrismaAdapter.
   - Redirects to `callbackUrl` (default: `/dashboard`) or `?callbackUrl=...`.
3. **Option B – Credentials:**
   - Fills email + password.
   - Submits form → `signIn('credentials', { email, password, callbackUrl })`.
   - On success, `window.location.href = callbackUrl`.
   - On failure, shows "Invalid email or password".
4. If user was redirected from protected route, `callbackUrl` preserves that path.

### 1.4 Middleware Protection

- **File:** `src/middleware.ts`
- **Behavior:**
  - If `NEXT_PUBLIC_SHOW_DEV_BAR=true` → **skip all auth checks** (dev mode).
  - `/auth/signin` and `/api/auth/*` → allow unauthenticated.
  - Otherwise, if no `req.auth` → redirect to `/auth/signin?callbackUrl=<pathname>`.
- **Matcher:** All paths except `_next/static`, `_next/image`, favicon, images, public assets.

### 1.5 API Routes

| Route | Purpose |
|-------|---------|
| `/api/auth/[...nextauth]` | NextAuth catch-all (session, sign-in, sign-out, OAuth callbacks) |

---

## 2. Onboarding & Dev Mode

### 2.1 Production vs Dev Mode

| Mode | Condition | Behavior |
|------|-----------|----------|
| **Dev Mode** | `NEXT_PUBLIC_SHOW_DEV_BAR=true` | Middleware skips auth; `UserSwitcher` shows; `UserProvider` uses `localStorage.mockUserId` to select user |
| **Production** | Otherwise | Middleware enforces auth; `ProductionHeader` shows; `UserProvider` uses NextAuth session |

### 2.2 User Context (`UserContext.tsx`)

- **Initialization:**
  - Fetches all users via `getAllUsers()`.
  - Dev: reads `localStorage.mockUserId` → loads that user or falls back to first user.
  - Prod: fetches `/api/auth/session` → finds user by `session.user.email`.
- **Methods:**
  - `refreshUser()` – re-fetches current user by ID.
  - `switchUser(userId)` – (dev only) sets `currentUser` and `localStorage.mockUserId`.
  - `signOutDev()` – (dev only) clears `mockUserId` and sets `currentUser = null`.

### 2.3 UI: ProductionHeader vs UserSwitcher

| Component | When Shown | Contents |
|------------|------------|----------|
| **ProductionHeader** | Production + user exists | Logo, Dashboard, History, Profile (avatar + name + pts), Sign Out |
| **UserSwitcher** | Dev mode only | "DEV MODE", current user info, Profile link, user dropdown, Sign Out |

---

## 3. Profile Management

### 3.1 Route & Layout

- **Route:** `/profile`
- **Data sources:** `getAllAvailableSkills`, `getUserTeachingSkills`, `getUserLearningGoals`, `getUserSkillDetails` (for verification status)

### 3.2 Granular Features

| Feature | Description |
|---------|-------------|
| **Basic Profile** | Edit name, bio, avatar URL |
| **Teaching Skills (GIVE)** | Multi-select from existing skills + custom skill creation; autocomplete dropdown with keyboard nav |
| **Learning Goals (WANT)** | Same multi-select + custom skills |
| **Custom Skills** | User can type new skill name → `ensureSkillExists()` creates Skill with auto slug; embedding generated on profile save |
| **Skill Verification** | "Sát hạch" button per teaching skill → opens QuizModal; on pass (≥4/5), `verifyUserSkill()` sets `UserSkill.isVerified = true` |
| **Embedding Generation** | On save, `generateSkillEmbedding()` for teaching + learning skill lists; stored in `User.teachingEmbedding` and `User.learningEmbedding` (768-dim vector) |

### 3.3 User Flow: Profile Edit (A→Z)

1. Click Profile in header or navigate to `/profile`.
2. Form loads: name, bio, avatarUrl, teaching skills, learning goals.
3. **Teaching skills:**
   - Type in input → filtered dropdown of skills not yet selected.
   - Click or Enter to add; X to remove.
   - Supports custom skill names (created on save).
4. **Learning goals:** Same UX.
5. **Verify skill:**
   - Click "Sát hạch" on a teaching skill.
   - If skill not saved: alert to save profile first.
   - QuizModal opens with 5 questions.
6. **Save Profile:** Clicks "Save Profile" → `updateUserProfile()`:
   - Updates name, bio, avatar.
   - Replaces teaching skills (delete all GIVE UserSkills → create new).
   - Replaces learning goals (delete all WANT UserSkills → create new).
   - Generates embeddings and updates User table.
7. Success toast; `revalidatePath` for `/`, `/discover`, `/profile`.

### 3.4 Backend: `updateUserProfile` (user.ts)

- **Teaching skills:**
  - `ensureSkillExists(skillName)` – creates Skill if not found (case-insensitive).
  - Slug: `toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/\s+/g,'-')`; dedupe with `-1`, `-2` if needed.
  - `generateSkillEmbedding(teachingSkills)` → 768-dim vector → `User.teachingEmbedding`.
- **Learning goals:** Same flow for `User.learningEmbedding`.

---

## 4. Discover / Mentor Search

### 4.1 Route

- **Route:** `/discover`
- **Query param:** `?search=<query>` for semantic search

### 4.2 Two Modes

| Mode | Condition | Action Called | Display |
|------|-----------|---------------|---------|
| **Default (no search)** | `searchQuery` empty | `getAutoMatchedMentors(currentUserId)` | "Best Matches" + "Explore Other Mentors" |
| **Search** | `searchQuery` non-empty | `searchMentorsSemantically(query, currentUserId)` | Single "Search Results" section |

### 4.3 User Flow: Discover (A→Z)

1. Navigate to `/discover` (or via URL `?search=React`).
2. Page loads; `useEffect` runs with `currentUser` and `searchQuery` (from state or URL).
3. **If searchQuery:**
   - Calls `searchMentorsSemantically`.
   - Shows loading spinner.
   - Displays mentor cards in grid; no "Best/Other" split.
4. **If no searchQuery:**
   - Calls `getAutoMatchedMentors`.
   - Shows "Best Matches" (green header) and "Explore Other Mentors" (gray header).
5. User can:
   - Type in search box → triggers new search (debounced via `searchQuery` dependency).
   - Clear search (X button) → reverts to auto-match.
   - Click mentor card → `/mentor/<id>`.
   - Click "View Available Slots" → `/mentor/<id>`.
   - Click "View Full Profile & Reviews" → `/mentor/<id>#reviews`.
6. UI shows: GivePoints balance, learning goals (when in auto-match), mentor cards with skills, ratings, AI match %, verified badges.

### 4.4 Mentor Card UI

- Avatar, name, email, rating (stars + count).
- Bio (line-clamp-3).
- Teaching skills: matched = green + ✓; verified = purple gradient + badge; else purple-100.
- "View Available Slots" and "View Full Profile & Reviews" buttons.
- AI Match badge (for best matches with `matchScore > 0`).

---

## 5. Booking & Scheduling

### 5.1 Booking Models

| Model | Purpose |
|-------|---------|
| **Slot-based** | Primary: `MenteeBookingCalendar` on mentor page; `bookAvailableSlot(slotId, menteeId, note)` |
| **Legacy free-form** | `/book/[mentorId]`: date + time inputs; `createBooking(mentorId, menteeId, startTime, endTime, note)` |

### 5.2 Slot Management (Mentor)

**Component:** `MentorCalendarManager` (Dashboard)

- **Grid:** Week view; Monday–Sunday; 8 AM–8 PM.
- **Add slots:** Click cells → toggle selection → "Add Selected Slots" → `addMentorSlots()`.
- **Overlap check:** Server validates no overlapping slots; existing slots checked via Prisma.
- **Delete:** Only unbooked slots; `deleteMentorSlot(slotId, mentorId)`.
- **Display:** Booked slots show mentee info; unbooked show as deletable.

### 5.3 Slot Booking (Mentee)

**Component:** `MenteeBookingCalendar` (mentor profile page)

- **Data:** `getAvailableSlots(mentorId)` – future, unbooked slots.
- **UI:** Slots grouped by week; green slots = bookable.
- **Flow:**
  1. Click slot → modal with optional note.
  2. Confirm → `bookAvailableSlot(slotId, currentUserId, note)`.
  3. Success → toast, redirect to `/dashboard`.
  4. Failure (e.g. SLOT_TAKEN) → error toast, slots refresh.

### 5.4 Booking Flow: Step-by-Step

**Mentee books slot:**

1. Mentee on `/mentor/<id>` sees `MenteeBookingCalendar`.
2. Clicks available slot → modal opens.
3. Optionally adds note; clicks "Book".
4. `bookAvailableSlot` runs:
   - `SELECT ... FOR UPDATE` on slot (lock).
   - If `isBooked` → throw `SLOT_TAKEN`.
   - If mentee `givePoints < 1` → error.
   - Decrement mentee `givePoints` by 1.
   - Create Booking (PENDING, linked to slot).
   - Create TransactionLog (amount: -1, type: BOOKING_CREATED).
   - Set slot `isBooked = true`.
5. Mentee sees "1 GivePoint held. Waiting for mentor to accept."

**Mentor accepts/declines:**

- **Accept:** `acceptBooking(bookingId, mentorId)` → status = CONFIRMED.
- **Decline:** `declineBooking(bookingId, mentorId)`:
  - Status = CANCELLED.
  - Release slot (`isBooked = false`).
  - Refund mentee (+1 point).
  - TransactionLog: +1 BOOKING_DECLINED.

**Mentee completes session:**

- Clicks "Submit Review & Complete" → review modal.
- Selects 1–5 stars, optional comment (max 500 chars).
- `completeSessionWithReview(bookingId, menteeId, rating, comment)`:
  - Create Review.
  - Booking status = COMPLETED.
  - Mentor `givePoints` +1.
  - TransactionLog: +1 BOOKING_COMPLETED.

**Cancel (mentor or mentee):**

- `cancelBooking(bookingId, userId)`:
  - Status = CANCELLED.
  - Release slot if applicable.
  - Refund mentee.
  - TransactionLog: +1 BOOKING_CANCELLED.

### 5.5 Concurrency Control

- **Lock:** `SELECT ... FOR UPDATE` on `AvailableSlot` inside Prisma transaction.
- **Isolation:** `ReadCommitted`; `maxWait: 5000`, `timeout: 10000`.
- **Double-book prevention:** Check `isBooked` after lock.

---

## 6. Review & Rating

### 6.1 Data Model

- **Review:** `bookingId`, `receiverId` (mentor), `authorId` (mentee), `rating` (1–5), `comment`.
- One review per completed booking.

### 6.2 Creation Flow

- Triggered from Dashboard when mentee clicks "Submit Review & Complete" on CONFIRMED booking.
- Modal: 5-star picker, optional textarea (500 chars).
- `completeSessionWithReview` creates Review in same transaction as booking completion and point transfer.

### 6.3 Display

- **Mentor profile:** `getReviewsWithReviewerDetails(mentorId)` – reviews with reviewer avatar/name.
- **Mentor rating:** `getMentorRating(mentorId)` → `{ average, count }`.
- **History page:** Star display per booking if review exists.

---

## 7. Point / Transaction Ledger

### 7.1 Transaction Types

| Type | Amount | When |
|------|--------|------|
| BOOKING_CREATED | -1 | Mentee books session |
| BOOKING_COMPLETED | +1 | Mentor receives point after completion |
| BOOKING_CANCELLED | +1 | Refund to mentee on cancel |
| BOOKING_DECLINED | +1 | Refund to mentee on mentor decline |
| INITIAL_BONUS | +3 | New user (via seed or manual) |
| ADMIN_ADJUSTMENT | ±N | Manual |

### 7.2 Point Rules

- 1 session = 1 GivePoint.
- Mentee pays 1 point when booking (held until completion or cancel/decline).
- Mentor earns 1 point when session is completed with review.
- Cancellation/decline refunds 1 point to mentee.

### 7.3 History Page (`/history`)

- **Tabs:** "My Bookings" and "GivePoint Ledger".
- **Summary cards:** Current balance, total earned, total spent, sessions done, bookings made.
- **Bookings tab:** Table with date, session time, role (mentor/mentee), other user, status, point impact, review stars.
- **Transactions tab:** Chronological list with type, related booking/user, amount, running balance.

### 7.4 Backend Functions

- `getUserTransactions(userId)` – all TransactionLog with booking + mentor/mentee.
- `getUserBookingHistory(userId)` – all bookings as mentor/mentee with slot, review.
- `getTransactionSummary(userId)` – aggregated counts and totals.

---

## 8. AI & Semantic Features

### 8.1 Models & Embeddings

| Model | Use |
|-------|-----|
| `gemini-embedding-001` | 768-dim embeddings for skills and search queries |
| `gemini-2.5-flash` | Quiz generation, roadmap generation |

### 8.2 Auto-Match Algorithm (`getAutoMatchedMentors`)

**Input:** `currentUserId`

**Steps:**

1. Load user WANT skills (UserSkill + Skill with embeddings).
2. Raw SQL with CROSS JOIN:
   - Join User + UserSkill (GIVE) + Skill (GIVE) with UserSkill (WANT) + Skill (WANT).
   - `MAX(1 - (s_give.embedding <=> s_want.embedding))` as `maxSimilarity`.
   - `BOOL_OR(skill name match OR bio ILIKE)` as `hasKeywordMatch`.
   - `HAVING`: keyword match **OR** semantic ≥ 0.55.
   - `ORDER BY hasKeywordMatch DESC, maxSimilarity DESC`.
   - Limit 30.
3. Split:
   - **Keyword matches** → always in `bestMatches`.
   - **Semantic only** → split at cutoff `0.585`:
     - `maxSimilarity >= 0.585` → `bestMatches`.
     - `maxSimilarity < 0.585` → `otherMentors`.
4. Fallback: If raw SQL fails, use keyword-only matching (exact skill name).

### 8.3 Semantic Search (`searchMentorsSemantically`)

**Input:** `query`, `currentUserId`

**Steps:**

1. Generate embedding: `generateEmbedding(query)` → 768-dim.
2. Raw SQL:
   - Join User + UserSkill (GIVE) + Skill.
   - `MAX(1 - (s.embedding <=> query_embedding))` as `maxSimilarity`.
   - `BOOL_OR(LOWER(s.name) LIKE %query% OR LOWER(bio) LIKE %query%)` as `hasKeywordMatch`.
   - `HAVING`: keyword **OR** semantic ≥ 0.57.
   - `ORDER BY hasKeywordMatch DESC, maxSimilarity DESC`.
   - Limit 50.
3. Enrich with teaching skills and `isVerified`; compute `matchedSkills` for UI.

### 8.4 AI Quiz (`generateSkillQuiz`, QuizModal)

- **Generation:** `gemini-2.5-flash` produces 5 multiple-choice questions in Vietnamese.
- **Structure:** `{ question, options: [4], correctAnswer: 0..3 }`.
- **Quiz rules:**
  - 15 seconds per question; timeout = auto-advance (wrong).
  - Tab switch / window blur → fail quiz.
  - Pass: ≥4/5 correct → `verifyUserSkill(userSkillId)`.
- **UI:** QuizModal with question, options, timer, pass/fail screen.

### 8.5 AI Roadmap (`generateLearningRoadmap`, LearningRoadmapCard)

- **Generation:** `gemini-2.5-flash` produces exactly 4 steps.
- **Step format:** `{ step, title, description, searchKeyword }`.
- **Caching:** Stored in `UserSkill.roadmap` (JSON).
- **Flow:** `getOrGenerateRoadmap(userSkillId, skillName)` checks cache; if miss, generates and saves.
- **UI:** `LearningRoadmapCard` – expandable; each step has "Find Mentor for &lt;searchKeyword&gt;" linking to `/discover?search=...`.

### 8.6 Skill Embeddings

- **Skills:** `Skill.embedding` (vector 768) – backfilled via `prisma/backfill-skill-embeddings.ts`.
- **Users:** `User.teachingEmbedding`, `User.learningEmbedding` – from `generateSkillEmbedding(skillNames[])` when profile is saved.
- **Custom skills:** `ensureSkillExists()` creates Skill; embedding generated in backfill or when first used.

---

## 9. Database Schema & Prisma

### 9.1 Models

| Model | Key Fields |
|-------|------------|
| **User** | id, email, name, avatarUrl, bio, givePoints, teachingEmbedding, learningEmbedding, password, NextAuth fields |
| **Skill** | id, name, slug, category, embedding |
| **UserSkill** | userId, skillId, type (GIVE/WANT), isVerified, roadmap (JSON) |
| **AvailableSlot** | mentorId, startTime, endTime, isBooked |
| **Booking** | mentorId, menteeId, slotId, startTime, endTime, status, note |
| **Review** | bookingId, receiverId, authorId, rating, comment |
| **TransactionLog** | userId, amount, type, bookingId |
| **Account, Session, VerificationToken** | NextAuth |

### 9.2 Enums

- `SkillType`: WANT, GIVE
- `BookingStatus`: PENDING, CONFIRMED, COMPLETED, CANCELLED
- `TransactionType`: BOOKING_CREATED, BOOKING_COMPLETED, BOOKING_CANCELLED, BOOKING_DECLINED, INITIAL_BONUS, ADMIN_ADJUSTMENT

### 9.3 Relations

- User ↔ UserSkill ↔ Skill
- User → AvailableSlot (mentor)
- User → Booking (mentor/mentee)
- Booking → AvailableSlot (1:1, optional)
- Booking → Review (1:1)
- User → TransactionLog
- Booking → TransactionLog

### 9.4 Indexes

- `@@unique([mentorId, startTime, endTime])` on AvailableSlot
- `@@index([mentorId, isBooked])` on AvailableSlot
- `@@index([userId, createdAt])` on TransactionLog

---

## Appendix A: All Server Actions

| File | Function | Purpose |
|------|----------|---------|
| booking.ts | bookAvailableSlot | Atomic slot booking with concurrency |
| booking.ts | bookSlot | Alias for bookAvailableSlot |
| booking.ts | createBooking | Legacy free-form booking |
| booking.ts | acceptBooking | Mentor confirms PENDING |
| booking.ts | declineBooking | Mentor declines, refund, release slot |
| booking.ts | completeSessionWithReview | Complete + review + point transfer |
| booking.ts | cancelBooking | Cancel, refund, release slot |
| booking.ts | getMyBookings | Bookings as mentor and mentee |
| booking.ts | getAllBookings | All bookings (admin) |
| booking.ts | getReviewsByMentorId | Reviews for mentor |
| booking.ts | getReviewsWithReviewerDetails | Reviews + reviewer info |
| booking.ts | getMentorRating | Average rating and count |
| mentor.ts | getAutoMatchedMentors | Granular skill-level matching |
| mentor.ts | getMentors | List mentors with teaching skills |
| mentor.ts | getMentorById | Mentor by ID |
| mentor.ts | searchMentorsSemantically | Hybrid keyword + semantic search |
| slots.ts | addMentorSlots | Add slots with overlap check |
| slots.ts | getAvailableSlots | Future unbooked slots for mentee |
| slots.ts | getAllMentorSlots | All slots with booking info |
| slots.ts | deleteMentorSlot | Remove unbooked slot |
| transactions.ts | getUserTransactions | Transaction log |
| transactions.ts | getUserBookingHistory | Booking history |
| transactions.ts | getTransactionSummary | Totals (earned, spent, etc.) |
| user.ts | getAllUsers | All users |
| user.ts | getUserById | User by ID |
| user.ts | getUserWithSkills | User with skills |
| user.ts | getUserLearningGoals | WANT skills + roadmap |
| user.ts | getUserTeachingSkills | GIVE skills + isVerified |
| user.ts | getAllAvailableSkills | All skills for profile |
| user.ts | updateUserProfile | Update profile + skills + embeddings |
| quiz.ts | getQuizForSkill | Generate Gemini quiz |
| quiz.ts | verifyUserSkill | Mark UserSkill verified |
| quiz.ts | getUserSkillDetails | UserSkill by userId, skillName, type |
| roadmap.ts | getOrGenerateRoadmap | Cached or new AI roadmap |
| roadmap.ts | clearRoadmapCache | Clear roadmap for regeneration |

---

## Appendix B: All Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | page.tsx | Home: balance, profile summary, nav |
| `/auth/signin` | signin/page.tsx | Google + credentials login |
| `/discover` | discover/page.tsx | Mentor discovery + semantic search |
| `/dashboard` | dashboard/page.tsx | Bookings, calendar, roadmap, actions |
| `/profile` | profile/page.tsx | Edit profile, skills, quiz |
| `/history` | history/page.tsx | Bookings + transaction ledger |
| `/mentor/[mentorId]` | mentor/[mentorId]/page.tsx | Mentor profile, reviews, calendar booking |
| `/book/[mentorId]` | book/[mentorId]/page.tsx | Legacy free-form booking |
| `/api/auth/[...nextauth]` | route.ts | NextAuth handlers |

---

## Appendix C: Key UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| MentorCalendarManager | components/ | Week grid; add/delete slots (mentor) |
| MenteeBookingCalendar | components/ | View slots; book with note (mentee) |
| QuizModal | components/ | 5-question quiz; timer; tab-switch detection |
| LearningRoadmapCard | components/ | Expandable 4-step roadmap; "Find Mentor" links |
| ProductionHeader | components/ | Nav (Dashboard, History, Profile, Sign out) |
| UserSwitcher | components/ | Dev: user dropdown, Profile, Sign out |
| SessionProvider | components/ | NextAuth SessionProvider |
| SignOutButton | components/ | Sign out (prod or dev variant) |

---

*End of document*
