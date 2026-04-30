import { Router, Request, Response } from "express";
import { conn, queryAsync } from "../dbconnect";

const router = Router();

// POST /insemination/record
// บันทึกผลการผสมเทียม
router.post("/record", async (req: Request, res: Response) => {
  const { booking_id, vetexpert_id, bull_sire_id, farmer_id, farm_id, is_success, note } = req.body;

  // validation
  if (!booking_id)   return res.status(400).json({ error: "booking_id is required" });
  if (!vetexpert_id) return res.status(400).json({ error: "vetexpert_id is required" });
  if (!bull_sire_id) return res.status(400).json({ error: "bull_sire_id is required" });
  if (!farmer_id)    return res.status(400).json({ error: "farmer_id is required" });
  if (!farm_id)      return res.status(400).json({ error: "farm_id is required" });
  if (is_success === undefined) return res.status(400).json({ error: "is_success is required" });

  // เช็คว่า booking_id นี้บันทึกผลไปแล้วหรือยัง
  const checkSql = `SELECT record_id FROM tb_insemination_records WHERE ref_booking_id = ?`;

  conn.query(checkSql, [booking_id], (err, rows: any) => {
    if (err) return res.status(500).json({ error: "Error checking booking" });
    if (rows.length > 0) return res.status(400).json({ error: "บันทึกผลการผสมนี้ไปแล้ว" });

    const insertSql = `
      INSERT INTO tb_insemination_records 
        (ref_booking_id, ref_vetexpert_id, ref_bull_sire_id, ref_farmer_id, ref_farm_id, is_success, inseminated_at, confirmed_at, note)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)
    `;

    conn.query(
      insertSql,
      [booking_id, vetexpert_id, bull_sire_id, farmer_id, farm_id, is_success ? 1 : 0, note || null],
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

// GET /insemination/stats/overview
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


// GET /insemination/stats/by-vet
// ดึงสถิติแยกตามหมอ
router.get("/stats/by-vet", (req: Request, res: Response) => {
  const sql = `
    SELECT 
      v.vetexpert_id,
      v.vetexpert_name,
      COUNT(*)                                          AS total,
      SUM(r.is_success)                                 AS success,
      COUNT(*) - SUM(r.is_success)                      AS failed,
      ROUND(SUM(r.is_success) / COUNT(*) * 100, 2)      AS success_rate
    FROM tb_insemination_records r
    JOIN tb_vetexperts v ON r.ref_vetexpert_id = v.vetexpert_id
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


// GET /insemination/stats/by-bull
// ดึงสถิติแยกตามน้ำเชื้อวัว
router.get("/stats/by-bull", (req: Request, res: Response) => {
  const sql = `
    SELECT 
      b.bull_sire_id,
      b.bull_name,
      COUNT(*)                                          AS total,
      SUM(r.is_success)                                 AS success,
      COUNT(*) - SUM(r.is_success)                      AS failed,
      ROUND(SUM(r.is_success) / COUNT(*) * 100, 2)      AS success_rate
    FROM tb_insemination_records r
    JOIN tb_bull_sires b ON r.ref_bull_sire_id = b.bull_sire_id
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

export default router;