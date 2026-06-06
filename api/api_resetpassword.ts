import { Router, Request, Response, NextFunction } from 'express'
import { tbsService } from '../src/config/thaibulksms_service'
import { RequestOTPDto, VerifyOTPDto, ResetPasswordDto } from '../src/otp_types'
import { conn, queryAsync } from "../dbconnect";
import bcrypt from 'bcrypt'

export const router = Router()

const OTP_TTL_MIN = 5

// ---- Route 1: ขอ OTP ----
router.post('/request-otp', async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body as RequestOTPDto

  if (!phone) {
    res.status(400).json({ success: false, error: 'กรุณากรอกเบอร์โทรศัพท์' })
    return
  }

  try {
    const token = await tbsService.requestOTP(phone)
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000)

    // เก็บ token ลง DB แทน session
    await queryAsync(
      `INSERT INTO tb_otp_reset (phone, token, expires_at, verified)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE token = ?, expires_at = ?, verified = 0`,
      [phone, token, expiresAt, token, expiresAt]
    )

    res.json({ success: true, message: 'ส่ง OTP ไปยังเบอร์ของคุณแล้ว' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
    res.status(502).json({ success: false, error: message })
  }
})

// ---- Route 2: ยืนยัน OTP ----
router.post('/verify-otp', async (req: Request, res: Response): Promise<void> => {
  const { phone, otp } = req.body

  if (!phone || !otp) {
    res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบ' })
    return
  }

  try {
    const rows = await queryAsync(
      'SELECT * FROM tb_otp_reset WHERE phone = ? ORDER BY created_at DESC LIMIT 1',
      [phone]
    )

    if (rows.length === 0) {
      res.status(400).json({ success: false, error: 'ไม่พบ OTP กรุณาขอใหม่' })
      return
    }

    const record = rows[0]

    if (new Date() > new Date(record.expires_at)) {
      res.status(400).json({ success: false, error: 'OTP หมดอายุแล้ว กรุณาขอใหม่' })
      return
    }

    await tbsService.verifyOTP(record.token, otp)

    // mark verified
    await queryAsync(
      'UPDATE tb_otp_reset SET verified = 1 WHERE phone = ?',
      [phone]
    )

    res.json({ success: true, message: 'OTP ถูกต้อง' })
  } catch (err) {
    res.status(400).json({ success: false, error: 'OTP ไม่ถูกต้องหรือหมดอายุ' })
  }
})

// ---- Route 3: Reset Password ----
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  const { phone, newPassword } = req.body

  if (!phone || !newPassword || newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบหรือรหัสผ่านสั้นเกินไป' })
    return
  }

  try {
    const rows = await queryAsync(
      'SELECT * FROM tb_otp_reset WHERE phone = ? AND verified = 1 ORDER BY created_at DESC LIMIT 1',
      [phone]
    )

    if (rows.length === 0) {
      res.status(403).json({ success: false, error: 'กรุณายืนยัน OTP ก่อน' })
      return
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // เช็ค farmers
    const farmers = await queryAsync(
      'SELECT farmers_id FROM tb_farmers WHERE farmers_phonenumber = ?', [phone]
    )
    if (farmers.length > 0) {
      await queryAsync(
        'UPDATE tb_farmers SET farmers_hashpassword = ?, farmers_password = ? WHERE farmers_phonenumber = ?',
        [hashedPassword, newPassword, phone]
      )
      await queryAsync('DELETE FROM tb_otp_reset WHERE phone = ?', [phone])
      res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      return
    }

    // เช็ค vetexperts
    const vets = await queryAsync(
      'SELECT vetexperts_id FROM tb_vetexperts WHERE vetexperts_phonenumber = ?', [phone]
    )
    if (vets.length > 0) {
      await queryAsync(
        'UPDATE tb_vetexperts SET vetexperts_hashpassword = ?, vetexperts_password = ? WHERE vetexperts_phonenumber = ?',
        [hashedPassword, newPassword, phone]
      )
      await queryAsync('DELETE FROM tb_otp_reset WHERE phone = ?', [phone])
      res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      return
    }

    // เช็ค admins
    const admins = await queryAsync(
      'SELECT admins_id FROM tb_admins WHERE admins_phonenumber = ?', [phone]
    )
    if (admins.length > 0) {
      await queryAsync(
        'UPDATE tb_admins SET admins_password = ? WHERE admins_phonenumber = ?',
        [hashedPassword, phone]
      )
      await queryAsync('DELETE FROM tb_otp_reset WHERE phone = ?', [phone])
      res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      return
    }

    res.status(404).json({ success: false, error: 'ไม่พบผู้ใช้งานที่มีเบอร์โทรนี้' })
  } catch (err) {
    console.error('[reset-password]', err)
    res.status(500).json({ success: false, error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' })
  }
})