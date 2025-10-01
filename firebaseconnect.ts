import admin from "firebase-admin";

if (!process.env.FIREBASE_ADMIN_SDK) {
  throw new Error("FIREBASE_ADMIN_SDK environment variable is not set");
}

const raw = JSON.parse(process.env.FIREBASE_ADMIN_SDK);

// แปลง \n เป็น newline จริง
raw.private_key = raw.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(raw),
  });
}

export const db = admin.firestore();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
