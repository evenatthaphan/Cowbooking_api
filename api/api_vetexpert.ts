import express from "express";
import { VetExpertPostRequest } from "../model/data_post_request";
import { VetSchedulesPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import { error } from "console";
import bcrypt from "bcrypt";
import multer from "multer";
import cloudinary from "../src/config/cloudinary";
import { promises as fs } from "fs";
import axios from "axios";
//import { db } from "../firebaseconnect";
import { v4 as uuidv4 } from "uuid";

export const router = express.Router();
//import { initializeApp } from "firebase/app";
const upload = multer({ dest: "uploads/" });
const RECAPTCHA_SECRET =
  process.env.RECAPTCHA_SECRET || "6Lelg9krAAAAAPt6l1_NUgB3OQXr5-Oaye-iRmjW";

//test get VetExperts (db connect)
router.get("/getVetExperts", (req, res) => {
  conn.query("SELECT * FROM tb_vetexperts", (err, result, fields) => {
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
router.get("/getVetExperts/:id", (req, res) => {
  const vetId = req.params.id;

  const sql = `
    SELECT 
      v.*,
      SUM(vb.bulls_semen_stock) AS total_semen_stock
    FROM tb_vetexperts v
    LEFT JOIN tb_vet_bulls vb ON v.vetexperts_id = vb.ref_vetexperts_id
    WHERE v.vetexperts_id = ?
    GROUP BY v.vetexperts_id
  `;

  conn.query(sql, [vetId], (err, result) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "Vet not found" });
    }

    res.json(result[0]);
  });
});

// post register *****
router.post("/register", upload.single("VetExpert_PL"), async (req, res) => {
  try {
    console.log("req.body:", req.body);
    const VetExperts = req.body;

    // check fields
    if (
      !VetExperts.VetExpert_name ||
      !VetExperts.VetExpert_password ||
      !VetExperts.phonenumber
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!VetExperts.province || !VetExperts.district || !VetExperts.locality) {
      return res.status(400).json({ error: "Address fields are required" });
    }

    // upload license
    let uploadResult: any = null;
    if (req.file) {
      uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "vet_experts",
      });
      await fs.unlink(req.file.path);
    }

    // hash password
    const hashedPassword = await bcrypt.hash(
      VetExperts.VetExpert_password,
      10
    );

    const profileImage =
      "https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg";

    // SQL
    const sql = `
      INSERT INTO tb_vetexperts (
        vetexperts_name,
        vetexperts_hashpassword,
        vetexperts_password,
        vetexperts_phonenumber,
        vetexperts__email,
        vetexperts_profile_image,
        vetexperts_province,
        vetexperts_district,
        vetexperts_locality,
        vetexperts__address,
        vetexperts_license,
        vetexperts_status,
        vetexperts_loc_lat,
        vetexperts_loc_long
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      VetExperts.VetExpert_name,
      hashedPassword,
      VetExperts.VetExpert_password, 
      VetExperts.phonenumber,
      VetExperts.VetExpert_email || "",
      profileImage,
      VetExperts.province,
      VetExperts.district,
      VetExperts.locality,
      VetExperts.VetExpert_address || "",
      uploadResult ? uploadResult.secure_url : null,
      0,      // status = 0
      null,   // lat
      null,   // long
    ];


    const result: any = await queryAsync(sql, values);

    res.status(201).json({
      message: "Registration successful (pending approval)",
      vetexperts_id: result.insertId,
    });
  } catch (err) {
    console.error("Error in /register:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// router.post("/register", upload.single("VetExpert_PL"), async (req, res) => {
//   try {
//     console.log("req.body:", req.body);
//     const VetExperts = req.body;

//     // check filds
//     if (
//       !VetExperts.VetExpert_name ||
//       !VetExperts.VetExpert_password ||
//       !VetExperts.phonenumber
//     ) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     if (!VetExperts.province || !VetExperts.district || !VetExperts.locality) {
//       return res.status(400).json({ error: "Address fields are required" });
//     }

//     // upload VetExpert_PL
//     let uploadResult = null;
//     if (req.file) {
//       uploadResult = await cloudinary.uploader.upload(req.file.path, {
//         folder: "vet_experts",
//       });
//       await fs.unlink(req.file.path); // 
//     }

//     const hashedPassword = await bcrypt.hash(VetExperts.VetExpert_password, 10);
//     const pendingId = uuidv4();

//     await db.ref(`pending_vet_experts/${pendingId}`).set({
//       VetExpert_name: VetExperts.VetExpert_name,
//       VetExpert_password: hashedPassword,
//       phonenumber: VetExperts.phonenumber,
//       VetExpert_email: VetExperts.VetExpert_email || "",
//       VetExpert_address: VetExperts.VetExpert_address || "",
//       province: VetExperts.province,
//       district: VetExperts.district,
//       locality: VetExperts.locality,
//       VetExpert_PL: uploadResult ? uploadResult.secure_url : null,
//       profile_image:
//         "https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg",
//       created_at: new Date().toISOString(),
//       status: "pending", // รอการอนุมัติ
//     });

//     res.status(201).json({
//       message: "Registration submitted for admin approval",
//       pendingId,
//     });
//   } catch (err) {
//     console.error("Error in /register:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// insert farm *****
router.post("/insertfarm", (req, res) => {
  console.log("req.body:", req.body);

  let Farms = req.body;

  // ตรวจสอบว่ามี address ไหม
  if (!Farms.address) {
    return res.status(400).json({ error: "address is required", body: Farms });
  }

  // เช็คว่ามี address ซ้ำหรือยัง
  const checking = "SELECT * FROM tb_farms WHERE frams_address = ?";
  conn.query(checking, [Farms.address], (err, rows) => {
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
      INSERT INTO tb_farms (frams_name, frams_province, frams_district, frams_locality, frams_address)
      VALUES (?, ?, ?, ?, ?)
    `;

    conn.query(
      sql,
      [
        Farms.name,
        Farms.province,
        Farms.district,
        Farms.locality,
        Farms.address,
      ],
      (err, result) => {
        if (err) {
          console.error("Error inserting farm:", err);
          return res.status(500).json({ error: "Error inserting farm" });
        }
        res.status(201).json({
          message: "Farm inserted successfully",
          farmId: result.insertId,
        });
      }
    );
  });
});

// add schedule
router.post("/vet/schedule", async (req, res) => {
  try {
    const body: VetSchedulesPostRequest = req.body;
    const { vet_expert_id, available_date, available_time } = body;

    if (!vet_expert_id || !available_date || !available_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // check available_time is array ?
    const times = Array.isArray(available_time)
      ? available_time
      : [available_time];

    // check vet_expert_id is existed
    const experts: any = await queryAsync(
      "SELECT vetexperts_id FROM tb_vetexperts WHERE vetexperts_id = ?",
      [vet_expert_id]
    );
    if (experts.length === 0) {
      return res.status(404).json({ error: "Vet expert not found" });
    }

    const insertedIds: number[] = [];
    for (const time of times) {
      // check time
      const existing: any = await queryAsync(
        "SELECT schedules_id FROM tb_vet_schedules WHERE ref_vetexperts_id = ? AND schedules_available_date = ? AND schedules_available_time = ?",
        [vet_expert_id, available_date, time]
      );

      if (existing.length > 0) continue; //

      const result: any = await queryAsync(
        "INSERT INTO tb_vet_schedules (ref_vetexperts_id, schedules_available_date, schedules_available_time, schedules_is_booked) VALUES (?, ?, ?, false)",
        [vet_expert_id, available_date, time]
      );
      insertedIds.push(result.insertId);
    }

    if (insertedIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No new schedules added (all already exist)" });
    }

    return res.status(201).json({
      message: "Schedules added successfully",
      schedule_ids: insertedIds,
    });
  } catch (err: any) {
    console.error(
      "Error adding schedule:",
      err.sqlMessage || err.message || err
    );
    return res.status(500).json({
      error: "Internal server error",
      details: err.sqlMessage || err.message,
    });
  }
});

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

router.get("/get/schedule/:id", async (req, res) => {
  try {
    const vetId = req.params.id;

    if (!vetId) {
      return res.status(400).json({ error: "vet_expert_id is required" });
    }

    const sql = `
      SELECT schedules_id, ref_vetexperts_id, schedules_available_date, schedules_available_time, schedules_is_booked, schedules_create_at
      FROM tb_vet_schedules
      WHERE ref_vetexperts_id = ?
      ORDER BY schedules_available_date, schedules_available_time
    `;

    conn.query(sql, [vetId], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Database error" });
      }

      res.json(results);
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});
