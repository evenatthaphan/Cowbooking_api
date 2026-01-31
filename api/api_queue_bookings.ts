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
      "SELECT * FROM tb_vet_schedules WHERE schedules_id = ? AND ref_vetexperts_id = ? AND schedules_is_booked = false",
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
      INSERT INTO tb_queue_bookings
      ( ref_farmers_id, ref_vetexperts_id, ref_bulls_id, schedules_id, dose, detailBull, status, vet_notes, created_at, updated_at)
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
        b.queue_bookings_id,
        b.ref_farmers_id,
        b.ref_vetexperts_id,
        b.ref_bulls_i,
        b.ref_schedules_id,
        b.bookings_detail_bull,
        b.bookings_status,
        b.bookings_vet_notes,
        b.created_at,
        b.updated_at,
        f.farmers_name AS farmers_name,
        v.vetexperts_name AS vetexperts_name
      FROM tb_queue_bookings b
      LEFT JOIN tb_farmers f ON b.ref_farmers_id = f.farmers_id
      LEFT JOIN tb_vetexperts v ON b.ref_vetexperts_id = v.vetexperts_id
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
        b.queue_bookings_id,
        b.ref_farmers_id,
        b.ref_vetexperts_id,
        b.ref_bulls_id,
        b.ref_schedules_id,
        b.bookings_detail_bull,
        b.bookings_status,
        b.bookings_vet_notes,
        b.created_at,
        b.updated_at,
        f.farmers_name AS farmers_name,
        v.vetexperts_name AS vetexperts_name
      FROM tb_queue_bookings b
      LEFT JOIN tb_farmers f ON b.ref_farmers_id = f. farmers_id
      LEFT JOIN tb_vetexperts v ON b.ref_vetexperts_id = v.vetexperts_id
    `;

    const params = [];
    if (farmer_id) {
      sql += " WHERE b.ref_farmers_id = ?";
      params.push(farmer_id);
    } else if (vet_expert_id) {
      sql += " WHERE b.ref_vetexperts_id = ?";
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
        b.queue_bookings_id AS queue_bookings_id,
        b.ref_farmers_id,
        f.farmers_name AS farmers_name,
        b.ref_vetexperts_id,
        v.vetexperts_name AS vetexperts_name,
        b.ref_bulls_id AS ref_bulls_id,
        bs.bulls_name AS bulls_name,
        bs.bulls_breed AS bulls_breed,
        b.bookings_dose AS bookings_dose,
        s.schedules_available_date AS schedule_date,
        s.schedules_available_time AS schedule_time,
        b.bookings_detail_bull,
        b.bookings_status,
        b.bookings_vet_notes,
        b.created_at
      FROM tb_queue_bookings b
      LEFT JOIN tb_farmers f ON b.ref_farmers_id = f.farmers_id
      LEFT JOIN tb_vetexperts v ON b.ref_vetexperts_id = v.vetexperts_id
      LEFT JOIN tb_vet_schedules s ON b. ref_schedules_id = s.schedules_id
      LEFT JOIN tb_vet_bulls vb ON b.ref_bulls_id = vb.vet_bulls_id
      LEFT JOIN tb_bull_sires bs ON vb.ref_bulls_id = bs.bulls_id
      WHERE b.ref_vetexperts_id = ?
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
  UPDATE tb_queue_bookings
  SET bookings_status = ?, bookings_vet_notes = ?, updated_at = NOW()
  WHERE queue_bookings_id = ?
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
      "SELECT ref_schedules_id FROM tb_queue_bookings WHERE queue_bookings_id = ?",
      [booking_id]
    );

    if (booking.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const schedule_id = booking[0].schedule_id;

    // deleted booking
    await queryAsync("DELETE FROM tb_queue_bookings WHERE queue_bookings_id = ?", [booking_id]);

    // update status schedule 
    await queryAsync("UPDATE tb_vet_schedules SET schedules_is_booked = false WHERE schedules_id = ?", [
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
