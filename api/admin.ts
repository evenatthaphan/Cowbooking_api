import { Request, Response, Router } from "express";
import { BullRow} from "../model/data_post_request";
import { Bull} from "../model/data_post_request";
import { Bull_VET} from "../model/data_post_request";
import { conn, queryAsync } from "../dbconnect";
import mysql from "mysql";
import bcrypt from "bcrypt";
import { db } from "../firebaseconnect";


//export const router = express.Router();
const router = Router();


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