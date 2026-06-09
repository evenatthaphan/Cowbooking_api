import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { Bull } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import { MysqlError } from "mysql";
import { QueryError, RowDataPacket } from "mysql2";
import jwt from "jsonwebtoken";
import { Router, Request, Response } from "express";

export const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = "7d";

// router.post("/login", async (req: Request, res: Response) => {
//   const { loginId, password } = req.body;

//   if (!loginId || !password) {
//     return res.status(400).json({ error: "loginId and password are required" });
//   }

//   try {
//     // ── FARMER ──────────────────────────────────────────────
//     const farmers = await queryAsync(
//       "SELECT * FROM tb_farmers WHERE farmers_name = ? OR farmers_phonenumber = ? OR farmers_email = ?",
//       [loginId, loginId, loginId]
//     ) as any[];

//     if (farmers.length > 0) {
//       const farmer = farmers[0];

//       const isMatch = await bcrypt.compare(password, farmer.farmers_hashpassword);
//       if (!isMatch) {
//         return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
//       }

//       const { farmers_hashpassword, ...farmerSafe } = farmer;

//       const token = jwt.sign(
//         { userId: farmer.farmers_id, role: "farmer" },
//         JWT_SECRET,
//         { expiresIn: JWT_EXPIRES_IN }
//       );

//       return res.json({
//         role: "farmer",
//         message: "เข้าสู่ระบบสำเร็จ",
//         token,
//         user: farmerSafe,
//       });
//     }

//     // ── VET ─────────────────────────────────────────────────
//     const vets = await queryAsync(
//       "SELECT * FROM tb_vetexperts WHERE vetexperts_name = ? OR vetexperts_phonenumber = ? OR vetexperts_email = ?",
//       [loginId, loginId, loginId]
//     ) as any[];

//     if (vets.length > 0) {
//       const vet = vets[0];

//       if (vet.vetexperts_status === 0) {
//         return res.status(403).json({ error: "บัญชีนี้อยู่ระหว่างรอการยืนยันจากระบบ" });
//       }
//       if (vet.vetexperts_status !== 1) {
//         return res.status(403).json({ error: "บัญชีนี้ไม่สามารถเข้าใช้งานได้" });
//       }

//       const isMatch = await bcrypt.compare(password, vet.vetexperts_hashpassword);
//       if (!isMatch) {
//         return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
//       }

//       const { vetexperts_hashpassword, ...vetSafe } = vet;

//       const token = jwt.sign(
//         { userId: vet.vetexperts_id, role: "vet" },
//         JWT_SECRET,
//         { expiresIn: JWT_EXPIRES_IN }
//       );

//       return res.json({
//         role: "vet",
//         message: "เข้าสู่ระบบสำเร็จ",
//         token,
//         user: vetSafe,
//       });
//     }

//     // ── ADMIN ────────────────────────────────────────────────
//     const admins = await queryAsync(
//       "SELECT * FROM tb_admins WHERE admins_name = ? OR admins_phonenumber = ? OR admins_email = ?",
//       [loginId, loginId, loginId]
//     ) as any[];

//     if (admins.length > 0) {
//       const admin = admins[0];

//       const isMatch = await bcrypt.compare(password, admin.admins_password);
//       if (!isMatch) {
//         return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
//       }

//       const token = jwt.sign(
//         { userId: admin.admins_id, role: "admin", adminType: admin.admin_type },
//         JWT_SECRET,
//         { expiresIn: JWT_EXPIRES_IN }
//       );

//       return res.json({
//         role: "admin",
//         message: "เข้าสู่ระบบสำเร็จ",
//         token,
//         user: {
//           admins_id:            admin.admins_id,
//           admins_name:          admin.admins_name,
//           admins_email:         admin.admins_email,
//           admins_phonenumber:   admin.admins_phonenumber,
//           admins_address:       admin.admins_address,
//           admin_type:           admin.admin_type,
//           must_change_password: admin.must_change_password,
//         },
//       });
//     }

//     return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });

//   } catch (err: any) {
//     return res.status(500).json({ error: err.message });
//   }
// });

router.post("/login", async (req, res) => {
  const { loginId, password, recaptcha_token } = req.body;

  if (!loginId || !password) {
    return res.status(400).json({ error: "loginId and password are required" });
  }

  const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
  if (RECAPTCHA_SECRET && recaptcha_token) {
    try {
      const verifyRes = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${recaptcha_token}`,
        { method: "POST" },
      );
      const verifyData = (await verifyRes.json()) as any;
      console.log("reCAPTCHA result:", verifyData);

      if (!verifyData.success || verifyData.score < 0.5) {
        return res.status(400).json({
          error: "reCAPTCHA ไม่ผ่าน กรุณาลองใหม่",
          score: verifyData.score,
        });
      }
    } catch (e) {
      console.error("reCAPTCHA verify error:", e);
      // fail-open: ถ้า verify error ยังให้ login ได้
    }
  }

  //  FARMER
  const farmerSql =
    "SELECT * FROM tb_farmers WHERE farmers_name = ? OR farmers_phonenumber = ? OR farmers_email = ?";

  conn.query(farmerSql, [loginId, loginId, loginId], async (err, farmers) => {
    if (err) return res.status(500).json({ error: err.message });

    if (farmers.length > 0) {
      const farmer = farmers[0];
      const isMatch = await bcrypt.compare(
        password,
        farmer.farmers_hashpassword,
      );

      if (!isMatch) {
        return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
      }

      return res.json({
        role: "farmer",
        message: "เข้าสู่ระบบสำเร็จ",
        user: farmer,
      });
    }

    //  VET
    const vetSql =
      "SELECT * FROM tb_vetexperts WHERE vetexperts_name = ? OR vetexperts_phonenumber = ? OR vetexperts_email = ?";

    conn.query(vetSql, [loginId, loginId, loginId], async (err2, vets) => {
      if (err2) return res.status(500).json({ error: err2.message });

      if (vets.length > 0) {
        const vet = vets[0];

        if (vet.vetexperts_status === 0) {
          return res
            .status(403)
            .json({ error: "บัญชีนี้อยู่ระหว่างรอการยืนยันจากระบบ" });
        }

        if (vet.vetexperts_status !== 1) {
          return res
            .status(403)
            .json({ error: "บัญชีนี้ไม่สามารถเข้าใช้งานได้" });
        }

        const isMatch = await bcrypt.compare(
          password,
          vet.vetexperts_hashpassword,
        );
        if (!isMatch) {
          return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        }

        return res.json({
          role: "vet",
          message: "เข้าสู่ระบบสำเร็จ",
          user: vet,
        });
      }

      // ADMIN
      const adminSql =
        "SELECT * FROM tb_admins WHERE admins_name = ? OR admins_phonenumber = ? OR admins_email = ?";

      conn.query(
        adminSql,
        [loginId, loginId, loginId],
        async (err3, admins) => {
          if (err3) return res.status(500).json({ error: err3.message });

          if (admins.length > 0) {
            const admin = admins[0];

            const isMatch = await bcrypt.compare(
              password,
              admin.admins_password,
            );
            if (!isMatch) {
              return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
            }

            return res.json({
              role: "admin",
              message: "เข้าสู่ระบบสำเร็จ",
              user: {
                admins_id: admin.admins_id,
                admins_name: admin.admins_name,
                admins_email: admin.admins_email,
                admins_phonenumber: admin.admins_phonenumber,
                admins_address: admin.admins_address,
                admin_type: admin.admin_type,
                must_change_password: admin.must_change_password,
              },
            });
          }
          if (admins.length > 0) {
            const admin = admins[0];

            if (password !== admin.admins_password) {
              return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
            }

            return res.json({
              role: "admin",
              message: "เข้าสู่ระบบสำเร็จ",
              user: admin,
            });
          }

          // ไม่พบทุก role
          return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });
        },
      );
    });
  });
});

// Search *****
router.post("/search", async (req, res) => {
  const { keyword, province, district, locality } = req.body;

  let sql = `
    SELECT
      b.bulls_id AS bull_id,
      b.bulls_name,
      b.bulls_breed,
      b.bulls_age,
      b.bulls_characteristics,
      b.bulls_contest_records,

      vb.bulls_price_per_dose,
      vb.bulls_semen_stock,
      vb.ref_vetexperts_id,

      ve.vetexperts_name,

      f.frams_id AS farm_id,
      f.frams_name AS farm_name,
      f.frams_province,
      f.frams_district,
      f.frams_locality,
      f.frams_address,

      bi.bulls_image1,
      bi.bulls_image2,
      bi.bulls_image3,
      bi.bulls_image4,
      bi.bulls_image5

    FROM tb_bull_sires b
    JOIN tb_farms f ON b.ref_farm_id = f.frams_id
    LEFT JOIN tb_vet_bulls vb ON b.bulls_id = vb.ref_bulls_id
    LEFT JOIN tb_vetexperts ve ON vb.ref_vetexperts_id = ve.vetexperts_id
    LEFT JOIN tb_bulls_img bi ON b.bulls_id = bi.ref_bulls_id
    WHERE 1=1
  `;

  const params: any[] = [];

  // ===== search keyword =====
  if (keyword && keyword.trim() !== "") {
    sql += `
      AND (
        b.bulls_name LIKE ?
        OR b.bulls_breed LIKE ?
        OR f.frams_name LIKE ?
      )
    `;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  // ===== filter location =====
  if (province) {
    sql += " AND f.frams_province = ?";
    params.push(province);
  }

  if (district) {
    sql += " AND f.frams_district = ?";
    params.push(district);
  }

  if (locality) {
    sql += " AND f.frams_locality = ?";
    params.push(locality);
  }

  try {
    conn.query(sql, params, (err: any, results: any[]) => {
      if (err) {
        console.error("Search error:", err);
        return res.status(500).json({ error: "Database query failed" });
      }

      // รวมรูปให้เป็น array
      const formatted = results.map((r) => {
        const images = [
          r.bulls_image1,
          r.bulls_image2,
          r.bulls_image3,
          r.bulls_image4,
          r.bulls_image5,
        ].filter(Boolean);

        return {
          bull_id: r.bull_id,
          bulls_name: r.bulls_name,
          bulls_breed: r.bulls_breed,
          bulls_age: r.bulls_age,
          bulls_characteristics: r.bulls_characteristics,
          bulls_contest_records: r.bulls_contest_records,

          price_per_dose: r.bulls_price_per_dose,
          semen_stock: r.bulls_semen_stock,

          vet_id: r.ref_vetexperts_id,
          vet_name: r.vetexperts_name,

          farm: {
            farm_id: r.farm_id,
            farm_name: r.farm_name,
            province: r.frams_province,
            district: r.frams_district,
            locality: r.frams_locality,
            address: r.frams_address,
          },

          images,
        };
      });

      res.json(formatted);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// get bull data *****
router.get("/bullData", async (req, res) => {
  try {
    const sql = `
      SELECT 
        b.bulls_id AS bull_id,
        b.bulls_name,
        b.bulls_breed,
        b.bulls_age,
        b.bulls_characteristics,
        b.bulls_contest_records,

        vb.bulls_price_per_dose,
        vb.bulls_semen_stock,

        f.frams_id AS farm_id,
        f.frams_name AS farm_name,
        f.frams_province,
        f.frams_district,
        f.frams_locality,
        f.frams_address,

        i.bulls_image1,
        i.bulls_image2,
        i.bulls_image3,
        i.bulls_image4,
        i.bulls_image5

      FROM tb_bull_sires b
      JOIN tb_farms f ON b.ref_farm_id = f.frams_id
      LEFT JOIN tb_vet_bulls vb ON b.bulls_id = vb.ref_bulls_id
      LEFT JOIN tb_bulls_img i ON b.bulls_id = i.ref_bulls_id
    `;

    conn.query(sql, (err: MysqlError | null, rows: RowDataPacket[]) => {
      if (err) {
        console.error("Error fetching bulls:", err);
        return res.status(500).json({ error: "Database error" });
      }

      const bullsMap: Record<number, any> = {};

      rows.forEach((row) => {
        if (!bullsMap[row.bull_id]) {
          bullsMap[row.bull_id] = {
            bull_id: row.bull_id,
            bulls_name: row.bulls_name,
            bulls_breed: row.bulls_breed,
            bulls_age: row.bulls_age,
            bulls_characteristics: row.bulls_characteristics,
            contest_records: row.bulls_contest_records,

            price_per_dose: row.bulls_price_per_dose,
            semen_stock: row.bulls_semen_stock,

            farm: {
              farm_id: row.farm_id,
              farm_name: row.farm_name,
              province: row.frams_province,
              district: row.frams_district,
              locality: row.frams_locality,
              address: row.frams_address,
            },

            images: [],
          };
        }

        // รวมรูปเป็น array
        const images = [
          row.bulls_image1,
          row.bulls_image2,
          row.bulls_image3,
          row.bulls_image4,
          row.bulls_image5,
        ].filter(Boolean);

        images.forEach((img: string) => {
          if (!bullsMap[row.bull_id].images.includes(img)) {
            bullsMap[row.bull_id].images.push(img);
          }
        });
      });

      res.json(Object.values(bullsMap));
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/vet-by-bull/:bull_id", (req, res) => {
  const bullId = req.params.bull_id;

  const sql = `
    SELECT v.vetexperts_id, 
      v.vetexperts_name, 
      v.vetexperts_email, 
      v.vetexperts_phonenumber, 
      v.vetexperts_profile_image, 
      v.vetexperts_province, 
      v.vetexperts_district, 
      v.vetexperts_locality, 
      v.vetexperts_address
    FROM tb_vetexperts v
    JOIN tb_vet_bulls vb ON v.vetexperts_id = vb.ref_vetexperts_id
    WHERE vb.ref_bulls_id = ?
  `;

  conn.query(sql, [bullId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database query failed" });
    }

    res.json(results);
  });
});
