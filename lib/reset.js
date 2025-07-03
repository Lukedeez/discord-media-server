// reset-db.js (clears Movie_Info table without touching config)
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, close, isSQLite } from './database.js';
import config from '../config.json' assert { type: 'json' };
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function resetMovieTable() {
  try {
    // delete cache file
    const CACHE_FILE = `../data/${config.dbConfig.database}.json`;
    const cachePath = path.resolve(__dirname, CACHE_FILE);
    fs.unlink(cachePath, (err) => {
      if (err) {
        console.log('Error deleting file:', err);
        return;
      }
      console.log('File deleted successfully');
    });

    // delete database
    if (isSQLite) {
      await query('DELETE FROM Movie_Info');
      await query('VACUUM'); // Clean up disk space
    } else {
      await query('TRUNCATE TABLE Movie_Info');
    }

    console.log('Movie_Info table has been cleared.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to reset Movie_Info:', err.message);
    process.exit(1);
  } finally {
    await close();
  }
}

resetMovieTable();
