import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyClonRZxvog7pc7Gpf2NKIDI7gThSbs91M",
  authDomain: "generateur-de-fiche-4264e.firebaseapp.com",
  projectId: "generateur-de-fiche-4264e",
  storageBucket: "generateur-de-fiche-4264e.firebasestorage.app",
  messagingSenderId: "554056107272",
  appId: "1:554056107272:web:072015b646e351b11dd8bd",
  measurementId: "G-953FG8MFVW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = new EmailAuthProvider();

// Initialize Analytics safely
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}
export { analytics };
