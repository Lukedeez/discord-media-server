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

/** Initializes DB connection based on config.json */
export async function initDatabase() {
  if (initialized) return;

  try {
      const { loadConfig } = await import('./loadConfig.js');
      const config = loadConfig();

      if (!config) {
        throw new Error('Configuration could not be loaded.');
      }

      isSQLite = config.dbType === 'sqlite';

      if (isSQLite) {
        const sqlite3 = (await import('better-sqlite3')).default;
        const sqlitePath = path.resolve(__dirname, '../data', path.basename(config.dbConfig.filename || 'media.sqlite'));
        fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
        db = new sqlite3(sqlitePath);
        if (!db || typeof db.prepare !== 'function') {
          throw new Error(`Failed to initialize SQLite DB at: ${sqlitePath}`);
        }
        //console.log(`SQLite DB loaded: ${sqlitePath}`);
      } else {
        const mysql = await import('mysql2/promise');
        db = await mysql.createConnection({
          host: config.dbConfig.host || config.dbHost,
          user: config.dbConfig.user || config.dbUser,
          password: config.dbConfig.password || process.env.DB_PASS,
          database: config.dbConfig.database || config.dbName
        });
        if (!db || typeof db.prepare !== 'function') {
          throw new Error('Failed to initialize SQLite database.');
        }
        //console.log(`MySQL DB connected: ${config.dbConfig.database || config.dbName}`);
      }

      initialized = true;
    } catch(err) {
      console.log(`\ninitDatabase error:\nPlease run setup first.\n\n${err.message}`)
    }
  
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

  if (!db) {
    throw new Error('Database is not initialized.');
  }

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
