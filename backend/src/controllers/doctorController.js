/**
 * Doctor controller - list doctors (for booking), get one, update own profile/availability.
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
 * GET /api/doctors - list all available doctors (for patient booking dropdown).
 */
export async function list(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT d.id, d.user_id, d.specialization, d.consultation_fee, d.is_available,
              u.name
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
 * GET /api/doctors/:id/unavailable-days - get doctor's unavailable dates (for patient booking).
 * Public - used to disable dates in patient date picker.
 */
export async function getUnavailableDaysById(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const [rows] = await query(
      `SELECT unavailable_date
       FROM doctor_unavailable_days
       WHERE doctor_id = ? AND unavailable_date >= CURDATE()
       ORDER BY unavailable_date`,
      [req.params.id]
    );
    const dates = rows.map((r) => toDateOnly(r.unavailable_date)).filter(Boolean);
    res.json({ unavailable_dates: dates });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/doctors/:id - get one doctor by id (public for booking page).
 */
export async function getById(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT d.id, d.user_id, d.specialization, d.license_number, d.consultation_duration_min,
              d.consultation_fee, d.break_minutes, d.bio, d.is_available,
              u.name, u.email
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/doctors/me - get current user's doctor profile (doctor only).
 */
export async function getMe(req, res, next) {
  try {
    const [rows] = await query(
      'SELECT d.* FROM doctors d WHERE d.user_id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Doctor profile not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/doctors/me - update own doctor profile (doctor only).
 */
export async function updateMe(req, res, next) {
  try {
    const { specialization, license_number, bio, consultation_duration_min, consultation_fee, break_minutes, is_available } = req.body;
    const [existing] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }
    const updates = [];
    const values = [];
    if (specialization !== undefined) { updates.push('specialization = ?'); values.push(specialization); }
    if (license_number !== undefined) { updates.push('license_number = ?'); values.push(license_number); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
    if (consultation_duration_min !== undefined) { updates.push('consultation_duration_min = ?'); values.push(consultation_duration_min); }
    if (consultation_fee !== undefined) { updates.push('consultation_fee = ?'); values.push(consultation_fee); }
    if (break_minutes !== undefined) { updates.push('break_minutes = ?'); values.push(break_minutes); }
    if (is_available !== undefined) { updates.push('is_available = ?'); values.push(is_available ? 1 : 0); }
    if (updates.length) {
      values.push(req.user.id);
      await query(`UPDATE doctors SET ${updates.join(', ')} WHERE user_id = ?`, values);
    }
    const [rows] = await query('SELECT * FROM doctors WHERE user_id = ?', [req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/doctors/me/availability - get weekly availability (doctor only).
 */
export async function getAvailability(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const [rows] = await query(
      'SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY day_of_week',
      [doc[0].id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/doctors/me/availability - replace weekly availability (doctor only).
 * Body: [{ day_of_week, start_time, end_time, is_available }, ...]
 */
export async function setAvailability(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
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
 * GET /api/doctors/me/unavailable-days - list emergency full-day unavailability (doctor only).
 */
export async function listUnavailableDays(req, res, next) {
  try {
    const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const [rows] = await query(
      'SELECT id, unavailable_date, reason, created_at FROM doctor_unavailable_days WHERE doctor_id = ? ORDER BY unavailable_date DESC',
      [doc[0].id]
    );
    res.json(rows.map((r) => ({ ...r, unavailable_date: toDateOnly(r.unavailable_date) })));
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/doctors/me/unavailable-days - mark doctor unavailable for an entire day.
 * Body: { unavailable_date, reason? }
 *
 * This sets affected confirmed appointments on that day to `reschedule_required`
 * and emails the patients that the doctor is unavailable.
 */
export async function addUnavailableDay(req, res, next) {
  try {
    const { unavailable_date, reason } = req.body || {};
    if (!isValidISODate(unavailable_date)) {
      return res.status(400).json({ error: 'unavailable_date (YYYY-MM-DD) required' });
    }

    const [doc] = await query(
      `SELECT d.id, u.name as doctor_name
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.user_id = ?`,
      [req.user.id]
    );
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
    const doctorId = doc[0].id;

    await query(
      'INSERT INTO doctor_unavailable_days (doctor_id, unavailable_date, reason) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason)',
      [doctorId, unavailable_date, reason || null]
    );

    // Move confirmed appointments to reschedule_required for that day
    const [affected] = await query(
      `SELECT a.id, a.patient_id, pu.email as patient_email, pu.name as patient_name
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

      // Notify patients (doctor will later propose a new slot manually)
      await Promise.allSettled(
        affected.map((a) =>
          sendEmail({
            to: a.patient_email,
            subject: 'Appointment needs rescheduling',
            text: `Dear ${a.patient_name},\n\nDr. ${doc[0].doctor_name} is unavailable on ${unavailable_date} due to an emergency. The doctor will propose a new appointment time soon. You will receive another email once a new time is proposed.\n\nAyurSutra`,
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
 * DELETE /api/doctors/me/unavailable-days/:date - remove doctor unavailable day.
 */
export async function removeUnavailableDay(req, res, next) {
  try {
    const raw = req.params.date || '';
    const dateNorm = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNorm)) return res.status(400).json({ error: 'Invalid date format' });

    const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });

    const [result] = await query(
      'DELETE FROM doctor_unavailable_days WHERE doctor_id = ? AND DATE(unavailable_date) = ?',
      [doc[0].id, dateNorm]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Unavailable day not found' });
    res.json({ ok: true, removed_date: dateNorm });
  } catch (err) {
    next(err);
  }
}
