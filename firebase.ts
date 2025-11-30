
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyASCvVS0YJYITLDwVZc_y5qhDHeuGSxSUg",
  authDomain: "medi-pharma-retail.firebaseapp.com",
  projectId: "medi-pharma-retail",
  storageBucket: "medi-pharma-retail.firebasestorage.app",
  messagingSenderId: "507594156243",
  appId: "1:507594156243:web:a722d7ab81b03ec9c54c26"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/*
TROUBLESHOOTING: "PERMISSION_DENIED" ERRORS

If you are seeing permission errors, your Firestore Security Rules need to be updated 
to support the Multi-User (Admin/Operator) architecture.

Go to Firebase Console > Firestore Database > Rules and paste:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner(userId) { return request.auth != null && request.auth.uid == userId; }
    function isOperator(userId) { return request.auth != null && exists(/databases/$(database)/documents/users/$(userId)/subUsers/$(request.auth.uid)); }

    match /userMappings/{mappingId} {
      allow read: if request.auth != null && request.auth.uid == mappingId;
      allow write: if request.auth != null; 
    }

    match /users/{userId} {
      match /subUsers/{subUserId} { allow read: if isOwner(userId) || (request.auth != null && request.auth.uid == subUserId); allow write: if isOwner(userId); }
      match /companyProfile/{document=**} { allow read: if isOwner(userId) || isOperator(userId); allow write: if isOwner(userId); }
      match /systemConfig/{document=**} { allow read: if isOwner(userId) || isOperator(userId); allow write: if isOwner(userId); }
      match /gstRates/{document=**} { allow read: if isOwner(userId) || isOperator(userId); allow write: if isOwner(userId); }

      match /products/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /bills/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /purchases/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /suppliers/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /payments/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
      match /companies/{document=**} { allow read, write: if isOwner(userId) || isOperator(userId); }
    }
  }
}
*/

export { db, auth };