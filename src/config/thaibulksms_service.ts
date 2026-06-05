import axios, { AxiosError } from "axios";
import {
  TBSRequestOTPBody,
  TBSRequestOTPResponse,
  TBSVerifyOTPBody,
  TBSVerifyOTPResponse,
} from "../otp_types";

const TBS_BASE_URL = "https://otp.thaibulksms.com/v2/otp";

export class ThaiBulkSMSService {
  private readonly key: string;
  private readonly secret: string;

  constructor() {
    const key = process.env.TBS_API_KEY;
    const secret = process.env.TBS_API_SECRET;

    if (!key || !secret) {
      throw new Error("TBS_API_KEY และ TBS_API_SECRET ต้องกำหนดใน .env");
    }

    this.key = key;
    this.secret = secret;
  }

  /**
   * ส่ง OTP ไปยังเบอร์โทรศัพท์ที่ระบุ
   * @returns token ที่ใช้สำหรับ verify ในขั้นตอนถัดไป
   */
  async requestOTP(phone: string): Promise<string> {
    const normalizedPhone = phone
      .replace(/^\+66/, "0")
      .replace(/^66/, "0")
      .trim();

    const body: TBSRequestOTPBody = {
      key: this.key,
      secret: this.secret,
      msisdn: normalizedPhone,
    };
    
    console.log('[TBS Request] body:', JSON.stringify(body));
    
    try {
      const { data } = await axios.post<TBSRequestOTPResponse>(
        `${TBS_BASE_URL}/request`,
        body,
      );
      return data.data.token;
    } catch (err) {
      throw this.handleError(err, "ไม่สามารถส่ง OTP ได้");
    }
  }

  /**
   * ตรวจสอบรหัส OTP ที่ user กรอก
   * @returns true ถ้าถูกต้อง, throw error ถ้าผิด
   */
  async verifyOTP(token: string, otp: string): Promise<true> {
    const body: TBSVerifyOTPBody = {
      key: this.key,
      secret: this.secret,
      token,
      otp,
    };

    try {
      await axios.post<TBSVerifyOTPResponse>(`${TBS_BASE_URL}/verify`, body);
      return true;
    } catch (err) {
      throw this.handleError(err, "OTP ไม่ถูกต้องหรือหมดอายุ");
    }
  }

  private handleError(err: unknown, fallbackMessage: string): Error {
    if (err instanceof AxiosError) {
      // log ดู response จริงจาก TBS
      console.error("[TBS Error] status:", err.response?.status);
      console.error("[TBS Error] data:", JSON.stringify(err.response?.data));

      const detail = err.response?.data?.message ?? fallbackMessage;
      return new Error(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );
    }
    return new Error(fallbackMessage);
  }
}

// Singleton — ใช้ instance เดียวตลอด app
export const tbsService = new ThaiBulkSMSService();
