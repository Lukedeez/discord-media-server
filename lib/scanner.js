// scanner.js (unified with database.js + supports SQLite/MySQL)
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
//dotenv.config();

import { writeFile, readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//dotenv.config({ path: path.resolve(__dirname, '../.env') });
const envPath = path.resolve(__dirname, '../.env');
const loaded = dotenv.config({ path: envPath });

if (loaded.error) {
  console.error('\nFailed to load .env\nPlease run setup first\n\n', loaded.error);
  process.exit(1);
}

const API_KEY = process.env.TMDB_API_KEY;
if (!API_KEY) {
  console.error('Missing TMDB_API_KEY in .env');
  console.error(`Looked in: ${envPath}`);
  //process.exit(1);
}

import config from '../config.json' assert { type: 'json' };
if(!config) {
  console.error('\nMissing config.json file\nPlease run setup or init first\n');
  process.exit(1);
}

import { query, close, isSQLite, initDatabase } from './database.js';

const CACHE_FILE = `../data/${config.dbConfig.database}.json`;
const cachePath = path.resolve(__dirname, CACHE_FILE);
//const API_KEY = process.env.TMDB_API_KEY || null;
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi'];

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else if (VIDEO_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function parseFileName(filename) {
  const name = path.basename(filename, path.extname(filename));
  const format = path.extname(filename).substring(1).toUpperCase();

  const match = name.match(/(.+?)\s+\((\d{4})\)/);
  if (match) {
    return {
      title: match[1].replace(/\./g, ' ').trim(),
      year: match[2],
      format: format
    };
  }

  const rawParts = name.replace(/[\(\)\[\]\-_]/g, '.').split('.');
  const yearMatch = rawParts.find(p => /^\d{4}$/.test(p));
  let year = yearMatch || '';

  const badTags = ['1080p', '720p', 'x264', 'x265', 'bluray', 'webdl', 'hdrip', 'webrip', 'hdtv', 'yify', 'rip'];
  const titleParts = [];

  for (let i = 0; i < rawParts.length; i++) {
    const part = rawParts[i];
    const next = rawParts[i + 1] || '';

    if (['Mr', 'Mrs', 'Dr', 'Ms', 'St'].includes(part) && next.length === 1) {
      titleParts.push(`${part}.`);
      i++;
    } else if (!badTags.includes(part.toLowerCase()) && !(year && part === year)) {
      titleParts.push(part);
    }
  }

  let title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
  // Fallback if title is empty but the name is a 4-digit year (e.g., '2012.avi')
  if (!title && /^\d{4}$/.test(name)) {
    title = name;
    year = '';
  }

  return { title, year, format };
}

async function fetchFromTMDb(title, year = null) {
  try {
    let release_year = '';
    const params = {
      api_key: API_KEY || '',
      query: title || '',
      ...(year ? { year } : {})
    };

    const res = await axios.get('https://api.themoviedb.org/3/search/movie', { params });
    const movie = res.data.results?.[0];
    
    if (!movie) return null;

    if (res.data.results.length == 1 && !year) {
      year = movie.release_date?.substring(0, 4);
      release_year = movie.release_date?.substring(0, 4) || '';
    }

    // Step 2: Get full details using the TMDB movie ID
    const detailsRes = await axios.get(`https://api.themoviedb.org/3/movie/${movie.id}`, {
      params: { api_key: API_KEY }
    });

    const details = detailsRes.data;

    return {
      tmdb: movie.id?.toString() || '',
      imdb: details.imdb_id || '',
      poster_fallback: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      rating: movie.vote_average?.toFixed(1) || '',
      runtime: details.runtime ? `${details.runtime} mins` : '',
      overview: movie.overview || '',
      year: year || '',
      release: release_year || '',
      backdrop: details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : '',
      popularity: details.popularity || '',
      realTitle: movie.title || ''
    };
  } catch (err) {
    console.error(`TMDb error for "${title}" (${year || ''}):`, err.message);
    return null;
  }
}

// main scan function
export default async function runScanner() {

  await initDatabase(); // 🔥 This is crucial for db to work!

  console.log(`\n${new Date().toLocaleString()} Run Scanner triggered`);
  //const scannedFilenames = []; // Track filenames we see
  const files = walk(config.mediaDirectory);
  const cached = await loadCache();

  const currentList = [];
  const added = [];
  const updated = [];
  const unchanged = [];
  const removed = [];
  const duplicates = [];
  const possibleDuplicates = [];

  const seenTitle = new Set();
  const seenTitleYear = new Set();
  const currentMap = new Map();
  const realTitleClusters = new Map(); // realTitle => [filename1, filename2, ...]
  
  for (const file of files) {
    const filename = path.basename(file);
    let { title, year, format } = parseFileName(filename);
    if (!title) {
      console.log(`* SKIPPING: ${title} - ${year} - ${filename}`);
      continue;
    }
    if (!format) {
      //console.log(`* SKIPPING: ${title} - ${year} - ${filename}`);
      format = path.extname(filename).slice(1).toUpperCase();
    }

    const stat = fs.statSync(file);
    const relativePath = path.relative(config.mediaDirectory, file).replace(/\\/g, '/');
    const folder = path.dirname(relativePath);
    const baseName = path.basename(file, path.extname(file));
    const relativePoster = `${folder}/${baseName}-poster.jpg`.replace(/\\/g, '/');

    if (!year) {
      year = '0000';
    }

    let meta = {};
    if (API_KEY) {
      meta = await fetchFromTMDb(title, year) || {};
    }

    let popularity = meta.popularity || '';
    let backdrop = meta.backdrop || '';

    // duplicate file check
    const key = `${title}|${year}`;
    if (seenTitleYear.has(key)) {
      duplicates.push({ title, year: year, filename });
      console.log(`* DUPLICATE: ${title} (${year}) [${filename}]`);
      continue;
    }
    seenTitleYear.add(key);

    // possible duplicates with same title
    if (seenTitle.has(meta.realTitle || title)) {
      if (!meta.release || year === '0000') {
        possibleDuplicates.push({ title, filename });
        console.log(`* POSSIBLE DUPLICATE: ${title} [${filename}]`);
      }
    }
    seenTitle.add(meta.realTitle);
    seenTitle.add(title);

    // group possible duplicates
    if (!realTitleClusters.has(title)) {
      realTitleClusters.set(title, []);
    }
    realTitleClusters.get(title).push({
      title,
      year,
      filename
    });

    // file data
    const fileEntry = {
      title: title,
      year: year,
      filename: filename,
      filepath: relativePath,
      poster: relativePoster,
      format: format,
      filesize: stat.size,
      poster_fallback: meta.poster_fallback || '',
      imdb: meta.imdb || '', 
      runtime: meta.runtime || '', 
      rating: meta.rating || '', 
      overview: meta.overview || ''
    };

    currentMap.set(key, fileEntry);
    currentList.push(fileEntry);

    const cachedEntry = cached.find(f => f.title === title && f.year === year);

    if (!cachedEntry) {
      added.push(fileEntry);
      console.log(`ADDED: ${fileEntry.filename}`);
    } else if (
      cachedEntry.filename !== filename ||
      cachedEntry.filepath !== relativePath ||
      cachedEntry.format !== format ||
      cachedEntry.filesize !== stat.size
    ) {
      updated.push(fileEntry);
      console.log(`UPDATED: ${fileEntry.filename}`);
    } else {
      unchanged.push(fileEntry);
      console.log(`UNCHANGED: ${fileEntry.filename}`);
    }

/*
    // download image
    if (meta.poster && !fs.existsSync(relativePoster)) {
      console.log(`Downloading poster to ${relativePoster}`);
      await downloadImage(meta.poster, relativePoster);
    }
*/


  } // end of movie for loop

  // handle removed/missing files
  for (const cachedEntry of cached) {
    const key = `${cachedEntry.title}|${cachedEntry.year}`;
    if (!currentMap.has(key)) {
      removed.push(cachedEntry);
      console.log(`* REMOVED: ${cachedEntry.filename}`);
    }
  }

  // === Perform DB operations ===
  for (const movie of added) {
    try {
      await query(
      `INSERT INTO Movie_Info
        (title, year, filename, poster, poster_fallback, filepath, filesize, imdb, format, runtime, rating, overview)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [movie.title, movie.year, movie.filename, movie.poster, movie.poster_fallback, movie.filepath, movie.filesize, movie.imdb, movie.format, movie.runtime, movie.rating, movie.overview]
      );
      console.log(`INSERTED: ${movie.filename}`);
    } catch(err) {
      console.log(`FAILED to insert: ${movie.filename}`, err.message);
    }
    
  }

  for (const movie of updated) {
    await query(
      `UPDATE Movie_Info 
        SET filename = ?, format = ?, filesize = ?, filepath = ?, poster = ? 
        WHERE title = ? AND year = ?`,
        [movie.filename, movie.format, movie.filesize, movie.filepath, movie.poster, movie.title, movie.year]
    );
    console.log(`UPDATED: ${movie.filename}`);
  }

  for (const movie of removed) {
    await query(
      `DELETE FROM Movie_Info WHERE filename = ?`,
      [movie.filename]
    );
    console.log(`REMOVED: ${movie.filename}`);
  }

  await saveCache(currentList); // update cache file

  console.log(`\nScan Summary:`);
  console.log(`  Total scanned: ${files.length}`);
  console.log(`  Added: ${added.length}`);
  console.log(`  Updated: ${updated.length}`);
  console.log(`  Unchanged: ${unchanged.length}`);
  console.log(`  Removed: ${removed.length}`);
  console.log(`  Duplicates: ${duplicates.length}`);
  console.log(`  Possible Duplicates: ${possibleDuplicates.length}`);

  try {
    if (duplicates.length > 0) {
      console.log('\nDuplicate Files Skipped:');
      duplicates.forEach(d => {
        console.log(`  - ${d.title} (${d.year}) [${d.filename}]`);
      });
    }
    if (possibleDuplicates.length > 0) {
      console.log('\nPossible Duplicate Files:');
      possibleDuplicates.forEach(d => {
        console.log(`  - ${d.title}`);
      });
    }
    if (removed.length > 0) {
      console.log('\nRemoved Files:');
      removed.forEach(d => {
        console.log(`  - ${d.title} (${d.year}) - [${d.filename}]`);
      });
    }

    console.log('\nGrouped by Real Title:\n');
    for (const [realTitle, files] of realTitleClusters.entries()) {
      if (files.length < 2) continue; // only show clusters with >1

      console.log(`"${realTitle}" (${files.length} files)`);
      for (const file of files) {
        console.log(`  - ${file.title} (${file.year}) [${file.filename}]`);
      }
      console.log('');
    }
  } catch(err) {
    console.log("Results error: ", err);
  }
  
  console.log(`\n${new Date().toLocaleString()} Scanner Finished\n`);

  return { 
    totalFiles: files.length,
    newMovies: added.length,
    updatedMovies: updated.length,
    removedMovies: removed.length,
    addedList: added
  };
}


// ========== JSON cache helpers ==========
async function loadCache() {
  try {
    const raw = await readFile(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveCache(data) {
  await writeFile(cachePath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}


const downloadImage = async (url, destPath) => {
  const writer = fs.createWriteStream(destPath);
  const response = await axios.get(url, { responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};


// universal scan call
if (process.argv[1] === __filename) {
  runScanner().catch(err => console.error('Scanner error:', err));
}