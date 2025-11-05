<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Driver Recruitment Application

A white-label, mobile-first driver recruitment application built with React, TypeScript, Vite, and Firebase. Allows applicants to submit driver applications, upload documents, and track application status with authentication and password reset flows.

## Features

- 📱 Mobile-first responsive design
- 🔐 Anonymous & email/password authentication (Firebase)
- 💾 Auto-save partial applications
- 📄 Document upload (badges, licenses, insurance)
- 📊 Real-time application status tracking
- 🎨 White-label configuration via Firestore
- 🔔 PWA with push notification support

## Quick Start

### Prerequisites

- Node.js (v16 or higher)
- A Firebase account ([free tier available](https://firebase.google.com))

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd driver-recruitment-app
npm install
```

### 2. Configure Firebase

**Complete Firebase setup is required for the app to work.**

Follow the detailed step-by-step guide: [**FIREBASE_SETUP.md**](./FIREBASE_SETUP.md)

**Quick summary:**
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password + Anonymous)
3. Create Firestore database and add security rules
4. Set up Storage with security rules
5. Create `defaultConfig` document in Firestore
6. Update `services/firebase.ts` with your Firebase credentials

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

### Deploy to Vercel (Recommended)

1. **Configure Firebase first** (see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md))

2. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "Configure Firebase"
   git push
   ```

3. Import your repository on [Vercel](https://vercel.com)

4. Deploy (Vercel auto-detects Vite configuration)

5. Add your Vercel domain to Firebase:
   - Go to Firebase Console → Authentication → Settings → Authorized domains
   - Add your Vercel URL (e.g., `your-app.vercel.app`)

### Deploy to Firebase Hosting (Alternative)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Backend:** Firebase (Auth, Firestore, Storage)
- **Routing:** React Router v7 (HashRouter)
- **Styling:** Tailwind CSS
- **Deployment:** Vercel or Firebase Hosting

## Project Structure

```
/
├── App.tsx                   # Main app with routing & Firebase auth
├── pages/                    # Route components
│   ├── Apply.tsx            # Application form with Firebase integration
│   ├── Status.tsx           # Application status tracking
│   ├── Login.tsx            # Firebase authentication
│   └── ...
├── components/              # Reusable UI components
├── hooks/                   # Custom React hooks
├── services/
│   └── firebase.ts          # Firebase configuration (UPDATE THIS!)
├── contexts/                # React context providers
├── types.ts                 # TypeScript type definitions
├── vercel.json              # Vercel deployment config
└── FIREBASE_SETUP.md        # Detailed Firebase setup guide
```

## Configuration

### White-Label Branding

Update branding in Firebase Console → Firestore → `configs/defaultConfig`:

```javascript
{
  branding: {
    companyName: "Your Company Name",
    logoUrl: "https://your-logo-url.com/logo.png",
    primaryColor: "cyan" // or "blue", "green", etc.
  },
  statusSteps: [
    { status: "Submitted", title: "...", description: "..." },
    // ... more steps
  ]
}
```

### Application Status Management

Update application statuses in Firebase Console → Firestore → `applications/{userId}`:

- Change `status` field to: `"Submitted"`, `"Under Review"`, `"Contacted"`, `"Meeting Scheduled"`, `"Approved"`, or `"Rejected"`
- Changes reflect in real-time for users

## Security

- Firebase security rules protect user data
- Users can only access their own applications
- File uploads limited to 10MB, images/PDFs only
- Anonymous authentication for partial saves
- See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for security rule configuration

## Documentation

- [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) - Complete Firebase configuration guide
- [CLAUDE.md](./CLAUDE.md) - Architecture and development guide

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
Add your domain to Firebase Console → Authentication → Settings → Authorized domains

### Application not saving
1. Check Firebase config in `services/firebase.ts`
2. Verify Firestore security rules are set
3. Check browser console for errors

### Files not uploading
1. Verify Storage security rules
2. Check file size (max 10MB)
3. Ensure file is image or PDF format

For more troubleshooting, see [FIREBASE_SETUP.md](./FIREBASE_SETUP.md#troubleshooting)

## License

[Your License Here]
