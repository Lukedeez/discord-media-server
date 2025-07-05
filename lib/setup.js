// setup.js — interactive setup for discord-media-server
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
//import { isSQLite, connectSQLite, connectMySQL } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env');

dotenv.config({ path: envPath });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function updateOrAdd(key, value) {
  let lines = [];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '' && !line.startsWith(key + '='));
  }
  lines.push(`${key}=${value}`);
  fs.writeFileSync(envPath, lines.join('\n').trim() + '\n', 'utf8');
}

async function promptValidMediaPath() {
  let dir = '';
  while (true) {
    dir = await ask('Full path to media folder (e.g., /home/user/Movies or D:\\Media\\Movies): ');
    if (fs.existsSync(dir)) return dir;
    console.log('That folder does not exist. Try again.');
  }
}

export default async function runSetup() {
  await main();
}

async function main() {
  console.log('Running setup...\n');


  const configPath = path.join(__dirname, '../config.json');
  let config = {};

  let shouldWriteEnv = false;
  if (fs.existsSync(envPath)) {
    const overwriteEnv = (await ask('.env already exists. Overwrite? (y/N): ')).toLowerCase();
    if (overwriteEnv !== 'y') {
      console.log('Skipping .env creation.');
    } else {
      shouldWriteEnv = true;
    }
  } else {
    shouldWriteEnv = true;
  }

  const { connectMySQL, connectSQLite, query } = await import('./database.js');

  if (fs.existsSync(configPath)) {
    const overwrite = (await ask('config.json already exists. Overwrite? (y/N): ')).toLowerCase();
    if (overwrite !== 'y') {
      console.log('Using existing config.json values...');
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } else {
      const mediaDirectory = await promptValidMediaPath();

      const dbChoice = await ask('Choose database type:\n1. SQLite\n2. MySQL\nEnter number: ');
      let dbType = dbChoice === '1' ? 'sqlite' : 'mysql';
      let dbConfig = {};

      if (dbType === 'sqlite') {
        let dbName = await ask('SQLite Database name: ');
        dbConfig = { 
          filename: path.resolve(__dirname, `../data/${dbName}.sqlite`),
          database: dbName
        };
        await connectSQLite(dbConfig);
      } else {
        dbConfig = {
          host: await ask('MySQL Host (localhost): ') || 'localhost',
          user: await ask('MySQL User: '),
          password: await ask('MySQL Password: '),
          database: await ask('MySQL Database name: ')
        };
        await connectMySQL(dbConfig);
      }

      config = { mediaDirectory, dbType, dbConfig };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  } else {
    const mediaDirectory = await promptValidMediaPath();

    const dbChoice = await ask('Choose database type:\n1. SQLite\n2. MySQL\nEnter number:');
    let dbType = dbChoice === '1' ? 'sqlite' : 'mysql';
    let dbConfig = {};

    if (dbType === 'sqlite') {
      let dbName = await ask('SQLite Database name: ');
      dbConfig = { 
        filename: path.resolve(__dirname, `../data/${dbName}.sqlite`),
        database: dbName
      };
      await connectSQLite(dbConfig);
    } else {
      dbConfig = {
        host: await ask('MySQL Host (localhost): ') || 'localhost',
        user: await ask('MySQL User: '),
        password: await ask('MySQL Password: '),
        database: await ask('MySQL Database name: ')
      };
      await connectMySQL(dbConfig);
    }

    config = { mediaDirectory, dbType, dbConfig };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  // Always update .env from config
  let discordClientId = '';
  if (shouldWriteEnv) {
    const discordToken = await ask('Discord Bot Token: ');
    discordClientId = await ask('Discord Client ID (optional): ');
    const tmdbKey = await ask('TMDb API Key (optional): ');

    updateOrAdd('DB_TYPE', config.dbType);
    updateOrAdd('MEDIA_DIR', config.mediaDirectory);
    if (config.dbType === 'mysql') {
      updateOrAdd('DB_HOST', config.dbConfig.host);
      updateOrAdd('DB_USER', config.dbConfig.user);
      updateOrAdd('DB_PASS', config.dbConfig.password);
      updateOrAdd('DB_NAME', config.dbConfig.database);
    }
    updateOrAdd('DISCORD_TOKEN', discordToken);
    if (discordClientId) updateOrAdd('DISCORD_CLIENT_ID', discordClientId);
    updateOrAdd('TMDB_API_KEY', tmdbKey);
  }

  console.log('\nCreating database tables...');
  if (config.dbType === 'mysql') {
    const mysql = await import('mysql2/promise');
    try {
      const conn = await mysql.createConnection({ host: config.dbConfig.host, user: config.dbConfig.user, password: config.dbConfig.password });
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbConfig.database}\``);
      await conn.query(`USE \`${config.dbConfig.filename}\``);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS Movie_Info (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          year VARCHAR(10),
          filename TEXT NOT NULL,
          poster TEXT,
          poster_fallback TEXT,
          filepath TEXT,
          filesize BIGINT,
          imdb VARCHAR(20),
          format VARCHAR(20),
          runtime VARCHAR(50),
          rating VARCHAR(10),
          overview TEXT,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(title, year)
        )
      `);
      await conn.end();
      console.log(`MySQL database and table setup complete.`);
    } catch (err) {
      console.error('MySQL setup failed:', err.message);
      process.exit(1);
    }
  } else {
    const sqlite3 = (await import('better-sqlite3')).default;
    const db = new sqlite3(config.dbConfig.filename);
    db.prepare(`
      CREATE TABLE IF NOT EXISTS Movie_Info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        year TEXT,
        filename TEXT NOT NULL,
        poster TEXT,
        poster_fallback TEXT,
        filepath TEXT,
        filesize INTEGER,
        imdb TEXT,
        format TEXT,
        runtime TEXT,
        rating TEXT,
        overview TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(title, year)
      )
    `).run();
    console.log(`SQLite database '${config.dbConfig.filename}' initialized.`);
  }

  rl.close();

  console.log('\nSetup complete.');
  if (discordClientId) {
    console.log(`\nInvite your bot with this link:\nhttps://discord.com/oauth2/authorize?client_id=${discordClientId}&scope=bot&permissions=274877975552`);
  }
}

//main();

export { runSetup };