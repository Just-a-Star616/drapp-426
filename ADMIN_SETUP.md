# Admin Dashboard Setup Guide

This guide walks you through setting up the admin dashboard for managing driver applications.

## Prerequisites

1. Complete the Firebase setup (see FIREBASE_SETUP.md)
2. Complete the FCM setup (see FCM_SETUP.md)
3. Enable Google Sign-In in Firebase Console

## Step 1: Enable Google Sign-In

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `drapp-426`
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Google** provider
5. Click **Enable**
6. Add your **Project support email**
7. Click **Save**

## Step 2: Configure Authorized Domains

1. In Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel domain: `drapp-426.vercel.app`
3. `localhost` should already be there for local development

## Step 3: Create Admin Users in Firestore

The admin login page supports two authentication methods:
- **Google Sign-In** (recommended for internal staff)
- **Email/Password** (for external admins or contractors)

### Method 1: Google Sign-In Admin

**Option A: Have them sign in first**
1. Ask the admin user to visit your site at `/#/admin/login`
2. They click "Sign in with Google"
3. They will see an "Access denied" error
4. Go to Firebase Console → **Authentication** → **Users**
5. Copy their UID
6. Add them to the `admins` collection (see below)

**Option B: Create manually (if you know their Google email)**
1. Have them sign in once (they'll get access denied)
2. Get their UID from Firebase Console → Authentication → Users
3. Add them to the `admins` collection (see below)

### Method 2: Email/Password Admin

1. Go to Firebase Console → **Authentication** → **Users**
2. Click **Add user**
3. Enter their email address
4. Enter a secure password (or generate one)
5. Copy the generated UID
6. Share the credentials securely with the admin user
7. Add them to the `admins` collection (see below)

### Adding Admin to Firestore

After creating the auth account (Google or Email/Password):

1. Go to Firebase Console → **Firestore Database**
2. Navigate to or create collection: `admins`
3. Click **Add document**
4. **Document ID**: Use the user's UID (from step above)
5. Add fields:
   ```
   email: "admin@example.com"
   role: "admin"
   createdAt: (current timestamp)
   ```
6. Click **Save**

**Important:** Both Google Sign-In and Email/Password users must be added to the `admins` collection in Firestore. The authentication method just determines how they log in - authorization is always checked against Firestore.

## Step 4: Security Rules (Already Deployed)

The Firestore security rules have been deployed. They ensure:
- Only admins can read the `admins` collection
- Only admins can update application statuses
- Only admins can access all applications
- Regular users can only access their own application

## Step 5: Test Admin Access

### Testing Google Sign-In
1. Go to `https://drapp-426.vercel.app/#/admin/login`
2. Ensure "Google Sign-In" tab is selected (default)
3. Click **Sign in with Google**
4. Use an email that's been added to the `admins` collection
5. You should be redirected to `/admin/dashboard`

### Testing Email/Password Login
1. Go to `https://drapp-426.vercel.app/#/admin/login`
2. Click the "Email / Password" tab
3. Enter the email and password
4. Click **Sign In**
5. You should be redirected to `/admin/dashboard`

### Switching Between Login Methods
The admin login page has two tabs at the top:
- **Google Sign-In**: For admins using their Google accounts
- **Email / Password**: For external admins with email/password credentials

Users can freely switch between tabs to choose their preferred login method.

## Admin Dashboard Features

### Application Management
- **View all applications**: Real-time list of all submitted applications
- **Search**: Filter by name, email, phone, or area
- **Status filter**: Filter by application status
- **Sorting**: Applications sorted by submission date (newest first)

### Application Details
- Click "View / Update" on any application to see full details
- View contact information
- View license and vehicle details
- Download uploaded documents
- Update application status

### Status Updates
When you update an application status:
1. The change is saved to Firestore immediately
2. A push notification is sent to the applicant (if they enabled notifications)
3. The applicant sees the updated status in real-time

### Stats Dashboard
The dashboard shows:
- Total applications
- Applications under review
- Approved applications
- New (submitted) applications

## Notifications

### Google Chat Notifications
New applications trigger Google Chat notifications automatically (already configured).

### Push Notifications to Applicants
When you update an application status:
- Applicants who enabled notifications receive a push notification
- The notification includes your company name and logo from Firestore config
- Notifications work even when the app is closed (via service worker)

## Troubleshooting

### "Access denied" Error
- Verify the user's email is in the `admins` collection in Firestore
- Check that the document ID in `admins` collection matches the user's UID
- Check browser console for detailed error messages

### Can't see applications
- Verify Firestore security rules are deployed: `firebase deploy --only firestore:rules`
- Check that applications exist in Firestore Database
- Ensure you're signed in as an admin

### Status updates not working
- Check Cloud Functions logs: `firebase functions:log`
- Verify the `sendPushNotification` function is deployed
- Check that FCM tokens are being saved in `fcmTokens` collection

### Push notifications not received
- Verify the applicant granted notification permissions
- Check that FCM token exists in `fcmTokens/{userId}`
- Check Cloud Functions logs for errors
- Verify VAPID key is correct in `src/services/firebase.ts`

## Security Best Practices

1. **Never share admin credentials**: Each admin should use their own Google account
2. **Regular audits**: Periodically review the `admins` collection and remove inactive admins
3. **Monitor logs**: Check Cloud Functions logs regularly for unauthorized access attempts
4. **Use environment-specific configs**: Consider separate Firebase projects for dev/staging/production

## Adding/Removing Admins

### Adding a new admin:
1. Have them sign in at `/#/admin/login` (they'll get access denied)
2. Get their UID from Firebase Console → Authentication → Users
3. Add a document to `admins` collection with their UID as document ID
4. Add fields: `email`, `role: "admin"`, `createdAt`

### Removing an admin:
1. Go to Firebase Console → Firestore Database → `admins` collection
2. Delete their document
3. They will immediately lose admin access
4. (Optional) Delete their auth account from Firebase Console → Authentication → Users

## Managing Application Statuses

The app supports these statuses (defined in `src/types.ts`):
- **Submitted**: Initial status when application is received
- **Under Review**: Application is being reviewed by staff
- **Contacted**: Applicant has been contacted
- **Meeting Scheduled**: Interview/meeting is scheduled
- **Approved**: Application approved
- **Rejected**: Application rejected

You can customize these statuses by:
1. Updating the `ApplicationStatus` enum in `src/types.ts`
2. Updating the `statusSteps` in Firestore `configs/defaultConfig`
3. Rebuilding and deploying the app

## Next Steps

- Review FCM_SETUP.md to configure push notifications
- Test the full workflow: application submission → status update → notification
- Customize the status steps in Firestore config
- Set up backup admin accounts for redundancy
