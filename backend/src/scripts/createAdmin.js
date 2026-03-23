/**
 * One-time script to create admin user. Run: node src/scripts/createAdmin.js
 * Requires .env with DB_* and from backend folder. Password will be admin@1234.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

async function main() {
  const email = 'admin@ayursutra.local';
  const password = 'admin@1234';
  const hash = await bcrypt.hash(password, 10);
  try {
    await query(
      'INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, ?, ?)',
      [email, hash, 'admin', 'Administrator']
    );
    console.log('Admin user created. Email:', email, 'Password:', password);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') console.log('Admin user already exists.');
    else throw err;
  }
  process.exit(0);
}
main();
