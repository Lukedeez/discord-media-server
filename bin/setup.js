// bin/setup.js
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import runSetup from '../lib/setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

await runSetup();
