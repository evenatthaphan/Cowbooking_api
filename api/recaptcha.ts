import express, { Request, Response } from "express";
import crypto from "crypto";
import { conn, queryAsync } from "../dbconnect";

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

// interface สำหรับ TypeScript (ใช้ Date แทน Firestore)
interface CaptchaData {
  id: string;
  text: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

//captcha
router.get("/captcha", async (req: Request, res: Response) => {
  try {
    const code = generateCaptcha(6);
    const captchaId = crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 นาที
    const createdAt = new Date();

    const sql = `
      INSERT INTO captchas (id, text, expires_at, used, created_at) 
      VALUES (?, ?, ?, ?, ?)
    `;

    conn.query(
      sql,
      [
        captchaId,
        code,
        expiresAt.toISOString().slice(0, 19).replace("T", " "),
        false,
        createdAt.toISOString().slice(0, 19).replace("T", " "),
      ],
      (err, result) => {
        if (err) {
          console.error("Error inserting captcha:", err);
          return res.status(500).json({ error: "Error inserting captcha" });
        }

        res.status(201).json({
          message: "Captcha generated successfully",
          captchaId: captchaId,
          captcha: code,
        });
      }
    );
  } catch (err) {
    console.error("Captcha create error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//captcha
router.post("/captcha/verify", (req: Request, res: Response) => {
  try {
    const { captchaId, answer } = req.body;

    if (!captchaId || !answer) {
      return res.status(400).json({ success: false, message: "invalid input" });
    }

    const moment = require("moment-timezone"); // moment-timezone

    const sqlSelect = "SELECT * FROM captchas WHERE id = ?";
    conn.query(sqlSelect, [captchaId], (err, rows) => {
      if (err) {
        console.error("Error selecting captcha:", err);
        return res.status(500).json({ success: false, message: "db error" });
      }

      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: "not found" });
      }

      const captcha = rows[0];

      if (captcha.used) {
        return res
          .status(400)
          .json({ success: false, message: "already used" });
      }

      // ใช้ moment-timezone เปรียบเทียบเวลา
      const now = moment().tz("Asia/Bangkok");
      const expiresAt = moment(captcha.expires_at).tz("Asia/Bangkok");

      if (now.isAfter(expiresAt)) {
        return res.status(400).json({ success: false, message: "expired" });
      }

      if (captcha.text !== answer) {
        return res.status(400).json({ success: false, message: "wrong" });
      }

      // mark ว่าใช้แล้ว
      const sqlUpdate = "UPDATE captchas SET used = ? WHERE id = ?";
      conn.query(sqlUpdate, [true, captchaId], (err2) => {
        if (err2) {
          console.error("Error updating captcha:", err2);
          return res
            .status(500)
            .json({ success: false, message: "db update error" });
        }

        return res.json({ success: true, message: "ok" });
      });
    });
  } catch (err) {
    console.error("Captcha verify error:", err);
    res.status(500).json({ success: false, message: "internal error" });
  }
});
