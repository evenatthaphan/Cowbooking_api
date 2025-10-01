import admin from "firebase-admin";

if (!process.env.FIREBASE_ADMIN_SDK) {
  throw new Error("FIREBASE_ADMIN_SDK environment variable is not set");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);

// Initialize Firebase only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
