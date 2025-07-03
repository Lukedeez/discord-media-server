// bin/reset.js
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import '../lib/server.js'; // starts the Express server
import '../lib/bot.js';     // starts the Discord bot

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Starting Discord Media Server...');