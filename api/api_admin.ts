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


// manage admin (list, update, delete) *****
// Middleware ตรวจสิทธิ์ตาม admin_type
// maxType: 1 = master เท่านั้น, 2 = master + super, 3 = ทุกคน

const requireType = (maxType: number) =>
  async (req: any, res: any, next: any) => {
    const adminType = Number(req.headers["admin-type"]);
    if (!adminType || adminType > maxType) {
      return res.status(403).json({ success: false, message: "ไม่มีสิทธิ์เข้าถึง" });
    }
    next();
  };
 

// GET /admin/list
// ดูรายชื่อ admin ทั้งหมด (ไม่ส่ง password กลับ)
router.get("/list", async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT
        admins_id,
        admins_name,
        admins_email,
        admins_phonenumber,
        admins_address,
        admin_type,
        must_change_password,
        created_at,
        updated_at
      FROM tb_admins
      ORDER BY admins_id ASC
    `;
    const result = (await queryAsync(sql, [])) as any[];
 
    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูล admin" });
    }
 
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("GET /admin/list error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 

// POST /admin/create
// เพิ่ม admin ใหม่ (เฉพาะ master=1 และ super=2 เท่านั้น)
// Body: admins_name, admins_email, admins_password,
//       admins_phonenumber, admins_address, admin_type
router.post("/create", requireType(2), async (req: any, res: any) => {
  const {
    admins_name,
    admins_email,
    admins_password,
    admins_phonenumber,
    admins_address,
    admin_type,
  } = req.body;
 
  // ตรวจ field จำเป็น
  if (!admins_name || !admins_email || !admins_password || !admin_type) {
    return res.status(400).json({
      success: false,
      message: "กรุณากรอก admins_name, admins_email, admins_password, admin_type",
    });
  }
 
  // Super (type=2) สร้างได้เฉพาะ admin (type=3) เท่านั้น
  const requesterType = Number(req.headers["admin-type"]);
  if (requesterType === 2 && Number(admin_type) !== 3) {
    return res.status(403).json({
      success: false,
      message: "Super admin สร้างได้เฉพาะ admin (type=3) เท่านั้น",
    });
  }
 
  try {
    // เช็ค email ซ้ำ
    const existing = await queryAsync(
      "SELECT admins_id FROM tb_admins WHERE admins_email = ?",
      [admins_email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "Email นี้ถูกใช้แล้ว" });
    }
 
    // Hash password
    const hashed = await bcrypt.hash(admins_password, 10);
 
    const sql = `
      INSERT INTO tb_admins
        (admins_name, admins_email, admins_password, admins_phonenumber, admins_address, admin_type, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;
    const result = await queryAsync(sql, [
      admins_name,
      admins_email,
      hashed,
      admins_phonenumber || null,
      admins_address || null,
      admin_type,
    ]);
 
    return res.status(201).json({
      success: true,
      message: "เพิ่ม admin สำเร็จ",
      admins_id: result.insertId,
    });
  } catch (err) {
    console.error("POST /admin/create error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 

// PUT /admin/update/:id
// แก้ไขข้อมูล admin (master + super เท่านั้น)
// Body: admins_name, admins_email, admins_phonenumber,
//       admins_address, admin_type
router.put("/update/:id", requireType(2), async (req: any, res: any) => {
  const { id } = req.params;
  const {
    admins_name,
    admins_email,
    admins_phonenumber,
    admins_address,
    admin_type,
  } = req.body;
 
  if (!admins_name && !admins_email && !admins_phonenumber && !admins_address && !admin_type) {
    return res.status(400).json({ success: false, message: "ไม่มีข้อมูลที่ต้องการแก้ไข" });
  }
 
  try {
    // ตรวจว่า admin นั้นมีอยู่
    const existing = await queryAsync(
      "SELECT admins_id FROM tb_admins WHERE admins_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบ admin" });
    }
 
    // build dynamic SET
    const fields: string[] = [];
    const values: any[] = [];
 
    if (admins_name)       { fields.push("admins_name = ?");        values.push(admins_name); }
    if (admins_email)      { fields.push("admins_email = ?");       values.push(admins_email); }
    if (admins_phonenumber){ fields.push("admins_phonenumber = ?"); values.push(admins_phonenumber); }
    if (admins_address)    { fields.push("admins_address = ?");     values.push(admins_address); }
    if (admin_type)        { fields.push("admin_type = ?");         values.push(admin_type); }
 
    values.push(id);
 
    await queryAsync(
      `UPDATE tb_admins SET ${fields.join(", ")} WHERE admins_id = ?`,
      values
    );
 
    return res.status(200).json({ success: true, message: "แก้ไข admin สำเร็จ" });
  } catch (err) {
    console.error("PUT /admin/update/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 

// DELETE /admin/delete/:id
// ลบ admin (เฉพาะ master=1 เท่านั้น)
router.delete("/delete/:id", requireType(1), async (req: any, res: any) => {
  const { id } = req.params;
 
  try {
    const existing = await queryAsync(
      "SELECT admins_id FROM tb_admins WHERE admins_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบ admin" });
    }
 
    await queryAsync("DELETE FROM tb_admins WHERE admins_id = ?", [id]);
 
    return res.status(200).json({ success: true, message: "ลบ admin สำเร็จ" });
  } catch (err) {
    console.error("DELETE /admin/delete/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// PUT /admin/update-profile/:id
// แก้ไขข้อมูลตัวเอง (เบอร์, อีเมล, ที่อยู่)
// ห้ามแก้ admin_type และ admins_name

router.put("/update-profile/:id", async (req: any, res: any) => {
  const { id } = req.params;
  const { admins_email, admins_phonenumber, admins_address } = req.body;
 
  if (!admins_email && !admins_phonenumber && !admins_address) {
    return res.status(400).json({ success: false, message: "ไม่มีข้อมูลที่ต้องการแก้ไข" });
  }
 
  try {
    const existing = await queryAsync(
      "SELECT admins_id FROM tb_admins WHERE admins_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบ admin" });
    }
 
    const fields: string[] = [];
    const values: any[] = [];
 
    if (admins_email)      { fields.push("admins_email = ?");       values.push(admins_email); }
    if (admins_phonenumber){ fields.push("admins_phonenumber = ?"); values.push(admins_phonenumber); }
    if (admins_address)    { fields.push("admins_address = ?");     values.push(admins_address); }
 
    values.push(id);
 
    await queryAsync(
      `UPDATE tb_admins SET ${fields.join(", ")} WHERE admins_id = ?`,
      values
    );
 
    return res.status(200).json({ success: true, message: "อัปเดตโปรไฟล์สำเร็จ" });
  } catch (err) {
    console.error("PUT /admin/update-profile/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});