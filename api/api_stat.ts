import express,{ Router, Request, Response } from "express";
import { conn, queryAsync } from "../dbconnect";

export const router = express.Router();

// POST record
router.post("/record", async (req: Request, res: Response) => {
  const { booking_id, is_success, note } = req.body;

  // validation
  if (!booking_id)          return res.status(400).json({ error: "booking_id is required" });
  if (is_success === undefined) return res.status(400).json({ error: "is_success is required" });

  // ดึงข้อมูลจาก tb_queue_bookings
  const getBookingSql = `
    SELECT 
      queue_bookings_id,
      ref_farmers_id,
      ref_vetexperts_id,
      ref_bulls_id,
      bookings_status
    FROM tb_queue_bookings 
    WHERE queue_bookings_id = ?
  `;

  conn.query(getBookingSql, [booking_id], (err, rows: any) => {
    if (err)             return res.status(500).json({ error: "Error fetching booking" });
    if (rows.length === 0) return res.status(404).json({ error: "ไม่พบข้อมูล booking นี้" });

    const booking = rows[0];

    // เช็คว่า status ต้อง accepted ถึงจะบันทึกผลได้
    if (booking.bookings_status !== "accepted") {
      return res.status(400).json({ error: "booking นี้ยังไม่ได้รับการยืนยัน" });
    }

    // เช็คว่าบันทึกผลไปแล้วหรือยัง
    const checkSql = `SELECT record_id FROM tb_insemination_records WHERE ref_booking_id = ?`;

    conn.query(checkSql, [booking_id], (err, rows: any) => {
      if (err)           return res.status(500).json({ error: "Error checking record" });
      if (rows.length > 0) return res.status(400).json({ error: "บันทึกผลการผสมนี้ไปแล้ว" });

      const insertSql = `
        INSERT INTO tb_insemination_records 
          (ref_booking_id, ref_vetexpert_id, ref_bull_sire_id, ref_farmer_id, is_success, inseminated_at, confirmed_at, note)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)
      `;

      conn.query(
        insertSql,
        [
          booking_id,
          booking.ref_vetexperts_id,  // ดึงจาก booking เลย
          booking.ref_bulls_id,        // ดึงจาก booking เลย
          booking.ref_farmers_id,      // ดึงจาก booking เลย
          is_success ? 1 : 0,
          note || null,
        ],
        (err, result: any) => {
          if (err) {
            console.error("Error inserting record:", err);
            return res.status(500).json({ error: "Error inserting record" });
          }
          return res.status(201).json({
            message: "บันทึกผลการผสมสำเร็จ",
            record_id: result.insertId,
          });
        }
      );
    });
  });
});

// GET stats/overview
// ดึงสถิติรวมสำหรับ Dashboard
router.get("/stats/overview", (req: Request, res: Response) => {
  const sql = `
    SELECT 
      COUNT(*)                                          AS total,
      SUM(is_success)                                   AS success,
      COUNT(*) - SUM(is_success)                        AS failed,
      ROUND(SUM(is_success) / COUNT(*) * 100, 2)        AS success_rate
    FROM tb_insemination_records
  `;

  conn.query(sql, (err, rows: any) => {
    if (err) {
      console.error("Error fetching overview stats:", err);
      return res.status(500).json({ error: "Error fetching overview stats" });
    }
    return res.status(200).json(rows[0]);
  });
});


// GET /stats/by-vet
// ดึงสถิติแยกตามหมอ
router.get("/stats/by-vet", (req: Request, res: Response) => {
  const sql = `
    SELECT 
      v.vetexperts_id,
      v.vetexperts_name,
      COUNT(*)                                          AS total,
      SUM(r.is_success)                                 AS success,
      COUNT(*) - SUM(r.is_success)                      AS failed,
      ROUND(SUM(r.is_success) / COUNT(*) * 100, 2)      AS success_rate
    FROM tb_insemination_records r
    JOIN tb_vetexperts v ON r.ref_vetexpert_id = v.vetexperts_id
    GROUP BY r.ref_vetexpert_id
    ORDER BY success_rate DESC
  `;

  conn.query(sql, (err, rows: any) => {
    if (err) {
      console.error("Error fetching stats by vet:", err);
      return res.status(500).json({ error: "Error fetching stats by vet" });
    }
    return res.status(200).json(rows);
  });
});


// GET /stats/by-bull
// ดึงสถิติแยกตามน้ำเชื้อวัว
router.get("/stats/by-bull", (req: Request, res: Response) => {
  const sql = `
    SELECT 
      b.bulls_id,
      b.bulls_name,
      COUNT(*)                                          AS total,
      SUM(r.is_success)                                 AS success,
      COUNT(*) - SUM(r.is_success)                      AS failed,
      ROUND(SUM(r.is_success) / COUNT(*) * 100, 2)      AS success_rate
    FROM tb_insemination_records r
    JOIN tb_bull_sires b ON r.ref_bull_sire_id = b.bulls_id
    GROUP BY r.ref_bull_sire_id
    ORDER BY success_rate DESC
  `;

  conn.query(sql, (err, rows: any) => {
    if (err) {
      console.error("Error fetching stats by bull:", err);
      return res.status(500).json({ error: "Error fetching stats by bull" });
    }
    return res.status(200).json(rows);
  });
});


// GET /insemination/stats/my-overview/:farmer_id
// สถิติรวมเฉพาะของเกษตรกรคนนั้น
router.get("/insemination/stats/my-overview/:farmer_id", (req: Request, res: Response) => {
  const { farmer_id } = req.params;

  const sql = `
    SELECT 
      COUNT(*)                                        AS total,
      SUM(is_success)                                 AS success,
      COUNT(*) - SUM(is_success)                      AS failed,
      ROUND(SUM(is_success) / COUNT(*) * 100, 2)      AS success_rate
    FROM tb_insemination_records
    WHERE ref_farmer_id = ?
  `;

  conn.query(sql, [farmer_id], (err, rows: any) => {
    if (err) {
      console.error("Error fetching my overview:", err);
      return res.status(500).json({ error: "Error fetching my overview" });
    }
    return res.status(200).json(rows[0]);
  });
});


// GET /insemination/stats/my-by-vet/:farmer_id
// สถิติแยกตามหมอ เฉพาะของเกษตรกรคนนั้น
router.get("/insemination/my-by-vet/:farmer_id", (req: Request, res: Response) => {
  const { farmer_id } = req.params;

  const sql = `
    SELECT 
      v.vetexpert_id,
      v.vetexperts_name AS vetexpert_name,
      COUNT(*)                                        AS total,
      SUM(r.is_success)                               AS success,
      COUNT(*) - SUM(r.is_success)                    AS failed,
      ROUND(SUM(r.is_success) / COUNT(*) * 100, 2)    AS success_rate
    FROM tb_insemination_records r
    JOIN tb_vetexperts v ON r.ref_vetexpert_id = v.vetexpert_id
    WHERE r.ref_farmer_id = ?
    GROUP BY r.ref_vetexpert_id
    ORDER BY success_rate DESC
  `;

  conn.query(sql, [farmer_id], (err, rows: any) => {
    if (err) {
      console.error("Error fetching my stats by vet:", err);
      return res.status(500).json({ error: "Error fetching my stats by vet" });
    }
    return res.status(200).json(rows);
  });
});


// GET /insemination/stats/my-by-bull/:farmer_id
// สถิติแยกตามน้ำเชื้อวัว เฉพาะของเกษตรกรคนนั้น
router.get("/insemination/my-by-bull/:farmer_id", (req: Request, res: Response) => {
  const { farmer_id } = req.params;

  const sql = `
    SELECT 
      b.bulls_id        AS bull_sire_id,
      b.bulls_name      AS bull_name,
      COUNT(*)                                        AS total,
      SUM(r.is_success)                               AS success,
      COUNT(*) - SUM(r.is_success)                    AS failed,
      ROUND(SUM(r.is_success) / COUNT(*) * 100, 2)    AS success_rate
    FROM tb_insemination_records r
    JOIN tb_bull_sires b ON r.ref_bull_sire_id = b.bulls_id
    WHERE r.ref_farmer_id = ?
    GROUP BY r.ref_bull_sire_id
    ORDER BY success_rate DESC
  `;

  conn.query(sql, [farmer_id], (err, rows: any) => {
    if (err) {
      console.error("Error fetching my stats by bull:", err);
      return res.status(500).json({ error: "Error fetching my stats by bull" });
    }
    return res.status(200).json(rows);
  });
});