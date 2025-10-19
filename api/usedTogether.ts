import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { BullRow} from "../model/data_post_request";
import { Bull} from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";


export const router = express.Router();


// login for 3 type ****
router.post("/login", async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.status(400).json({ error: "loginId and password are required" });
  }

  // check Farmers
  const farmerSql =
    "SELECT * FROM Farmers WHERE farm_name = ? OR phonenumber = ? OR farmer_email = ?";
  conn.query(farmerSql, [loginId, loginId, loginId], async (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.length > 0) {
      const user = result[0];
      const isMatch = await bcrypt.compare(password, user.farm_password);
      if (isMatch) {
        return res.json({ role: "farmer", message: "Login success", user });
      } else {
        return res.status(400).json({ error: "Not found this Farmer" });
      }
    }

    // check VetExperts
    const vetSql =
      "SELECT * FROM VetExperts WHERE VetExpert_name = ? OR phonenumber = ? OR VetExpert_email = ?";
    conn.query(vetSql, [loginId, loginId, loginId], async (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      if (result2.length > 0) {
        const vet = result2[0];
        const isMatch2 = await bcrypt.compare(password, vet.VetExpert_password);
        if (isMatch2) {
          return res.json({ role: "vet", message: "Login success", user: vet });
        } else {
          return res.status(400).json({ error: "Not found this VetExpert" });
        }
      }

      // check Admins
      const adminSql =
        "SELECT * FROM Admins WHERE admin_name = ? OR phonenumber = ? OR admin_email = ?";
      conn.query(adminSql, [loginId, loginId, loginId], async (err3, result3) => {
        if (err3) return res.status(500).json({ error: err3.message });

        if (result3.length > 0) {
          const admin = result3[0];
          const isMatch3 = await bcrypt.compare(password, admin.admin_password);
          if (isMatch3) {
            return res.json({
              role: "admin",
              message: "Login success",
              user: admin,
            });
          } else {
            return res.status(400).json({ error: "Not found this Admin" });
          }
        }

        // ถ้าไม่เจอในทั้งสาม table
        return res.status(400).json({ error: "Invalid Users" });
      });
    });
  });
});



// Search *****
router.post("/search", async (req, res) => {
  const { keyword, province, district, locality } = req.body;

  let sql = `
    SELECT 
      b.id AS bull_id,
      b.Bullname,
      b.Bullbreed,
      b.Bullage,
      b.characteristics,
      b.price_per_dose,
      b.semen_stock,
      b.contest_records,
      f.id AS farm_id,
      f.name AS farm_name,
      f.province,
      f.district,
      f.locality,
      f.address,
      bi.image1
    FROM BullSires b
    JOIN Farms f ON b.farm_id = f.id
    LEFT JOIN BullImages bi ON b.id = bi.bull_id
    WHERE 1=1
  `;
  let params: any[] = [];
  
  // search by keyword
  if (keyword && keyword.trim() !== "") {
    sql += " AND (b.Bullname LIKE ? OR f.name LIKE ? OR b.Bullbreed LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    console.log(" search keyword : ", keyword);
  } else {
    console.log(" no search only used filter ");
  }

  // filter
  if (province) {
    sql += " AND f.province = ?";
    params.push(province);
  }

  if (district) {
    sql += " AND f.district = ?";
    params.push(district);
  }

  if (locality) {
    sql += " AND f.locality = ?";
    params.push(locality);
  }

  try {
    conn.query(sql, params, (err: any, results: any[]) => {
      if (err) {
        console.error("Search error:", err);
        return res.status(500).json({ error: "Database query failed" });
      }
      
      // แปลงผลลัพธ์ให้มี images เป็น array
      const resultsWithImages = results.map(r => ({
        ...r,
        images: r.image1 ? [r.image1] : [],
      }));

      res.json(resultsWithImages);
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});




// get bull data *****
router.get("/bullData", async (req, res) => {
  try {
    const sql = `
      SELECT 
        b.id AS bull_id,
        b.Bullname,
        b.Bullbreed,
        b.Bullage,
        b.characteristics,
        b.farm_id,
        f.name AS farm_name,
        f.province,
        f.district,
        f.locality,
        f.address,
        b.price_per_dose,
        b.semen_stock,
        b.contest_records,
        b.added_by,
        i.id AS image_id,
        i.image1,
        i.image2,
        i.image3,
        i.image4,
        i.image5
      FROM BullSires b
      JOIN Farms f ON b.farm_id = f.id
      LEFT JOIN BullImages i ON b.id = i.bull_id
    `;

    conn.query(sql, (err, result) => {
      if (err) {
        console.error("Error fetching bulls:", err);
        return res.status(500).json({ error: "Database error" });
      }

      const bullsMap: { [key: number]: Bull} = {};

      (result as BullRow[]).forEach((row: BullRow) => {
        if (!bullsMap[row.bull_id]) {
          bullsMap[row.bull_id] = {
            bull_id: row.bull_id,
            Bullname: row.Bullname,
            Bullbreed: row.Bullbreed,
            Bullage: row.Bullage,
            characteristics: row.characteristics,
            price_per_dose: row.price_per_dose,
            semen_stock: row.semen_stock,
            contest_records: row.contest_records,
            added_by: row.added_by,
            farm: {
              id: row.farm_id,
              name: row.farm_name,
              province: row.province,
              district: row.district,
              locality: row.locality,
              address: row.address,
            },
            images: [],
          };
        }

        if (row.image_id) {
          bullsMap[row.bull_id].images.push({
            id: row.image_id,
            image1: row.image1,
            image2: row.image2,
            image3: row.image3,
            image4: row.image4,
            image5: row.image5,
          });
        }
      });

      res.json(Object.values(bullsMap));
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
