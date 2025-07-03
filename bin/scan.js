// bin/scan.js
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import runScanner from '../lib/scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Running media scan...');
await runScanner();
console.log('Scan complete.');