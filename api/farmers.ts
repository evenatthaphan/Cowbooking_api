import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";

export const router = express.Router();

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

//get farmer
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


//get where id 
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


//post register
router.post("/register", (req, res) => {
  console.log("req.body:", req.body);

  let Farmer = req.body;

  if (!Farmer.farm_name) {
    return res.status(400).json({ error: "farm_name is required", body: Farmer });
  }
  if (!Farmer.phonenumber) {
    return res.status(400).json({ error: "phonenumber is required" });
  }

  //ตรวจสอบก่อนว่าเบอร์นี้มีในระบบหรือยัง
  const checkSql = "SELECT * FROM Farmers WHERE phonenumber = ?";
  conn.query(checkSql, [Farmer.phonenumber], (err, rows) => {
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
      INSERT INTO Farmers 
        (farm_name, farm_password, phonenumber, farmer_email, profile_image, farm_address)
      VALUES (?, ?, ?, ?, 'https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg', ?)
    `;

    conn.query(
      sql,
      [
        Farmer.farm_name,
        Farmer.farm_password,
        Farmer.phonenumber,
        Farmer.farmer_email,
        Farmer.farm_address,
      ],
      (err, result) => {
        if (err) {
          console.error("Error inserting Farmer:", err);
          res.status(500).json({ error: "Error inserting Farmer" });
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
  const sql = "SELECT * FROM Farmers WHERE farm_name = ? AND farm_password = ?";
  conn.query(sql, [username, password], (err, result) => {
    res.json(result);
  });
});



//edit profile
router.put("/edit:id", async (req, res) => {
  //Receive data from request
  const id = +req.params.id;
  let farmer: FarmerPostRequest = req.body;

  //Query original data by id
  let farmerOriginal: FarmerPostRequest | undefined;
  let sql = mysql.format("select * from Farmers where id =? ", [id]);
  let result = await queryAsync(sql);
  const jsonStr = JSON.stringify(result);
  const jsonObj = JSON.parse(jsonStr);
  const rawData = jsonObj;
  farmerOriginal = rawData[0];

  //Merge received object to original
  const updataFarmer = { ...farmerOriginal, ...farmer };

  //update data in tabel
  sql =
    "update  `Farmers` set `farm_name`=?,`phonenumber`=?, `farmer_email`=?, `profile_image`=?, `farm_address`=? where `id`=?";
  sql = mysql.format(sql, [
    updataFarmer.farm_name,
    updataFarmer.phonenumber,
    updataFarmer.farmer_email,
    updataFarmer.farmer_email,
    updataFarmer.profile_image,
    id,
  ]);
  conn.query(sql, (err, result) => {
    if (err) throw err;
    res.status(200).json({ affected_row: result.affectedRows });
  });
});


// change password
router.put("/changepass/:id", async (req, res) => {
  const id = +req.params.id;
  const { old_password, new_password } = req.body;

  // ตรวจสอบว่ามีการส่งรหัสผ่านมาครบ
  if (!old_password || !new_password) {
    return res.status(400).json({ error: "old_password and new_password are required" });
  }

  try {
    let sql = mysql.format("SELECT * FROM Farmers WHERE id = ?", [id]);
    let result = await queryAsync(sql) as FarmerPostRequest[];

    if (!result || result.length === 0) {
      return res.status(404).json({ error: "Farmer not found" });
    }

    const farmerOriginal = result[0];

    // เช็ครหัสผ่านเดิม
    if (farmerOriginal.farm_password !== old_password) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    // อัปเดตรหัสผ่านใหม่
    const updateSql = "UPDATE Farmers SET farm_password = ? WHERE id = ?";
    conn.query(updateSql, [new_password, id], (err, updateResult) => {
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




