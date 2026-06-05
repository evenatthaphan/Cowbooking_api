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

export interface TBSRequestOTPResponse {
  data: {
    token: string
    status: string
  }
}

export interface TBSVerifyOTPResponse {
  data: {
    status: string
  }
}

// ---- Request Body จาก Client ----

export interface RequestOTPDto {
  phone: string  // เช่น "0812345678"
}

export interface VerifyOTPDto {
  otp: string    // รหัส 6 หลักที่ user กรอก
}

export interface ResetPasswordDto {
  newPassword: string
}

// ---- Session ที่เก็บข้อมูล OTP ----

export interface OTPSession {
  token: string
  phone: string
  canResetPassword: boolean
  expiresAt: number  // Unix timestamp (ms)
}