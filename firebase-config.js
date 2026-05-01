import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7txHhFQyDY9OfhnktU7zXP1ZVP6nSjNQ",
  authDomain: "portfolio-c9670.firebaseapp.com",
  projectId: "portfolio-c9670",
  storageBucket: "portfolio-c9670.firebasestorage.app",
  messagingSenderId: "703355693979",
  appId: "1:703355693979:web:03935579e9e00568fa0f3e",
  measurementId: "G-G58JBBB53J"
};

export const ADMIN_EMAIL = "lizakang123@gmail.com";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, "default");
export const auth = getAuth(app);
