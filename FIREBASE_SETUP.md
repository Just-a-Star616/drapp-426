# Firebase Setup Guide

This guide will walk you through setting up Firebase for your Driver Recruitment Application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** or **"Create a project"**
3. Enter a project name (e.g., "Driver Recruitment App")
4. (Optional) Enable Google Analytics
5. Click **"Create project"**

## Step 2: Register Your Web App

1. In your Firebase project dashboard, click the **Web icon** (`</>`) to add a web app
2. Give your app a nickname (e.g., "Driver Recruitment Web App")
3. **Check** "Also set up Firebase Hosting" (optional, but recommended)
4. Click **"Register app"**
5. Copy the Firebase configuration object - you'll need this in Step 6

## Step 3: Enable Authentication

1. In the Firebase Console, go to **Build** → **Authentication**
2. Click **"Get started"**
3. Go to the **"Sign-in method"** tab
4. Enable **Email/Password** authentication:
   - Click on "Email/Password"
   - Toggle **"Enable"** on
   - Click **"Save"**
5. Enable **Anonymous** authentication:
   - Click on "Anonymous"
   - Toggle **"Enable"** on
   - Click **"Save"**
6. Go to the **"Settings"** tab → **"Authorized domains"**
7. Add your deployment domains:
   - `localhost` (already there)
   - Your Vercel domain (e.g., `drapp-426.vercel.app`)
   - Any custom domains you'll use

## Step 4: Set Up Firestore Database

1. In the Firebase Console, go to **Build** → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** (we'll configure rules next)
4. Select a location (choose one closest to your users)
5. Click **"Enable"**

### Configure Firestore Security Rules

1. Go to the **"Rules"** tab in Firestore
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to read configs
    match /configs/{document=**} {
      allow read: if true;
      allow write: if false; // Only admins can write (via Firebase Console)
    }

    // Allow users to read/write their own applications
    match /applications/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false; // No one can delete
    }
  }
}
```

3. Click **"Publish"**

### Create the Configuration Document

1. Go to **Firestore Database** → **Data** tab
2. Click **"Start collection"**
3. Collection ID: `configs`
4. Document ID: `defaultConfig`
5. Add the following fields:

```
branding (map):
  companyName (string): "Your Company Name"
  logoUrl (string): "https://i.imgur.com/sCEI0fT.png"
  primaryColor (string): "cyan"

statusSteps (array): [
  {
    status (string): "Submitted"
    title (string): "Application Submitted"
    description (string): "Your application has been received"
  },
  {
    status (string): "Under Review"
    title (string): "Under Review"
    description (string): "We are reviewing your application"
  },
  {
    status (string): "Contacted"
    title (string): "Contacted"
    description (string): "We have reached out to you"
  },
  {
    status (string): "Meeting Scheduled"
    title (string): "Meeting Scheduled"
    description (string): "An interview has been scheduled"
  },
  {
    status (string): "Approved"
    title (string): "Approved"
    description (string): "Congratulations! Your application has been approved"
  }
]
```

6. Click **"Save"**

## Step 5: Set Up Firebase Storage

1. In the Firebase Console, go to **Build** → **Storage**
2. Click **"Get started"**
3. Choose **"Start in production mode"**
4. Select the same location as your Firestore
5. Click **"Done"**

### Configure Storage Security Rules

1. Go to the **"Rules"** tab in Storage
2. Replace the default rules with:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow users to upload to their own application folder
    match /applications/{userId}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 10 * 1024 * 1024 // Max 10MB
                   && request.resource.contentType.matches('image/.*|application/pdf');
    }
  }
}
```

3. Click **"Publish"**

## Step 6: Update Your Application Code

1. Open `services/firebase.ts` in your code editor
2. Replace the placeholder configuration with your Firebase config from Step 2:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

3. Save the file

## Step 7: Deploy to Vercel

1. Push your code to GitHub (with the updated Firebase config)
2. Go to [Vercel](https://vercel.com) and import your repository
3. Vercel will automatically detect your Vite project
4. Click **"Deploy"**
5. Once deployed, copy your Vercel URL

## Step 8: Update Firebase Authorized Domains

1. Go back to Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Click **"Add domain"**
3. Add your Vercel domain (e.g., `drapp-426.vercel.app`)
4. Click **"Add"**

## Step 9: Test Your Application

1. Visit your deployed Vercel URL
2. Try submitting a test application
3. Check Firebase Console:
   - **Authentication** → Users (should see a new user)
   - **Firestore** → applications (should see a new document)
   - **Storage** → applications (should see uploaded files)

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- Make sure your domain is added to Firebase Console → Authentication → Settings → Authorized domains

### "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure the user is authenticated

### Files not uploading
- Check Storage security rules
- Verify file size is under 10MB
- Ensure file type is image or PDF

### Application not saving
- Check browser console for errors
- Verify Firebase config is correct
- Check Firestore rules allow write access

## Optional: Set Up Firebase Hosting (Alternative to Vercel)

If you prefer Firebase Hosting instead of Vercel:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Choose your Firebase project
# Set public directory to: dist
# Configure as single-page app: Yes
# Set up automatic builds with GitHub: No
npm run build
firebase deploy
```

Your app will be deployed to: `https://YOUR_PROJECT_ID.web.app`

## Security Notes

- Never commit your Firebase config to a public repository if it contains sensitive data
- Use Firebase App Check for production to prevent abuse
- Monitor usage in Firebase Console to avoid unexpected costs
- Set up budget alerts in Google Cloud Console
- Consider upgrading to Blaze plan for production use (Spark plan has limitations)
