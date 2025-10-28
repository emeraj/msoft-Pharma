// Fix: Import v8 compat libraries to ensure compatibility and resolve module export errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/auth';

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
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();
const auth = firebase.auth();

/*
TROUBLESHOOTING: If you are seeing a "PERMISSION_DENIED" error, it's because your
Firebase Realtime Database security rules are not configured correctly. The application
is designed to store data for each user under their own unique ID.

To fix this, go to your Firebase project > Realtime Database > Rules tab and
replace the contents with the following:

{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid == $uid",
        ".write": "auth != null && auth.uid == $uid"
      }
    }
  }
}

This ensures that only a logged-in user can read or write to their own data.
*/

export { database, auth };