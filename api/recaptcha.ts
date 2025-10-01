import express from "express";
import crypto from "crypto";
import { db, serverTimestamp } from "../firebaseconnect";

export const router = express.Router();

function generateCaptcha(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

interface CaptchaData {
  text: string;
  expiresAt: number;
  used: boolean;
  createdAt: FirebaseFirestore.FieldValue;
}

// สร้าง captcha
router.get("/captcha", async (req, res) => {
  try {
    const code = generateCaptcha(6);
    const captchaId = crypto.randomBytes(8).toString("hex");
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 นาที

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

    if (!doc.exists)
      return res.status(400).json({ success: false, message: "not found" });

    const data = doc.data() as CaptchaData;

    if (data.used)
      return res.status(400).json({ success: false, message: "already used" });
    if (Date.now() > data.expiresAt)
      return res.status(400).json({ success: false, message: "expired" });
    if (data.text !== answer)
      return res.status(400).json({ success: false, message: "wrong" });

    await db.collection("captchas").doc(captchaId).update({ used: true });
    res.json({ success: true, message: "ok" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "internal error" });
  }
});
