# 🚀 AI Quiz Verification - Quick Start

## ⚡ Run These Commands Now!

### Step 1: Push Schema Changes

```bash
npx prisma db push
```

✅ Adds `isVerified` field to `UserSkill` table

---

### Step 2: Regenerate Prisma Client

```bash
npm run db:generate
```

✅ Updates TypeScript types

---

### Step 3: Start Dev Server

```bash
npm run dev
```

✅ App running!

---

## 🧪 Test It (2 minutes)

### Quick Test Flow

1. Open `http://localhost:3000/profile`
2. Add teaching skill: "ReactJS"
3. Click **[Verify]** button
4. Wait ~3 seconds (AI generating quiz)
5. Quiz modal opens with 5 Vietnamese questions!
6. Answer questions (15s per question)
7. Pass with 4/5 correct
8. **"Verified"** badge appears! ✅

---

## 🎯 What You Get

### Verified Badge

```
Before: [ReactJS [Verify] ×]
After:  [⭐ ReactJS [Verified] ×]
```

### Anti-Cheat Features

- ✅ Tab switch detection → Instant fail
- ✅ 15-second timer per question
- ✅ Auto-submit on timeout
- ✅ Visual warnings

---

## 🎓 Thesis Demo (30 seconds)

**Say**: "We verify mentor skills with AI-generated quizzes"

**Do**: 
1. Click [Verify] on a skill
2. Show quiz modal
3. Point out timer + anti-cheat warning
4. Complete quiz
5. Show verified badge

**Impact**: Committee sees real security + AI!

---

## 📊 Features

| Feature | Status |
|---------|--------|
| AI Quiz Generation | ✅ |
| Vietnamese Questions | ✅ |
| Anti-Cheat (Tab Switch) | ✅ |
| Timer (15s/question) | ✅ |
| Pass/Fail Screens | ✅ |
| Verified Badge | ✅ |
| Database Integration | ✅ |

---

## 🔧 How It Works

```
1. User clicks [Verify]
        ↓
2. AI generates 5 questions (Gemini)
        ↓
3. Quiz modal opens
        ↓
4. User answers (15s each)
        ↓
5. Score >= 4/5 = Pass
        ↓
6. Update DB: isVerified = true
        ↓
7. Badge appears on profile
```

---

## ⚠️ Anti-Cheat Demo

### Test Tab Switch Detection

1. Start quiz
2. Click another browser tab
3. **Result**: Quiz fails immediately with warning! 🚨

### Test Timer Expiration

1. Start quiz
2. Don't answer
3. Wait 15 seconds
4. **Result**: Auto-advances (counts as wrong)

---

## 📚 Full Documentation

See `AI-QUIZ-VERIFICATION-COMPLETE.md` for:
- Complete technical details
- Code explanations
- Thesis demo script
- Future enhancements

---

## ✅ Verification Checklist

- [ ] Schema pushed
- [ ] Prisma client regenerated
- [ ] Dev server running
- [ ] Added skill to profile
- [ ] Clicked [Verify]
- [ ] Completed quiz
- [ ] Verified badge showing

---

**Status**: ✅ CODE READY  
**Action**: Run commands above!

**One command to rule them all:**
```bash
npx prisma db push && npm run db:generate && npm run dev
```

🎉 **Quiz verification ready to impress your committee!**
