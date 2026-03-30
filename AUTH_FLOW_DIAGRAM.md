# Authentication Flow Diagram

## 🔐 Updated Authentication & Redirect Flow

### Visual Flow Chart

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER VISITS SITE                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Is User Logged In?  │
                    └───────────────────────┘
                         │              │
                    NO   │              │   YES
                         │              │
         ┌───────────────┘              └───────────────┐
         ▼                                               ▼
┌──────────────────┐                          ┌──────────────────┐
│  Visits Route: / │                          │  Visits Route: / │
└──────────────────┘                          └──────────────────┘
         │                                               │
         ▼                                               ▼
┌──────────────────┐                          ┌──────────────────┐
│  Show Landing    │                          │   REDIRECT TO    │
│  Page (Public)   │                          │    /homepage     │
└──────────────────┘                          └──────────────────┘
         │                                               │
         ▼                                               ▼
┌──────────────────┐                          ┌──────────────────┐
│ Click "Sign In"  │                          │  Welcome Screen  │
└──────────────────┘                          │  (Your Balance,  │
         │                                    │   Your Profile)  │
         ▼                                    └──────────────────┘
┌──────────────────┐
│  /auth/signin    │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Choose Method:  │
│  • Google OAuth  │
│  • Email/Pass    │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│  Authenticate    │
└──────────────────┘
         │
         ▼
┌──────────────────┐
│   REDIRECT TO    │
│    /homepage     │◄─────────────────────────┐
└──────────────────┘                          │
         │                                    │
         ▼                                    │
┌──────────────────┐                          │
│  Welcome Screen  │                          │
│  (Your Balance,  │                          │
│   Your Profile)  │                          │
└──────────────────┘                          │
         │                                    │
         ▼                                    │
┌──────────────────┐                          │
│  User can now    │                          │
│  navigate to:    │                          │
│  • Dashboard     │                          │
│  • Discover      │                          │
│  • Profile       │                          │
│  • History       │                          │
└──────────────────┘                          │
         │                                    │
         └────────────────────────────────────┘
              (Click logo to return)
```

## 🔄 Specific Scenarios

### Scenario A: New User First Visit
```
1. User → https://givegot.com/
   Status: Not authenticated
   Result: ✅ Show landing page

2. User → Click "Sign In"
   Result: ✅ Navigate to /auth/signin

3. User → Sign in with Google
   Result: ✅ Redirect to /homepage (default)

4. User → Click logo
   Result: ✅ Stay on /homepage (already there)
```

### Scenario B: Returning User Direct Visit
```
1. User → https://givegot.com/
   Status: Already authenticated
   Result: ↪️ Auto-redirect to /homepage

2. User → See welcome dashboard immediately
   Result: ✅ No need to sign in again
```

### Scenario C: Deep Link Access (Protected Route)
```
1. User → https://givegot.com/profile
   Status: Not authenticated
   Result: ↪️ Redirect to /auth/signin?callbackUrl=/profile

2. User → Sign in with Email
   Result: ✅ Redirect to /profile (original destination)

3. User → Complete profile edits
   Result: ✅ Can access protected route
```

### Scenario D: Sign Out Flow
```
1. User → Click "Sign Out"
   Result: ✅ Clear session

2. System → Redirect to /auth/signin
   Result: ✅ Show sign-in page

3. User → Navigate to /
   Result: ✅ Show landing page (now unauthenticated)
```

## 🎯 Key Decision Points

### Middleware Decision Tree

```
Request comes in
    │
    ├─ Is Dev Mode?
    │   └─ YES → Allow all routes ✅
    │
    ├─ Is /auth/signin or /api/auth/*?
    │   └─ YES → Allow access ✅
    │
    ├─ Is / AND user authenticated?
    │   └─ YES → Redirect to /homepage ↪️
    │
    ├─ Is /?
    │   └─ YES → Allow access (public landing) ✅
    │
    ├─ User authenticated?
    │   ├─ YES → Allow access ✅
    │   └─ NO → Redirect to /auth/signin?callbackUrl=<current-route> ↪️
```

## 📍 Route Protection Summary

| Route | Public Access | Auth Required | Redirect Behavior |
|-------|--------------|---------------|-------------------|
| `/` | ✅ Yes (landing) | ❌ No | Auth users → `/homepage` |
| `/homepage` | ❌ No | ✅ Yes | Unauth users → `/auth/signin` |
| `/dashboard` | ❌ No | ✅ Yes | Unauth users → `/auth/signin` |
| `/discover` | ❌ No | ✅ Yes | Unauth users → `/auth/signin` |
| `/profile` | ❌ No | ✅ Yes | Unauth users → `/auth/signin` |
| `/history` | ❌ No | ✅ Yes | Unauth users → `/auth/signin` |
| `/auth/signin` | ✅ Yes | ❌ No | After login → `/homepage` |

## 🔑 Key Changes Summary

### Before Update:
- Default redirect after login: `/dashboard`
- Authenticated users visiting `/`: See landing page
- Unprotected route callback: `/`

### After Update:
- Default redirect after login: `/homepage` ⭐
- Authenticated users visiting `/`: Auto-redirect to `/homepage` ⭐
- Unprotected route callback: `/homepage` ⭐

## 🎨 User Experience Improvements

1. **Clearer Navigation**: Authenticated users always land on their welcome dashboard
2. **Better Onboarding**: New users see landing page → sign in → welcome dashboard
3. **Consistent Experience**: Logo always takes authenticated users to welcome screen
4. **Logical Flow**: Public landing for visitors, personalized homepage for users
5. **Faster Access**: Returning users skip landing page and go straight to their dashboard

## 🔒 Security Considerations

- ✅ All protected routes still require authentication
- ✅ Public landing page remains accessible to everyone
- ✅ Middleware properly validates authentication state
- ✅ Callback URLs prevent unauthorized access
- ✅ No security vulnerabilities introduced
