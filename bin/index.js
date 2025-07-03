#!/usr/bin/env node

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    console.log('Starting setup...');
    execSync('node ./bin/setup.js', { stdio: 'inherit' });

    console.log('Starting scan...');
    execSync('node ./bin/scan.js', { stdio: 'inherit' });

    console.log('Starting Discord bot...');
    execSync('node ./bin/start.js', { stdio: 'inherit' });
    break;
  case 'setup':
    console.log('Starting setup...');
    execSync('node ./bin/setup.js', { stdio: 'inherit' });
    break;
  case 'scan':
    console.log('Starting scan...');
    execSync('node ./bin/scan.js', { stdio: 'inherit' });
    break;
  case 'start':
    console.log('Starting Discord bot...');
    execSync('node ./bin/start.js', { stdio: 'inherit' });
    break;
  case 'reset':
    console.log('Resetting & clearing database...');
    execSync('node ./bin/reset.js', { stdio: 'inherit' });
    break;
  default:
    console.log('Usage: discord-media-server [init|setup|scan|start|reset]');
}
