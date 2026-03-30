# Admin Module - Quick Setup Guide

## 🚀 Getting Started

### Step 1: Database is Already Updated
✅ Schema changes have been pushed to your database
✅ All existing data is preserved
✅ Existing skills are automatically APPROVED

### Step 2: Create Your First Admin User

You need to manually promote a user to ADMIN role. Choose one of these methods:

#### Method A: Using Database Client (Recommended)

If you're using Supabase, Prisma Studio, or any PostgreSQL client:

```sql
-- Replace with your actual email
UPDATE "User" 
SET role = 'ADMIN' 
WHERE email = 'your-email@example.com';
```

#### Method B: Using Prisma Studio

```bash
npx prisma studio
```

1. Open the `User` table
2. Find your user record
3. Change `role` from `USER` to `ADMIN`
4. Save changes

#### Method C: Using Supabase Dashboard

1. Go to your Supabase project
2. Navigate to Table Editor
3. Select `User` table
4. Find your user row
5. Edit the `role` column to `ADMIN`
6. Save

### Step 3: Access Admin Panel

1. Sign in to your account (the one you just promoted)
2. Navigate to `/admin` in your browser
3. You should see the Admin Dashboard!

If you see a redirect to `/homepage`, your role wasn't updated correctly.

---

## 🔐 Admin Panel Overview

### Dashboard (`/admin`)
- View platform statistics
- Quick access to all admin features
- System status monitoring

### User Management (`/admin/users`)
- View all registered users
- Change user roles (USER ↔ ADMIN)
- Adjust GivePoints balance
- Monitor user activity

### Report Management (`/admin/reports`)
- Review user-submitted reports
- Mark reports as resolved
- Track reporter and reported user info

### Skill Approval (`/admin/skills`)
- Review pending skills
- Approve or reject skills
- Manage skill visibility in search

---

## 🛡️ Security Features

### Access Control
- ✅ Only users with `role = 'ADMIN'` can access `/admin/*`
- ✅ Non-admin users are redirected to `/homepage`
- ✅ Unauthenticated users are redirected to sign-in

### Data Protection
- ✅ All admin actions use server-side validation
- ✅ Confirmation dialogs for destructive actions
- ✅ Audit trails for point adjustments
- ✅ Type-safe database operations

---

## 📊 How It Works

### Skill Approval Shadow

**Default Behavior:**
- All existing skills are automatically `APPROVED`
- Users can see and search for approved skills
- New skills can be set to `PENDING` for review

**Admin Workflow:**
1. Admin reviews pending skills in `/admin/skills`
2. Admin clicks "Approve" or "Reject"
3. Only APPROVED skills appear in:
   - Discover page search
   - Semantic AI matching
   - Mentor profiles
   - User skill lists

**User Impact:**
- ✅ ZERO changes to existing functionality
- ✅ All current skills remain visible
- ✅ Search works exactly as before

### User Role Management

**Promoting to Admin:**
- Change user role to `ADMIN` in User Management
- User immediately gains admin access
- Can access `/admin/*` routes

**Demoting from Admin:**
- Change role back to `USER`
- User loses admin access
- Redirected to `/homepage` if accessing admin routes

### Points Adjustment

**Use Cases:**
- Compensate for bugs or errors
- Reward community contributions
- Resolve disputes
- Test functionality

**Process:**
1. Go to User Management
2. Click "Adjust Points" for a user
3. Enter positive (add) or negative (subtract) amount
4. Confirm adjustment
5. Transaction log is created automatically

---

## 🧪 Testing Your Admin Panel

### Test Checklist:

#### 1. Access Control
- [ ] Try accessing `/admin` as non-admin (should redirect)
- [ ] Sign in as admin and access `/admin` (should work)
- [ ] Sign out and try `/admin` (should redirect to sign-in)

#### 2. Dashboard
- [ ] Statistics display correctly
- [ ] Quick action links work
- [ ] Navigation sidebar functions

#### 3. User Management
- [ ] Users table loads
- [ ] Change a user's role
- [ ] Adjust points (try +5 and -2)
- [ ] Verify transaction log created

#### 4. Report Management
- [ ] Create a test report (you'll need to add this feature to user UI)
- [ ] View report in admin panel
- [ ] Mark as resolved
- [ ] Verify status changes

#### 5. Skill Approval
- [ ] View all skills
- [ ] Filter by status (Pending, Approved, Rejected)
- [ ] Approve a skill
- [ ] Reject a skill
- [ ] Verify search only shows approved skills

#### 6. Regression Testing
- [ ] Homepage works normally
- [ ] Dashboard functions as before
- [ ] Discover page search works
- [ ] Profile page unchanged
- [ ] Booking system works
- [ ] All user features intact

---

## 🐛 Troubleshooting

### "I can't access /admin"

**Solution:**
1. Verify you're signed in
2. Check your user role in database:
   ```sql
   SELECT email, role FROM "User" WHERE email = 'your-email@example.com';
   ```
3. If role is `USER`, update it to `ADMIN`
4. Sign out and sign back in
5. Try accessing `/admin` again

### "No skills showing in discover page"

**Solution:**
1. Go to `/admin/skills`
2. Check if skills are PENDING or REJECTED
3. Approve the skills you want visible
4. Refresh discover page

### "Points adjustment not working"

**Solution:**
1. Check browser console for errors
2. Verify you have admin role
3. Try with a different user
4. Check database connection

### "Build errors"

**Solution:**
1. Run `npm install` to ensure all dependencies
2. Run `npx prisma generate` to regenerate Prisma client
3. Clear `.next` folder: `rm -rf .next`
4. Rebuild: `npm run build`

---

## 📝 Common Admin Tasks

### Promote a User to Admin
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'user@example.com';
```

### Demote an Admin to User
```sql
UPDATE "User" SET role = 'USER' WHERE email = 'admin@example.com';
```

### Approve All Pending Skills
```sql
UPDATE "Skill" SET status = 'APPROVED' WHERE status = 'PENDING';
```

### View All Admins
```sql
SELECT email, name, role FROM "User" WHERE role = 'ADMIN';
```

### Check Pending Reports
```sql
SELECT * FROM "Report" WHERE status = 'PENDING';
```

---

## 🎯 Best Practices

### Admin Account Security
- ✅ Use strong passwords for admin accounts
- ✅ Limit number of admin users
- ✅ Regularly review admin access
- ✅ Monitor admin actions via logs

### Skill Approval
- ✅ Review skills for appropriateness
- ✅ Check for duplicates before approving
- ✅ Reject spam or inappropriate skills
- ✅ Approve legitimate skills promptly

### User Management
- ✅ Only adjust points when necessary
- ✅ Document reason for adjustments
- ✅ Be cautious with role changes
- ✅ Monitor reported users

### Report Handling
- ✅ Review reports promptly
- ✅ Investigate before taking action
- ✅ Communicate with involved parties
- ✅ Document resolution steps

---

## 🔄 Maintenance

### Regular Tasks
- Review pending skills weekly
- Check pending reports daily
- Monitor user activity
- Review admin access monthly

### Database Backups
- Backup before major changes
- Test restore procedures
- Keep backups secure
- Document backup schedule

---

## 📞 Support

### Need Help?
1. Check this guide first
2. Review `ADMIN_MODULE_IMPLEMENTATION.md` for technical details
3. Check browser console for errors
4. Verify database connection
5. Review Prisma logs

### Reporting Issues
Include:
- Error messages
- Steps to reproduce
- Expected vs actual behavior
- Browser and environment info
- Screenshots if applicable

---

## ✅ Success!

Your admin module is now fully operational. You can:
- ✅ Manage users and roles
- ✅ Review and resolve reports
- ✅ Approve/reject skills
- ✅ Monitor platform statistics
- ✅ Adjust user points
- ✅ Maintain platform quality

All while ensuring ZERO impact on existing user features!

Happy administrating! 🎉
