import express, { Request, Response } from "express";
import mysql from "mysql";
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

    // handle license (FILE or URL)
    let licenseUrl: string | null = null;

    // upload file
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "vet_experts",
      });
      await fs.unlink(req.file.path);
      licenseUrl = uploadResult.secure_url;
    }

    // fallback to URL from body
    if (!licenseUrl && VetExperts.VetExpert_PL) {
      licenseUrl = VetExperts.VetExpert_PL;
    }

    // license → reject
    if (!licenseUrl) {
      return res.status(400).json({ error: "VetExpert license is required" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(VetExperts.VetExpert_password, 10);

    const profileImage =
      "https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg";

    // SQL
    const sql = `
      INSERT INTO tb_vetexperts (
        vetexperts_name,
        vetexperts_hashpassword,
        vetexperts_password,
        vetexperts_phonenumber,
        vetexperts_email,
        vetexperts_profile_image,
        vetexperts_province,
        vetexperts_district,
        vetexperts_locality,
        vetexperts_address,
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
      licenseUrl, //
      0,
      VetExperts.lat || null,
      VetExperts.lng || null,
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

// update address
router.put("/update-address/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      vetexperts_province,
      vetexperts_district,
      vetexperts_locality,
      vetexperts_address,
      vetexperts_loc_lat,
      vetexperts_loc_long,
    } = req.body;

    const result: any = await queryAsync(
      `UPDATE tb_vetexperts
       SET vetexperts_province = ?, vetexperts_district = ?, vetexperts_locality = ?,
           vetexperts_address = ?, vetexperts_loc_lat = ?, vetexperts_loc_long = ?
       WHERE vetexperts_id = ?`,
      [
        vetexperts_province,
        vetexperts_district,
        vetexperts_locality,
        vetexperts_address,
        vetexperts_loc_lat || null,
        vetexperts_loc_long || null,
        id,
      ],
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "ไม่พบสัตวบาล" });

    return res.status(200).json({ message: "อัพเดตที่อยู่สำเร็จ" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

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
      },
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
      [vet_expert_id],
    );
    if (experts.length === 0) {
      return res.status(404).json({ error: "Vet expert not found" });
    }

    const insertedIds: number[] = [];
    for (const time of times) {
      // check time
      const existing: any = await queryAsync(
        "SELECT schedules_id FROM tb_vet_schedules WHERE ref_vetexperts_id = ? AND schedules_available_date = ? AND schedules_available_time = ?",
        [vet_expert_id, available_date, time],
      );

      if (existing.length > 0) continue; //

      const result: any = await queryAsync(
        "INSERT INTO tb_vet_schedules (ref_vetexperts_id, schedules_available_date, schedules_available_time, schedules_is_booked) VALUES (?, ?, ?, false)",
        [vet_expert_id, available_date, time],
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
      err.sqlMessage || err.message || err,
    );
    return res.status(500).json({
      error: "Internal server error",
      details: err.sqlMessage || err.message,
    });
  }
});

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

// total stock of semen for vet expert
router.get("/vet-bulls/total-stock/:vet_id", async (req, res) => {
  try {
    const { vet_id } = req.params;

    const result: any = await queryAsync(
      `SELECT COALESCE(SUM(bulls_semen_stock), 0) AS total_stock
       FROM tb_vet_bulls
       WHERE ref_vetexperts_id = ?`,
      [vet_id],
    );

    return res.status(200).json({ total_stock: result[0].total_stock });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// แก้ไขข้อมูลส่วนตัว (ชื่อ, เบอร์, อีเมล, รูปโปรไฟล์, รูปใบประกอบ)
router.put(
  "/vetexpert/update-profile/:vet_id",
  upload.fields([
    // ← เพิ่ม middleware รับไฟล์
    { name: "profile_image", maxCount: 1 },
    { name: "license_image", maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const vet_id = +req.params.vet_id;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      // ดึงข้อมูลเดิมก่อน
      const selectSql = mysql.format(
        "SELECT * FROM tb_vetexperts WHERE vetexperts_id = ?",
        [vet_id],
      );
      const existing = (await queryAsync(selectSql)) as any[];
      if (existing.length === 0) {
        return res.status(404).json({ error: "Vet not found" });
      }
      const vetOriginal = existing[0];

      // อัปโหลดรูปโปรไฟล์ใหม่ถ้ามี
      let profileImageUrl = vetOriginal.vetexperts_profile_image;
      if (files?.profile_image?.[0]) {
        const uploadResult = await cloudinary.uploader.upload(
          files.profile_image[0].path,
          { folder: "vetexperts_profile" },
        );
        profileImageUrl = uploadResult.secure_url;
      }

      // อัปโหลดรูปใบประกอบวิชาชีพใหม่ถ้ามี
      let licenseImageUrl = vetOriginal.vetexperts_license;
      if (files?.license_image?.[0]) {
        const uploadResult = await cloudinary.uploader.upload(
          files.license_image[0].path,
          { folder: "vetexperts_license" },
        );
        licenseImageUrl = uploadResult.secure_url;
      }

      const { vetexperts_name, vetexperts_phonenumber, vetexperts_email } =
        req.body;

      const updateSql = mysql.format(
        `UPDATE tb_vetexperts
         SET vetexperts_name = ?,
             vetexperts_phonenumber = ?,
             vetexperts_email = ?,
             vetexperts_profile_image = ?,
             vetexperts_license = ?
         WHERE vetexperts_id = ?`,
        [
          vetexperts_name ?? vetOriginal.vetexperts_name,
          vetexperts_phonenumber ?? vetOriginal.vetexperts_phonenumber,
          vetexperts_email ?? vetOriginal.vetexperts_email,
          profileImageUrl,
          licenseImageUrl,
          vet_id,
        ],
      );

      const result: any = await queryAsync(updateSql);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Vet not found" });
      }

      // ดึงข้อมูลล่าสุดส่งกลับ (เหมือน farmer route)
      const updatedResult = (await queryAsync(
        mysql.format("SELECT * FROM tb_vetexperts WHERE vetexperts_id = ?", [
          vet_id,
        ]),
      )) as any[];

      return res.status(200).json({
        message: "Profile updated successfully",
        vet: updatedResult[0],
      });
    } catch (err: any) {
      console.error(err);
      return res
        .status(500)
        .json({ error: "Update failed", details: err.message });
    }
  },
);
// router.put("/vetexpert/update-profile/:vet_id", async (req, res) => {
//   try {
//     const { vet_id } = req.params;
//     const { vetexperts_name, vetexperts_phonenumber, vetexperts_email, vetexperts_profile_image, vetexperts_license } = req.body;

//     const sql = `
//       UPDATE tb_vetexperts
//       SET vetexperts_name = ?, vetexperts_phonenumber = ?, vetexperts_email = ?,
//           vetexperts_profile_image = ?, vetexperts_license = ?
//       WHERE vetexperts_id = ?
//     `;
//     const result: any = await queryAsync(sql, [
//       vetexperts_name, vetexperts_phonenumber, vetexperts_email,
//       vetexperts_profile_image, vetexperts_license, vet_id,
//     ]);

//     if (result.affectedRows === 0) return res.status(404).json({ error: "Vet not found" });
//     return res.status(200).json({ message: "Profile updated successfully" });
//   } catch (err: any) {
//     return res.status(500).json({ error: "Internal server error", details: err.message });
//   }
// });

// เปลี่ยนรหัสผ่าน
router.put("/vetexpert/change-password/:vet_id", async (req, res) => {
  try {
    const { vet_id } = req.params;
    const { old_password, new_password } = req.body;

    const rows: any = await queryAsync(
      "SELECT vetexperts_hashpassword FROM tb_vetexperts WHERE vetexperts_id = ?",
      [vet_id],
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Vet not found" });

    // เช็ครหัสเดิมกับ hash
    const isMatch = await bcrypt.compare(
      old_password,
      rows[0].vetexperts_hashpassword,
    );
    if (!isMatch) {
      return res.status(400).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }

    // hash รหัสใหม่ก่อนบันทึก
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // await queryAsync(
    //   "UPDATE tb_vetexperts SET vetexperts_hashpassword = ? WHERE vetexperts_id = ?",
    //   [hashedPassword, vet_id]
    // );
    await queryAsync(
      "UPDATE tb_vetexperts SET vetexperts_hashpassword = ?, vetexperts_password = ? WHERE vetexperts_id = ?",
      [hashedPassword, new_password, vet_id],
    );

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// แก้ไขที่อยู่
router.put("/vetexpert/update-address/:vet_id", async (req, res) => {
  try {
    const { vet_id } = req.params;
    const {
      vetexperts_province,
      vetexperts_district,
      vetexperts_locality,
      vetexperts_address,
    } = req.body;

    const sql = `
      UPDATE tb_vetexperts
      SET vetexperts_province = ?, vetexperts_district = ?,
          vetexperts_locality = ?, vetexperts_address = ?
      WHERE vetexperts_id = ?
    `;
    const result: any = await queryAsync(sql, [
      vetexperts_province,
      vetexperts_district,
      vetexperts_locality,
      vetexperts_address,
      vet_id,
    ]);

    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Vet not found" });
    return res.status(200).json({ message: "Address updated successfully" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// get all farms
router.get("/farms", async (req: any, res: any) => {
  try {
    const rows = await queryAsync(
      `SELECT * FROM tb_farms ORDER BY frams_id DESC`,
      [],
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── ดูวัวทั้งหมดของหมอ ────────────────────────────────────────────────────
router.get("/vet-bulls/my/:vet_id", async (req, res) => {
  try {
    const { vet_id } = req.params;
    const rows = await queryAsync(
      `SELECT 
        vb.vet_bulls_id, vb.ref_bulls_id, vb.bulls_semen_stock, vb.bulls_price_per_dose,
        bs.bulls_name, bs.bulls_breed, bs.bulls_age, bs.bulls_characteristics,
        bs.bulls_HealthStatus, bs.ref_farm_id,
        f.frams_name,
        bi.bulls_image1, bi.bulls_image2, bi.bulls_image3, bi.bulls_image4, bi.bulls_image5
       FROM tb_vet_bulls vb
       JOIN tb_bull_sires bs ON vb.ref_bulls_id = bs.bulls_id
       LEFT JOIN tb_farms f ON bs.ref_farm_id = f.frams_id
       LEFT JOIN tb_bulls_img bi ON bs.bulls_id = bi.ref_bulls_id
       WHERE vb.ref_vetexperts_id = ?
       ORDER BY vb.created_at DESC`,
      [vet_id],
    );
    return res.status(200).json(rows);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// ── ดูฟาร์มทั้งหมด ────────────────────────────────────────────────────────
router.get("/vet-bulls/farms", async (req, res) => {
  try {
    const rows = await queryAsync(
      `SELECT frams_id, frams_name, frams_province, frams_district FROM tb_farms ORDER BY frams_name ASC`,
    );
    return res.status(200).json(rows);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// ── ดูวัวในฟาร์ม ──────────────────────────────────────────────────────────
router.get("/vet-bulls/bulls-in-farm/:farm_id", async (req, res) => {
  try {
    const { farm_id } = req.params;
    const rows = await queryAsync(
      `SELECT bulls_id, bulls_name, bulls_breed FROM tb_bull_sires WHERE ref_farm_id = ?`,
      [farm_id],
    );
    return res.status(200).json(rows);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// ── สร้างฟาร์มใหม่ ────────────────────────────────────────────────────────
router.post("/vet-bulls/farms/create", async (req, res) => {
  try {
    const {
      frams_name,
      frams_province,
      frams_district,
      frams_locality,
      frams_address,
    } = req.body;
    if (!frams_name)
      return res.status(400).json({ error: "กรุณากรอกชื่อฟาร์ม" });

    const result: any = await queryAsync(
      `INSERT INTO tb_farms (frams_name, frams_province, frams_district, frams_locality, frams_address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        frams_name,
        frams_province || null,
        frams_district || null,
        frams_locality || null,
        frams_address || null,
      ],
    );
    return res
      .status(201)
      .json({ message: "สร้างฟาร์มสำเร็จ", frams_id: result.insertId });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// ── สร้างวัวใหม่ ──────────────────────────────────────────────────────────
router.post("/vet-bulls/bulls/create", async (req, res) => {
  try {
    const {
      bulls_name,
      bulls_breed,
      bulls_age,
      bulls_characteristics,
      bulls_HealthStatus,
      ref_farm_id,
    } = req.body;
    if (!bulls_name || !ref_farm_id)
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });

    const result: any = await queryAsync(
      `INSERT INTO tb_bull_sires (bulls_name, bulls_breed, bulls_age, bulls_characteristics, bulls_HealthStatus, ref_farm_id, bulls_contest_records)
       VALUES (?, ?, ?, ?, ?, ?, '')`,
      [
        bulls_name,
        bulls_breed || null,
        bulls_age || null,
        bulls_characteristics || null,
        bulls_HealthStatus || null,
        ref_farm_id,
      ],
    );
    return res
      .status(201)
      .json({ message: "สร้างข้อมูลวัวสำเร็จ", bulls_id: result.insertId });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

// ── เพิ่มวัวเข้าสต็อกหมอ + บันทึกรูป ────────────────────────────────────
router.post("/vet-bulls/add", upload.array("images", 5), async (req, res) => {
  try {
    const { vet_id, bulls_id, bulls_semen_stock, bulls_price_per_dose } =
      req.body;

    if (!vet_id || !bulls_id)
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });

    // อัปโหลดรูปขึ้น Cloudinary เอง (เหมือนเกษตรกร)
    const images: string[] = [];
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "vet_bulls",
        });
        images.push(uploadResult.secure_url);
        await fs.unlink(file.path); // ลบไฟล์ชั่วคราว
      }
    }

    await queryAsync("START TRANSACTION");
    try {
      await queryAsync(
        `INSERT INTO tb_vet_bulls (ref_vetexperts_id, ref_bulls_id, bulls_semen_stock, bulls_price_per_dose)
         VALUES (?, ?, ?, ?)`,
        [vet_id, bulls_id, bulls_semen_stock || 0, bulls_price_per_dose || 0],
      );

      if (images.length > 0) {
        const imgs = [...images, null, null, null, null, null].slice(0, 5);
        await queryAsync(
          `INSERT INTO tb_bulls_img (ref_bulls_id, bulls_image1, bulls_image2, bulls_image3, bulls_image4, bulls_image5)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             bulls_image1 = VALUES(bulls_image1), bulls_image2 = VALUES(bulls_image2),
             bulls_image3 = VALUES(bulls_image3), bulls_image4 = VALUES(bulls_image4),
             bulls_image5 = VALUES(bulls_image5)`,
          [bulls_id, ...imgs],
        );
      }

      await queryAsync("COMMIT");
      return res.status(201).json({ message: "เพิ่มวัวเข้าสต็อกสำเร็จ" });
    } catch (e) {
      await queryAsync("ROLLBACK");
      throw e;
    }
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});
// router.post("/vet-bulls/add", upload.array("images", 5), async (req, res) => {
//   try {
//     const { vet_id, bulls_id, bulls_semen_stock, bulls_price_per_dose } = req.body;
//     const uploadedFiles = req.files as Express.Multer.File[] | undefined;
//     const images: string[] = [];

//     if (uploadedFiles && uploadedFiles.length > 0) {
//       for (const file of uploadedFiles) {
//         const uploadResult = await cloudinary.uploader.upload(file.path, {
//           folder: "vet_bulls",
//         });
//         images.push(uploadResult.secure_url);
//         await fs.unlink(file.path);
//       }
//     }

//     const rawBodyImages = req.body.images;
//     if (rawBodyImages) {
//       if (Array.isArray(rawBodyImages)) {
//         images.push(...rawBodyImages.filter((img) => typeof img === "string" && img.trim()));
//       } else if (typeof rawBodyImages === "string") {
//         try {
//           const parsed = JSON.parse(rawBodyImages);
//           if (Array.isArray(parsed)) {
//             images.push(...parsed.filter((img) => typeof img === "string" && img.trim()));
//           } else if (rawBodyImages.trim()) {
//             images.push(rawBodyImages.trim());
//           }
//         } catch {
//           if (rawBodyImages.trim()) {
//             images.push(rawBodyImages.trim());
//           }
//         }
//       }
//     }

//     if (!vet_id || !bulls_id || images.length === 0)
//       return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบและอัพโหลดรูปอย่างน้อย 1 รูป" });

//     await queryAsync("START TRANSACTION");
//     try {
//       // เพิ่มใน tb_vet_bulls
//       await queryAsync(
//         `INSERT INTO tb_vet_bulls (ref_vetexperts_id, ref_bulls_id, bulls_semen_stock, bulls_price_per_dose)
//          VALUES (?, ?, ?, ?)`,
//         [vet_id, bulls_id, bulls_semen_stock || 0, bulls_price_per_dose || 0]
//       );

//       // บันทึกรูป
//       const imgs = [...images, null, null, null, null].slice(0, 5);
//       await queryAsync(
//         `INSERT INTO tb_bulls_img (ref_bulls_id, bulls_image1, bulls_image2, bulls_image3, bulls_image4, bulls_image5)
//          VALUES (?, ?, ?, ?, ?, ?)
//          ON DUPLICATE KEY UPDATE
//            bulls_image1 = VALUES(bulls_image1), bulls_image2 = VALUES(bulls_image2),
//            bulls_image3 = VALUES(bulls_image3), bulls_image4 = VALUES(bulls_image4),
//            bulls_image5 = VALUES(bulls_image5)`,
//         [bulls_id, ...imgs]
//       );

//       await queryAsync("COMMIT");
//       return res.status(201).json({ message: "เพิ่มวัวเข้าสต็อกสำเร็จ" });
//     } catch (e) {
//       await queryAsync("ROLLBACK");
//       throw e;
//     }
//   } catch (err: any) {
//     return res.status(500).json({ error: "Internal server error", details: err.message });
//   }
// });

// ── แก้ไข stock + ราคา ────────────────────────────────────────────────────
router.put("/vet-bulls/update/:vet_bull_id", async (req, res) => {
  try {
    const { vet_bull_id } = req.params;
    const { bulls_semen_stock, bulls_price_per_dose } = req.body;

    const result: any = await queryAsync(
      `UPDATE tb_vet_bulls SET bulls_semen_stock = ?, bulls_price_per_dose = ?, updated_at = NOW()
       WHERE vet_bulls_id = ?`,
      [bulls_semen_stock, bulls_price_per_dose, vet_bull_id],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "ไม่พบข้อมูล" });
    return res.status(200).json({ message: "อัพเดตสำเร็จ" });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", details: err.message });
  }
});

router.post("/update-fcm-token", async (req: any, res: any) => {
  const { vet_id, fcm_token } = req.body;
  try {
    await queryAsync(
      "UPDATE tb_vetexperts SET fcm_token = ? WHERE vetexperts_id = ?",
      [fcm_token, vet_id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
