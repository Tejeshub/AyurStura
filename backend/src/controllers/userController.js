/**
 * User controller - get current user profile, update profile.
 * req.user is set by authMiddleware.
 */
import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

/**
 * GET /api/users/me - return current user (and doctor row if doctor).
 */
export async function getMe(req, res, next) {
  try {
    const [users] = await query(
      'SELECT id, email, role, name, phone, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!users.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];
    if (req.user.role === 'doctor') {
      const [doctors] = await query(
        'SELECT id, specialization, license_number, consultation_duration_min, consultation_fee, break_minutes, bio, is_available FROM doctors WHERE user_id = ?',
        [req.user.id]
      );
      user.doctor = doctors[0] || null;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/users/me - update current user (name, phone, and for doctor: profile fields).
 */
export async function updateMe(req, res, next) {
  try {
    const { name, phone, date_of_birth, gender, blood_group, medical_history } = req.body;
    const updates = [];
    const values = [];
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (updates.length) {
      values.push(req.user.id);
      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    if (req.user.role === 'doctor') {
      const { specialization, license_number, bio, consultation_duration_min, consultation_fee, break_minutes } = req.body;
      const docUpdates = [];
      const docValues = [];
      if (specialization !== undefined) { docUpdates.push('specialization = ?'); docValues.push(specialization); }
      if (license_number !== undefined) { docUpdates.push('license_number = ?'); docValues.push(license_number); }
      if (bio !== undefined) { docUpdates.push('bio = ?'); docValues.push(bio); }
      if (consultation_duration_min !== undefined) { docUpdates.push('consultation_duration_min = ?'); docValues.push(consultation_duration_min); }
      if (consultation_fee !== undefined) { docUpdates.push('consultation_fee = ?'); docValues.push(consultation_fee); }
      if (break_minutes !== undefined) { docUpdates.push('break_minutes = ?'); docValues.push(break_minutes); }
      if (docUpdates.length) {
        docValues.push(req.user.id);
        await query(
          `UPDATE doctors SET ${docUpdates.join(', ')} WHERE user_id = ?`,
          docValues
        );
      }
    }

    const [users] = await query(
      'SELECT id, email, role, name, phone FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = users[0];
    if (req.user.role === 'doctor') {
      const [doctors] = await query('SELECT * FROM doctors WHERE user_id = ?', [req.user.id]);
      user.doctor = doctors[0] || null;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
}
