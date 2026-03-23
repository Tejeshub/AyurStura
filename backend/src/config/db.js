/**
 * Database configuration - creates a connection pool for MySQL.
 * Reads credentials from environment variables. Used by all routes.
 */

//1QtLuDjjkD8I1kYk

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '3EQQcsGgsSZKmv3.root',
  password: '1QtLuDjjkD8I1kYk', // 🔴 replace with your actual password
  database: 'test',
  ssl: {  
    rejectUnauthorized: true
  },
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