// reset-db.js (clears Movie_Info table without touching config)
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


async function resetMovieTable() {
  
  try {
    //const {  query, close, isSQLite, initDatabase } = await import('./database.js');
    const configPath = path.join(__dirname, '../config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    if (!config) {
      throw new Error('Configuration could not be loaded.');
    }

    //await initDatabase();

    // delete cache file
    const CACHE_FILE = `../data/${config.dbConfig.database}.json`;
    const cachePath = path.resolve(__dirname, CACHE_FILE);
    fs.unlink(cachePath, (err) => {
      if (err) {
        console.log('Error deleting file:', err);
        return;
      }
      console.log('Cache file deleted successfully');
    });

    const dbModule = await import('./database.js');
    await dbModule.initDatabase();
    const { query, close, isSQLite } = dbModule;

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
