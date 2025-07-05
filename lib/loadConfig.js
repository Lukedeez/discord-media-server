// lib/loadConfig.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export function loadConfig() {
  const configPath = path.resolve(__dirname, '../config.json');
  if (!fs.existsSync(configPath)) {
    console.error('config.json not found. Please run setup.js first.');
    process.exit(1);
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error('Failed to parse config.json:', err.message);
    process.exit(1);
  }
}
