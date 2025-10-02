// import admin from "firebase-admin";

// var admin = require("firebase-admin");

// var serviceAccount = require("path/to/serviceAccountKey.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: "https://flutter-57982-default-rtdb.asia-southeast1.firebasedatabase.app"
// });


// console.log(admin.app().options.projectId);

// console.log("Project ID in service account:", serviceAccount.project_id);
// export const db = admin.firestore();
// export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;


import admin from "firebase-admin";

if (!process.env.FIREBASE_ADMIN_SDK) {
  throw new Error("FIREBASE_ADMIN_SDK environment variable is not set");
}

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

console.log("Admin SDK projectId:", admin.app().options.projectId);
console.log("Service account project_id:", serviceAccount.project_id);

export const db = admin.firestore();
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;
