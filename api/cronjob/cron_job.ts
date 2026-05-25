import cron from 'node-cron';
import { queryAsync } from '../../dbconnect';

// รันทุกวันตอนเที่ยงคืน
cron.schedule('0 0 * * *', async () => {
  try {
    // หา booking ที่ accepted และผ่านไป 21 วัน ยังไม่มี notification check_result
    const bookings: any = await queryAsync(
      `SELECT b.queue_bookings_id, b.ref_farmers_id,
              s.schedules_available_date
       FROM tb_queue_bookings b
       JOIN tb_vet_schedules s ON b.ref_schedules_id = s.schedules_id
       WHERE b.bookings_status = 'accepted'
         AND DATEDIFF(NOW(), s.schedules_available_date) >= 21
         AND b.queue_bookings_id NOT IN (
           SELECT ref_booking_id FROM tb_notifications
           WHERE noti_type = 'check_result'
         )`
    );

    for (const booking of bookings) {
      await queryAsync(
        `INSERT INTO tb_notifications
         (ref_farmers_id, noti_type, noti_title, noti_message, ref_booking_id)
         VALUES (?, 'check_result', ?, ?, ?)`,
        [
          booking.ref_farmers_id,
          'ตรวจสอบผลการผสมเทียม 🐄',
          'ผ่านไป 21 วันแล้ว กรุณาตรวจสอบว่าวัวติดสัดอีกหรือไม่ และกรอกผลการผสม',
          booking.queue_bookings_id,
        ]
      );
    }
    console.log(`Sent ${bookings.length} check_result notifications`);
  } catch (e) {
    console.error('Cron error:', e);
  }
});