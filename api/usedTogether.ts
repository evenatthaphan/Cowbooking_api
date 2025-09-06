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
