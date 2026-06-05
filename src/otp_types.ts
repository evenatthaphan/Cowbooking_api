// ---- Request/Response ของ ThaiBulkSMS API ----

export interface TBSRequestOTPBody {
  key: string
  secret: string
  msisdn: string
}

export interface TBSVerifyOTPBody {
  key: string
  secret: string
  token: string
  otp: string
}

// แก้ให้ตรงกับ response จริงของ ThaiBulkSMS
export interface TBSRequestOTPResponse {
  status: string  // "success"
  token: string   // ← อยู่ระดับบนสุด ไม่มี data.token
  refno: string
}

export interface TBSVerifyOTPResponse {
  status: string
}

// ---- Request Body จาก Client ----

export interface RequestOTPDto {
  phone: string
}

export interface VerifyOTPDto {
  otp: string
}

export interface ResetPasswordDto {
  newPassword: string
}

// ---- Session ที่เก็บข้อมูล OTP ----

export interface OTPSession {
  token: string
  phone: string
  canResetPassword: boolean
  expiresAt: number
}