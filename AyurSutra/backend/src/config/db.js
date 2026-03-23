/**
 * Database configuration - creates a connection pool for MySQL.
 * Reads credentials from environment variables. Used by all routes.
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ayursutra_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Execute a query with optional parameters (prevents SQL injection).
 * @param {string} sql - SQL string with ? placeholders
 * @param {Array} [params] - Values to substitute
 * @returns {Promise<[rows, fields]>}
 */
export async function query(sql, params = []) {
  const [rows, fields] = await pool.execute(sql, params);
  return [rows, fields];
}

/**
 * Get a single connection from the pool (for transactions).
 * Remember to connection.release() when done.
 */
export function getConnection() {
  return pool.getConnection();
}

export default pool;
