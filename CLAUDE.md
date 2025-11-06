# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a white-label, mobile-first driver recruitment application built with React, TypeScript, Vite, and Firebase. It supports two distinct applicant journeys:
- **Licensed drivers**: Already have taxi/PHV license - submit details, documents, and vehicle information
- **Unlicensed drivers**: Working towards license - track 5-step licensing progress with document uploads

The application includes real-time application tracking, optional document uploads (staff validation before dispatch system entry), vehicle management, and an admin dashboard for managing applications and sending notifications.

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

### Application Flow
The application supports two distinct user journeys:

**Licensed Driver Flow** (src/pages/ApplyWizard.tsx):
- 7-step wizard for drivers with existing taxi/PHV licenses
- Step 1: Personal details + license status check
- Step 2: Badge details (number, expiry, issuing council)
- Step 3: Driving license details
- Step 4: Document uploads (badge, license, insurance - all optional)
- Step 5: Vehicle ownership question (own vehicle vs fleet)
- Step 6: Vehicle details (conditional - only if own vehicle)
- Step 7: Review and submit
- All documents optional - validated by staff before dispatch system entry

**Unlicensed Driver Flow** (initially via ApplyWizard, then Status page):
- Initial signup captures basic details
- Status page (`src/pages/Status.tsx`) shows 5-step licensing checklist:
  1. Eligibility Check
  2. Enhanced DBS Check (with optional document upload)
  3. Medical Examination (with optional document upload)
  4. Knowledge & Safeguarding Test (with optional certificate upload)
  5. Council Application Submitted
- Progress tracked with visual indicators and percentage completion
- Can add vehicle details later if purchased after initial "fleet vehicle" selection

### Application State Management
- **Real-time sync**: Application data stored in Firestore (`applications` collection, keyed by user UID)
- **Multi-step wizard**: Licensed drivers use `ApplyWizard.tsx` with step tracking via `currentStep` field
- **Context**: Global state via `AppContext` defined in `src/contexts/AppContext.tsx`
  - Provides: `branding`, `statusSteps`, `application`, `isAuthenticated`, `currentUser`
  - Computed in `src/App.tsx` using `useMemo`
- **Firestore listeners**: Real-time updates using `onSnapshot` in `src/App.tsx`
  - Branding loaded via `getDocFromServer` (bypasses cache) on mount
  - Application synced in real-time per user

### White-Label Configuration
- Branding and status steps stored in Firestore `configs` collection (default document: `defaultConfig`)
- Configuration loaded via `getDocFromServer` (bypasses cache) in `src/App.tsx:29-54`
- Admin dashboard (`src/pages/AdminDashboard.tsx`) allows updating branding in real-time
- Branding cache issue: Uses server fetch to ensure latest branding is always loaded

### Document Upload Flow
**All documents are optional** - applicants can provide via platform, email, or in-person at face-to-face meetings. Staff validate all documents before entering details into dispatch system.

**Initial Upload (ApplyWizard.tsx)**:
1. Files selected via `FileUpload` component during application wizard
2. Uploaded to Firebase Storage on form submission
3. Download URLs stored in Firestore `documents` field

**Post-Submission Upload (Status.tsx)**:
1. Both licensed and unlicensed applicants can upload/update documents after submission
2. Upload handler in `Status.tsx:handleSaveChanges()` processes multiple files
3. Supports uploading:
   - Badge documents
   - Driving license
   - Insurance certificate
   - V5C logbook (optional)
   - PHV licence (optional)
   - DBS certificate (unlicensed)
   - Medical examination certificate (unlicensed)
   - Knowledge test certificate (unlicensed)
4. File naming pattern: `documents/{userId}/{timestamp}-{fileName}`
5. Real-time visibility to staff in AdminDashboard

### Routing
- Uses `HashRouter` for compatibility with static hosting
- Route protection logic in `src/App.tsx:166-179`:
  - Unauthenticated users redirected to `/home` or `/login`
  - Authenticated users redirected to `/status` when accessing public routes
  - Admin routes protected by `isAdmin` state (checks `admins` collection)
- Routes:
  - Public: `/home`, `/apply`, `/login`, `/forgot-password`, `/reset-password`
  - Protected: `/confirmation`, `/status`
  - Admin: `/admin/login`, `/admin/dashboard`, `/admin/branding`

### Data Model
Key types in `src/types.ts`:

**Application Interface**:
- Personal details: firstName, lastName, email, phone, area
- License status: `isLicensedDriver` (boolean)
- Licensed driver fields:
  - Badge: badgeNumber, badgeExpiry, issuingCouncil
  - Driving license: drivingLicenseNumber, licenseExpiry
  - DBS: dbsCheckNumber (optional, for validation by staff)
- Unlicensed driver fields:
  - `unlicensedProgress`: Object tracking 5-step licensing journey
    - eligibilityChecked, dbsApplied, medicalBooked, knowledgeTestPassed, councilApplicationSubmitted
    - Document URLs: dbsDocumentUrl, medicalDocumentUrl, knowledgeTestDocumentUrl
- Vehicle ownership:
  - `hasOwnVehicle`: true (own), false (fleet), undefined (not specified)
  - vehicleMake, vehicleModel, vehicleReg, insuranceExpiry
- Documents object:
  - badgeDocumentUrl, drivingLicenseDocumentUrl, insuranceDocumentUrl
  - v5cDocumentUrl (optional), phvLicenceDocumentUrl (optional)
- Application tracking:
  - status: ApplicationStatus enum
  - currentStep: wizard step number (for licensed flow)
  - isPartial: boolean flag for incomplete applications
  - createdAt: timestamp

**ApplicationStatus Enum**:
Tracks administrative progress (separate from licensing progress for unlicensed):
- Submitted, Under Review, Contacted, Meeting Scheduled, Approved, Rejected

**BrandingConfig Interface**:
- companyName, logoUrl, primaryColor, tagline (optional)

**ActivityLog Interface**:
- Comprehensive tracking of all actions performed by staff and applicants
- Fields: id, applicationId, applicantName, applicantEmail, timestamp
- activityType: Enum defining the type of activity (Status Update, Document Upload, etc.)
- actor: Enum specifying who performed the action (Staff, Applicant, System)
- actorId, actorName: Identity of the person who performed the action
- details: Human-readable description of the activity
- metadata: Optional object containing additional context (old/new values, document types, etc.)

### Activity Logging System
The application includes comprehensive activity logging to track all actions by staff and applicants:

**Logged Activities**:
- **Staff actions**:
  - Status updates (with old/new values)
  - Custom notification sending (with title and recipient details)
  - Document uploads on behalf of applicants (with document type)
  - Applicant information edits (with field-level change tracking)
  - Unlicensed driver progress updates (marking stages complete/incomplete)
- **Applicant actions**:
  - Document uploads (with document types and counts)
  - Information updates (personal details, license details, vehicle details)
  - Vehicle additions
  - DBS number additions
  - Unlicensed progress self-updates

**Implementation** (`src/services/activityLog.ts`):
- `logActivity()`: Central function to create activity log entries in Firestore
- `getApplicationActivityLogs()`: Retrieve logs for a specific application
- `getAllActivityLogs()`: Retrieve recent logs across all applications (for admin dashboard)

**Automatic Logging**:
- Status page (`src/pages/Status.tsx`): Logs all applicant actions when saving changes
  - Document uploads tracked with document types and counts
  - Vehicle additions tracked with vehicle details
  - DBS number additions logged for staff validation
- Admin dashboard (`src/pages/AdminDashboard.tsx`): Logs staff actions
  - Status updates logged with old/new values
  - Notifications logged with title and recipient details
- All logs immutable once created (Firestore rules prevent updates/deletes)

**Activity Log Viewer** (`src/components/ActivityLogViewer.tsx`):
- Displays activity history with visual indicators and badges
- Shows in AdminDashboard main view (recent activity across all applications)
- Shows in application detail modal (activity for specific applicant)
- Real-time relative timestamps ("5m ago", "2h ago", etc.)
- Color-coded by actor type (Staff, Applicant, System)

**Webhook Notifications**:
- Cloud Function `notifyStaffOfActivity` sends Google Chat notifications for important activities
- Triggered automatically when new activity logs are created
- Notifies staff of applicant actions (document uploads, vehicle additions, etc.)
- Includes activity details, metadata, and link to Firebase Console

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

**notifyStaffOfActivity**: Firestore trigger that sends Google Chat webhook notifications when activity logs are created
- Triggers on new activity log creation in `activityLogs` collection
- Sends notifications to staff for important activities (applicant actions, status updates)
- Includes activity details, metadata, and link to view application
- Uses same `googlechat.webhook` environment config as `notifyNewApplication`

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

**Reference Data:**
- `Licence Issuing Authorities.txt`: Complete list of 359 UK licensing authorities
  - Used in ApplyWizard.tsx for "Issuing Council" dropdown
  - Includes all UK councils that issue taxi/PHV licenses

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
- `activityLogs`: Comprehensive activity tracking for all staff and applicant actions
  - Auto-created when activities are logged via `logActivity()` service
  - Contains ActivityLog documents with activity type, actor, details, and metadata
  - Indexed by timestamp for efficient querying
  - Immutable once created (Firestore rules prevent updates/deletes)

**Firebase Functions Config:**
```bash
firebase functions:config:set googlechat.webhook="https://chat.googleapis.com/v1/spaces/..."
```

**Security Rules:**
- `firestore.rules`: Database security rules with validation
  - Activity logs require proper field validation and actor ID matching authenticated user
  - Admins can read/write all collections, users can only access their own data
- `storage.rules`: Storage bucket rules for document uploads

**Firestore Indexes:**
- `firestore.indexes.json`: Composite indexes configuration
  - Activity logs indexed by `applicationId` (ascending) + `timestamp` (descending)
  - Required for querying activity logs per application sorted by time
  - Deploy via: `firebase deploy --only firestore:indexes`

## Key Implementation Details

**Password Validation:**
- Custom hook `usePasswordValidation` checks strength requirements
- Visual feedback via `PasswordStrength` component
- Validation enforced before submission in `Apply.tsx`

**Form State Persistence:**
- Multi-step wizard tracks progress via `currentStep` field in Firestore
- Passwords never saved in Firestore (excluded when pre-filling form data)
- Step validation ensures data integrity before progression
- Vehicle ownership decision impacts form flow (step 6 conditional on hasOwnVehicle)

**Vehicle Management:**
- Applicants can initially select "Own Vehicle" or "Fleet Vehicle"
- Those who select "Fleet Vehicle" can later add their own vehicle via Status page
- When adding vehicle, applicants provide:
  - Vehicle make, model, registration
  - Insurance expiry date
  - Optional documents: Insurance certificate, V5C logbook, PHV licence
- Vehicle details visible to staff in AdminDashboard for validation
- Supports transition from fleet to owned vehicle mid-process

**File Upload Pattern:**
- Files stored temporarily in component state
- Uploaded to Firebase Storage only on form submission
- Upload path: `documents/{userId}/{timestamp}-{fileName}`
- Download URLs stored in application document's `documents` field

**Admin Features (src/pages/AdminDashboard.tsx):**
- Comprehensive application management at `/admin/dashboard`
- **View all applicant details**:
  - Licensed drivers: Badge details, driving license, DBS number, vehicle ownership, vehicle details (if provided), all documents
  - Unlicensed drivers: 5-step licensing progress with visual indicators, vehicle details (if added), licensing documents
- **Edit applicant information**:
  - Staff can edit personal details (name, phone, area)
  - Edit license details (badge number, expiry, issuing council, driving license)
  - Edit vehicle details (make, model, registration, insurance expiry)
  - All edits tracked in activity logs with before/after values
- **Document management**:
  - Upload documents on behalf of applicants
  - Support for all document types (badge, license, insurance, V5C, PHV, DBS, medical, knowledge test)
  - View and download existing documents
  - Upload buttons available for each document type
- **Unlicensed progress tracking**:
  - Mark each of 5 licensing stages as complete/incomplete
  - Checkboxes for: Eligibility, DBS, Medical, Knowledge Test, Council Application
  - All progress updates logged with staff actor identification
- **Status management**: Change application status (Submitted → Under Review → Contacted → Meeting Scheduled → Approved/Rejected)
- **Notifications**:
  - Send custom notifications to individual or multiple applicants
  - Schedule notifications for later delivery
  - Status change notifications sent automatically via FCM
- **Activity history**: View comprehensive activity logs for each applicant
- **Complete field visibility**: All fields and documents visible to staff for validation before dispatch system entry
- **Real-time updates**:
  - Application list updates in real-time via Firestore listeners
  - Selected application modal updates automatically when data changes
  - No need to close/reopen modal to see changes

**Applicant Status Page (src/pages/Status.tsx):**
- **Licensed drivers**:
  - View submitted application details
  - **Edit personal information**: Can update name, phone, area, license details, vehicle details
  - Upload/update missing documents (badge, license, insurance, V5C, PHV)
  - Add DBS check number for staff validation
  - Add vehicle details if initially selected "fleet vehicle"
  - All edits tracked in activity logs
- **Unlicensed drivers**:
  - Track 5-step licensing progress with visual checklist
  - Upload licensing documents as received (DBS, medical, knowledge test)
  - Add vehicle details if initially selected "fleet vehicle"
  - **Edit personal information**: Same editing capabilities as licensed drivers
  - View personal information
- **Activity history**: View own activity log showing all changes made to application
- All document uploads optional with clear messaging about staff validation

**Branding Settings Page (src/pages/BrandingSettings.tsx):**
- Dedicated page for managing company branding at `/admin/branding`
- **Customizable fields**:
  - Company name (required)
  - Logo URL (required)
  - Primary color (required) - with visual color picker
  - Tagline (optional)
- **Live preview**: Shows real-time preview of branding changes before saving
- **User-friendly interface**:
  - Color picker with hex code input
  - Form validation for required fields
  - Reset button to revert changes
  - Helpful tips section with best practices
- **Updates configs/defaultConfig** in Firestore while preserving other fields
- **Automatic page reload** after save to show new branding across the app
- **Access**: Via "Branding" button in AdminDashboard header (paint brush icon)
- Protected route - requires admin authentication
