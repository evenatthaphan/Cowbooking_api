import admin from 'firebase-admin'

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK!)
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

export async function sendVetApprovedNotification(fcmToken: string, vetName: string): Promise<void> {
  await admin.messaging().send({
    token: fcmToken,
    notification: {
      title: '🎉 ยินดีด้วย!',
      body: `คุณ${vetName} ได้รับการอนุมัติแล้ว สามารถเข้าสู่ระบบได้เลย`,
    },
    android: {
      notification: {
        channelId: 'cow_booking_channel',
        color: '#2e7d32',
      },
    },
  })
}

export async function sendVetRejectedNotification(fcmToken: string, vetName: string): Promise<void> {
  await admin.messaging().send({
    token: fcmToken,
    notification: {
      title: 'แจ้งผลการพิจารณา',
      body: `ขออภัย คุณ${vetName} บัญชีของคุณไม่ได้รับการอนุมัติในขณะนี้`,
    },
  })
}