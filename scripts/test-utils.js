#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Ensures Playwright browsers are installed, installing them if needed
 * @returns {Promise<boolean>} True if browsers are ready, false if installation failed
 */
export async function ensurePlaywrightBrowsers() {
  // Check for Playwright browsers
  const playwrightDir = join(process.env.USERPROFILE || process.env.HOME || '', 
    process.platform === 'win32' ? 'AppData/Local/ms-playwright' : '.cache/ms-playwright');

  let needsInstall = true;
  
  if (existsSync(playwrightDir)) {
    try {
      const entries = readdirSync(playwrightDir);
      const browsers = entries.filter(entry => 
        entry.startsWith('chromium-') || 
        entry.startsWith('firefox-') || 
        entry.startsWith('webkit-')
      );
      
      if (browsers.length >= 3) {
        console.log('✅ Playwright browsers detected');
        return true;
      }
    } catch (error) {
      console.log('Could not verify browser installation');
    }
  }

  console.log('🚀 Installing Playwright browsers...');
  try {
    execSync('npx playwright install', { stdio: 'inherit' });
    console.log('✅ Installation complete!');
    return true;
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    return false;
  }
}

/**
 * Runs a command with inherited stdio
 * @param {string} command - The command to run
 * @param {string[]} args - Command arguments
 */
export function runCommand(command, args = []) {
  const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
  try {
    execSync(fullCommand, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ Command failed: ${fullCommand}`);
    process.exit(error.status || 1);
  }
}
