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
      bs.id,
      bs.Bullname,
      bs.Bullbreed,
      bs.Bullage,
      bs.characteristics,
      bs.farm_id,
      bs.contest_records,
      f.name AS farm_name,
      f.province,
      f.district,
      f.locality,
      f.address,
      bi.image1,
      bi.image2,
      bi.image3,
      bi.image4,
      bi.image5
    FROM BullSires bs
    JOIN Farms f ON bs.farm_id = f.id
    LEFT JOIN BullImages bi ON bi.bull_id = bs.id
    ORDER BY bs.Bullbreed, bs.Bullname
  `;

  conn.query(sql, (err: any, result: any[]) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No bulls found" });
    }

    // columm to array
    const groupedByBreed: Record<string, any[]> = {};

    result.forEach((bull) => {
      const breed = bull.Bullbreed || "Unknown Breed";
      if (!groupedByBreed[breed]) groupedByBreed[breed] = [];

      // array image
      bull.images = [bull.image1, bull.image2, bull.image3, bull.image4, bull.image5]
        .filter((url) => url); // url 

      groupedByBreed[breed].push(bull);
    });

    res.json(groupedByBreed);
  });
});


router.get("/getby_vetid/:vet_id", (req, res) => {
  const { vet_id } = req.params;

  const sql = `
    SELECT 
      bs.id AS bullseries_id,
      bs.Bullname,
      bs.Bullbreed,
      bs.characteristics,
      f.id AS farm_id,
      f.name AS farm_name,
      vb.price_per_dose,
      vb.semen_stock,
      vb.id as bullvet_id
    FROM Vet_Bulls vb
    JOIN BullSires bs ON vb.bull_id = bs.id
    JOIN Farms f ON bs.farm_id = f.id
    WHERE vb.vet_expert_id = ?
    ORDER BY bs.Bullbreed, bs.Bullname
  `;

  conn.query(sql, [vet_id], (err, result: Bull_VET[]) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }

    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No bulls found for this vet" });
    }

    // จัดกลุ่มตามสายพันธุ์
    const groupedByBreed: Record<string, Bull_VET[]> = {};

    result.forEach((bull: Bull_VET) => {
      const breed = bull.Bullbreed || "Unknown Breed";
      if (!groupedByBreed[breed]) groupedByBreed[breed] = [];
      groupedByBreed[breed].push(bull);
    });

    res.json(groupedByBreed);
  });
});





