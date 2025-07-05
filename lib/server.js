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

import { query, close } from './database.js';

const app = express();
const PORT = 3000;

import config from '../config.json' assert { type: 'json' };
if(!config) {
  console.error('\nMissing config.json file\nPlease run setup or init first\n');
  process.exit(1);
}

// Serve static files from mediaDirectory (movies and posters)
app.use('/movies', express.static(config.mediaDirectory));

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
