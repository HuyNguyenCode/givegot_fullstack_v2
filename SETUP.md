# GiveGot v2 - Setup Guide

## Phase 1 Complete! ✅

### What's Working:
- ✅ Prisma ORM configured (v5.22.0)
- ✅ Mock Auth System fully functional
- ✅ UserContext with real-time user switching
- ✅ Beautiful DevBar/UserSwitcher component
- ✅ Dashboard UI showing user balance and profile
- ✅ Mock data fallback system

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Mock Auth System Usage

The **Mock Auth System** allows you to switch between users instantly:

1. **DevBar**: Look at the top of the screen - you'll see a purple gradient bar
2. **Current User**: Shows who you're logged in as with their GivePoints
3. **User Switcher**: Dropdown menu to switch between all available users
4. **Persistence**: Your selected user is saved in localStorage

### Available Mock Users:
- **Alice Johnson** (Mentor) - 15 GivePoints
- **Bob Smith** (Mentee) - 3 GivePoints
- **Carol Designer** (Mentor) - 20 GivePoints
- **David Lee** (Mentee) - 3 GivePoints

---

## ⚠️ Database Connection Issue (NEEDS FIXING)

Currently, the app is using **mock data** because of a Supabase connection error.

### Error:
```
FATAL: Tenant or user not found
```

This means your Supabase credentials in `.env` are incorrect.

### To Fix:

**📋 See detailed instructions in:** `GET-SUPABASE-CREDENTIALS.md`

**Quick Steps:**
1. Go to: https://supabase.com/dashboard/project/tkvdvzbhmyaaevscjkxp/settings/database
2. Copy **Connection string** → **URI format** with password shown
3. Get both:
   - **Session mode** (port 5432) → `DIRECT_URL`
   - **Transaction mode** (port 6543) → `DATABASE_URL`
4. Update your `.env` file
5. Run: `node setup-database.js` (automated setup script)

### Once Database is Fixed:

**Easy way (automated):**
```bash
node setup-database.js
```

**Manual way:**
1. Update `.env`: Set `USE_MOCK_DATA="false"`
2. Run: `npx prisma db push`
3. Run: `npm run db:seed`
4. Restart: `npm run dev`

---

## Project Structure

```
givegot-v2/
├── prisma/
│   ├── schema.prisma       # Database schema (Time-Banking models)
│   └── seed.ts             # Seed script (10 users + skills)
├── src/
│   ├── actions/
│   │   └── user.ts         # Server Actions for user management
│   ├── app/
│   │   ├── layout.tsx      # Root layout with UserProvider
│   │   ├── page.tsx        # Dashboard page
│   │   └── globals.css     # Global styles
│   ├── components/
│   │   └── UserSwitcher.tsx # DevBar for switching users
│   ├── contexts/
│   │   └── UserContext.tsx  # Mock Auth context provider
│   ├── lib/
│   │   ├── prisma.ts       # Prisma client singleton
│   │   └── mock-data.ts    # Mock users for development
│   └── types/
│       └── index.ts        # TypeScript type definitions
└── .env                    # Environment variables
```

---

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema to database
- `npm run db:seed` - Seed database with sample data

---

## Next Steps (Phase 2)

Once the database connection is working:

1. ✅ **Mentor Discovery Page** - Browse mentors by skill
2. ✅ **Booking Flow** - Book sessions with point holding
3. ✅ **Mentor Dashboard** - Accept/reject pending sessions
4. ✅ **Session Completion** - Transfer points after session
5. ✅ **Review System** - Rate mentors after completion

---

## Time-Banking Logic Recap

1. **User A (Mentee)** books a session → 1 GivePoint is **held** (Status: PENDING)
2. **User B (Mentor)** accepts → Status: CONFIRMED
3. After session → **User A confirms completion** → Point transfers to B (Status: COMPLETED)
4. Constraint: User must have points to book (except new users get 3 free points)

---

## Testing the Mock Auth

1. Open the app in your browser
2. Use the **User Switcher** dropdown to switch between users
3. Notice how the **GivePoints balance** changes instantly
4. The **entire app state** updates to reflect the new user
5. Refresh the page - your selected user persists (localStorage)

**This mock auth system will work perfectly for your thesis demonstration!**
