#!/usr/bin/env node

import { fileURLToPath } from 'url';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

// Get the real path to the setup script relative to package
const setupPath = path.join(__dirname, 'setup.js');
const scanPath = path.join(__dirname, 'scan.js');
const startPath = path.join(__dirname, 'start.js');
const resetPath = path.join(__dirname, 'reset.js');

const args = process.argv.slice(2);

switch (args[0]) {
  case 'init':
    let input = '';
    console.log('Starting setup...');
    execSync(`node "${setupPath}"`, { stdio: 'inherit' });
    input = await ask('Run scan? (y/N): ');
    if (input.toLowerCase() === 'y') {
      console.log('Starting scan...');
      execSync(`node "${scanPath}"`, { stdio: 'inherit' });
    }
    input = await ask('Start server & discord bot? (y/N): ');
    if (input.toLowerCase() === 'y') {
      console.log('Starting Server & Discord Bot...');
      execSync(`node "${startPath}"`, { stdio: 'inherit' });
    }
    rl.close();
    break;
  case 'setup':
    console.log('Starting setup...');
    execSync(`node "${setupPath}"`, { stdio: 'inherit' });
    break;
  case 'scan':
    console.log('Starting scan...');
    execSync(`node "${scanPath}"`, { stdio: 'inherit' });
    break;
  case 'start':
    console.log('Starting Server & Discord Bot...');
    execSync(`node "${startPath}"`, { stdio: 'inherit' });
    break;
  case 'reset':
    console.log('Resetting & clearing database...');
    execSync(`node "${resetPath}"`, { stdio: 'inherit' });
    break;
  default:
    console.log(`Usage: discord-media-server <init|setup|scan|start|reset>`);
    break;
}
