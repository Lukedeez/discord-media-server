// database.js (universal MySQL + SQLite handler)
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

let db;
let isSQLite = false;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy-loaded config & connection
let initialized = false;

const { loadConfig } = await import('./loadConfig.js');
const config = loadConfig();
isSQLite = config.dbType === 'sqlite';

/** Initializes DB connection based on config.json */
export async function initDatabase() {
  if (initialized) return;

  if (isSQLite) {
    const sqlite3 = (await import('better-sqlite3')).default;
    db = new sqlite3(path.join(__dirname, config.dbConfig.filename || config.dbName));
  } else {
    const mysql = await import('mysql2/promise');
    db = await mysql.createConnection({
      host: config.dbConfig.host || config.dbHost,
      user: config.dbConfig.user || config.dbUser,
      password: config.dbConfig.password || process.env.DB_PASS,
      database: config.dbConfig.database || config.dbName
    });
  }

  initialized = true;
}

/** Connects to SQLite for setup validation */
export async function connectSQLite(config) {
  const sqlite3 = (await import('better-sqlite3')).default;

  const dbPath = path.resolve(__dirname, '../data', config.filename || 'database.sqlite');

  // Ensure the folder exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  try {
    const db = new sqlite3(dbPath);
    db.exec('SELECT 1');
    db.close();
    console.log(`SQLite database ready at ${dbPath}`);
  } catch (err) {
    console.error('SQLite connection failed:', err.message);
    process.exit(1);
  }
}

/** Connects to MySQL for setup validation */
export async function connectMySQL(config) {
  try {
    const mysql = await import('mysql2/promise');
    const db = await mysql.createConnection({
      host: config.host,
      user: config.user,
      password: config.password,
      database: config.database
    });
    await db.query('SELECT 1');
    await db.end();
    console.log('MySQL connection successful');
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    process.exit(1);
  }
}

export async function query(sql, params = []) {
  if (!initialized) await initDatabase();

  if (isSQLite) {
    const stmt = db.prepare(sql);
    if (sql.trim().toLowerCase().startsWith('select')) {
      return stmt.all(...params);
    } else {
      return stmt.run(...params);
    }
  } else {
    const [rows] = await db.execute(sql, params);
    return rows;
  }
}

export async function close() {
  if (!initialized) return;
  if (isSQLite) {
    db.close();
  } else {
    await db.end();
  }
}

export { isSQLite };
