import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC2UsQptqRT9RByx3CVKsJZngJjJq3bBrI",
  authDomain: "med-app-notifier.firebaseapp.com",
  projectId: "med-app-notifier",
  storageBucket: "med-app-notifier.firebasestorage.app",
  messagingSenderId: "61447751880",
  appId: "1:61447751880:web:0b7903174e942c0ceb7dfd",
  measurementId: "G-JG2QPF7RKF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
