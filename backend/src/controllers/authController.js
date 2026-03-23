/**
 * Auth controller - register, login, logout, refresh token.
 * Uses httpOnly cookies: accessToken (30m), refreshToken (7d).
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;
const accessExpiry = process.env.JWT_ACCESS_EXPIRY || '30m';
const refreshExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
};

function setTokens(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 30 * 60 * 1000 }); // 30 min
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 }); // 7 days
}

/**
 * POST /api/auth/register - create user (patient or doctor). Admin is not registerable.
 */
export async function register(req, res, next) {
  try {
    const { email, password, name, phone, role, specialization, license_number } = req.body;
    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'Email, password, name, and role are required' });
    }
    if (!['patient', 'doctor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be patient or doctor' });
    }
    if (role === 'doctor' && !license_number) {
      return res.status(400).json({ error: 'License number required for doctors' });
    }

    const [existing] = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [insertResult] = await query(
      'INSERT INTO users (email, password_hash, role, name, phone) VALUES (?, ?, ?, ?, ?)',
      [email, password_hash, role, name, phone || null]
    );
    const userId = insertResult.insertId;

    if (role === 'doctor') {
      await query(
        'INSERT INTO doctors (user_id, specialization, license_number) VALUES (?, ?, ?)',
        [userId, specialization || null, license_number]
      );
    }

    const user = { id: userId, email, name, role, phone: phone || null };
    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      accessSecret,
      { expiresIn: accessExpiry }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      refreshSecret,
      { expiresIn: refreshExpiry }
    );
    setTokens(res, accessToken, refreshToken);
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login - validate credentials and set cookies.
 * Admin: demo check password (e.g. admin@1234) or store admin in DB with hashed password.
 */
export async function login(req, res, next) {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [users] = await query(
      'SELECT id, email, password_hash, role, name, phone FROM users WHERE email = ?',
      [email]
    );
    const userRow = users[0];
    if (!userRow) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (role && userRow.role !== role) {
      return res.status(401).json({ error: 'Invalid role for this account' });
    }

    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: userRow.role,
      phone: userRow.phone || null,
    };

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      accessSecret,
      { expiresIn: accessExpiry }
    );
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      refreshSecret,
      { expiresIn: refreshExpiry }
    );
    setTokens(res, accessToken, refreshToken);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout - clear cookies.
 */
export async function logout(req, res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.json({ message: 'Logged out' });
}

/**
 * POST /api/auth/refresh - issue new access token using refresh token cookie.
 */
export async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'No refresh token' });
    }
    const decoded = jwt.verify(token, refreshSecret);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const [users] = await query(
      'SELECT id, email, role FROM users WHERE id = ?',
      [decoded.userId]
    );
    if (!users.length) {
      res.clearCookie('refreshToken', { path: '/' });
      return res.status(401).json({ error: 'User not found' });
    }
    const u = users[0];
    const accessToken = jwt.sign(
      { userId: u.id, role: u.role, email: u.email },
      accessSecret,
      { expiresIn: accessExpiry }
    );
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 30 * 60 * 1000,
    });
    res.json({ ok: true });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/' });
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}
