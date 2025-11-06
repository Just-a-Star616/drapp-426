// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCxUVjvmrjUcKAPP86c9v_bk9AQThZOtj8",
  authDomain: "drapp-426.firebaseapp.com",
  projectId: "drapp-426",
  storageBucket: "drapp-426.firebasestorage.app",
  messagingSenderId: "602539304557",
  appId: "1:602539304557:web:e11d9d44fa47f663b08164",
  measurementId: "G-Y4DKNYBE7N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Get Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Initialize Firebase Cloud Messaging
let messaging: ReturnType<typeof getMessaging> | null = null;
try {
  // Only initialize messaging if supported (not in all browsers/contexts)
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('Firebase Messaging not supported in this environment:', error);
}

// Google Auth Provider for admin sign-in
const googleProvider = new GoogleAuthProvider();

// VAPID key for FCM (get this from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates)
const VAPID_KEY = 'BIVyChwVN7Cnzc6xWc5vomO0uSDediV2yBy3E0ad_28eWx-0t9aRNCgKIjh4uDo1hQ3klxSIYbk2QQd4NcmiSlE'; // TODO: Replace with actual VAPID key

/**
 * Request notification permission and get FCM token
 * @returns FCM token if permission granted, null otherwise
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  console.log('requestNotificationPermission - Starting...');
  console.log('Messaging available:', !!messaging);
  console.log('VAPID_KEY set:', !!VAPID_KEY && VAPID_KEY !== 'YOUR_VAPID_KEY_HERE');

  if (!messaging) {
    console.error('Firebase Messaging not available - service worker may not be registered');
    return null;
  }

  try {
    console.log('Requesting permission...');
    const permission = await Notification.requestPermission();
    console.log('Permission result:', permission);

    if (permission === 'granted') {
      console.log('Getting FCM token with VAPID key...');
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log('FCM Token received:', token);
      return token;
    } else {
      console.warn('Notification permission denied by user');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
};

/**
 * Listen for foreground messages
 * @param callback Function to call when message received
 */
export const onMessageListener = (callback: (payload: any) => void) => {
  if (!messaging) {
    console.warn('Firebase Messaging not available');
    return () => {};
  }
  return onMessage(messaging, callback);
};

export { app, auth, db, storage, messaging, googleProvider };
