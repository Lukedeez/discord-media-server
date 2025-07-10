// server.js (ES module version with database.js integration)
import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { initDatabase, query, close } from './database.js';

await initDatabase(); // Ensure DB is connected

const app = express();
const PORT = process.env.PORT || 3000;

import config from '../config.json' assert { type: 'json' };
if(!config) {
  console.error('\nMissing config.json file\nPlease run setup or init first\n');
  process.exit(1);
}


const DB_PATH = path.join(__dirname, '../data', config.dbConfig.database+'.json');
let mediaIndex = [];

function loadIndex() {
  if (fs.existsSync(DB_PATH)) {
    mediaIndex = JSON.parse(fs.readFileSync(DB_PATH));
    console.log(`Loaded ${mediaIndex.length} entries from ${config.dbConfig.database}.json`);
  } else {
    mediaIndex = [];
    console.warn(`${config.dbConfig.database}.json not found — running empty.`);
  }
}
loadIndex();


// Serve static files from mediaDirectory (movies and posters)
app.use('/movies', express.static(config.mediaDirectory));
app.use(express.static(path.join(__dirname, 'public'))); // ✅ This line serves /public


app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'dashboard.html'));
});

// --- Web UI ---
app.get('/dashboard/media', (req, res) => {
  const recent = [...mediaIndex]
    .sort((a, b) => new Date(b.added) - new Date(a.added))
    .slice(0, 20);
  //res.render('media-dashboard', { media: recent, total: mediaIndex.length });
  res.json({ media: recent, total: mediaIndex.length });
});

app.get('/dashboard/movies', (req, res) => {
  const { title, year, format, imdb } = req.query;
  let results = mediaIndex;

  if (title) {
    results = results.filter(m =>
      m.title?.toLowerCase().includes(title.toLowerCase())
    );
  }
  if (year) {
    results = results.filter(m => String(m.year) === String(year));
  }
  if (format) {
    results = results.filter(m => m.format?.toLowerCase() === format.toLowerCase());
  }
  if (imdb) {
    results = results.filter(m => m.imdb?.toLowerCase().includes(imdb.toLowerCase()));
  }

  res.json({ total: results.length, results });
});

app.get('/dashboard/search', async (req, res) => {
  const { title, year, format, imdb } = req.query;
  let sql = 'SELECT * FROM Movie_Info';
  let conditions = [];
  let params = [];

  if (title) {
    conditions.push('title LIKE ?');
    params.push(`%${title}%`);
  }

  if (year) {
    conditions.push('year = ?');
    params.push(year);
  }

  if (format) {
    conditions.push('format like ?');
    params.push(`%${format}%`);
  }

  if (imdb) {
    conditions.push('imdb LIKE ?');
    params.push(`%${imdb}%`);
  }

  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY added_at DESC LIMIT 100';

  try {
    const results = await query(sql, params);
    res.json({ count: results.length, results });
  } catch (err) {
    console.error('SQL Query Failed:', err.message);
    res.status(500).json({ error: 'Query failed' });
  }
});





// Search movies
app.get('/api/search', async (req, res) => {
  const { title = '', year = '' } = req.query;

  let sql = 'SELECT * FROM Movie_Info WHERE 1=1';
  const args = [];

  if (title) {
    sql += ' AND title LIKE ?';
    args.push(`%${title}%`);
  }

  if (year) {
    sql += ' AND year = ?';
    args.push(year);
  }

  sql += ' ORDER BY title ASC LIMIT 25';

  try {
    const rows = await query(sql, args);
    const results = rows.map(movie => {
      const fullPosterPath = path.join(config.mediaDirectory, movie.poster || '');
      const posterURL = fs.existsSync(fullPosterPath)
        ? `/movies/${encodeURI(movie.poster)}`
        : movie.poster_fallback || null;

      return {
        ...movie,
        posterURL
      };
    });
    res.json(results);
  } catch (err) {
    console.error('DB search error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Return one random movie
app.get('/api/random', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM Movie_Info ORDER BY RANDOM() LIMIT 1');
    if (!rows.length) return res.status(404).json({ error: 'No movies found' });

    const movie = rows[0];
    const fullPosterPath = path.join(config.mediaDirectory, movie.poster || '');
    const posterURL = fs.existsSync(fullPosterPath)
      ? `/movies/${encodeURI(movie.poster)}`
      : movie.poster_fallback || null;

    res.json({ ...movie, posterURL });
  } catch (err) {
    console.error('DB random fetch error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await close();
  console.log('\nServer shutting down.');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\nMedia server running at http://localhost:${PORT}`);
  console.log(`Serving media from: ${config.mediaDirectory}`);
});
