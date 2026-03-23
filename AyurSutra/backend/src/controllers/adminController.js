/**
 * Admin controller - appointments list, doctors CRUD, patients list, analytics, clinic settings.
 * Admin can manage doctor availability, unavailability, and appointments (confirm, reschedule, cancel).
 */
import { query } from '../config/db.js';
import { sendEmail } from '../utils/mailer.js';

function isValidISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return String(value).slice(0, 10);
}

/**
 * GET /api/admin/appointments - list all appointments (admin view).
 */
export async function listAppointments(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT a.*,
              pu.name as patient_name, pu.email as patient_email,
              du.name as doctor_name, d.specialization
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       ORDER BY COALESCE(a.confirmed_date, a.appointment_date) DESC, a.confirmed_time DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/doctors - list all doctors with user info.
 */
export async function listDoctors(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT d.*, u.name, u.email,
              (SELECT COUNT(*) FROM appointments WHERE doctor_id = d.id) as patient_count
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       ORDER BY u.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/doctors - add doctor (create user with role doctor + doctors row).
 */
export async function createDoctor(req, res, next) {
  try {
    const bcrypt = (await import('bcryptjs')).default;
    const { email, password, name, specialization, license_number } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, name required' });
    }
    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already exists' });
    const password_hash = await bcrypt.hash(password, 10);
    const [ur] = await query(
      'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
      [email, password_hash, 'doctor', name]
    );
    await query(
      'INSERT INTO doctors (user_id, specialization, license_number) VALUES (?, ?, ?)',
      [ur.insertId, specialization || null, license_number || null]
    );
    const [rows] = await query(
      `SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.user_id = ?`,
      [ur.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/doctors/:id/profile - doctor profile with appointments, availability, unavailable days.
 */
export async function getDoctorProfile(req, res, next) {
  try {
    const doctorId = req.params.id;
    const [docRows] = await query(
      `SELECT d.*, u.name, u.email
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [doctorId]
    );
    if (!docRows.length) return res.status(404).json({ error: 'Doctor not found' });

    const [appointments] = await query(
      `SELECT a.*, pu.name as patient_name, pu.email as patient_email
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       WHERE a.doctor_id = ?
       ORDER BY a.appointment_date DESC, a.confirmed_time DESC`,
      [doctorId]
    );

    const [availability] = await query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week',
      [doctorId]
    );

    const [unavailableDays] = await query(
      'SELECT id, unavailable_date, reason, created_at FROM doctor_unavailable_days WHERE doctor_id = ? ORDER BY unavailable_date DESC',
      [doctorId]
    );

    res.json({
      doctor: docRows[0],
      appointments,
      availability,
      unavailable_days: unavailableDays.map((d) => ({ ...d, unavailable_date: toDateOnly(d.unavailable_date) })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/doctors/:id/availability - get doctor weekly availability.
 */
export async function getDoctorAvailability(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const [rows] = await query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/admin/doctors/:id/availability - set doctor weekly availability.
 * Body: [{ day_of_week, start_time, end_time, is_available }, ...]
 */
export async function setDoctorAvailability(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const doctorId = doc[0].id;
    const items = Array.isArray(req.body) ? req.body : req.body.slots || [];
    await query('DELETE FROM doctor_availability WHERE doctor_id = ?', [doctorId]);
    for (const slot of items) {
      const day = slot.day_of_week;
      const start = slot.start_time;
      const end = slot.end_time;
      const available = slot.is_available !== false ? 1 : 0;
      if (day === undefined || !start || !end) continue;
      await query(
        'INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available) VALUES (?, ?, ?, ?, ?)',
        [doctorId, day, start, end, available]
      );
    }
    const [rows] = await query('SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week', [doctorId]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/doctors/:id/unavailable-days - list doctor emergency unavailable days.
 */
export async function getDoctorUnavailableDays(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const [rows] = await query(
      'SELECT id, unavailable_date, reason, created_at FROM doctor_unavailable_days WHERE doctor_id = ? ORDER BY unavailable_date DESC',
      [req.params.id]
    );
    res.json(rows.map((r) => ({ ...r, unavailable_date: toDateOnly(r.unavailable_date) })));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/doctors/:id/unavailable-days - mark doctor unavailable for a full day.
 * Body: { unavailable_date, reason? }
 * Moves confirmed appointments on that day to reschedule_required and emails patients (clinic wording).
 */
export async function addDoctorUnavailableDay(req, res, next) {
  try {
    const { unavailable_date, reason } = req.body || {};
    if (!isValidISODate(unavailable_date)) {
      return res.status(400).json({ error: 'unavailable_date (YYYY-MM-DD) required' });
    }

    const [doc] = await query(
      `SELECT d.id, u.name as doctor_name
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const doctorId = doc[0].id;

    await query(
      'INSERT INTO doctor_unavailable_days (doctor_id, unavailable_date, reason) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
      [doctorId, unavailable_date, reason || null]
    );

    const [affected] = await query(
      `SELECT a.id, pu.email as patient_email, pu.name as patient_name
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       WHERE a.doctor_id = ?
         AND a.status = 'confirmed'
         AND a.confirmed_date = ?`,
      [doctorId, unavailable_date]
    );

    if (affected.length) {
      await query(
        `UPDATE appointments
         SET status = 'reschedule_required'
         WHERE doctor_id = ? AND status = 'confirmed' AND confirmed_date = ?`,
        [doctorId, unavailable_date]
      );

      await Promise.allSettled(
        affected.map((a) =>
          sendEmail({
            to: a.patient_email,
            subject: 'Appointment needs rescheduling',
            text: `Dear ${a.patient_name},\n\nThe clinic informs you that Dr. ${doc[0].doctor_name} is unavailable on ${unavailable_date} due to an emergency. The clinic will propose a new appointment time soon. You will receive another email once a new time is proposed.\n\nAyurSutra`,
          })
        )
      );
    }

    res.status(201).json({
      ok: true,
      unavailable_date,
      affected_appointments: affected.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/doctors/:id/unavailable-days/:date - remove doctor unavailable day.
 */
export async function removeDoctorUnavailableDay(req, res, next) {
  try {
    const { id, date } = req.params;
    const dateNorm = (date || '').slice(0, 10);
    if (!isValidISODate(dateNorm)) return res.status(400).json({ error: 'Invalid date format' });

    const [doc] = await query('SELECT id FROM doctors WHERE id = ?', [id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });

    const [result] = await query(
      'DELETE FROM doctor_unavailable_days WHERE doctor_id = ? AND DATE(unavailable_date) = ?',
      [id, dateNorm]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Unavailable day not found' });
    }
    res.json({ ok: true, removed_date: dateNorm });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/doctors/:id - update doctor (admin).
 */
export async function updateDoctor(req, res, next) {
  try {
    const [doc] = await query('SELECT id, user_id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const { name, email, specialization, license_number, is_available } = req.body;
    if (name !== undefined) await query('UPDATE users SET name = ? WHERE id = ?', [name, doc[0].user_id]);
    if (email !== undefined) await query('UPDATE users SET email = ? WHERE id = ?', [email, doc[0].user_id]);
    const updates = [];
    const values = [];
    if (specialization !== undefined) { updates.push('specialization = ?'); values.push(specialization); }
    if (license_number !== undefined) { updates.push('license_number = ?'); values.push(license_number); }
    if (is_available !== undefined) { updates.push('is_available = ?'); values.push(is_available ? 1 : 0); }
    if (updates.length) {
      values.push(req.params.id);
      await query(`UPDATE doctors SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    const [rows] = await query(
      `SELECT d.*, u.name, u.email FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?`,
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/doctors/:id - delete doctor (and user).
 */
export async function deleteDoctor(req, res, next) {
  try {
    const [doc] = await query('SELECT user_id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    await query('DELETE FROM users WHERE id = ?', [doc[0].user_id]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/patients - list all patients.
 */
export async function listPatients(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              (SELECT COUNT(*) FROM appointments WHERE patient_id = u.id) as total_visits,
              (SELECT MAX(appointment_date) FROM appointments WHERE patient_id = u.id) as last_visit
       FROM users u
       WHERE u.role = 'patient'
       ORDER BY u.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/analytics - revenue and appointment stats.
 */
export async function getAnalytics(req, res, next) {
  try {
    const [revenueRows] = await query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
       FROM appointments WHERE status IN ('confirmed', 'completed')
       GROUP BY month ORDER BY month DESC LIMIT 12`
    );
    const [typeRows] = await query(
      `SELECT type, COUNT(*) as count FROM appointments GROUP BY type`
    );
    const [totals] = await query(
      `SELECT
        (SELECT COUNT(*) FROM doctors) as doctors_count,
        (SELECT COUNT(*) FROM users WHERE role = 'patient') as patients_count,
        (SELECT COUNT(*) FROM appointments WHERE status = 'pending') as pending_count`
    );
    res.json({
      revenueByMonth: revenueRows,
      byType: typeRows,
      totals: totals[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/settings - get clinic settings.
 */
export async function getSettings(req, res, next) {
  try {
    const [rows] = await query('SELECT * FROM clinic_settings WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/settings - update clinic settings.
 */
export async function updateSettings(req, res, next) {
  try {
    const {
      clinic_name, contact_email, phone, address,
      email_notifications, sms_reminders, auto_confirm_appointments, default_appointment_duration_min,
    } = req.body;
    const updates = [];
    const values = [];
    if (clinic_name !== undefined) { updates.push('clinic_name = ?'); values.push(clinic_name); }
    if (contact_email !== undefined) { updates.push('contact_email = ?'); values.push(contact_email); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (email_notifications !== undefined) { updates.push('email_notifications = ?'); values.push(email_notifications ? 1 : 0); }
    if (sms_reminders !== undefined) { updates.push('sms_reminders = ?'); values.push(sms_reminders ? 1 : 0); }
    if (auto_confirm_appointments !== undefined) { updates.push('auto_confirm_appointments = ?'); values.push(auto_confirm_appointments ? 1 : 0); }
    if (default_appointment_duration_min !== undefined) { updates.push('default_appointment_duration_min = ?'); values.push(default_appointment_duration_min); }
    if (updates.length) {
      values.push(1);
      await query(`UPDATE clinic_settings SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    const [rows] = await query('SELECT * FROM clinic_settings WHERE id = 1');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}
