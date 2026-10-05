import { getApps, initializeApp } from "@firebase/app";
import { getAuth } from "@firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDYpX7onhD24z5_82LssFw3ROZ_TG52rGc",
  authDomain: "luma-learning-intelligence.firebaseapp.com",
  projectId: "luma-learning-intelligence",
  storageBucket: "luma-learning-intelligence.firebasestorage.app",
  messagingSenderId: "161313706596",
  appId: "1:161313706596:web:07ff4e98d7e03d8311c571",
};

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
