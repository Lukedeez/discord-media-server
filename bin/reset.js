// bin/reset.js
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import '../lib/reset.js'; // reset database and clear cache

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Reset database and cleared cache...');