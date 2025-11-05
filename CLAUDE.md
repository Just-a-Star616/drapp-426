# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a white-label, mobile-first driver recruitment application built with React, TypeScript, Vite, and Firebase. It allows applicants to submit driver applications, upload documents, track application status, and includes authentication with password reset flows.

## Development Commands

**Start development server:**
```bash
npm run dev
```
Runs on `http://0.0.0.0:3000` (accessible on local network)

**Build for production:**
```bash
npm run build
```

**Preview production build:**
```bash
npm run preview
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
- **Auto-save**: Partial applications auto-saved every 1.5s while user types (see `Apply.tsx:82-89`)
- **Context**: Global state via `AppContext` (branding, statusSteps, application, currentUser)
- **Firestore listeners**: Real-time updates using `onSnapshot` for both config and application documents

### White-Label Configuration
- Branding and status steps stored in Firestore `configs` collection (default document: `defaultConfig`)
- Config structure:
  ```typescript
  {
    branding: { companyName, logoUrl, primaryColor },
    statusSteps: [{ status, title, description }]
  }
  ```
- Configuration loaded via real-time listener in `App.tsx:29-42`

### Document Upload Flow
1. Files selected via `FileUpload` component
2. Uploaded to Firebase Storage in `Apply.tsx` submission handler
3. Download URLs stored in Firestore application document under `documents` field
4. File naming pattern: `{timestamp}-{originalName}`

### Routing
- Uses `HashRouter` for compatibility with static hosting
- Route protection:
  - Unauthenticated users redirected to `/home` or `/login`
  - Authenticated users redirected to `/status` when accessing public routes
- Routes: `/home`, `/apply`, `/login`, `/forgot-password`, `/reset-password`, `/confirmation`, `/status`

### Data Model
Key types in `types.ts`:
- `Application`: Contains all applicant data, documents, status, and partial flag
- `ApplicationStatus`: Enum for tracking stages (Submitted, Under Review, Contacted, Meeting Scheduled, Approved, Rejected)
- `BrandingConfig`: White-label configuration (company name, logo, primary color)

### Service Worker
- Registered in `App.tsx:80-90` for PWA capabilities
- Implementation in `service-worker.js` at project root
- Enables push notifications (via `NotificationBell` component)

## Important Files

**Configuration:**
- `services/firebase.ts`: Firebase initialization (requires real config values before deployment)
- `vite.config.ts`: Vite configuration with GEMINI_API_KEY environment variable loading
- `.env.local`: Environment variables (GEMINI_API_KEY)

**Deprecated files** (marked for deletion):
- `constants.ts`: Status steps now in Firestore
- `services/googleApiService.ts`: Backend logic should move to Cloud Functions

## Firebase Setup Requirements

Before deployment, update `services/firebase.ts` with actual Firebase project credentials:
```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Firestore collections required:
- `configs`: Document `defaultConfig` with branding and statusSteps
- `applications`: Auto-created when users submit applications (keyed by user UID)

## Key Implementation Details

**Password Validation:**
- Custom hook `usePasswordValidation` checks strength requirements
- Visual feedback via `PasswordStrength` component
- Validation enforced before submission in `Apply.tsx`

**Form State Persistence:**
- Partial applications saved with `isPartial: true` flag
- Passwords never saved in partial applications (`Apply.tsx:71-73`)
- Existing partial data pre-fills form on mount (`Apply.tsx:50-58`)

**File Upload Pattern:**
- Files stored temporarily in component state
- Uploaded to Firebase Storage only on form submission
- Upload path: `documents/{userId}/{timestamp}-{fileName}`

**Error Handling:**
- Form validation errors stored in `errors` state object
- Field-specific error messages displayed inline
- Loading states prevent duplicate submissions
