import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
//import { BullRow } from "../model/data_post_request";
import { Bull } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import { MysqlError } from "mysql";
import { QueryError, RowDataPacket } from "mysql2";


export const router = express.Router();


// login for 3 type ****
router.post("/login", async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.status(400).json({ error: "loginId and password are required" });
  }

  //  FARMER
  const farmerSql =
    "SELECT * FROM tb_farmers WHERE farmers_name = ? OR farmers_phonenumber = ? OR farmers_email = ?";

  conn.query(farmerSql, [loginId, loginId, loginId], async (err, farmers) => {
    if (err) return res.status(500).json({ error: err.message });

    if (farmers.length > 0) {
      const farmer = farmers[0];
      const isMatch = await bcrypt.compare(password, farmer.farmers_hashpassword);

      if (!isMatch) {
        return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
      }

      return res.json({ role: "farmer", message: "เข้าสู่ระบบสำเร็จ", user: farmer });
    }

    //  VET 
    const vetSql =
      "SELECT * FROM tb_vetexperts WHERE vetexperts_name = ? OR vetexperts_phonenumber = ? OR vetexperts_email = ?";

    conn.query(vetSql, [loginId, loginId, loginId], async (err2, vets) => {
      if (err2) return res.status(500).json({ error: err2.message });

      if (vets.length > 0) {
        const vet = vets[0];

        if (vet.vetexperts_status === 0) {
          return res.status(403).json({ error: "บัญชีนี้อยู่ระหว่างรอการยืนยันจากระบบ" });
        }

        if (vet.vetexperts_status !== 1) {
          return res.status(403).json({ error: "บัญชีนี้ไม่สามารถเข้าใช้งานได้" });
        }

        const isMatch = await bcrypt.compare(password, vet.vetexperts_hashpassword);
        if (!isMatch) {
          return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
        }

        return res.json({ role: "vet", message: "เข้าสู่ระบบสำเร็จ", user: vet });
      }

      // ADMIN 
      const adminSql =
        "SELECT * FROM tb_admins WHERE admins_name = ? OR admins_phonenumber = ? OR admins_email = ?";

      conn.query(adminSql, [loginId, loginId, loginId], async (err3, admins) => {
        if (err3) return res.status(500).json({ error: err3.message });

        if (admins.length > 0) {
          const admin = admins[0];
          const isMatch = await bcrypt.compare(password, admin.admin_password);

          if (!isMatch) {
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
      });
    });
  });
});



// router.post("/login", async (req, res) => {
//   const { loginId, password } = req.body;

//   if (!loginId || !password) {
//     return res.status(400).json({ error: "loginId and password are required" });
//   }

//   //  Farmers 
//   const farmerSql =
//     "SELECT * FROM tb_farmers WHERE farmers_name = ? OR farmers_phonenumber = ? OR farmers_email = ?";

//   conn.query(farmerSql, [loginId, loginId, loginId], async (err, result) => {
//     if (err) return res.status(500).json({ error: err.message });

//     if (result.length > 0) {
//       const user = result[0];
//       const isMatch = await bcrypt.compare(password, user.farm_password);

//       if (!isMatch) {
//         return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
//       }

//       return res.json({ role: "farmer", message: "เข้าสู่ระบบสำเร็จ", user });
//     }

//     // VetExperts 
//     const vetSql =
//       "SELECT * FROM tb_vetexperts WHERE vetexperts_name = ? OR vetexperts_phonenumber = ? OR vetexperts_email = ?";

//     conn.query(vetSql, [loginId, loginId, loginId], async (err2, result2) => {
//       if (err2) return res.status(500).json({ error: err2.message });

//       if (result2.length > 0) {
//         const vet = result2[0];

//         // เช็คสถานะ
//         if (vet.vetexperts_status === 0) {
//           return res.status(403).json({
//             error: "บัญชีนี้อยู่ระหว่างรอการยืนยันจากระบบ",
//           });
//         }

//         if (vet.vetexperts_status !== 1) {
//           return res.status(403).json({
//             error: "บัญชีนี้ไม่สามารถเข้าใช้งานได้",
//           });
//         }

//         //เช็ครหัสผ่าน
//         const isMatch2 = await bcrypt.compare(
//           password,
//           vet.vetexperts_hashpassword
//         );

//         if (!isMatch2) {
//           return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
//         }

//         return res.json({
//           role: "vet",
//           message: "เข้าสู่ระบบสำเร็จ",
//           user: vet,
//         });
//       }

//       // ไม่พบผู้ใช้
//       return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });
//     });


//       //  Admins 
//       const adminSql =
//         "SELECT * FROM tb_admins WHERE admins_name = ? OR admins_phonenumber = ? OR admins_email = ?";

//       conn.query(
//         adminSql,
//         [loginId, loginId, loginId],
//         async (err3, result3) => {
//           if (err3) return res.status(500).json({ error: err3.message });

//           if (result3.length > 0) {
//             const admin = result3[0];
//             const isMatch3 = await bcrypt.compare(
//               password,
//               admin.admin_password
//             );

//             if (!isMatch3) {
//               return res.status(400).json({ error: "รหัสผ่านไม่ถูกต้อง" });
//             }

//             return res.json({
//               role: "admin",
//               message: "เข้าสู่ระบบสำเร็จ",
//               user: admin,
//             });
//           }

//           // ไม่พบผู้ใช้ในทุก table
//           return res
//             .status(400)
//             .json({ error: "Invalid username or password" });
//         }
//       );
//   });
// });




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
    params.push(
      `%${keyword}%`,
      `%${keyword}%`,
      `%${keyword}%`
    );
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

// router.post("/search", async (req, res) => {
//   const { keyword, province, district, locality } = req.body;

//   let sql = `
//     SELECT 
//       b.bulls_id AS bull_id,
//       b.bulls_name,
//       b.bulls_breed,
//       b.bulls_age,
//       b.bulls_characteristics,
//       b.price_per_dose,
//       b.semen_stock,
//       b.contest_records,
//       f.id AS farm_id,
//       f.name AS farm_name,
//       f.province,
//       f.district,
//       f.locality,
//       f.address,
//       bi.image1
//     FROM tb_bull_sires b
//     JOIN Farms f ON b.farm_id = f.id
//     LEFT JOIN BullImages bi ON b.id = bi.bull_id
//     WHERE 1=1
//   `;
//   let params: any[] = [];

//   // search by keyword
//   if (keyword && keyword.trim() !== "") {
//     sql += " AND (b.Bullname LIKE ? OR f.name LIKE ? OR b.Bullbreed LIKE ?)";
//     params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
//     console.log(" search keyword : ", keyword);
//   } else {
//     console.log(" no search only used filter ");
//   }

//   // filter
//   if (province) {
//     sql += " AND f.province = ?";
//     params.push(province);
//   }

//   if (district) {
//     sql += " AND f.district = ?";
//     params.push(district);
//   }

//   if (locality) {
//     sql += " AND f.locality = ?";
//     params.push(locality);
//   }

//   try {
//     conn.query(sql, params, (err: any, results: any[]) => {
//       if (err) {
//         console.error("Search error:", err);
//         return res.status(500).json({ error: "Database query failed" });
//       }

//       // แปลงผลลัพธ์ให้มี images เป็น array
//       const resultsWithImages = results.map((r) => ({
//         ...r,
//         images: r.image1 ? [r.image1] : [],
//       }));

//       res.json(resultsWithImages);
//     });
//   } catch (error) {
//     res.status(500).json({ error: "Server error" });
//   }
// });



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

    conn.query(
      sql,
      (err: MysqlError | null, rows: RowDataPacket[]) => {
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
