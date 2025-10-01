"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.router = express_1.default.Router();
// init firebase
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.applicationDefault(), // หรือใช้ serviceAccountKey.json
});
const db = firebase_admin_1.default.firestore();
function generateCaptcha(len = 6) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789";
    let s = "";
    for (let i = 0; i < len; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}
// สร้าง captcha
exports.router.get("/captcha", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const code = generateCaptcha(6);
    const captchaId = crypto_1.default.randomBytes(8).toString("hex");
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 นาที
    yield db.collection("captchas").doc(captchaId).set({
        text: code,
        expiresAt,
        used: false,
        createdAt: firebase_admin_1.default.firestore.FieldValue.serverTimestamp(),
    });
    res.json({
        captchaId,
        captcha: code,
    });
}));
// ตรวจสอบ captcha
exports.router.post("/captcha/verify", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { captchaId, answer } = req.body;
    const doc = yield db.collection("captchas").doc(captchaId).get();
    if (!doc.exists) {
        return res.status(400).json({ success: false, message: "not found" });
    }
    const data = doc.data();
    if (data.used) {
        return res.status(400).json({ success: false, message: "already used" });
    }
    if (Date.now() > data.expiresAt) {
        return res.status(400).json({ success: false, message: "expired" });
    }
    if (data.text !== answer) {
        return res.status(400).json({ success: false, message: "wrong" });
    }
    yield db.collection("captchas").doc(captchaId).update({ used: true });
    res.json({ success: true, message: "ok" });
}));
