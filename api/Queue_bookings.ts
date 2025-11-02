import express from "express";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import { BookingResult } from "../model/data_post_request";

export const router = express.Router();

// queue_book ****
router.post("/queue/book", async (req, res) => {
  try {
    const { farmer_id, vet_expert_id, bull_id, dose, schedule_id, detailBull } =
      req.body;

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
      (farmer_id, vet_expert_id, bull_id, schedule_id, dose, detailBull, status, vet_notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result: any = await queryAsync(sqlInsert, [
      farmer_id,
      vet_expert_id,
      bull_id || null,
      schedule_id,
      dose || null,
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
    console.error(
      "Error inserting booking:",
      err.sqlMessage || err.message || err
    );
    return res.status(500).json({
      error: "Internal server error",
      details: err.sqlMessage || err.message,
    });
  }
});

// select all data booking ***
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
        f.farm_name AS farmer_name,
        v.VetExpert_name AS vet_name
      FROM Queue_bookings b
      LEFT JOIN Farmers f ON b.farmer_id = f.id
      LEFT JOIN VetExperts v ON b.vet_expert_id = v.id
      ORDER BY b.created_at DESC
    `;

    const results = await queryAsync(sql);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// select only farmer data booking ***
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
        f.farm_name AS farmer_name,
        v.VetExpert_name AS vet_name
      FROM Queue_bookings b
      LEFT JOIN Farmers f ON b.farmer_id = f.id
      LEFT JOIN VetExperts v ON b.vet_expert_id = v.id
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

// get all booking for vetexpert ***
router.get("/bookings/vet/:vet_expert_id", async (req, res) => {
  try {
    const { vet_expert_id } = req.params;

    const sql = `
      SELECT 
        b.id AS booking_id,
        b.farmer_id,
        f.farm_name AS farmer_name,
        b.vet_expert_id,
        v.VetExpert_name AS vet_name,
        b.bull_id AS vet_bull_id,
        bs.Bullname AS bullname,
        bs.Bullbreed AS bullbreed,
        b.dose AS dose,
        s.available_date AS schedule_date,
        s.available_time AS schedule_time,
        b.detailBull,
        b.status,
        b.vet_notes,
        b.created_at
      FROM Queue_bookings b
      LEFT JOIN Farmers f ON b.farmer_id = f.id
      LEFT JOIN VetExperts v ON b.vet_expert_id = v.id
      LEFT JOIN Vet_schedules s ON b.schedule_id = s.id
      LEFT JOIN Vet_Bulls vb ON b.bull_id = vb.id
      LEFT JOIN BullSires bs ON vb.bull_id = bs.id
      WHERE b.vet_expert_id = ?
      ORDER BY b.created_at DESC
    `;

    const results = await queryAsync(sql, [vet_expert_id]);
    return res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching vet bookings:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});



// vetexpert update status booking ****
router.put("/bookings/update/:booking_id", async (req, res) => {
  try {
    const { booking_id } = req.params;
    const { status, vet_notes } = req.body;

    // check status
    if (!status || !["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    // use query and send vet_notes
    const statusLower = (status as string).toLowerCase();

    if (!["accepted", "rejected"].includes(statusLower)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const sql = `
  UPDATE Queue_bookings
  SET status = ?, vet_notes = ?, updated_at = NOW()
  WHERE id = ?
`;

    const result = await queryAsync(sql, [
      statusLower,
      vet_notes || null,
      booking_id,
    ]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res
      .status(200)
      .json({ message: "Booking status and notes updated successfully" });
  } catch (err: any) {
    console.error(
      "Error updating booking:",
      err.sqlMessage || err.message || err
    );
    return res.status(500).json({
      error: "Internal server error",
      details: err.sqlMessage || err.message,
    });
  }
});



// cancel booking ***
router.delete("/queue/cancel/:booking_id", async (req, res) => {
  try {
    const { booking_id } = req.params;

    if (!booking_id) {
      return res.status(400).json({ error: "Missing booking_id" });
    }

    // check booking is existed
    const booking: any = await queryAsync(
      "SELECT schedule_id FROM Queue_bookings WHERE id = ?",
      [booking_id]
    );

    if (booking.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const schedule_id = booking[0].schedule_id;

    // deleted booking
    await queryAsync("DELETE FROM Queue_bookings WHERE id = ?", [booking_id]);

    // update status schedule 
    await queryAsync("UPDATE Vet_schedules SET is_booked = false WHERE id = ?", [
      schedule_id,
    ]);

    return res.status(200).json({ message: "Booking cancelled successfully" });
  } catch (err: any) {
    console.error("Error cancelling booking:", err.sqlMessage || err.message || err);
    return res.status(500).json({
      error: "Internal server error",
      details: err.sqlMessage || err.message,
    });
  }
});
