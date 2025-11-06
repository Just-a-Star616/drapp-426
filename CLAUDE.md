# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a white-label, mobile-first driver recruitment application built with React, TypeScript, Vite, and Firebase. It allows applicants to submit driver applications, upload documents, track application status, and includes authentication with password reset flows. The app includes an admin dashboard for managing applications and sending notifications.

## Development Commands

**Frontend:**
```bash
npm run dev      # Start development server on http://0.0.0.0:3000
npm run build    # Build for production
npm run preview  # Preview production build
```

**Firebase Functions:**
```bash
cd functions
npm run serve    # Start Firebase emulators (functions only)
npm run shell    # Interactive functions shell
npm run deploy   # Deploy functions to Firebase
npm run logs     # View function logs
```

**Firebase Deployment:**
```bash
firebase deploy --only hosting  # Deploy hosting only
firebase deploy --only functions  # Deploy functions only
firebase deploy  # Deploy everything
```

## Architecture

### Authentication Flow
- Uses Firebase Auth with a hybrid approach:
  - **Anonymous authentication** for partial application saving (users can start applications without logging in)
  - **Email/password authentication** created when application is submitted
  - Anonymous accounts are linked to email/password credentials upon submission using `linkWithCredential`
- Authentication state managed in `App.tsx` via `onAuthStateChanged`
- `isAuthenticated` = logged in AND not anonymous

### Application State Management
- **Real-time sync**: Application data stored in Firestore (`applications` collection, keyed by user UID)
- **Auto-save**: Partial applications auto-saved every 1.5s while user types (debounced in `src/pages/Apply.tsx:111-118`)
- **Context**: Global state via `AppContext` defined in `src/contexts/AppContext.tsx`
  - Provides: `branding`, `statusSteps`, `application`, `isAuthenticated`, `currentUser`
  - Computed in `src/App.tsx:136-148` using `useMemo`
- **Firestore listeners**: Real-time updates using `onSnapshot` in `src/App.tsx`
  - Branding loaded via `getDocFromServer` (bypasses cache) on mount (line 29-54)
  - Application synced in real-time per user (line 92-117)

### White-Label Configuration
- Branding and status steps stored in Firestore `configs` collection (default document: `defaultConfig`)
- Configuration loaded via `getDocFromServer` (bypasses cache) in `src/App.tsx:29-54`
- Admin dashboard (`src/pages/AdminDashboard.tsx`) allows updating branding in real-time
- Branding cache issue: Uses server fetch to ensure latest branding is always loaded

### Document Upload Flow
1. Files selected via `FileUpload` component
2. Uploaded to Firebase Storage in `src/pages/Apply.tsx` submission handler
3. Download URLs stored in Firestore application document under `documents` field
4. File naming pattern: `{timestamp}-{originalName}`

### Routing
- Uses `HashRouter` for compatibility with static hosting
- Route protection logic in `src/App.tsx:166-179`:
  - Unauthenticated users redirected to `/home` or `/login`
  - Authenticated users redirected to `/status` when accessing public routes
  - Admin routes protected by `isAdmin` state (checks `admins` collection)
- Routes:
  - Public: `/home`, `/apply`, `/login`, `/forgot-password`, `/reset-password`
  - Protected: `/confirmation`, `/status`
  - Admin: `/admin/login`, `/admin/dashboard`

### Data Model
Key types in `src/types.ts`:
- `Application`: Contains all applicant data, documents, status, and partial flag
- `ApplicationStatus`: Enum for tracking stages (Submitted, Under Review, Contacted, Meeting Scheduled, Approved, Rejected)
- `BrandingConfig`: White-label configuration (company name, logo, primary color)

### Firebase Cloud Functions
Located in `functions/index.js`:

**notifyNewApplication**: Firestore trigger that sends Google Chat notifications when new applications are submitted
- Only triggers for newly completed (non-partial) applications
- Requires `googlechat.webhook` environment config
- Configure via: `firebase functions:config:set googlechat.webhook="https://..."`

**sendPushNotification**: Firestore trigger that sends FCM push notifications when application status changes
- Looks up FCM tokens in `fcmTokens` collection
- Includes branding from `configs/defaultConfig`
- Runs automatically on status updates

**sendCustomNotification**: HTTP function for sending custom notifications to applicants
- Endpoint for admin dashboard to send immediate or scheduled notifications
- Supports multiple recipients
- Body: `{ recipients: string[], title: string, message: string, sendNow: boolean, scheduledFor?: number }`

**processScheduledNotifications**: Scheduled function (runs every minute) to send scheduled notifications
- Processes notifications stored in `scheduledNotifications` collection

### Service Worker
- Implementation in `service-worker.js` at project root
- Currently disabled in `src/App.tsx:119-131` (commented out)
- Enables push notifications for PWA capabilities
- Uses dynamic branding from push notification payload
- When re-enabled, ensure push notifications include branding data from Firestore config

### Project Structure
- **Source directory**: All application code is in `src/` directory
- **Path alias**: `@` resolves to `src/` directory (configured in `vite.config.ts`)
- **Subdirectories**: `src/pages/`, `src/components/`, `src/hooks/`, `src/services/`, `src/contexts/`
- **Entry point**: `src/index.tsx` referenced from `index.html`

## Important Files

**Configuration:**
- `src/services/firebase.ts`: Firebase initialization and exports
- `vite.config.ts`: Vite configuration with path alias (`@` -> `src/`) and GEMINI_API_KEY
- `.env.local`: Environment variables (GEMINI_API_KEY for Gemini API integration)
- `firebase.json`: Firebase project configuration (hosting, functions, firestore, storage)
- `functions/package.json`: Cloud Functions dependencies (Node 20)

**Utility Scripts:**
- `check-config.js` / `check-config.cjs`: Configuration validation scripts
- `functions/check-config.js`: Validates Firebase Functions configuration
- `functions/update-config.js`: Updates Firebase Functions configuration

## Firebase Setup Requirements

**Project Configuration:**
Update `src/services/firebase.ts` with Firebase project credentials before deployment.

**Firestore Collections:**
- `configs`: Document `defaultConfig` with structure:
  ```typescript
  {
    branding: { companyName: string, logoUrl: string, primaryColor: string, tagline?: string },
    statusSteps: [{ status: ApplicationStatus, title: string, description: string }]
  }
  ```
- `applications`: Auto-created when users submit applications (keyed by user UID)
- `admins`: Documents keyed by admin UID for admin access control
- `fcmTokens`: Stores FCM tokens for push notifications (keyed by user UID)
- `scheduledNotifications`: Stores scheduled notifications for later delivery

**Firebase Functions Config:**
```bash
firebase functions:config:set googlechat.webhook="https://chat.googleapis.com/v1/spaces/..."
```

**Security Rules:**
- `firestore.rules`: Database security rules
- `storage.rules`: Storage bucket rules for document uploads

## Key Implementation Details

**Password Validation:**
- Custom hook `usePasswordValidation` checks strength requirements
- Visual feedback via `PasswordStrength` component
- Validation enforced before submission in `Apply.tsx`

**Form State Persistence:**
- Partial applications saved with `isPartial: true` flag in `src/pages/Apply.tsx:89-109`
- Passwords never saved in partial applications (deleted from partialData object)
- Existing partial data pre-fills form on mount (`src/pages/Apply.tsx:78-87`)
- Auto-save triggers 1.5s after user stops typing (debounced)

**File Upload Pattern:**
- Files stored temporarily in component state
- Uploaded to Firebase Storage only on form submission
- Upload path: `documents/{userId}/{timestamp}-{fileName}`
- Download URLs stored in application document's `documents` field

**Admin Features:**
- Admin dashboard at `/admin/dashboard` for managing applications
- Change application status, view applicant details, and upload documents
- Send custom notifications to one or multiple applicants
- Schedule notifications for later delivery
