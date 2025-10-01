import admin from "firebase-admin";
import path from "path";

// path ของไฟล์ JSON นอก project
const serviceAccountPath = path.resolve("D:/Senoir Project/firebase-adminsdk.json");

// Admin SDK จะอ่าน credential จากไฟล์ JSON
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const db = admin.firestore();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;