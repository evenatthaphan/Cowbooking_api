import express from "express";
import { VetExpertPostRequest } from "../model/data_post_request"
import { conn, queryAsync } from "../dbconnect";

export const router = express.Router();
//import { initializeApp } from "firebase/app";


//get VetExperts
router.get("/getVetExperts", (req, res) => {
  conn.query("SELECT * FROM VetExperts", (err, result, fields) => {
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


//get where id 
router.get("/getVetExperts/:id", (req, res) => {
  const farmerId = req.params.id; // ดึงค่าที่ส่งมา
  const sql = "SELECT * FROM VetExperts WHERE id = ?"; 

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


//post register
router.post("/register", (req, res) => {
  console.log("req.body:", req.body);

  let VetExperts = req.body;

  if (!VetExperts.VetExpert_name) {
    return res.status(400).json({ error: "VetExpert_name is required", body: VetExperts });
  }
  if (!VetExperts.phonenumber) {
    return res.status(400).json({ error: "phonenumber is required" });
  }

  //ตรวจสอบก่อนว่าเบอร์นี้มีในระบบหรือยัง
  const checkSql = "SELECT * FROM VetExperts WHERE phonenumber = ?";
  conn.query(checkSql, [VetExperts.phonenumber], (err, rows) => {
    if (err) {
      console.error("Error checking phonenumber:", err);
      return res.status(500).json({ error: "Error checking phonenumber" });
    }

    if (rows.length > 0) {
      // ถ้ามีแล้ว
      return res.status(400).json({ error: "Phonenumber already exists" });
    }

    // 2) ถ้าไม่มี -> INSERT ได้
    const sql = `
      INSERT INTO VetExperts 
        (VetExpert_name, VetExpert_password, phonenumber, VetExpert_email, profile_image, VetExpert_address, VetExpert_PL)
      VALUES (?, ?, ?, ?, 'https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg', ?, ?)
    `;

    conn.query(
      sql,
      [
        VetExperts.VetExpert_name,
        VetExperts.VetExpert_password,
        VetExperts.phonenumber,
        VetExperts.VetExpert_email,
        VetExperts.VetExpert_address,
        VetExperts.VetExpert_PL
      ],
      (err, result) => {
        if (err) {
          console.error("Error inserting VetExpert:", err);
          res.status(500).json({ error: "Error inserting VetExpert" });
        } else {
          res.status(201).json({ affected_row: result.affectedRows });
        }
      }
    );
  });
});


//login
router.get("/login", async (req, res) => {
  const username = req.query.username;
  const password = req.query.password;
  const sql = "SELECT * FROM VetExperts WHERE VetExpert_name = ? AND VetExpert_password = ?";
  conn.query(sql, [username, password], (err, result) => {
    res.json(result);
  });
});