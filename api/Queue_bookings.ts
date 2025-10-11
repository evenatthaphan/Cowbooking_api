import express from "express";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";

export const router = express.Router();


// queue_book ****
router.post("/queue/book", async (req, res) => {
  try {
    const {
      farmer_id,
      vet_expert_id,
      bull_id,
      schedule_id,
      detailBull,
    } = req.body;

    // check important fild
    if (!farmer_id || !vet_expert_id || !schedule_id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // check time and day are FREE
    const schedules: any = await queryAsync(
      "SELECT * FROM Vet_schedules WHERE id = ? AND vet_expert_id = ? AND is_booked = false",
      [schedule_id, vet_expert_id]
    );

    if (schedules.length === 0) {
      return res
        .status(400)
        .json({ error: "Selected schedule not available or already booked" });
    }

    // get day and time
    const { available_date, available_time } = schedules[0];

    // 
    const status = "pending";
    const vet_notes = null;
    const created_at = new Date();
    const updated_at = new Date();

    // insert queue
    const sqlInsert = `
      INSERT INTO Queue_bookings
      (farmer_id, vet_expert_id, bull_id, schedule_id, detailBull, status, vet_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result: any = await queryAsync(sqlInsert, [
      farmer_id,
      vet_expert_id,
      bull_id || null,
      schedule_id,
      detailBull || null,
      status,
      vet_notes,
      created_at,
      updated_at,
    ]);

    // update status vet_schedules that is_booked = true
    await queryAsync("UPDATE Vet_schedules SET is_booked = true WHERE id = ?", [
      schedule_id,
    ]);

    // send back to response
    return res.status(201).json({
      message: "Booking created successfully",
      booking_id: result.insertId,
      schedule: { available_date, available_time },
    });
  } catch (err: any) {
    console.error("Error inserting booking:", err.sqlMessage || err.message || err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.sqlMessage || err.message,
    });
  }
});




// select all data booking
router.get("/bookings", async (req, res) => {
  try {
    const sql = `
      SELECT 
        b.id,
        b.farmer_id,
        b.vet_expert_id,
        b.bull_id,
        b.schedule_id,
        b.detailBull,
        b.status,
        b.vet_notes,
        b.created_at,
        b.updated_at,
        f.name AS farmer_name,
        v.name AS vet_name
      FROM booking b
      LEFT JOIN farmers f ON b.farmer_id = f.id
      LEFT JOIN vet_experts v ON b.vet_expert_id = v.id
      ORDER BY b.created_at DESC
    `;

    const results = await queryAsync(sql);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// select only farmer data booking
router.get("/bookings/farmer", async (req, res) => {
  try {
    const { farmer_id, vet_expert_id } = req.query;

    let sql = `
      SELECT 
        b.id,
        b.farmer_id,
        b.vet_expert_id,
        b.bull_id,
        b.schedule_id,
        b.detailBull,
        b.status,
        b.vet_notes,
        b.created_at,
        b.updated_at,
        f.name AS farmer_name,
        v.name AS vet_name
      FROM booking b
      LEFT JOIN farmers f ON b.farmer_id = f.id
      LEFT JOIN vet_experts v ON b.vet_expert_id = v.id
    `;

    const params = [];
    if (farmer_id) {
      sql += " WHERE b.farmer_id = ?";
      params.push(farmer_id);
    } else if (vet_expert_id) {
      sql += " WHERE b.vet_expert_id = ?";
      params.push(vet_expert_id);
    }

    sql += " ORDER BY b.created_at DESC";

    const results = await queryAsync(sql, params);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
