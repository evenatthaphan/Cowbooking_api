import express from "express";
import { FarmerPostRequest } from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";

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
  conn.query('SELECT * FROM Farmers', (err, result, fields) => {
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


//post register
router.post("/register", (req, res) => {
  let Farmer: FarmerPostRequest = req.body;
  const sql =
    "INSERT INTO Farmers (farm_name, farm_password , phonenumber, farmer_email, profile_image, farm_address) VALUES (?, ? , ?,'https://i.pinimg.com/564x/a8/0e/36/a80e3690318c08114011145fdcfa3ddb.jpg',?)";
  conn.query(sql, [Farmer.farm_name, Farmer.farm_password, Farmer.phonenumber,Farmer.farmer_email, Farmer.farm_address], (err, result) => {
    if (err) {
      console.error("Error inserting user:", err);
      res.status(500).json({ error: "Error inserting user" });
    } else {
      res.status(201).json({ affected_row: result.affectedRows });
    }
  });
});
