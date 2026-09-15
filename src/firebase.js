import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyCut-lqqGwpwZ9FjaifrBObi8Kr76tawIU",
  authDomain: "mylibertyies-f2f38.firebaseapp.com",
  projectId: "mylibertyies-f2f38",
  storageBucket: "mylibertyies-f2f38.firebasestorage.app",
  messagingSenderId: "1072836543676",
  appId: "1:1072836543676:web:713dc5f12930e89ce5fcb9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);


// 👈 Enable the offline database cache (Called once cleanly)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open, persistence can only be active in one tab at a time.
    console.warn("Firestore offline persistence failed: Multiple browser tabs open.");
  } else if (err.code === "unimplemented") {
    // The current browser does not support IndexedDB offline persistence features
    console.warn("Firestore offline persistence failed: Browser not supported.");
  }
});
