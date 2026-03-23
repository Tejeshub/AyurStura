/**
 * Appointment controller - book, list, get one, update status (confirm/cancel/complete).
 */
import { query } from '../config/db.js';
import { sendEmail } from '../utils/mailer.js';

const FIXED_BREAK_START = '13:00';
const FIXED_BREAK_END = '14:00';

function isValidISODate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isValidHHMM(s) {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function fromMinutes(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function getDoctorIdForUser(userId) {
  const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
  return doc.length ? doc[0].id : null;
}

async function getDoctorAvailabilityForDate(doctorId, isoDate) {
  // MySQL schema uses day_of_week: 0=Sun..6=Sat
  const d = new Date(`${isoDate}T00:00:00`);
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const [rows] = await query(
    'SELECT start_time, end_time, is_available FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ?',
    [doctorId, jsDay]
  );
  if (!rows.length || !rows[0].is_available) return null;
  return {
    start_time: rows[0].start_time?.slice(0, 5),
    end_time: rows[0].end_time?.slice(0, 5),
  };
}

async function isDoctorUnavailableFullDay(doctorId, isoDate) {
  const [rows] = await query(
    'SELECT id FROM doctor_unavailable_days WHERE doctor_id = ? AND unavailable_date = ?',
    [doctorId, isoDate]
  );
  return rows.length > 0;
}

async function getBookedTimes(doctorId, isoDate, excludeAppointmentId = null) {
  const params = [doctorId, isoDate];
  let excludeSql = '';
  if (excludeAppointmentId) {
    excludeSql = ' AND a.id <> ?';
    params.push(excludeAppointmentId);
  }
  const [rows] = await query(
    `SELECT a.confirmed_time, a.reschedule_proposed_time, a.status
     FROM appointments a
     WHERE a.doctor_id = ?
       AND (
         (a.confirmed_date = ? AND a.status IN ('confirmed', 'reschedule_required'))
         OR (a.reschedule_proposed_date = ? AND a.status = 'reschedule_proposed')
       )
       ${excludeSql}`,
    excludeAppointmentId ? [doctorId, isoDate, isoDate, excludeAppointmentId] : [doctorId, isoDate, isoDate]
  );

  const set = new Set();
  for (const r of rows) {
    const t1 = r.confirmed_time ? r.confirmed_time.slice(0, 5) : null;
    const t2 = r.reschedule_proposed_time ? r.reschedule_proposed_time.slice(0, 5) : null;
    if (t1) set.add(t1);
    if (t2) set.add(t2);
  }
  return set;
}

function generateHourlySlots(startTime, endTime) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots = [];
  for (let t = start; t + 60 <= end; t += 60) {
    const hhmm = fromMinutes(t);
    // Skip fixed break 13:00-14:00 slot start (and any start that would overlap break)
    if (hhmm === FIXED_BREAK_START) continue;
    // Also skip if slot overlaps the break window (for safety)
    const slotEnd = t + 60;
    const breakStart = toMinutes(FIXED_BREAK_START);
    const breakEnd = toMinutes(FIXED_BREAK_END);
    const overlapsBreak = t < breakEnd && slotEnd > breakStart;
    if (overlapsBreak) continue;
    slots.push(hhmm);
  }
  return slots;
}

/**
 * POST /api/appointments - request an appointment (patient only).
 * Body: doctor_id, type, appointment_date(preferred_date), symptoms.
 */
export async function create(req, res, next) {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Only patients can book appointments' });
    }
    const { doctor_id, type, appointment_date, symptoms } = req.body;
    if (!doctor_id || !type || !appointment_date) {
      return res.status(400).json({ error: 'doctor_id, type, appointment_date required' });
    }
    const validTypes = ['consultation', 'follow-up', 'panchakarma', 'therapy'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid appointment type' });
    }

    const [result] = await query(
      `INSERT INTO appointments (patient_id, doctor_id, type, appointment_date, appointment_time, symptoms, status)
       VALUES (?, ?, ?, ?, NULL, ?, 'pending')`,
      [req.user.id, doctor_id, type, appointment_date, symptoms || null]
    );
    const [rows] = await query(
      `SELECT a.*, u.name as doctor_name, d.specialization
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE a.id = ?`,
      [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments - list appointments. Patient: own; Doctor: own doctor's; Admin: all (optional query filters).
 */
export async function list(req, res, next) {
  try {
    let sql = '';
    let params = [];
    if (req.user.role === 'patient') {
      sql = `SELECT a.*, u.name as doctor_name, d.specialization
             FROM appointments a
             JOIN doctors d ON d.id = a.doctor_id
             JOIN users u ON u.id = d.user_id
             WHERE a.patient_id = ?
             ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'doctor') {
      const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
      if (!doc.length) return res.status(404).json({ error: 'Doctor not found' });
      sql = `SELECT a.*, u.name as patient_name, u.email as patient_email
             FROM appointments a
             JOIN users u ON u.id = a.patient_id
             WHERE a.doctor_id = ?
             ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
      params = [doc[0].id];
    } else if (req.user.role === 'admin') {
      sql = `SELECT a.*,
                    pu.name as patient_name, pu.email as patient_email,
                    du.name as doctor_name, d.specialization
             FROM appointments a
             JOIN users pu ON pu.id = a.patient_id
             JOIN doctors d ON d.id = a.doctor_id
             JOIN users du ON du.id = d.user_id
             ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [rows] = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments/:id - get one appointment (owner or admin).
 */
export async function getById(req, res, next) {
  try {
    const [rows] = await query(
      `SELECT a.*,
              pu.name as patient_name, pu.email as patient_email, pu.phone as patient_phone,
              du.name as doctor_name, d.specialization
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];
    if (req.user.role === 'patient' && appt.patient_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role === 'doctor') {
      const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
      if (!doc.length || appt.doctor_id !== doc[0].id) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(appt);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/appointments/:id - update status (confirm, cancel, complete). Doctor or admin.
 */
export async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const valid = ['pending', 'confirmed', 'reschedule_required', 'reschedule_proposed', 'cancelled', 'completed'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ error: 'Valid status required: pending, confirmed, reschedule_required, reschedule_proposed, cancelled, completed' });
    }
    const [rows] = await query('SELECT id, doctor_id FROM appointments WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];

    if (req.user.role === 'doctor') {
      const [doc] = await query('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
      if (!doc.length || appt.doctor_id !== doc[0].id) return res.status(403).json({ error: 'Forbidden' });
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await query('UPDATE appointments SET status = ? WHERE id = ?', [status, req.params.id]);
    const [updated] = await query(
      `SELECT a.*, u.name as doctor_name, d.specialization
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users u ON u.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/appointments/:id/available-slots?date=YYYY-MM-DD
 * Doctor or admin. Used for confirming pending or proposing reschedule.
 */
export async function getAvailableSlotsForAppointment(req, res, next) {
  try {
    let doctorId;
    if (req.user.role === 'doctor') {
      doctorId = await getDoctorIdForUser(req.user.id);
      if (!doctorId) return res.status(404).json({ error: 'Doctor not found' });
    } else if (req.user.role === 'admin') {
      const [apptRows] = await query('SELECT doctor_id FROM appointments WHERE id = ?', [req.params.id]);
      if (!apptRows.length) return res.status(404).json({ error: 'Appointment not found' });
      doctorId = apptRows[0].doctor_id;
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { date } = req.query;
    if (!isValidISODate(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });

    const [apptRows] = await query('SELECT id, doctor_id FROM appointments WHERE id = ?', [req.params.id]);
    if (!apptRows.length) return res.status(404).json({ error: 'Appointment not found' });
    if (req.user.role === 'doctor' && apptRows[0].doctor_id !== doctorId) return res.status(403).json({ error: 'Forbidden' });

    const unavailable = await isDoctorUnavailableFullDay(doctorId, date);
    if (unavailable) return res.json({ date, slots: [] });

    const avail = await getDoctorAvailabilityForDate(doctorId, date);
    if (!avail) return res.json({ date, slots: [] });

    const allSlots = generateHourlySlots(avail.start_time, avail.end_time);
    const booked = await getBookedTimes(doctorId, date, req.params.id);
    const free = allSlots.filter((t) => !booked.has(t));

    res.json({ date, slots: free });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments/:id/confirm
 * Doctor or admin. Body: { confirmed_date, confirmed_time } (HH:MM, must be hourly slot)
 */
export async function confirmWithSlot(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    if (req.user.role !== 'doctor' && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    let doctorId;
    if (req.user.role === 'doctor') {
      doctorId = await getDoctorIdForUser(req.user.id);
      if (!doctorId) return res.status(404).json({ error: 'Doctor not found' });
    } else {
      const [dr] = await query('SELECT doctor_id FROM appointments WHERE id = ?', [req.params.id]);
      if (!dr.length) return res.status(404).json({ error: 'Appointment not found' });
      doctorId = dr[0].doctor_id;
    }

    const { confirmed_date, confirmed_time } = req.body || {};
    if (!isValidISODate(confirmed_date) || !isValidHHMM(confirmed_time)) {
      return res.status(400).json({ error: 'confirmed_date (YYYY-MM-DD) and confirmed_time (HH:MM) required' });
    }
    if (confirmed_time.split(':')[1] !== '00') {
      return res.status(400).json({ error: 'confirmed_time must be on the hour (e.g. 10:00, 11:00)' });
    }

    const [apptRows] = await query(
      `SELECT a.*, pu.email as patient_email, pu.name as patient_name, du.name as doctor_name
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!apptRows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = apptRows[0];
    if (req.user.role === 'doctor' && appt.doctor_id !== doctorId) return res.status(403).json({ error: 'Forbidden' });
    if (appt.status !== 'pending') return res.status(400).json({ error: 'Only pending appointments can be confirmed' });

    // Validate slot availability
    if (await isDoctorUnavailableFullDay(doctorId, confirmed_date)) {
      return res.status(400).json({ error: 'Doctor is unavailable on that date' });
    }
    const avail = await getDoctorAvailabilityForDate(doctorId, confirmed_date);
    if (!avail) return res.status(400).json({ error: 'Doctor is not available on that weekday' });

    const possible = new Set(generateHourlySlots(avail.start_time, avail.end_time));
    if (!possible.has(confirmed_time)) return res.status(400).json({ error: 'Time is outside working hours or during break' });

    const booked = await getBookedTimes(doctorId, confirmed_date, appt.id);
    if (booked.has(confirmed_time)) return res.status(409).json({ error: 'Slot already booked' });

    await query(
      `UPDATE appointments
       SET confirmed_date = ?, confirmed_time = ?, status = 'confirmed'
       WHERE id = ?`,
      [confirmed_date, confirmed_time, appt.id]
    );

    const emailText = isAdmin
      ? `Dear ${appt.patient_name},\n\nThe clinic has confirmed your appointment with Dr. ${appt.doctor_name} on ${confirmed_date} at ${confirmed_time}.\n\nAyurSutra`
      : `Dear ${appt.patient_name},\n\nYour appointment with Dr. ${appt.doctor_name} is confirmed on ${confirmed_date} at ${confirmed_time}.\n\nAyurSutra`;
    await sendEmail({
      to: appt.patient_email,
      subject: 'Your appointment is confirmed',
      text: emailText,
    });

    const [updated] = await query('SELECT * FROM appointments WHERE id = ?', [appt.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments/:id/reschedule/propose
 * Doctor or admin. Body: { reschedule_proposed_date, reschedule_proposed_time }
 */
export async function proposeReschedule(req, res, next) {
  try {
    const isAdmin = req.user.role === 'admin';
    if (req.user.role !== 'doctor' && !isAdmin) return res.status(403).json({ error: 'Forbidden' });

    let doctorId;
    if (req.user.role === 'doctor') {
      doctorId = await getDoctorIdForUser(req.user.id);
      if (!doctorId) return res.status(404).json({ error: 'Doctor not found' });
    } else {
      const [dr] = await query('SELECT doctor_id FROM appointments WHERE id = ?', [req.params.id]);
      if (!dr.length) return res.status(404).json({ error: 'Appointment not found' });
      doctorId = dr[0].doctor_id;
    }

    const { reschedule_proposed_date, reschedule_proposed_time } = req.body || {};
    if (!isValidISODate(reschedule_proposed_date) || !isValidHHMM(reschedule_proposed_time)) {
      return res.status(400).json({ error: 'reschedule_proposed_date and reschedule_proposed_time required' });
    }
    if (reschedule_proposed_time.split(':')[1] !== '00') {
      return res.status(400).json({ error: 'reschedule_proposed_time must be on the hour' });
    }

    const [apptRows] = await query(
      `SELECT a.*, pu.email as patient_email, pu.name as patient_name, du.name as doctor_name
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!apptRows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = apptRows[0];
    if (req.user.role === 'doctor' && appt.doctor_id !== doctorId) return res.status(403).json({ error: 'Forbidden' });
    if (!['confirmed', 'reschedule_required'].includes(appt.status)) {
      return res.status(400).json({ error: 'Only confirmed/reschedule_required appointments can be rescheduled' });
    }

    // Validate new slot availability
    if (await isDoctorUnavailableFullDay(doctorId, reschedule_proposed_date)) {
      return res.status(400).json({ error: 'Doctor is unavailable on that date' });
    }
    const avail = await getDoctorAvailabilityForDate(doctorId, reschedule_proposed_date);
    if (!avail) return res.status(400).json({ error: 'Doctor is not available on that weekday' });

    const possible = new Set(generateHourlySlots(avail.start_time, avail.end_time));
    if (!possible.has(reschedule_proposed_time)) return res.status(400).json({ error: 'Time is outside working hours or during break' });

    const booked = await getBookedTimes(doctorId, reschedule_proposed_date, appt.id);
    if (booked.has(reschedule_proposed_time)) return res.status(409).json({ error: 'Slot already booked' });

    await query(
      `UPDATE appointments
       SET reschedule_proposed_date = ?, reschedule_proposed_time = ?, status = 'reschedule_proposed'
       WHERE id = ?`,
      [reschedule_proposed_date, reschedule_proposed_time, appt.id]
    );

    const emailText = isAdmin
      ? `Dear ${appt.patient_name},\n\nThe clinic has proposed a new appointment time with Dr. ${appt.doctor_name}: ${reschedule_proposed_date} at ${reschedule_proposed_time}.\nPlease log in to AyurSutra to Accept or Reject this reschedule.\n\nAyurSutra`
      : `Dear ${appt.patient_name},\n\nDr. ${appt.doctor_name} has proposed a new appointment time: ${reschedule_proposed_date} at ${reschedule_proposed_time}.\nPlease log in to AyurSutra to Accept or Reject this reschedule.\n\nAyurSutra`;
    await sendEmail({
      to: appt.patient_email,
      subject: 'Appointment reschedule proposed',
      text: emailText,
    });

    const [updated] = await query('SELECT * FROM appointments WHERE id = ?', [appt.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments/:id/cancel
 * Admin only. Cancels appointment directly and emails patient.
 */
export async function adminCancel(req, res, next) {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const [rows] = await query(
      `SELECT a.*, pu.email as patient_email, pu.name as patient_name, du.name as doctor_name
       FROM appointments a
       JOIN users pu ON pu.id = a.patient_id
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];
    if (['cancelled', 'completed'].includes(appt.status)) {
      return res.status(400).json({ error: 'Appointment already cancelled or completed' });
    }

    await query(
      `UPDATE appointments
       SET status = 'cancelled',
           reschedule_proposed_date = NULL,
           reschedule_proposed_time = NULL
       WHERE id = ?`,
      [appt.id]
    );

    await sendEmail({
      to: appt.patient_email,
      subject: 'Appointment cancelled',
      text: `Dear ${appt.patient_name},\n\nThe clinic has cancelled your appointment with Dr. ${appt.doctor_name}.\n\nAyurSutra`,
    });

    const [updated] = await query('SELECT * FROM appointments WHERE id = ?', [appt.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments/:id/reschedule/accept
 * Patient only.
 */
export async function acceptReschedule(req, res, next) {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can accept' });

    const [rows] = await query(
      `SELECT a.*, du.name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];
    if (appt.patient_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (appt.status !== 'reschedule_proposed') return res.status(400).json({ error: 'No reschedule proposal to accept' });
    if (!appt.reschedule_proposed_date || !appt.reschedule_proposed_time) {
      return res.status(400).json({ error: 'Missing proposed slot' });
    }

    await query(
      `UPDATE appointments
       SET confirmed_date = reschedule_proposed_date,
           confirmed_time = reschedule_proposed_time,
           reschedule_proposed_date = NULL,
           reschedule_proposed_time = NULL,
           status = 'confirmed'
       WHERE id = ?`,
      [appt.id]
    );

    await sendEmail({
      to: req.user.email,
      subject: 'Reschedule accepted - appointment confirmed',
      text: `Your appointment with Dr. ${appt.doctor_name} is confirmed on ${appt.reschedule_proposed_date} at ${appt.reschedule_proposed_time}.\n\nAyurSutra`,
    });

    const [updated] = await query('SELECT * FROM appointments WHERE id = ?', [appt.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/appointments/:id/reschedule/reject
 * Patient only. Cancels the appointment if patient rejects.
 */
export async function rejectReschedule(req, res, next) {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can reject' });

    const [rows] = await query(
      `SELECT a.*, du.name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       JOIN users du ON du.id = d.user_id
       WHERE a.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const appt = rows[0];
    if (appt.patient_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (appt.status !== 'reschedule_proposed') return res.status(400).json({ error: 'No reschedule proposal to reject' });

    await query(
      `UPDATE appointments
       SET status = 'cancelled',
           reschedule_proposed_date = NULL,
           reschedule_proposed_time = NULL
       WHERE id = ?`,
      [appt.id]
    );

    await sendEmail({
      to: req.user.email,
      subject: 'Appointment cancelled',
      text: `Your appointment with Dr. ${appt.doctor_name} has been cancelled because you rejected the proposed reschedule.\n\nAyurSutra`,
    });

    const [updated] = await query('SELECT * FROM appointments WHERE id = ?', [appt.id]);
    res.json(updated[0]);
  } catch (err) {
    next(err);
  }
}
