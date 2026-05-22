// ═══════════════════════════════════════════
//  js/config.js  —  Firebase Setup
//  Ubah konfigurasi di sini kalau pindah project
// ═══════════════════════════════════════════

import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, serverTimestamp, getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  getAuth, signInWithEmailAndPassword,
  onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyCeSqRWg0MNOq51EyKXerb9Yhc-Knzfo8k",
  authDomain:        "angkringan-12330.firebaseapp.com",
  projectId:         "angkringan-12330",
  storageBucket:     "angkringan-12330.firebasestorage.app",
  messagingSenderId: "630385630007",
  appId:             "1:630385630007:web:e19e29f1512705d704d8b2",
  measurementId:     "G-MHDVHFSF16",
};

const app = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
export {
  collection, addDoc, getDocs, deleteDoc,
  doc, serverTimestamp, getDoc,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
};

