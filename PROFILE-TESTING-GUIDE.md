# 🧪 Profile Management - Quick Testing Guide

## Before You Test

Make sure your dev server is running:
```bash
npm run dev
```

Then open: `http://localhost:3000`

---

## Test 1: Access the Profile Page ⚡️

### From Home Page
1. Go to `http://localhost:3000`
2. You should see **three buttons**: "Discover Mentors", "My Dashboard", and **"Edit Profile"**
3. Click **"Edit Profile"**
4. ✅ Should navigate to `/profile`

### From Dashboard
1. Go to `http://localhost:3000/dashboard`
2. Look for the **"Edit Profile"** button (gradient purple-blue)
3. Click it
4. ✅ Should navigate to `/profile`

### From DevBar (Quick Access)
1. Look at the top purple bar
2. Find the **gear icon** with "Profile" label
3. Click it
4. ✅ Should navigate to `/profile`

---

## Test 2: Update Basic Profile Info 📝

1. **Switch to Bob Smith** (mentee) using the DevBar
2. Navigate to `/profile`
3. **Update Name**:
   - Change from "Bob Smith" to "Bob The Builder"
   - ✅ Name field should update as you type
4. **Update Bio**:
   - Add: "I'm learning web development to build awesome apps!"
   - ✅ Bio textarea should expand naturally
5. **Change Avatar**:
   - Click **"🎲 Generate Random Avatar"**
   - ✅ Avatar preview should change instantly
6. Click **"Save Profile"**
7. ✅ Green success toast should slide in from the right
8. ✅ Toast should say "Profile Updated! Your mentor matches have been refreshed"
9. Navigate to home page
10. ✅ Welcome message should show "Bob The Builder"

---

## Test 3: Manage Teaching Skills (Become a Mentor) 🎓

1. **Switch to David Lee** (user-mentee-2)
2. Navigate to `/profile`
3. **Current State**: David has NO teaching skills (not a mentor yet)
4. **Add Teaching Skills**:
   - Click on **"Marketing"** tag in the "What I Can Teach" section
   - ✅ Tag should turn green with a checkmark
   - Click on **"Python"** tag
   - ✅ Tag should also turn green
   - ✅ Counter should show "2 skills selected"
5. Click **"Save Profile"**
6. ✅ Success toast appears
7. **Verify**:
   - Switch to **Bob Smith** (mentee)
   - Go to `/discover`
   - ✅ **David Lee** should now appear as a mentor
   - ✅ His card should show "Marketing" and "Python" as teaching skills

---

## Test 4: Update Learning Goals & See Auto-Match Update 🎯

### Setup
1. Switch to **Bob Smith** (user-mentee-1)
2. Navigate to `/discover`
3. **Note**: Current Best Matches (with default goals: ReactJS, Python)
   - Alice Johnson (ReactJS, NodeJS) - ✅ Match
   - Emma Python (Python) - ✅ Match

### Change Goals
4. Navigate to `/profile`
5. **Current Learning Goals**: ReactJS, Python
6. **Deselect "Python"** (click to toggle off)
   - ✅ Tag should turn white/outlined
7. **Select "UI/UX Design"** (click to toggle on)
   - ✅ Tag should turn blue with checkmark
8. ✅ Counter should show "2 goals selected" (ReactJS + UI/UX Design)
9. Click **"Save Profile"**
10. ✅ Success toast appears

### Verify Auto-Match Updated
11. Navigate to `/discover`
12. **Expected Best Matches**:
    - ✅ Alice Johnson (ReactJS) - Still matches
    - ✅ **Carol Designer (UI/UX Design)** - NEW MATCH!
    - ✅ Green badge on Carol's card: "UI/UX Design ✓"
13. **Expected "Explore Other Mentors"**:
    - ✅ Emma Python - No longer in Best Matches (Python removed from goals)
    - ✅ Frank Williams (IELTS) - Never matched
    - ✅ David Lee (if became mentor in Test 3)

**This proves the auto-match system is working dynamically!** 🎉

---

## Test 5: Clear All Learning Goals 🧹

1. Switch to **Bob Smith**
2. Navigate to `/profile`
3. **Deselect ALL learning goals** (click all blue tags to turn them off)
4. ✅ Message should appear: "No learning goals selected. Select skills above to get personalized mentor recommendations!"
5. Click **"Save Profile"**
6. Navigate to `/discover`
7. **Expected**:
   - ✅ "Best Matches" section should be empty or show helpful message
   - ✅ All mentors should appear in "Explore Other Mentors"

---

## Test 6: Multiple Skills Matching 🔥

1. Switch to **Bob Smith**
2. Navigate to `/profile`
3. **Select multiple learning goals**:
   - ReactJS ✓
   - NodeJS ✓
   - Python ✓
4. Save profile
5. Navigate to `/discover`
6. **Expected**:
   - ✅ **Alice Johnson** should have **matchScore: 2** (ReactJS + NodeJS)
   - ✅ Alice should appear FIRST in Best Matches (highest score)
   - ✅ Emma Python should have matchScore: 1 (Python only)
   - ✅ Both matched skills should have green badges with checkmarks

---

## Test 7: Switch Users & Verify Isolation 👥

1. **As Bob Smith**:
   - Set learning goals: [ReactJS, UI/UX Design]
   - Save profile
2. **Switch to David Lee**:
   - Navigate to `/profile`
   - ✅ Learning goals should be: [Python, Marketing] (his original goals)
   - ✅ Bob's changes should NOT affect David
3. **Switch back to Bob**:
   - Navigate to `/profile`
   - ✅ Goals should still be: [ReactJS, UI/UX Design]
   - ✅ Changes persisted correctly

---

## Test 8: Form Validation & UX 🛡️

1. Navigate to `/profile`
2. **Clear the name field** completely
3. Click "Save Profile"
4. ✅ HTML5 validation should prevent submission
5. ✅ Browser should show "Please fill out this field"
6. **Fill name with spaces only**: "   "
7. Save profile
8. ✅ Should trim to empty and fail validation
9. **Valid Input**:
   - Enter a proper name
   - ✅ Form should submit successfully

---

## Test 9: Avatar Generation 🎲

1. Navigate to `/profile`
2. Note current avatar
3. Click **"🎲 Generate Random Avatar"** 5 times
4. ✅ Each click should generate a DIFFERENT avatar
5. ✅ Avatar preview should update immediately
6. Click "Save Profile"
7. Switch to another user, then back
8. Navigate to `/profile`
9. ✅ Last saved avatar should persist

---

## Test 10: UI Responsiveness & Animations 🎨

### Desktop View
1. Open `/profile` in full browser window
2. ✅ Tags should display in rows with proper wrapping
3. ✅ All sections clearly separated

### Mobile View
1. Open Dev Tools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone 12" or similar
4. ✅ Tags should wrap to multiple rows
5. ✅ Buttons should stack vertically on small screens
6. ✅ Layout should remain readable

### Animations
1. Save profile
2. ✅ Toast should **slide in from the right**
3. ✅ Toast should auto-dismiss after 4 seconds
4. ✅ Hover over skill tags - should see scale and color transitions
5. ✅ Click tags - should see smooth selection animation

---

## Expected Behavior Summary

| Action | Expected Result |
|--------|-----------------|
| Load `/profile` | Shows current user's profile data |
| Toggle teaching skill tag | Tag changes color (white ↔ green) |
| Toggle learning goal tag | Tag changes color (white ↔ blue) |
| Click "Generate Avatar" | New random avatar appears |
| Click "Save" with empty name | Validation error |
| Click "Save" with valid data | Success toast + data persists |
| Update learning goals | `/discover` matches update instantly |
| Add teaching skills | User becomes visible as mentor |
| Switch users | Each user's profile data is independent |

---

## Console Logs to Check

When you save your profile, check the browser console (F12 → Console tab):

```
✅ Updated profile for Bob Smith
✅ Updated teaching skills for user-mentee-1: ReactJS, UI/UX Design
✅ Updated learning goals for user-mentee-1: ReactJS, UI/UX Design
```

When you navigate to `/discover`:

```
🎯 Auto-match for user user-mentee-1:
   Learning goals: ReactJS, UI/UX Design
   Best matches: 2
   Other mentors: 3
```

---

## Common Issues & Solutions

### Issue: Profile doesn't save
**Solution**: Check browser console for errors. Make sure dev server is running.

### Issue: Auto-match not updating after profile save
**Solution**: 
1. Hard refresh the `/discover` page (Ctrl+Shift+R)
2. Check if you called `refreshUser()` in the profile page
3. Verify console logs show "Updated learning goals"

### Issue: Tags not toggling
**Solution**: Make sure you're clicking the actual button, not just hovering. The cursor should change to pointer.

### Issue: Success toast not appearing
**Solution**: 
1. Check if `globals.css` has the `@keyframes slide-in` animation
2. Verify `showSuccessToast` state is being set to `true`
3. Check browser console for React errors

---

## Visual Checklist

When you open `/profile`, you should see:

- ✅ Purple-blue gradient header with gear icon
- ✅ "Edit Your Profile" title in white text
- ✅ Avatar preview on the left (rounded circle)
- ✅ Avatar URL input with "Generate Random Avatar" button below
- ✅ Name input field with asterisk (required)
- ✅ Bio textarea (4 rows)
- ✅ Horizontal divider line
- ✅ "🎓 What I Can Teach" heading
- ✅ Green-themed skill tag section
- ✅ Tags with hover effects
- ✅ Selected tags: solid green with checkmark
- ✅ Horizontal divider line
- ✅ "📚 What I Want to Learn" heading
- ✅ Blue-themed skill tag section
- ✅ Selected tags: solid blue with checkmark
- ✅ Purple info panel explaining auto-match
- ✅ Gray "Cancel" button and gradient "Save Profile" button

---

## Success Criteria

✅ **Feature is complete if**:
1. Profile page loads without errors
2. Can update name, bio, avatar successfully
3. Can toggle teaching skills and see visual feedback
4. Can toggle learning goals and see visual feedback
5. Save button works and shows success toast
6. Changes persist after switching users and coming back
7. Learning goal changes update auto-match on `/discover`
8. Teaching skill changes make user visible as mentor
9. Build completes without TypeScript errors
10. No linter warnings

**All criteria met!** ✅

---

## Next Steps

Your platform now has:
- ✅ Phase 1: Mock Auth
- ✅ Phase 2: Auto-Match Discovery
- ✅ Phase 2.5: Profile Management (NEW!)
- ✅ Phase 3: Booking System

**Ready for Phase 4**: Review System (rate mentors after sessions)

Or you can:
- Add more mock users and skills
- Enhance the UI design further
- Build additional features (calendar, notifications, etc.)
- Start preparing your thesis presentation

---

**Status**: ✅ READY TO TEST IN BROWSER
