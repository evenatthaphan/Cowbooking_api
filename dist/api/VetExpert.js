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
const dbconnect_1 = require("../dbconnect");
const bcrypt_1 = __importDefault(require("bcrypt"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = __importDefault(require("../src/config/cloudinary"));
const fs_1 = require("fs");
const axios_1 = __importDefault(require("axios"));
exports.router = express_1.default.Router();
//import { initializeApp } from "firebase/app";
const upload = (0, multer_1.default)({ dest: "uploads/" });
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || "6Lelg9krAAAAAPt6l1_NUgB3OQXr5-Oaye-iRmjW";
//test get VetExperts (db connect)
exports.router.get("/getVetExperts", (req, res) => {
    dbconnect_1.conn.query("SELECT * FROM VetExperts", (err, result, fields) => {
        if (err) {
            console.error("DB Query Error:", err);
            return res.status(500).json({ message: "Internal Server Error" });
        }
        if (!result || result.length === 0) {
            return res.status(404).json({ message: "No VetExperts found" });
        }
        res.json(result);
    });
});
// getVetExperts where id
exports.router.get("/getVetExperts/:id", (req, res) => {
    const farmerId = req.params.id; // ดึงค่าที่ส่งมา
    const sql = "SELECT * FROM VetExperts WHERE id = ?";
    dbconnect_1.conn.query(sql, [farmerId], (err, result, fields) => {
        if (err) {
            console.error("DB Query Error:", err);
            return res.status(500).json({ message: "Internal Server Error" });
        }
        if (!result || result.length === 0) {
            return res.status(404).json({ message: "Farmer not found" });
        }
        res.json(result[0]); // ส่งแค่ตัวเดียว
    });
});
// post register *****
exports.router.post("/register", upload.single("VetExpert_PL"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("req.body:", req.body);
        let VetExperts = req.body;
        if (!VetExperts.recaptchaToken) {
            return res.status(400).json({ error: "reCAPTCHA token is required" });
        }
        try {
            // ตรวจสอบกับ Google reCAPTCHA API
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${VetExperts.recaptchaToken}`;
            const response = yield axios_1.default.post(verifyUrl);
            if (!response.data.success) {
                return res.status(400).json({ error: "Failed reCAPTCHA verification" });
            }
        }
        catch (err) {
            console.error("reCAPTCHA verification failed:", err);
            return res.status(500).json({ error: "reCAPTCHA verification failed" });
        }
        if (!VetExperts.VetExpert_name) {
            return res.status(400).json({ error: "VetExpert_name is required" });
        }
        if (!VetExperts.phonenumber) {
            return res.status(400).json({ error: "phonenumber is required" });
        }
        if (!VetExperts.VetExpert_password) {
            return res.status(400).json({ error: "VetExpert_password is required" });
        }
        if (!VetExperts.province || !VetExperts.district || !VetExperts.locality) {
            return res.status(400).json({
                error: "province, district and locality are required",
            });
        }
        // upload to Cloudinary
        let uploadResult = null;
        if (req.file) {
            uploadResult = yield cloudinary_1.default.uploader.upload(req.file.path, {
                folder: "vet_experts", // floder Cloudinary
            });
            //
            yield fs_1.promises.unlink(req.file.path);
        }
        //Hash  Password
        const saltRounds = 10;
        const hashedPassword = yield bcrypt_1.default.hash(VetExperts.VetExpert_password, saltRounds);
        const sql = `
      INSERT INTO VetExperts 
        (VetExpert_name, VetExpert_password, phonenumber, VetExpert_email, profile_image, province, district, locality, VetExpert_address, VetExpert_PL)
      VALUES (?, ?, ?, ?, 'https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg', ?, ?, ?, ?, ?)
    `;
        dbconnect_1.conn.query(sql, [
            VetExperts.VetExpert_name,
            hashedPassword,
            VetExperts.phonenumber,
            VetExperts.VetExpert_email,
            VetExperts.province,
            VetExperts.district,
            VetExperts.locality,
            VetExperts.VetExpert_address,
            uploadResult ? uploadResult.secure_url : null, // เก็บ URL ไฟล์ Cloudinary
        ], (err, result) => {
            if (err) {
                console.error("Error inserting VetExpert:", err);
                res.status(500).json({ error: "Error inserting VetExpert" });
            }
            else {
                res.status(201).json({
                    affected_row: result.affectedRows,
                    cloudinary_url: uploadResult ? uploadResult.secure_url : null,
                });
            }
        });
    }
    catch (err) {
        console.error("Error in /register:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
}));
// insert farm *****
exports.router.post("/insertfarm", (req, res) => {
    console.log("req.body:", req.body);
    let Farms = req.body;
    // ตรวจสอบว่ามี address ไหม
    if (!Farms.address) {
        return res.status(400).json({ error: "address is required", body: Farms });
    }
    // เช็คว่ามี address ซ้ำหรือยัง
    const checking = "SELECT * FROM Farms WHERE address = ?";
    dbconnect_1.conn.query(checking, [Farms.address], (err, rows) => {
        if (err) {
            console.error("Error checking address:", err);
            return res.status(500).json({ error: "Error checking address" });
        }
        if (rows.length > 0) {
            // มี address ซ้ำแล้ว
            return res.status(400).json({ error: "address already exists" });
        }
        // ถ้าไม่มีซ้ำ -> insert
        const sql = `
      INSERT INTO Farms (name, province, district, locality, address)
      VALUES (?, ?, ?, ?, ?)
    `;
        dbconnect_1.conn.query(sql, [
            Farms.name,
            Farms.province,
            Farms.district,
            Farms.locality,
            Farms.address,
        ], (err, result) => {
            if (err) {
                console.error("Error inserting farm:", err);
                return res.status(500).json({ error: "Error inserting farm" });
            }
            res.status(201).json({
                message: "Farm inserted successfully",
                farmId: result.insertId,
            });
        });
    });
});
// add schedule
// router.post("/vet/schedule", async (req, res) => {
//   try {
//     const { vet_expert_id, available_date, available_time } = req.body;
//     if (!vet_expert_id || !available_date || !available_time) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }
//     const sql = `
//       INSERT INTO vet_schedules (vet_expert_id, available_date, available_time)
//       VALUES (?, ?, ?)
//     `;
//     const [result]: any = await queryAsync(sql, [
//       vet_expert_id,
//       available_date,
//       available_time,
//     ]);
//     return res.status(201).json({
//       message: "Schedule added",
//       schedule_id: result.insertId,
//     });
//   } catch (err) {
//     console.error("Error adding schedule:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });
// class FileMiddleware {
//   filename = "";
//   public readonly diskLoader = multer({
//     //
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 67108864, // 64 MByte
//   },
// });
// }
// const fileUpload = new FileMiddleware();
// router.post("/", fileUpload.diskLoader.single("Photo"), async (req, res) => {
//   const userId = req.body.UserID;
//   console.log("UserID:", userId);
//   try {
//     // อัพโหลดรูปภาพไปยัง Firebase Storage
//     const filename = Date.now() + "-" + Math.round(Math.random() * 1000) + ".png";
//     const storageRef = ref(storage, "/images/" + filename);
//     const metadata = { contentType: req.file!.mimetype };
//     const snapshot = await uploadBytesResumable(storageRef, req.file!.buffer, metadata);
//     const url = await getDownloadURL(snapshot.ref);
//     // บันทึกรูปภาพลงใน Firebase Storage และรับ URL ของรูปภาพ
//     const Photo = url;
//     const count = 10;
//     console.log(Photo);
//     console.log(count);
//     // บันทึกข้อมูลลงในฐานข้อมูล MySQL
//     const UserID = req.body;
//     // console.log("jju"+UserID);
//     let sql = "INSERT INTO image (userID, imageURL, uploadDate, voteCount, imageName) VALUES (?, ?, NOW(), ?, ?)";
//     sql = mysql.format(sql,[req.body.UserID, url, count, req.body.imageName]);
//     conn.query(sql, (err, result) => {
//       if (err) {
//         console.error(err);
//         return res.status(500).json({ error: 'Error inserting user' });
//       }
//       res.status(201).json({ Photo: Photo, result });
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Error uploading image and inserting user' });
//   }
// });
