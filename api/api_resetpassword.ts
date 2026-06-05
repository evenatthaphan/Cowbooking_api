import { Router, Request, Response, NextFunction } from "express";
import "express-session";
import { tbsService } from "../src/config/thaibulksms_service";
import {
  RequestOTPDto,
  VerifyOTPDto,
  ResetPasswordDto,
  OTPSession,
} from "../src/otp_types";
import bcrypt from "bcrypt";
import { queryAsync } from "../dbconnect";
import { db } from "../firebaseconnect";

const router = Router();

// เพิ่ม otp session type ให้ express-session รู้จัก
declare module "express-session" {
  interface SessionData {
    otp?: OTPSession;
  }
}

// ---- Helper ----

const OTP_TTL_MS = 5 * 60 * 1000; // 5 นาที

function isPhoneValid(phone: string): boolean {
  return /^(0[6-9]\d{8}|66[6-9]\d{8})$/.test(phone);
}

// ---- Middleware: ตรวจว่ายืนยัน OTP ผ่านแล้ว ----

function requireOTPVerified(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.session.otp?.canResetPassword) {
    res.status(403).json({ success: false, error: "กรุณายืนยัน OTP ก่อน" });
    return;
  }
  next();
}

// ---- Route 1: ขอ OTP ----
// POST /api/reset-password/request-otp
// Body: { phone: "0812345678" }

router.post(
  "/request-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { phone } = req.body as RequestOTPDto;

    if (!phone || !isPhoneValid(phone)) {
      res
        .status(400)
        .json({ success: false, error: "เบอร์โทรศัพท์ไม่ถูกต้อง" });
      return;
    }

    try {
      const token = await tbsService.requestOTP(phone);

      // เก็บ token + เบอร์ + เวลาหมดอายุไว้ใน session
      req.session.otp = {
        token,
        phone,
        canResetPassword: false,
        expiresAt: Date.now() + OTP_TTL_MS,
      };

      res.json({ success: true, message: "ส่ง OTP ไปยังเบอร์ของคุณแล้ว" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      res.status(502).json({ success: false, error: message });
    }
  },
);

// ---- Route 2: ยืนยัน OTP ----
// POST /api/reset-password/verify-otp
// Body: { otp: "093892" }

router.post(
  "/verify-otp",
  async (req: Request, res: Response): Promise<void> => {
    const { otp } = req.body as VerifyOTPDto;
    const session = req.session.otp;

    if (!session?.token) {
      res
        .status(400)
        .json({ success: false, error: "ไม่พบ session กรุณาขอ OTP ใหม่" });
      return;
    }

    if (Date.now() > session.expiresAt) {
      req.session.otp = undefined;
      res
        .status(400)
        .json({ success: false, error: "OTP หมดอายุแล้ว กรุณาขอใหม่" });
      return;
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      res
        .status(400)
        .json({ success: false, error: "OTP ต้องเป็นตัวเลข 6 หลัก" });
      return;
    }

    try {
      await tbsService.verifyOTP(session.token, otp);

      // อัปเดต session ว่าผ่านการยืนยันแล้ว
      req.session.otp = { ...session, canResetPassword: true };

      res.json({ success: true, message: "OTP ถูกต้อง กรุณาตั้งรหัสผ่านใหม่" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "OTP ไม่ถูกต้อง";
      res.status(400).json({ success: false, error: message });
    }
  },
);

// ---- Route 3: เปลี่ยนรหัสผ่าน (ต้องผ่าน OTP ก่อน) ----
// POST /api/reset-password/reset
// Body: { newPassword: "..." }

router.post(
  "/reset",
  requireOTPVerified,
  async (req: Request, res: Response): Promise<void> => {
    const { newPassword } = req.body as ResetPasswordDto;
    const phone = req.session.otp!.phone;

    if (!newPassword || newPassword.length < 8) {
      res
        .status(400)
        .json({ success: false, error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // เช็ค farmers ก่อน
      const [farmers]: any = await queryAsync(
        "SELECT farmers_id FROM tb_farmers WHERE farmers_phonenumber = ?",
        [phone],
      );

      if (farmers.length > 0) {
        await queryAsync(
          "UPDATE tb_farmers SET farmers_hashpassword = ?, farmers_password = ? WHERE farmers_phonenumber = ?",
          [hashedPassword, newPassword, phone],
        );
        req.session.destroy(() => {});
        res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
        return;
      }

      // เช็ค vetexperts
      const [vets]: any = await queryAsync(
        "SELECT vetexperts_id FROM tb_vetexperts WHERE vetexperts_phonenumber = ?",
        [phone],
      );

      if (vets.length > 0) {
        await queryAsync(
          "UPDATE tb_vetexperts SET vetexperts_hashpassword = ?, vetexperts_password = ? WHERE vetexperts_phonenumber = ?",
          [hashedPassword, newPassword, phone],
        );
        req.session.destroy(() => {});
        res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
        return;
      }

      // เช็ค admins
      const [admins]: any = await queryAsync(
        "SELECT admins_id FROM tb_admins WHERE admins_phonenumber = ?",
        [phone],
      );

      if (admins.length > 0) {
        await queryAsync(
          "UPDATE tb_admins SET admins_hashpassword = ?, admins_password = ? WHERE admins_phonenumber = ?",
          [hashedPassword, newPassword, phone],
        );
        req.session.destroy(() => {});
        res.json({ success: true, message: "เปลี่ยนรหัสผ่านสำเร็จ" });
        return;
      }

      // ไม่เจอเบอร์นี้ในระบบเลย
      res
        .status(404)
        .json({ success: false, error: "ไม่พบผู้ใช้งานที่มีเบอร์โทรนี้" });
    } catch (err) {
      console.error("[reset-password]", err);
      res
        .status(500)
        .json({ success: false, error: "ไม่สามารถเปลี่ยนรหัสผ่านได้" });
    }
  },
);

// router.post('/reset', requireOTPVerified, async (req: Request, res: Response): Promise<void> => {
//   const { newPassword } = req.body as ResetPasswordDto
//   const phone = req.session.otp!.phone

//   if (!newPassword || newPassword.length < 8) {
//     res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
//     return
//   }

//   try {
//     // TODO: แทนที่ด้วย logic อัปเดต password ใน DB ของคุณ
//     // await UserService.resetPassword(phone, newPassword)
//     console.log(`[reset-password] phone=${phone} เปลี่ยนรหัสผ่านสำเร็จ`)

//     // ล้าง session หลังเปลี่ยนสำเร็จ
//     req.session.destroy(() => {})

//     res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
//   } catch (err) {
//     res.status(500).json({ success: false, error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' })
//   }
// })

export default router;
