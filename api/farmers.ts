//import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import multer from "multer";
import express, { Request, Response } from "express";
import cloudinary from "../src/config/cloudinary";
import axios from "axios";


export const router = express.Router();
const upload = multer({ dest: "uploads/" });

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || "6Lelg9krAAAAAPt6l1_NUgB3OQXr5-Oaye-iRmjW";

// router.get("/", (req, res) => {
//   if (req.query.id) {
//     res.send("Get in trip.ts Query id: " + req.query.id);
//   } else {
//     res.send("Get in trip.ts");
//   }
// });

// router.get("/:id", (req, res) => {
//   res.send("Get in trip.ts id: " + req.params.id);
// });

// get farmer test db connect
router.get("/getfarmer", (req, res) => {
  conn.query("SELECT * FROM Farmers", (err, result, fields) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No farmers found" });
    }
    res.json(result);
  });
});

// get where id
router.get("/getfarmer/:id", (req, res) => {
  const farmerId = req.params.id; // ดึงค่าที่ส่งมา
  const sql = "SELECT * FROM Farmers WHERE id = ?";

  conn.query(sql, [farmerId], (err, result, fields) => {
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


// farmer register *****
router.post("/register", async (req: Request, res: Response) => {
  console.log("req.body:", req.body);

  let Farmer = req.body;

  // validation field ต่าง ๆ
  if (!Farmer.farm_name) {
    return res.status(400).json({ error: "farm_name is required" });
  }
  if (!Farmer.phonenumber) {
    return res.status(400).json({ error: "phonenumber is required" });
  }
  if (!Farmer.farm_password) {
    return res.status(400).json({ error: "farm_password is required" });
  }
  if (!Farmer.province || !Farmer.district || !Farmer.locality) {
    return res
      .status(400)
      .json({ error: "province, district and locality are required" });
  }

  // เช็คเบอร์ซ้ำ
  const checkSql =
    "SELECT * FROM Farmers WHERE phonenumber = ? OR farmer_email = ?";
  conn.query(
    checkSql,
    [Farmer.phonenumber, Farmer.farmer_email],
    async (err, rows) => {
      if (err) {
        console.error("Error checking phonenumber and email:", err);
        return res
          .status(500)
          .json({ error: "Error checking phonenumber and email" });
      }

      if (rows.length > 0) {
        const existing = rows[0];
        if (existing.phonenumber === Farmer.phonenumber) {
          return res.status(400).json({ error: "Phonenumber already exists" });
        }
        if (existing.farmer_email === Farmer.farmer_email) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }

      try {
        // hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(
          Farmer.farm_password,
          saltRounds
        );

        // insert
        const sql = `
        INSERT INTO Farmers 
          (farm_name, farm_password, phonenumber, farmer_email, profile_image, farm_address, province, district, locality)
        VALUES (?, ?, ?, ?, 'https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg', ?, ?, ?, ?)
      `;

        conn.query(
          sql,
          [
            Farmer.farm_name,
            hashedPassword,
            Farmer.phonenumber,
            Farmer.farmer_email,
            Farmer.farm_address,
            Farmer.province,
            Farmer.district,
            Farmer.locality,
          ],
          (err, result) => {
            if (err) {
              console.error("Error inserting Farmer:", err);
              res.status(500).json({ error: "Error inserting Farmer" });
            } else {
              res.status(201).json({
                message: "Farmer registered successfully",
                farmerId: result.insertId,
              });
            }
          }
        );
      } catch (hashErr) {
        console.error("Error hashing password:", hashErr);
        return res.status(500).json({ error: "Error hashing password" });
      }
    }
  );
});




// edit profile *****
router.put("/edit/:id", upload.single("profile_image"), async (req: Request, res: Response) => {
  try {
    const id = +req.params.id;
    let farmer: FarmerPostRequest = req.body;

    // กำหนด type ให้ result 
    let sql = mysql.format("SELECT * FROM Farmers WHERE id = ?", [id]);
    let result = await queryAsync(sql) as FarmerPostRequest[];

    if (result.length === 0) {
      return res.status(404).json({ error: "Farmer not found" });
    }
    const farmerOriginal = result[0];

    // อัพโหลดรูปใหม่ถ้ามี
    if (req.file) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "farmers_profile",
      });
      farmer.profile_image = uploadResult.secure_url;
    }

    const updatedFarmer = { ...farmerOriginal, ...farmer };

    sql =
      "UPDATE `Farmers` SET `farm_name`=?, `phonenumber`=?, `farmer_email`=?, `profile_image`=?, `farm_address`=? WHERE `id`=?";
    sql = mysql.format(sql, [
      updatedFarmer.farm_name,
      updatedFarmer.phonenumber,
      updatedFarmer.farmer_email,
      updatedFarmer.profile_image,
      updatedFarmer.farm_address,
      id,
    ]);

    conn.query(sql, (err, result) => {
      if (err) throw err;
      res.status(200).json({
        message: "Profile updated successfully",
        affected_row: (result as any).affectedRows,
        profile_image: updatedFarmer.profile_image,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});



// change password *****
router.put("/changepass/:id", async (req, res) => {
  const id = +req.params.id;
  const { old_password, new_password } = req.body;

  if (!old_password || !new_password) {
    return res
      .status(400)
      .json({ error: "old_password and new_password are required" });
  }

  try {
    // หา farmer ตาม id
    let sql = mysql.format("SELECT * FROM Farmers WHERE id = ?", [id]);
    let result = (await queryAsync(sql)) as FarmerPostRequest[];

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    const farmerOriginal = result[0];
    console.log("old_password from request:", old_password);
    console.log("stored hash from DB:", farmerOriginal.farm_password);

    // compare oldpass
    const isMatch = await bcrypt.compare(
      old_password,
      farmerOriginal.farm_password
    );
    console.log("isMatch result:", isMatch);

    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    // hash
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);

    // update
    const updateSql = "UPDATE Farmers SET farm_password = ? WHERE id = ?";
    conn.query(updateSql, [hashedPassword, id], (err) => {
      if (err) {
        console.error("Error updating password:", err);
        return res.status(500).json({ error: "Error updating password" });
      }
      res.json({ message: "Password updated successfully" });
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// forget password
// router.post("/forget-pass", async (req, res) => {

//   const { phone, otp, newPassword } = req.body;
//   if (!phone || !otp || !newPassword) {
//     return res.status(400).json({ error: "phone ,otp, newPassword are required" });
//   }

// })

// ================= Location endpoints (from Farmers data) =================

// Get distinct provinces from Farmers
router.get("/locations/provinces", (req, res) => {
  const sql = `
    SELECT DISTINCT province 
    FROM Farmers 
    WHERE province IS NOT NULL AND province <> ''
    ORDER BY province ASC
  `;
  conn.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching provinces:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(result.map((row: any) => row.province));
  });
});

// Get distinct districts filtered by province
router.get("/locations/districts/:province", (req, res) => {
  const { province } = req.params;
  const sql = `
    SELECT DISTINCT district 
    FROM Farmers 
    WHERE district IS NOT NULL AND district <> '' AND province = ?
    ORDER BY district ASC
  `;
  conn.query(sql, [province], (err, result) => {
    if (err) {
      console.error("Error fetching districts:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(result.map((row: any) => row.district));
  });
});

// Get distinct localities filtered by province and district
router.get("/locations/localities/:province/:district", (req, res) => {
  const { province, district } = req.params;

  if (!province || !district) {
    return res.status(400).json({ error: "province and district are required" });
  }

  const sql = `
    SELECT DISTINCT locality 
    FROM Farmers 
    WHERE locality IS NOT NULL AND locality <> '' AND province = ? AND district = ?
    ORDER BY locality ASC
  `;
  conn.query(sql, [province, district], (err, result) => {
    if (err) {
      console.error("Error fetching localities:", err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(result.map((row: any) => row.locality));
  });
});