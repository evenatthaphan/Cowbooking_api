"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// /// queue_book ****
// router.post("/queue/book", async (req, res) => {
//   try {
//     const {
//       farmer_id,
//       vet_expert_id,
//       preferred_date,
//       preferred_time,
//       service_type,
//       animal_type,
//       symptoms,
//       urgency_level,
//     } = req.body;
//     // 
//     if (
//       !farmer_id ||
//       !vet_expert_id ||
//       !preferred_date ||
//       !service_type ||
//       !animal_type ||
//       !symptoms ||
//       !urgency_level
//     ) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }
//     // 
//     const booking_date = new Date();
//     // 
//     const status = "pending";
//     const sql = `
//       INSERT INTO queue_bookings
//       (farmer_id, vet_expert_id, booking_date, preferred_date, preferred_time, 
//        service_type, animal_type, symptoms, urgency_level, status)
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `;
//     const [result]: any = await queryAsync(sql, [
//       farmer_id,
//       vet_expert_id,
//       booking_date,
//       preferred_date,
//       preferred_time || null,
//       service_type,
//       animal_type,
//       symptoms,
//       urgency_level,
//       status,
//     ]);
//     return res.status(201).json({
//       message: "Booking created successfully",
//       booking_id: result.insertId,
//     });
//   } catch (err) {
//     console.error("Error inserting booking:", err);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });
