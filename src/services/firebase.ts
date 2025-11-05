// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
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

export { app, auth, db, storage };
