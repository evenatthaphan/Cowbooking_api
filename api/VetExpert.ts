import express from "express";
import { VetExpertPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import { error } from "console";
import bcrypt from "bcrypt";

// import multer from "multer";
// import { VetSchedulesPostRequest } from "../model/data_post_request";

// //เชื่อม firebase
// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// // import { getAnalytics } from "firebase/analytics";
// import { getStorage, ref,uploadBytesResumable,getDownloadURL} from "firebase/storage";

// const firebaseConfig = {
//   apiKey: "AIzaSyCNAXKjHaISwfyPpPR9MIV3ebxchs2Pgxo",
//   authDomain: "anime-mash---app---eve.firebaseapp.com",
//   projectId: "anime-mash---app---eve",
//   storageBucket: "anime-mash---app---eve.appspot.com",
//   messagingSenderId: "61740520109",
//   appId: "1:61740520109:web:c841c429bd225ec814ac24",
//   measurementId: "G-RG8GHMN3G5"
// };

// Initialize Firebase
// initializeApp(firebaseConfig);
// const storage = getStorage();



export const router = express.Router();
//import { initializeApp } from "firebase/app";

//test get VetExperts (db connect)
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

// getVetExperts where id
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

// post register *****
router.post("/register", async (req, res) => {
  console.log("req.body:", req.body);

  let VetExperts = req.body;

  if (!VetExperts.VetExpert_name) {
    return res
      .status(400)
      .json({ error: "VetExpert_name is required", body: VetExperts });
  }
  if (!VetExperts.phonenumber) {
    return res.status(400).json({ error: "phonenumber is required" });
  }
  if (!VetExperts.VetExpert_password) {
    return res.status(400).json({ error: "VetExpert_password is required" });
  }
  if (!VetExperts.province || !VetExperts.district || !VetExperts.locality) {
    return res.status(400).json({ error: "province, district and locality are required" });
  }

  //ตรวจสอบก่อนว่าเบอร์นี้มีในระบบหรือยัง
  const checkSql =
    "SELECT * FROM VetExperts WHERE phonenumber = ? OR VetExpert_email = ?";
  conn.query(
    checkSql,
    [VetExperts.phonenumber, VetExperts.VetExpert_email],
    async (err, rows) => {
      if (err) {
        console.error("Error checking phonenumber and email:", err);
        return res
          .status(500)
          .json({ error: "Error checking phonenumber amd email" });
      }

      if (rows.length > 0) {
        // ถ้ามีแล้ว
        const existing = rows[0];
        if (existing.phonenumber === VetExperts.phonenumber) {
          return res.status(400).json({ error: "Phonenumber already exists" });
        }
        if (existing.VetExpert_email === VetExperts.VetExpert_email) {
          return res.status(400).json({ error: "Email already exists" });
        }
      }

      try {
        //
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(
          VetExperts.VetExpert_password,
          saltRounds
        );

        // 2) ถ้าไม่มี -> INSERT ได้
        const sql = `
      INSERT INTO VetExperts 
        (VetExpert_name, VetExpert_password, phonenumber, VetExpert_email, profile_image, province, district, locality, VetExpert_address, VetExpert_PL)
      VALUES (?, ?, ?, ?, 'https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg',?, ?, ?, ?, ?)
    `;

        conn.query(
          sql,
          [
            VetExperts.VetExpert_name,
            hashedPassword,
            VetExperts.phonenumber,
            VetExperts.VetExpert_email,
            VetExperts.province,
            VetExperts.district,
            VetExperts.locality,
            VetExperts.VetExpert_address,
            VetExperts.VetExpert_PL,
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
      } catch (hashErr) {
        console.error("Error hashing password:", hashErr);
        return res.status(500).json({ error: "Error hashing password" });
      }
    }
  );
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
  const checking = "SELECT * FROM Farms WHERE address = ?";
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
      INSERT INTO Farms (name, province, district, locality, address)
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
// router.post("/vet/schedule", async (req, res) => {
//   try {
//     const { vet_expert_id, available_date, available_time } = req.body;

//     if (!vet_expert_id || !available_date || !available_time) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const sql = `
//       INSERT INTO vet_schedules (vet_expert_id, available_date, available_time)
//       VALUES (?, ?, ?)
//     `;
//     const [result]: any = await queryAsync(sql, [
//       vet_expert_id,
//       available_date,
//       available_time,
//     ]);

//     return res.status(201).json({
//       message: "Schedule added",
//       schedule_id: result.insertId,
//     });
//   } catch (err) {
//     console.error("Error adding schedule:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });



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
