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
const VAPID_KEY = 'YOUR_VAPID_KEY_HERE'; // TODO: Replace with actual VAPID key

/**
 * Request notification permission and get FCM token
 * @returns FCM token if permission granted, null otherwise
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (!messaging) {
    console.warn('Firebase Messaging not available');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
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
