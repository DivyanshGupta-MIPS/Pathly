// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // <-- ADDED: Firebase Auth

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDyL6aGyiV10BC5bvkztSw-VqQfEg6ocgU",
  authDomain: "pathly-events-db.firebaseapp.com",
  projectId: "pathly-events-db",
  storageBucket: "pathly-events-db.firebasestorage.app",
  messagingSenderId: "301459948603",
  appId: "1:301459948603:web:872cee140b82357901881e"
};

// Initialize Firebase safely for Next.js hot-reloading
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app); // <-- ADDED: Export auth for the login page