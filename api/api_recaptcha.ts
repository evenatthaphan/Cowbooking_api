import express, { Request, Response } from "express";
import crypto from "crypto";
import { conn, queryAsync } from "../dbconnect";

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
    const createdAt = new Date();

    const sql = `
      INSERT INTO tb_recaptcha
      (recaptcha_id, created_at, recaptcha_text)
      VALUES (?, ?, ?)
    `;

    await queryAsync(sql, [
      captchaId,
      createdAt,
      code,
    ]);

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

// router.get("/captcha", async (req: Request, res: Response) => {
//   try {
//     const code = generateCaptcha(6);
//     const captchaId = crypto.randomBytes(8).toString("hex");
//     const expiresAt = Date.now() + 5 * 60 * 1000; // หมดอายุ 5 นาที
//     const createdAt = Date.now();

//     // push into Firebase Realtime Database
//     await db.ref("captchas/" + captchaId).set({
//       id: captchaId,
//       text: code,
//       expiresAt,
//       used: false,
//       createdAt,
//     });

//     res.status(201).json({
//       message: "Captcha generated successfully",
//       captchaId,
//       captcha: code,
//     });
//   } catch (err) {
//     console.error("Captcha create error:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// check captcha
router.post("/captcha/verify", async (req: Request, res: Response) => {
  try {
    const { captchaId, answer } = req.body;

    if (!captchaId || !answer) {
      return res.status(400).json({ success: false, message: "invalid input" });
    }

    const sql = `
      SELECT recaptcha_text, created_at
      FROM tb_recaptcha
      WHERE recaptcha_id = ?
    `;

    // const [rows]: any = await queryAsync(sql, [captchaId]);

    // if (rows.length === 0) {
    //   return res.status(400).json({ success: false, message: "not found" });
    // }

    // const captcha = rows[0];

    const rows: any = await queryAsync(sql, [captchaId]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: "not found" });
    }

    const captcha = rows[0];


    // หมดอายุ 5 นาที
    const EXPIRE_MS = 5 * 60 * 1000;
    const createdAt = new Date(captcha.created_at).getTime();

    if (Date.now() - createdAt > EXPIRE_MS) {
      return res.status(400).json({ success: false, message: "expired" });
    }

    if (captcha.recaptcha_text !== answer) {
      return res.status(400).json({ success: false, message: "wrong" });
    }

    // ลบทิ้งหลังใช้ (แทน used=true)
    await queryAsync(
      `DELETE FROM tb_recaptcha WHERE recaptcha_id = ?`,
      [captchaId]
    );

    return res.json({ success: true, message: "ok" });
  } catch (err) {
    console.error("Captcha verify error:", err);
    res.status(500).json({ success: false, message: "internal error" });
  }
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function cleanupCaptchas() {
  try {
    await queryAsync(
      `
      DELETE FROM tb_recaptcha
      WHERE created_at < (NOW() - INTERVAL 1 DAY)
      `
    );

    console.log("Cleaned up old captchas");
  } catch (err) {
    console.error("Captcha cleanup error:", err);
  }
}


