import { Request, Response, Router } from "express";
import { BullRow} from "../model/data_post_request";
import { Bull} from "../model/data_post_request";
import { Bull_VET} from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import { db } from "../firebaseconnect";
import { requireAdminType } from "../src/middleware/adminAuth";


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

// ═══════════════════════════════════════════════════════════════════════════
// VET APPROVAL
// ═══════════════════════════════════════════════════════════════════════════
 
// ── รายการ vet รอยืนยัน (ทุก type) ───────────────────────────────────────
router.get("/vet/pending", requireAdminType(3), async (req, res) => {
  try {
    const rows = await queryAsync(
      `SELECT vetexperts_id, vetexperts_name, vetexperts_email,
              vetexperts_phonenumber, vetexperts_license,
              vetexperts_profile_image, created_at
       FROM tb_vetexperts
       WHERE vetexperts_status = 0
       ORDER BY created_at ASC`
    );
    return res.status(200).json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ── อนุมัติ / ปฏิเสธ vet (ทุก type) ──────────────────────────────────────
router.put("/vet/approve/:vet_id", requireAdminType(3), async (req, res) => {
  try {
    const { vet_id } = req.params;
    const { status } = req.body; // 1 = อนุมัติ, 2 = ปฏิเสธ
 
    if (![1, 2].includes(Number(status))) {
      return res.status(400).json({ error: "status ต้องเป็น 1 (อนุมัติ) หรือ 2 (ปฏิเสธ)" });
    }
 
    const result: any = await queryAsync(
      "UPDATE tb_vetexperts SET vetexperts_status = ? WHERE vetexperts_id = ?",
      [status, vet_id]
    );
 
    if (result.affectedRows === 0) return res.status(404).json({ error: "ไม่พบ Vet" });
 
    return res.status(200).json({
      message: Number(status) === 1 ? "อนุมัติสำเร็จ" : "ปฏิเสธสำเร็จ",
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
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


// GET /admin/members
// ดูข้อมูลสมาชิกทั้งหมด (farmers + vetexperts)
// Query: ?type=farmer | vetexpert (ถ้าไม่ส่งจะได้ทั้งหมด)
router.get("/members", async (req: Request, res: Response) => {
  const { type } = req.query;
 
  try {
    let farmers: any[] = [];
    let vets: any[] = [];
 
    if (!type || type === "farmer") {
      farmers = await queryAsync(
        `SELECT farmers_id AS id, farmers_name AS name,
                farmers_email AS email, farmers_phonenumber AS phonenumber,
                farmers_province AS province, farmers_district AS district,
                farmers_locality AS locality, farmers_address AS address,
                'farmer' AS member_type
         FROM tb_farmers ORDER BY farmers_id ASC`,
        []
      );
    }
 
    if (!type || type === "vetexpert") {
      vets = await queryAsync(
        `SELECT vetexperts_id AS id, vetexperts_name AS name,
                vetexperts_email AS email, vetexperts_phonenumber AS phonenumber,
                vetexperts_province AS province, vetexperts_district AS district,
                vetexperts_locality AS locality, vetexperts_address AS address,
                vetexperts_license AS license, vetexperts_status AS status,
                'vetexpert' AS member_type
         FROM tb_vetexperts ORDER BY vetexperts_id ASC`,
        []
      );
    }
 
    const data = [...farmers, ...vets];
 
    if (data.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลสมาชิก" });
    }
 
    return res.status(200).json({ success: true, total: data.length, data });
  } catch (err) {
    console.error("GET /admin/members error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


// GET /admin/members/search
// ค้นหาสมาชิก filter จาก จังหวัด, อำเภอ, ตำบล, keyword
// Query: ?province=&district=&locality=&keyword=&type=farmer|vetexpert
router.get("/members/search", async (req: Request, res: Response) => {
  const { province, district, locality, keyword, type } = req.query as any;
 
  try {
    const buildWhere = (prefix: string) => {
      const conditions: string[] = [];
      const values: any[] = [];
 
      if (province) { conditions.push(`${prefix}_province = ?`);                          values.push(province); }
      if (district) { conditions.push(`${prefix}_district = ?`);                          values.push(district); }
      if (locality) { conditions.push(`${prefix}_locality = ?`);                          values.push(locality); }
      if (keyword)  { conditions.push(`(${prefix}_name LIKE ? OR ${prefix}_email LIKE ?)`); values.push(`%${keyword}%`, `%${keyword}%`); }
 
      return {
        where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        values,
      };
    };
 
    let farmers: any[] = [];
    let vets: any[] = [];
 
    if (!type || type === "farmer") {
      const { where, values } = buildWhere("farmers");
      farmers = await queryAsync(
        `SELECT farmers_id AS id, farmers_name AS name,
                farmers_email AS email, farmers_phonenumber AS phonenumber,
                farmers_province AS province, farmers_district AS district,
                farmers_locality AS locality, 'farmer' AS member_type
         FROM tb_farmers ${where}`,
        values
      );
    }
 
    if (!type || type === "vetexpert") {
      const { where, values } = buildWhere("vetexperts");
      vets = await queryAsync(
        `SELECT vetexperts_id AS id, vetexperts_name AS name,
                vetexperts_email AS email, vetexperts_phonenumber AS phonenumber,
                vetexperts_province AS province, vetexperts_district AS district,
                vetexperts_locality AS locality, vetexperts_license AS license,
                vetexperts_status AS status, 'vetexpert' AS member_type
         FROM tb_vetexperts ${where}`,
        values
      );
    }
 
    const data = [...farmers, ...vets];
 
    return res.status(200).json({ success: true, total: data.length, data });
  } catch (err) {
    console.error("GET /admin/members/search error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ============================================================
// PUT /admin/members/farmer/:id
// แก้ไขข้อมูลเกษตรกร (master เท่านั้น)
// Body: name, email, phonenumber, address
// ============================================================
router.put("/members/farmer/:id", requireType(1), async (req: any, res: any) => {
  const { id } = req.params;
  const { name, email, phonenumber, address } = req.body;
 
  if (!name && !email && !phonenumber && !address) {
    return res.status(400).json({ success: false, message: "ไม่มีข้อมูลที่ต้องการแก้ไข" });
  }
 
  try {
    const existing = await queryAsync(
      "SELECT farmers_id FROM tb_farmers WHERE farmers_id = ?", [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบเกษตรกร" });
    }
 
    const fields: string[] = [];
    const values: any[]   = [];
 
    if (name)        { fields.push("farmers_name = ?");        values.push(name); }
    if (email)       { fields.push("farmers_email = ?");       values.push(email); }
    if (phonenumber) { fields.push("farmers_phonenumber = ?"); values.push(phonenumber); }
    if (address)     { fields.push("farmers_address = ?");     values.push(address); }
    values.push(id);
 
    await queryAsync(
      `UPDATE tb_farmers SET ${fields.join(", ")} WHERE farmers_id = ?`,
      values
    );
 
    return res.status(200).json({ success: true, message: "แก้ไขข้อมูลเกษตรกรสำเร็จ" });
  } catch (err) {
    console.error("PUT /admin/members/farmer/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 
// ============================================================
// DELETE /admin/members/farmer/:id
// ลบเกษตรกร (master เท่านั้น)
// ============================================================
router.delete("/members/farmer/:id", requireType(1), async (req: any, res: any) => {
  const { id } = req.params;
 
  try {
    const existing = await queryAsync(
      "SELECT farmers_id FROM tb_farmers WHERE farmers_id = ?", [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบเกษตรกร" });
    }
 
    await queryAsync("DELETE FROM tb_farmers WHERE farmers_id = ?", [id]);
 
    return res.status(200).json({ success: true, message: "ลบเกษตรกรสำเร็จ" });
  } catch (err) {
    console.error("DELETE /admin/members/farmer/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 
// ============================================================
// PUT /admin/members/vetexpert/:id
// แก้ไขข้อมูลสัตวบาล (master เท่านั้น)
// Body: name, email, phonenumber, address
// ============================================================
router.put("/members/vetexpert/:id", requireType(1), async (req: any, res: any) => {
  const { id } = req.params;
  const { name, email, phonenumber, address } = req.body;
 
  if (!name && !email && !phonenumber && !address) {
    return res.status(400).json({ success: false, message: "ไม่มีข้อมูลที่ต้องการแก้ไข" });
  }
 
  try {
    const existing = await queryAsync(
      "SELECT vetexperts_id FROM tb_vetexperts WHERE vetexperts_id = ?", [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบสัตวบาล" });
    }
 
    const fields: string[] = [];
    const values: any[]   = [];
 
    if (name)        { fields.push("vetexperts_name = ?");        values.push(name); }
    if (email)       { fields.push("vetexperts_email = ?");       values.push(email); }
    if (phonenumber) { fields.push("vetexperts_phonenumber = ?"); values.push(phonenumber); }
    if (address)     { fields.push("vetexperts_address = ?");     values.push(address); }
    values.push(id);
 
    await queryAsync(
      `UPDATE tb_vetexperts SET ${fields.join(", ")} WHERE vetexperts_id = ?`,
      values
    );
 
    return res.status(200).json({ success: true, message: "แก้ไขข้อมูลสัตวบาลสำเร็จ" });
  } catch (err) {
    console.error("PUT /admin/members/vetexpert/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 
// ============================================================
// DELETE /admin/members/vetexpert/:id
// ลบสัตวบาล (master เท่านั้น)
// ============================================================
router.delete("/members/vetexpert/:id", requireType(1), async (req: any, res: any) => {
  const { id } = req.params;
 
  try {
    const existing = await queryAsync(
      "SELECT vetexperts_id FROM tb_vetexperts WHERE vetexperts_id = ?", [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบสัตวบาล" });
    }
 
    await queryAsync("DELETE FROM tb_vetexperts WHERE vetexperts_id = ?", [id]);
 
    return res.status(200).json({ success: true, message: "ลบสัตวบาลสำเร็จ" });
  } catch (err) {
    console.error("DELETE /admin/members/vetexpert/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


// GET /admin/verify-vet
// ดูรายการ vetexpert ที่รอการยืนยัน (status = 0)
router.get("/verify-vet", async (req: Request, res: Response) => {
  try {
    const result = await queryAsync(
      `SELECT vetexperts_id, vetexperts_name, vetexperts_email,
              vetexperts_phonenumber, vetexperts_license,
              vetexperts_province, vetexperts_district,
              vetexperts_locality, vetexperts_status
       FROM tb_vetexperts
       WHERE vetexperts_status = 0
       ORDER BY vetexperts_id ASC`,
      []
    );
 
    return res.status(200).json({ success: true, total: result.length, data: result });
  } catch (err) {
    console.error("GET /admin/verify-vet error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});
 

// PUT /admin/verify-vet/:id
// อนุมัติ หรือ ปฏิเสธ vetexpert
// Body: status → 1 = อนุมัติ, 2 = ปฏิเสธ
router.put("/verify-vet/:id", async (req: any, res: any) => {
  const { id } = req.params;
  const { status } = req.body;
 
  if (status === undefined || ![1, 2].includes(Number(status))) {
    return res.status(400).json({
      success: false,
      message: "status ต้องเป็น 1 (อนุมัติ) หรือ 2 (ปฏิเสธ) เท่านั้น",
    });
  }
 
  try {
    const existing = await queryAsync(
      "SELECT vetexperts_id FROM tb_vetexperts WHERE vetexperts_id = ?", [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "ไม่พบ vetexpert" });
    }
 
    await queryAsync(
      "UPDATE tb_vetexperts SET vetexperts_status = ? WHERE vetexperts_id = ?",
      [status, id]
    );
 
    const message = Number(status) === 1 ? "อนุมัติ vetexpert สำเร็จ" : "ปฏิเสธ vetexpert สำเร็จ";
    return res.status(200).json({ success: true, message });
  } catch (err) {
    console.error("PUT /admin/verify-vet/:id error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FARM MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
 
// ── ดูฟาร์มทั้งหมด ────────────────────────────────────────────────────────
router.get("/farms", requireAdminType(3), async (req, res) => {
  try {
    const farms = await queryAsync(
      `SELECT 
        f.frams_id,
        f.frams_name,
        f.frams_province,
        f.frams_district,
        f.frams_locality,
        f.frams_address,
        COUNT(DISTINCT bs.bulls_id) AS total_bulls
       FROM tb_farms f
       LEFT JOIN tb_bull_sires bs ON f.frams_id = bs.ref_farm_id
       GROUP BY f.frams_id
       ORDER BY f.frams_name ASC`
    );
    return res.status(200).json(farms);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ── เพิ่มฟาร์ม ─────────────────────────────────────────────────────────────
router.post("/farms/create", requireAdminType(3), async (req, res) => {
  try {
    const { frams_name, frams_province, frams_district, frams_locality, frams_address, frams_lat, frams_long } = req.body;

    if (!frams_name) return res.status(400).json({ error: "กรุณากรอกชื่อฟาร์ม" });

    await queryAsync(
      `INSERT INTO tb_farms
       (frams_name, frams_province, frams_district, frams_locality, frams_address, frams_lat, frams_long)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [frams_name, frams_province || null, frams_district || null,
       frams_locality || null, frams_address || null,
       frams_lat || null, frams_long || null]
    );

    return res.status(201).json({ message: "เพิ่มฟาร์มสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ── แก้ไขฟาร์ม ─────────────────────────────────────────────────────────────
router.put("/farms/update/:id", requireAdminType(3), async (req, res) => {
  try {
    const { id } = req.params;
    const { frams_name, frams_province, frams_district, frams_locality, frams_address, frams_lat, frams_long } = req.body;

    const result: any = await queryAsync(
      `UPDATE tb_farms
       SET frams_name = ?, frams_province = ?, frams_district = ?,
           frams_locality = ?, frams_address = ?, frams_lat = ?, frams_long = ?,
           updated_at = NOW()
       WHERE frams_id = ?`,
      [frams_name, frams_province || null, frams_district || null,
       frams_locality || null, frams_address || null,
       frams_lat || null, frams_long || null, id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "ไม่พบฟาร์ม" });
    return res.status(200).json({ message: "แก้ไขข้อมูลฟาร์มสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// ── ลบฟาร์ม ───────────────────────────────────────────────────────────────
router.delete("/farms/delete/:id", requireAdminType(3), async (req, res) => {
  try {
    const { id } = req.params;

    // เช็คก่อนว่ามีวัวผูกอยู่มั้ย
    const bulls: any = await queryAsync(
      "SELECT COUNT(*) AS total FROM tb_bull_sires WHERE ref_farm_id = ?",
      [id]
    );

    if (bulls[0].total > 0) {
      return res.status(400).json({
        error: "ไม่สามารถลบฟาร์มได้ เนื่องจากมีพ่อพันธุ์อยู่ในฟาร์มนี้",
        total_bulls: bulls[0].total,
      });
    }

    const result: any = await queryAsync(
      "DELETE FROM tb_farms WHERE frams_id = ?",
      [id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ error: "ไม่พบฟาร์ม" });
    return res.status(200).json({ message: "ลบฟาร์มสำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ═══════════════════════════════════════════════════════════════════════════
// BULL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
 
// ── ดูพ่อพันธุ์ทั้งหมด ────────────────────────────────────────────────────
router.get("/bulls", requireType(3), async (req, res) => {
  try {
    const bulls = await queryAsync(
      `SELECT bs.bulls_id, bs.bulls_name, bs.bulls_breed,
              bs.bulls_highlight, bs.bulls_history,
              SUM(vb.bulls_semen_stock) AS total_stock
       FROM tb_bull_sires bs
       LEFT JOIN tb_vet_bulls vb ON bs.bulls_id = vb.ref_bulls_id
       GROUP BY bs.bulls_id
       ORDER BY bs.bulls_name ASC`
    );
    return res.status(200).json(bulls);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ── เพิ่มพ่อพันธุ์ ─────────────────────────────────────────────────────────
router.post("/bulls/create", requireType(3), async (req, res) => {
  try {
    const { bulls_name, bulls_breed, bulls_highlight, bulls_history } = req.body;
 
    if (!bulls_name || !bulls_breed) {
      return res.status(400).json({ error: "กรุณากรอกชื่อและสายพันธุ์" });
    }
 
    await queryAsync(
      `INSERT INTO tb_bull_sires (bulls_name, bulls_breed, bulls_highlight, bulls_history)
       VALUES (?, ?, ?, ?)`,
      [bulls_name, bulls_breed, bulls_highlight || null, bulls_history || null]
    );
 
    return res.status(201).json({ message: "เพิ่มพ่อพันธุ์สำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ── แก้ไขพ่อพันธุ์ ─────────────────────────────────────────────────────────
router.put("/bulls/update/:id", requireType(3), async (req, res) => {
  try {
    const { id } = req.params;
    const { bulls_name, bulls_breed, bulls_highlight, bulls_history } = req.body;
 
    const result: any = await queryAsync(
      `UPDATE tb_bull_sires
       SET bulls_name = ?, bulls_breed = ?, bulls_highlight = ?, bulls_history = ?
       WHERE bulls_id = ?`,
      [bulls_name, bulls_breed, bulls_highlight || null, bulls_history || null, id]
    );
 
    if (result.affectedRows === 0) return res.status(404).json({ error: "ไม่พบพ่อพันธุ์" });
    return res.status(200).json({ message: "แก้ไขพ่อพันธุ์สำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ── ลบพ่อพันธุ์ ────────────────────────────────────────────────────────────
router.delete("/bulls/delete/:id", requireAdminType(3), async (req, res) => {
  try {
    const { id } = req.params;
    const result: any = await queryAsync(
      "DELETE FROM tb_bull_sires WHERE bulls_id = ?",
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "ไม่พบพ่อพันธุ์" });
    return res.status(200).json({ message: "ลบพ่อพันธุ์สำเร็จ" });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ═══════════════════════════════════════════════════════════════════════════
// INSEMINATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════
 
router.get("/inseminations", requireAdminType(3), async (req, res) => {
  try {
    const { from_date, to_date, vet_id, farmer_id, status } = req.query;
 
    let where = "WHERE 1=1";
    const params: any[] = [];
 
    if (from_date) { where += " AND s.schedules_available_date >= ?"; params.push(from_date); }
    if (to_date)   { where += " AND s.schedules_available_date <= ?"; params.push(to_date); }
    if (vet_id)    { where += " AND b.ref_vetexperts_id = ?";         params.push(vet_id); }
    if (farmer_id) { where += " AND b.ref_farmers_id = ?";            params.push(farmer_id); }
    if (status)    { where += " AND b.bookings_status = ?";           params.push(status); }
 
    const rows = await queryAsync(
      `SELECT
        b.queue_bookings_id,
        f.farmers_name,
        v.vetexperts_name,
        bs.bulls_name, bs.bulls_breed,
        b.bookings_dose,
        b.bookings_status,
        b.bookings_vet_notes,
        s.schedules_available_date AS schedule_date,
        s.schedules_available_time AS schedule_time,
        b.created_at
       FROM tb_queue_bookings b
       LEFT JOIN tb_farmers f       ON b.ref_farmers_id   = f.farmers_id
       LEFT JOIN tb_vetexperts v    ON b.ref_vetexperts_id = v.vetexperts_id
       LEFT JOIN tb_vet_schedules s ON b.ref_schedules_id  = s.schedules_id
       LEFT JOIN tb_vet_bulls vb   ON b.ref_bulls_id       = vb.vet_bulls_id
       LEFT JOIN tb_bull_sires bs  ON vb.ref_bulls_id      = bs.bulls_id
       ${where}
       ORDER BY b.created_at DESC`,
      params
    );
 
    return res.status(200).json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════
 
router.get("/dashboard/stats", requireAdminType(3), async (req, res) => {
  try {
    const [[bookings], [farmers], [vets], [pending], [success]] = await Promise.all([
      queryAsync("SELECT COUNT(*) AS total FROM tb_queue_bookings") as any,
      queryAsync("SELECT COUNT(*) AS total FROM tb_farmers") as any,
      queryAsync("SELECT COUNT(*) AS total FROM tb_vetexperts WHERE vetexperts_status = 1") as any,
      queryAsync("SELECT COUNT(*) AS total FROM tb_vetexperts WHERE vetexperts_status = 0") as any,
      queryAsync(`
        SELECT
          ROUND(
            SUM(CASE WHEN bookings_status = 'accepted' THEN 1 ELSE 0 END) * 100.0
            / NULLIF(COUNT(*), 0), 1
          ) AS rate
        FROM tb_queue_bookings
        WHERE bookings_status IN ('accepted', 'rejected')
      `) as any,
    ]);
 
    return res.status(200).json({
      total_bookings:    bookings.total,
      total_farmers:     farmers.total,
      total_vets:        vets.total,
      pending_approvals: pending.total,
      success_rate:      success.rate ?? 0,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});
 
// ── แนวโน้มรายเดือน ────────────────────────────────────────────────────────
router.get("/dashboard/trend", requireAdminType(3), async (req, res) => {
  try {
    const rows = await queryAsync(
      `SELECT
        DATE_FORMAT(s.schedules_available_date, '%Y-%m') AS month,
        COUNT(*) AS total,
        SUM(CASE WHEN b.bookings_status = 'accepted' THEN 1 ELSE 0 END) AS success,
        ROUND(
          SUM(CASE WHEN b.bookings_status = 'accepted' THEN 1 ELSE 0 END) * 100.0
          / NULLIF(COUNT(*), 0), 1
        ) AS success_rate
       FROM tb_queue_bookings b
       LEFT JOIN tb_vet_schedules s ON b.ref_schedules_id = s.schedules_id
       WHERE b.bookings_status IN ('accepted', 'rejected')
         AND s.schedules_available_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY month
       ORDER BY month ASC`
    );
    return res.status(200).json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
});