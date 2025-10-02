import express from "express";
import crypto from "crypto";
import { db, serverTimestamp } from "../firebaseconnect";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

export const router = express.Router();

// ฟังก์ชันสุ่ม captcha
function generateCaptcha(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}


// interface สำหรับ TypeScript
interface CaptchaData {
  text: string;
  expiresAt: Timestamp;
  used: boolean;
  createdAt: FieldValue;
}

// สร้าง captcha
router.get("/captcha", async (req, res) => {
  try {
    const code = generateCaptcha(6);
    const captchaId = crypto.randomBytes(8).toString("hex");

    // ใช้ Firestore Timestamp สำหรับหมดอายุ
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)); // 5 นาที

    // บันทึกเอกสาร
    await db.collection("captchas").doc(captchaId).set({
      text: code,
      expiresAt,
      used: false,
      createdAt: serverTimestamp(),
    });

    res.json({ captchaId, captcha: code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "internal error" });
  }
});

// ตรวจสอบ captcha
router.post("/captcha/verify", async (req, res) => {
  try {
    const { captchaId, answer } = req.body;

    if (!captchaId || !answer) {
      return res.status(400).json({ success: false, message: "invalid input" });
    }

    const doc = await db.collection("captchas").doc(captchaId).get();

    if (!doc.exists) {
      return res.status(400).json({ success: false, message: "not found" });
    }

    const data = doc.data() as CaptchaData;
    if (!data) {
      return res.status(400).json({ success: false, message: "not found" });
    }

    // ตรวจสอบ captcha
    if (data.used) {
      return res.status(400).json({ success: false, message: "already used" });
    }
    if (Timestamp.now().toMillis() > data.expiresAt.toMillis()) {
      return res.status(400).json({ success: false, message: "expired" });
    }
    if (data.text !== answer) {
      return res.status(400).json({ success: false, message: "wrong" });
    }

    // อัปเดตว่าใช้แล้ว
    await db.collection("captchas").doc(captchaId).update({ used: true });

    res.json({ success: true, message: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "internal error" });
  }
});
