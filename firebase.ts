
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyASCvVS0YJYITLDwVZc_y5qhDHeuGSxSUg",
  authDomain: "medi-pharma-retail.firebaseapp.com",
  projectId: "medi-pharma-retail",
  storageBucket: "medi-pharma-retail.firebasestorage.app",
  messagingSenderId: "507594156243",
  appId: "1:507594156243:web:a722d7ab81b03ec9c54c26"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

/*
TROUBLESHOOTING: If you are seeing a "PERMISSION_DENIED" error, it's because your
Firestore security rules are not configured correctly. The application
is designed to store data for each user under their own unique ID.

To fix this, go to your Firebase project > Firestore Database > Rules tab and
replace the contents with the following:

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

This ensures that only a logged-in user can read or write to their own data.
*/

export { db, auth, firebase };
