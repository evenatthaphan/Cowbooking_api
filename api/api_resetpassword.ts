import { Router, Request, Response, NextFunction } from 'express'
import { tbsService } from '../src/config/thaibulksms_service'
import { RequestOTPDto, VerifyOTPDto, ResetPasswordDto } from '../src/otp_types'
import { conn, queryAsync } from "../dbconnect";
import bcrypt from 'bcrypt'

export const router = Router()

const OTP_TTL_MIN = 5

router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  const { phone, newPassword } = req.body

  if (!phone || !newPassword || newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'ข้อมูลไม่ครบหรือรหัสผ่านสั้นเกินไป' })
    return
  }

  try {
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
      res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      return
    }

    res.status(404).json({ success: false, error: 'ไม่พบผู้ใช้งานที่มีเบอร์โทรนี้' })
  } catch (err) {
    console.error('[reset-password]', err)
    res.status(500).json({ success: false, error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้' })
  }
})