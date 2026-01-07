import express, { Request, Response } from "express";
import crypto from "crypto";
import { conn, queryAsync } from "../dbconnect";
import { db } from "../firebaseconnect";

export const router = express.Router();

// สุ่ม captcha
function generateCaptcha(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

// create new captcha 
router.get("/captcha", async (req: Request, res: Response) => {
  try {
    const code = generateCaptcha(6);
    const captchaId = crypto.randomBytes(8).toString("hex");
    const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุ 5 นาที
    const createdAt = Date.now();

    // push into Firebase Realtime Database
    await db.ref("captchas/" + captchaId).set({
      id: captchaId,
      text: code,
      expiresAt,
      used: false,
      createdAt,
    });

    res.status(201).json({
      message: "Captcha generated successfully",
      captchaId,
      captcha: code,
    });
  } catch (err) {
    console.error("Captcha create error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// check captcha
router.post("/captcha/verify", async (req: Request, res: Response) => {
  try {
    const { captchaId, answer } = req.body;
    if (!captchaId || !answer) {
      return res.status(400).json({ success: false, message: "invalid input" });
    }

    const snapshot = await db.ref("captchas/" + captchaId).once("value");
    if (!snapshot.exists()) {
      return res.status(400).json({ success: false, message: "not found" });
    }

    const captcha = snapshot.val();

    if (captcha.used) {
      return res.status(400).json({ success: false, message: "already used" });
    }

    if (Date.now() > captcha.expiresAt) {
      return res.status(400).json({ success: false, message: "expired" });
    }

    if (captcha.text !== answer) {
      return res.status(400).json({ success: false, message: "wrong" });
    }

    // update Captchas is used
    await db.ref("captchas/" + captchaId).update({ used: true });

    return res.json({ success: true, message: "ok" });
  } catch (err) {
    console.error("Captcha verify error:", err);
    res.status(500).json({ success: false, message: "internal error" });
  }
});


// Cleanup used captchas older than 1 day
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function cleanupUsedCaptchas() {
  try {
    const snapshot = await db.ref("captchas").once("value");
    if (!snapshot.exists()) return;

    const now = Date.now();
    const captchas = snapshot.val();

    const updates: Record<string, null> = {};

    for (const id in captchas) {
      const c = captchas[id];
      if (
        c.used === true &&
        c.createdAt &&
        now - c.createdAt > ONE_DAY_MS
      ) {
        updates[`captchas/${id}`] = null; // ลบ node
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
      console.log("✅ Cleaned up used captchas:", Object.keys(updates).length);
    }
  } catch (err) {
    console.error("❌ Captcha cleanup error:", err);
  }
}

