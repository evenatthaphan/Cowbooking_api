import admin from "firebase-admin";

if (!process.env.FIREBASE_ADMIN_SDK) {
  throw new Error("FIREBASE_ADMIN_SDK environment variable is not set");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);

// แปลง \n เป็น newline จริง
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

console.log(admin.app().options.projectId);


export const db = admin.firestore();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
