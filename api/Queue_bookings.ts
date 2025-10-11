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
    await queryAsync("UPDATE vet_schedules SET is_booked = true WHERE id = ?", [
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
