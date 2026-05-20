import { Request, Response, Router } from "express";
import { BullRow} from "../model/data_post_request";
import { Bull} from "../model/data_post_request";
import { Bull_VET} from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import { db } from "../firebaseconnect";


//export const router = express.Router();
export const router = Router();

// test api
router.get("/getadmins", (req, res) => {
  conn.query("SELECT * FROM tb_admins", (err, result, fields) => {
    if (err) {
      console.error("DB Query Error:", err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
    if (!result || result.length === 0) {
      return res.status(404).json({ message: "No admins found" });
    }
    res.json(result);
  });
});


// select form register vet from firebase ****
router.get("/vet-requests", async (req: Request, res: Response) => {
  try {
    const snapshot = await db.ref("pending_vet_experts").once("value");

    const data = snapshot.val();

    // แปลง object เป็น array
    const vetRequests = Object.entries(data || {})
      .map(([id, value]: [string, any]) => ({ id, ...value }))
      .filter((v) => v.status === "pending");

    res.status(200).json(vetRequests);
  } catch (error) {
    console.error("Error fetching vet requests:", error);
    res.status(500).json({ error: "Failed to fetch vet requests" });
  }
});


// admin approve *****
router.post("/vet-requests/:id/approve", async (req, res) => {
  const { id } = req.params;
  await db.ref("VetExperts/" + id).update({ status: "approved" });
  res.json({ message: "อนุมัติเรียบร้อย" });
});

// admin reject *****
router.post("/vet-requests/:id/reject", async (req, res) => {
  const { id } = req.params;
  await db.ref("VetExperts/" + id).update({ status: "rejected" });
  res.json({ message: "ปฏิเสธเรียบร้อย" });
});



//Master Admin *****

// login admin *****
router.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });

    // ค้นหาจาก admins_name หรือ admins_email
    const rows: any = await queryAsync(
      `SELECT * FROM tb_admins 
       WHERE admins_name = ? OR admins_email = ?`,
      [username, username]
    );

    if (rows.length === 0)
      return res.status(401).json({ error: "ไม่พบบัญชีผู้ใช้" });

    const admin = rows[0];

    // เช็ค bcrypt
    const isMatch = await bcrypt.compare(password, admin.admins_password);
    if (!isMatch)
      return res.status(401).json({ error: "รหัสผ่านไม่ถูกต้อง" });

    return res.status(200).json({
      admins_id:            admin.admins_id,
      admins_name:          admin.admins_name,
      admins_email:         admin.admins_email,
      admins_phonenumber:   admin.admins_phonenumber,
      admins_address:       admin.admins_address,
      admin_type:           admin.admin_type,           // 1, 2, 3
      must_change_password: admin.must_change_password === 1, // true → บังคับเปลี่ยนรหัส
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});


// change password admin first login *****
router.put("/admin/change-password/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { old_password, new_password } = req.body;

    const rows: any = await queryAsync(
      "SELECT admins_password FROM tb_admins WHERE admins_id = ?",
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "ไม่พบบัญชีผู้ใช้" });

    const isMatch = await bcrypt.compare(old_password, rows[0].admins_password);
    if (!isMatch)
      return res.status(400).json({ error: "รหัสผ่านเดิมไม่ถูกต้อง" });

    const hashed = await bcrypt.hash(new_password, 10);

    await queryAsync(
      `UPDATE tb_admins 
       SET admins_password = ?, must_change_password = 0, updated_at = NOW()
       WHERE admins_id = ?`,
      [hashed, id]
    );

    return res.status(200).json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});



// create admin *****
router.post("/admin/create", async (req, res) => {
  try {
    const { admins_name, admins_email, admins_password, admins_phonenumber, admins_address, admin_type } = req.body;

    const hashed = await bcrypt.hash(admins_password, 10);

    await queryAsync(
      `INSERT INTO tb_admins 
       (admins_name, admins_email, admins_password, admins_phonenumber, admins_address, admin_type, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,  // must_change_password = 1 เสมอ
      [admins_name, admins_email, hashed, admins_phonenumber, admins_address || null, admin_type]
    );

    return res.status(201).json({ message: "สร้างบัญชีผู้ดูแลระบบสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

