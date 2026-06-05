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

    console.log("[TBS Request] body:", JSON.stringify(body));

    try {
      const { data } = await axios.post<TBSRequestOTPResponse>(
        `${TBS_BASE_URL}/request`,
        body,
      );
      console.log("[TBS Response success]", JSON.stringify(data));
      return data.token; // ← แก้จาก data.data.token
    } catch (err) {
      throw this.handleError(err, "ไม่สามารถส่ง OTP ได้");
    }
  }

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

export const tbsService = new ThaiBulkSMSService();