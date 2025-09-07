import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";


export const router = express.Router();


// login for 2 type ****
router.post("/login", async (req, res) => {
  const { loginId, password } = req.body;

  if (!loginId || !password) {
    return res.status(400).json({ error: "loginId and password are required" });
  }

  // check Farmers
  const farmerSql = "SELECT * FROM Farmers WHERE farm_name = ? OR phonenumber = ? OR farmer_email = ?";
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
    const vetSql = "SELECT * FROM VetExperts WHERE VetExpert_name = ? OR phonenumber = ? OR VetExpert_email = ?";
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

      // ถ้าไม่เจอในทั้งสอง table
      return res.status(400).json({ error: "Invalid Users" });
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
      f.address
    FROM BullSires b
    JOIN Farms f ON b.farm_id = f.id
    WHERE 1=1
  `;
  let params = [];

  if (keyword) {
    sql += " AND (b.Bullname LIKE ? OR f.name LIKE ? OR b.Bullbreed LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

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
    conn.query(sql, params, (err, results) => {
      if (err) {
        console.error("Search error:", err);
        return res.status(500).json({ error: "Database query failed" });
      }
      res.json(results);
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

