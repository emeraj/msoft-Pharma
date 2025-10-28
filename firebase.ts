// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyClJ96XmwGspnx1r1LM1IZIoMAU3UwFNxw",
  authDomain: "inquiry-form-924ef.firebaseapp.com",
  projectId: "inquiry-form-924ef",
  storageBucket: "inquiry-form-924ef.firebasestorage.app",
  messagingSenderId: "624877614380",
  appId: "1:624877614380:web:9636fcc2ab2ce8fe8f2889"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { database, auth };