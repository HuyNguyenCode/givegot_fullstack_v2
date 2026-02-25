# How to Get Correct Supabase Connection Strings

## Step-by-Step Guide:

### 1. Open Supabase Dashboard
Go to: https://supabase.com/dashboard/project/tkvdvzbhmyaaevscjkxp

### 2. Navigate to Database Settings
- Click on **Project Settings** (gear icon) in the left sidebar
- Click on **Database** tab

### 3. Find Connection String Section
Scroll down to find **"Connection string"** or **"Connection pooling"**

### 4. Copy Both Connection Strings:

#### A. For `DATABASE_URL` (Transaction Mode):
- Look for **"Connection pooling"** → **"Transaction mode"**
- Select **"URI"** format
- Click **"Show password"** checkbox
- Copy the entire string
- It should look like: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

#### B. For `DIRECT_URL` (Session Mode):
- Look for **"Connection pooling"** → **"Session mode"**
- Select **"URI"** format  
- Click **"Show password"** checkbox
- Copy the entire string
- It should look like: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`

OR use **"Direct connection"** (not pooler):
- Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

---

## Common Issues:

### Issue 1: Username Format
- ✅ Correct: `postgres.PROJECT_REF` or just `postgres`
- ❌ Wrong: `postgres.tkvdvzbhmyaaevscjkxp` (if it's not matching your project)

### Issue 2: Password
- Your password might contain special characters
- If password is: `MyP@ss.word`
- Encode it as: `MyP%40ss%2Eword`
  - `@` → `%40`
  - `.` → `%2E`
  - `#` → `%23`
  - `$` → `%24`
  - `%` → `%25`

### Issue 3: Host/Region
- Make sure `aws-1-ap-south-1` matches your actual region
- Sometimes it's `aws-0-ap-south-1` instead

---

## Quick Test After Updating:

1. Update `.env` with new connection strings
2. Run: `node test-db-connection.js`
3. If successful, you'll see: "✅ SUCCESS! Found X users."
4. Then run: `npx prisma db push`
5. Then seed: `npm run db:seed`

---

## Alternative: Continue with Mock Data

If you want to proceed with development first and fix the database later:
- Keep `USE_MOCK_DATA="true"` in `.env`
- The app works perfectly with mock data
- Fix the database connection later

The Mock Auth system is already working! Check http://localhost:3000
