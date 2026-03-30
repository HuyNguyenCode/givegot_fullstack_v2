# Admin CRUD Testing Guide

## Quick Start

1. **Access Admin Panel:**
   - Navigate to `http://localhost:3000/admin`
   - You must be logged in with an ADMIN role

2. **Test User Management:**
   - Go to `http://localhost:3000/admin/users`

3. **Test Skill Management:**
   - Go to `http://localhost:3000/admin/skills`

---

## User Management Testing

### Test 1: View and Filter Users
1. Navigate to `/admin/users`
2. Verify stats dashboard shows:
   - Total Users
   - Admin Count
   - Active Users
   - Suspended Count
3. Test search: Type a user's name or email
4. Test role filter: Select "Users Only" or "Admins Only"
5. Test status filter: Select "Active Only" or "Suspended Only"

### Test 2: Edit User
1. Click the **Edit** (pencil) icon on any user
2. Modal should open with current user data
3. Try changing:
   - Name
   - Role (USER ↔ ADMIN)
   - GivePoints balance
   - Suspension status (checkbox)
4. Click "Save Changes"
5. Verify success alert
6. Verify table updates immediately

### Test 3: Adjust Points
1. Click the **Coins** icon on any user
2. Modal should show current balance
3. Enter a positive number (e.g., +10)
4. Verify "New balance" preview updates
5. Click "Confirm"
6. Verify success alert with new balance
7. Verify table updates

### Test 4: Suspend/Activate User
1. Click the **Ban** icon on an active user
2. Confirm the suspension dialog
3. Verify success alert
4. Verify status badge changes to "Suspended"
5. **CRITICAL TEST:** Open an incognito window, log in as that user
6. Verify they are immediately redirected to sign-in with error
7. Click the **Ban** icon again to activate
8. Verify status badge changes to "Active"

### Test 5: Delete User (Safety Check)
1. Find a user with active bookings (status: PENDING or CONFIRMED)
2. Click the **Trash** icon
3. Confirm the deletion dialog
4. **Expected:** Error alert saying "Cannot delete user with X active booking(s)"
5. Find a user with NO active bookings
6. Click the **Trash** icon
7. Confirm the deletion dialog
8. **Expected:** Success alert, user removed from table

---

## Skill Management Testing

### Test 1: View and Filter Skills
1. Navigate to `/admin/skills`
2. Verify stats dashboard shows:
   - Total Skills
   - Pending Review
   - Approved
   - Rejected
3. Test search: Type a skill name
4. Test status filter: Select "Pending", "Approved", or "Rejected"
5. Test category filter: Select "Programming", "Design", etc.

### Test 2: Create Master Skill
1. Click the **"Create Master Skill"** button (green, top-right)
2. Modal should open
3. Enter a skill name (e.g., "Advanced TypeScript")
4. Select a category (e.g., "Programming")
5. Click "Create Skill"
6. **Expected:** Success alert
7. Verify new skill appears in table with status "APPROVED"

### Test 3: Edit Skill
1. Click the **Edit** (pencil) icon on any skill
2. Modal should open with current skill data
3. Try changing:
   - Skill name
   - Category
   - Approval status (PENDING/APPROVED/REJECTED)
4. Note the "Current Usage" count at the bottom
5. Click "Save Changes"
6. Verify success alert
7. Verify table updates immediately

### Test 4: Approve/Reject Pending Skills
1. Filter by status: "Pending"
2. Click the **CheckCircle** (green) icon to approve
3. Verify success alert
4. Verify skill moves to "Approved" status
5. Click the **XCircle** (red) icon to reject another skill
6. Confirm the rejection dialog
7. Verify skill moves to "Rejected" status

### Test 5: Delete Skill (Safety Check)
1. Find a skill with users (Users column > 0)
2. Click the **Trash** icon
3. Confirm the deletion dialog
4. **Expected:** Error alert saying "Cannot delete skill. X user(s) are currently teaching or learning this skill."
5. Find a skill with NO users (Users column = 0)
6. Click the **Trash** icon
7. Confirm the deletion dialog
8. **Expected:** Success alert, skill removed from table

---

## Security Testing

### Test 1: Suspended User Blocking
1. Suspend a user from `/admin/users`
2. Open an incognito window
3. Log in as that suspended user
4. Try to access any protected route (e.g., `/homepage`, `/discover`)
5. **Expected:** Immediately redirected to `/auth/signin?error=suspended`
6. Verify they cannot access any part of the app

### Test 2: Admin-Only Access
1. Log out from admin account
2. Log in with a regular USER account
3. Try to access `/admin`
4. **Expected:** Redirected to `/homepage` (non-admins blocked)
5. Try to access `/admin/users` directly
6. **Expected:** Redirected to `/homepage`

---

## Data Integrity Testing

### Test 1: User Deletion Cascade
1. Create a test user
2. Have them create some skills, bookings, reviews
3. Try to delete the user while they have active bookings
4. **Expected:** Blocked with error message
5. Cancel or complete all their bookings
6. Delete the user again
7. **Expected:** Success
8. Verify related records are handled (UserSkill, Reviews, etc.)

### Test 2: Skill Deletion Prevention
1. Create a test skill
2. Have a user add it to their profile (teaching or learning)
3. Try to delete the skill from admin panel
4. **Expected:** Blocked with error message showing user count
5. Remove the skill from all user profiles
6. Delete the skill again
7. **Expected:** Success

---

## UI/UX Testing

### Test 1: Responsive Design
1. Resize browser window to mobile size (< 768px)
2. Verify tables are scrollable horizontally
3. Verify modals are centered and readable
4. Verify filters stack vertically on mobile

### Test 2: Loading States
1. Click any action button (Edit, Delete, etc.)
2. Verify button shows "Saving..." or "Deleting..." text
3. Verify button is disabled during operation
4. Verify spinner appears on page load

### Test 3: User Feedback
1. Perform any action (edit, delete, suspend, etc.)
2. Verify success alert appears
3. Verify error alert appears for blocked actions
4. Verify confirmation dialogs for destructive actions

---

## Performance Testing

### Test 1: Large Dataset
1. If you have 100+ users, test filtering and search
2. Verify table renders quickly
3. Verify search is responsive (no lag)

### Test 2: Concurrent Actions
1. Open two browser tabs with admin panel
2. Edit a user in tab 1
3. Edit the same user in tab 2
4. Verify both updates work (last write wins)

---

## Edge Cases

### Test 1: Empty States
1. Filter skills by a category with no skills
2. **Expected:** "No Skills Found" message with icon
3. Search for a non-existent user
4. **Expected:** "Showing 0 of X users"

### Test 2: Duplicate Skill Names
1. Try to create a master skill with a name that already exists
2. **Expected:** Error alert "A skill with this name already exists"

### Test 3: Invalid Points Adjustment
1. Open points adjustment modal
2. Leave amount at 0
3. Click "Confirm"
4. **Expected:** Button is disabled (cannot adjust by 0)

---

## Regression Testing

After any code changes, re-run these critical tests:

1. [ ] Suspended users are blocked by middleware
2. [ ] User deletion is blocked if active bookings exist
3. [ ] Skill deletion is blocked if users are using it
4. [ ] Admin-only routes are protected
5. [ ] All CRUD operations work (Create, Read, Update, Delete)
6. [ ] Filters and search work correctly
7. [ ] Modals open and close properly
8. [ ] Success/error alerts appear
9. [ ] Table updates immediately after actions
10. [ ] Build succeeds (`npm run build`)

---

## Known Issues / Limitations

1. **Middleware Deprecation Warning:**
   - Next.js 16 shows a warning about middleware → proxy convention
   - This is a framework warning, not a bug
   - Functionality works correctly

2. **Prisma Client Locking:**
   - On Windows, `npx prisma generate` may fail if dev server is running
   - Solution: Stop dev server, regenerate, restart dev server

3. **Bulk Actions:**
   - Not yet implemented (future enhancement)
   - Currently, actions are performed one at a time

---

## Success Criteria

All tests pass if:
- ✅ All CRUD operations work without errors
- ✅ Data integrity checks prevent orphan records
- ✅ Suspended users are blocked from accessing the app
- ✅ Admin-only routes are protected
- ✅ UI is responsive and provides clear feedback
- ✅ Build succeeds without TypeScript errors
- ✅ No console errors in browser

---

## Troubleshooting

### "Unknown field `isSuspended`" Error:
**Solution:** Regenerate Prisma client
```bash
npx prisma generate
```

### "Cannot delete user" Error:
**Cause:** User has active bookings
**Solution:** Cancel or complete bookings first, or this is expected behavior

### "Cannot delete skill" Error:
**Cause:** Users are teaching/learning the skill
**Solution:** Remove skill from user profiles first, or this is expected behavior

### Modal Not Opening:
**Cause:** JavaScript error or state issue
**Solution:** Check browser console for errors, refresh page

### Suspended User Still Accessing App:
**Cause:** Session not invalidated
**Solution:** User needs to log out and log back in, or middleware will catch them on next route change

---

## Next Steps After Testing

1. **Document any bugs found**
2. **Create GitHub issues for enhancements**
3. **Update user documentation**
4. **Train other admins on the new features**
5. **Monitor production logs for errors**

---

## Contact

If you encounter any issues during testing, please report them with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Browser and OS version
