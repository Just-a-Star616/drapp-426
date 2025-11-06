# Firebase Cloud Messaging (FCM) Setup Guide

This guide walks you through setting up Firebase Cloud Messaging for push notifications to applicants.

## Step 1: Enable Firebase Cloud Messaging

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `drapp-426`
3. Navigate to **Project Settings** (gear icon) → **Cloud Messaging**
4. Note your **Server Key** (Legacy) or **Cloud Messaging API (V1)** credentials

## Step 2: Generate VAPID Key (Web Push Certificates)

1. In Firebase Console → **Project Settings** → **Cloud Messaging**
2. Scroll to **Web Push certificates**
3. Click **Generate key pair**
4. Copy the **Key pair** value (starts with `B...`)
5. This is your VAPID public key

## Step 3: Add VAPID Key to Your App

Update `src/services/firebase.ts` to include the VAPID key:

```typescript
// Get FCM token for this device
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const messaging = getMessaging();
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY_HERE'
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
};
```

## Step 4: Enable Google Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `drapp-426`
3. Navigate to **APIs & Services** → **Library**
4. Search for **Firebase Cloud Messaging API**
5. Click **Enable**

## Step 5: Set Up Google Sign-In for Admin

1. In Firebase Console → **Authentication** → **Sign-in method**
2. Click **Google** provider
3. Click **Enable**
4. Add your **Project support email**
5. Save

## Step 6: Configure Authorized Domains

1. In Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Add your Vercel domain (e.g., `drapp-426.vercel.app`)
3. Add `localhost` for local development

## Step 7: Create Admin Users Collection in Firestore

1. In Firebase Console → **Firestore Database**
2. Create a new collection: `admins`
3. Add documents with admin email addresses:
   ```
   Document ID: (auto-generated)
   Fields:
     email: "admin@example.com"
     role: "admin"
     createdAt: (timestamp)
   ```

## Step 8: Update Firestore Security Rules

Update your `firestore.rules` to include admin authorization:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function to check if user is admin
    function isAdmin() {
      return exists(/databases/$(database)/documents/admins/$(request.auth.uid)) ||
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.email == request.auth.token.email;
    }

    // Applications - users can only access their own, admins can access all
    match /applications/{applicationId} {
      allow read: if request.auth != null &&
                     (request.auth.uid == applicationId || isAdmin());
      allow create: if request.auth != null && request.auth.uid == applicationId;
      allow update: if request.auth != null &&
                       (request.auth.uid == applicationId || isAdmin());
      allow delete: if isAdmin();
    }

    // Admins collection - only admins can read
    match /admins/{adminId} {
      allow read: if request.auth != null && isAdmin();
      allow write: if false; // Manually managed only
    }

    // Configs - public read, admin write
    match /configs/{configId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // FCM Tokens - users can manage their own
    match /fcmTokens/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Step 9: Deploy Updated Cloud Functions

The Cloud Functions will automatically send push notifications when application status changes.

```bash
cd functions
npm install firebase-admin@latest
cd ..
firebase deploy --only functions
```

## Step 10: Test Notifications

1. Open your app in a browser
2. Grant notification permissions when prompted
3. Submit a test application
4. Log in to admin dashboard
5. Change the application status
6. Verify notification is received

## Troubleshooting

**Notifications not working?**
- Check browser console for errors
- Verify VAPID key is correct
- Ensure FCM API is enabled in Google Cloud Console
- Check that service worker is registered
- Verify FCM token is saved to Firestore

**Admin can't log in?**
- Verify their email is in the `admins` collection
- Check Firestore security rules are deployed
- Ensure Google Sign-In is enabled in Firebase Console

**Push notifications not sent on status change?**
- Check Cloud Functions logs: `firebase functions:log`
- Verify the Cloud Function has necessary permissions
- Ensure FCM server key is configured (if using legacy API)
