import express from "express";
import { BullRow} from "../model/data_post_request";
import { Bull} from "../model/data_post_request";
import { Bull_VET} from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";


export const router = express.Router();


// get bull by Bullbreed
router.get("/getbull", (req, res) => {
  const sql = `
    SELECT
      b.bulls_id AS bull_id,
      b.bulls_name,
      b.bulls_breed,
      b.bulls_age,
      b.bulls_characteristics,
      b.bulls_contest_records,

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
    LEFT JOIN tb_bulls_img i ON i.ref_bulls_id = b.bulls_id
    ORDER BY b.bulls_breed, b.bulls_name
  `;

  conn.query(sql, (err: any, rows: any[]) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No bulls found" });
    }

    // group by breed
    const groupedByBreed: Record<string, any[]> = {};

    rows.forEach((row) => {
      const breed = row.bulls_breed || "ไม่ระบุสายพันธุ์";
      if (!groupedByBreed[breed]) groupedByBreed[breed] = [];

      const images = [
        row.bulls_image1,
        row.bulls_image2,
        row.bulls_image3,
        row.bulls_image4,
        row.bulls_image5,
      ].filter(Boolean);

      groupedByBreed[breed].push({
        bull_id: row.bull_id,
        bulls_name: row.bulls_name,
        bulls_breed: row.bulls_breed,
        bulls_age: row.bulls_age,
        bulls_characteristics: row.bulls_characteristics,
        contest_records: row.bulls_contest_records,

        farm: {
          farm_id: row.farm_id,
          farm_name: row.farm_name,
          province: row.frams_province,
          district: row.frams_district,
          locality: row.frams_locality,
          address: row.frams_address,
        },

        images,
      });
    });

    res.json(groupedByBreed);
  });
});

// router.get("/getbull", (req, res) => {
//   const sql = `
//     SELECT 
//       bs.id,
//       bs.Bullname,
//       bs.Bullbreed,
//       bs.Bullage,
//       bs.characteristics,
//       bs.farm_id,
//       bs.contest_records,
//       f.name AS farm_name,
//       f.province,
//       f.district,
//       f.locality,
//       f.address,
//       bi.image1,
//       bi.image2,
//       bi.image3,
//       bi.image4,
//       bi.image5
//     FROM BullSires bs
//     JOIN Farms f ON bs.farm_id = f.id
//     LEFT JOIN BullImages bi ON bi.bull_id = bs.id
//     ORDER BY bs.Bullbreed, bs.Bullname
//   `;

//   conn.query(sql, (err: any, result: any[]) => {
//     if (err) {
//       console.error("DB Query Error:", err);
//       return res.status(500).json({ message: "Internal Server Error" });
//     }

//     if (!result || result.length === 0) {
//       return res.status(404).json({ message: "No bulls found" });
//     }

//     // columm to array
//     const groupedByBreed: Record<string, any[]> = {};

//     result.forEach((bull) => {
//       const breed = bull.Bullbreed || "Unknown Breed";
//       if (!groupedByBreed[breed]) groupedByBreed[breed] = [];

//       // array image
//       bull.images = [bull.image1, bull.image2, bull.image3, bull.image4, bull.image5]
//         .filter((url) => url); // url 

//       groupedByBreed[breed].push(bull);
//     });

//     res.json(groupedByBreed);
//   });
// });



router.get("/getby_vetid/:vet_id", (req, res) => {
  const { vet_id } = req.params;

  const sql = `
    SELECT
      b.bulls_id AS bull_id,
      b.bulls_name,
      b.bulls_breed,
      b.bulls_characteristics,
      b.bulls_contest_records,

      vb.vet_bulls_id,
      vb.bulls_price_per_dose,
      vb.bulls_semen_stock,

      f.frams_id AS farm_id,
      f.frams_name AS farm_name,

      i.bulls_image1,
      i.bulls_image2,
      i.bulls_image3,
      i.bulls_image4,
      i.bulls_image5

    FROM tb_vet_bulls vb
    JOIN tb_bull_sires b ON vb.ref_bulls_id = b.bulls_id
    JOIN tb_farms f ON b.ref_farm_id = f.frams_id
    LEFT JOIN tb_bulls_img i ON b.bulls_id = i.ref_bulls_id
    WHERE vb.ref_vetexperts_id = ?
    ORDER BY b.bulls_breed, b.bulls_name
  `;

  conn.query(sql, [vet_id], (err: any, rows: any[]) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "No bulls found for this vet" });
    }

    // group by breed
    const groupedByBreed: Record<string, any[]> = {};

    rows.forEach((row) => {
      const breed = row.bulls_breed || "ไม่ระบุสายพันธุ์";
      if (!groupedByBreed[breed]) groupedByBreed[breed] = [];

      const images = [
        row.bulls_image1,
        row.bulls_image2,
        row.bulls_image3,
        row.bulls_image4,
        row.bulls_image5,
      ].filter(Boolean);

      groupedByBreed[breed].push({
        bull_id: row.bull_id,
        bulls_name: row.bulls_name,
        bulls_breed: row.bulls_breed,
        bulls_characteristics: row.bulls_characteristics,

        vet_bull_id: row.vet_bulls_id,
        price_per_dose: row.bulls_price_per_dose,
        semen_stock: row.bulls_semen_stock,
        contest_records: row.bulls_contest_records,

        farm: {
          farm_id: row.farm_id,
          farm_name: row.farm_name,
        },

        images,
      });
    });

    res.json(groupedByBreed);
  });
});



// router.get("/getby_vetid/:vet_id", (req, res) => {
//   const { vet_id } = req.params;

//   const sql = `
//     SELECT 
//       bs.id AS bullseries_id,
//       bs.Bullname,
//       bs.Bullbreed,
//       bs.characteristics,
//       f.id AS farm_id,
//       f.name AS farm_name,
//       vb.id as vet_bull_id,
//       vb.price_per_dose,
//       vb.semen_stock
//     FROM Vet_Bulls vb
//     JOIN BullSires bs ON vb.bull_id = bs.id
//     JOIN Farms f ON bs.farm_id = f.id
//     WHERE vb.vet_expert_id = ?
//     ORDER BY bs.Bullbreed, bs.Bullname
//   `;

//   conn.query(sql, [vet_id], (err, result: Bull_VET[]) => {
//     if (err) {
//       console.error("DB Query Error:", err);
//       return res.status(500).json({ message: "Internal Server Error" });
//     }

//     if (!result || result.length === 0) {
//       return res.status(404).json({ message: "No bulls found for this vet" });
//     }

//     // จัดกลุ่มตามสายพันธุ์
//     const groupedByBreed: Record<string, Bull_VET[]> = {};

//     result.forEach((bull: Bull_VET) => {
//       const breed = bull.Bullbreed || "Unknown Breed";
//       if (!groupedByBreed[breed]) groupedByBreed[breed] = [];
//       groupedByBreed[breed].push(bull);
//     });

//     res.json(groupedByBreed);
//   });
// });





