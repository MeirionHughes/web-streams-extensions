#!/usr/bin/env node

// Simple wrapper script for browser tests in watch mode
import { ensurePlaywrightBrowsers, runCommand } from './test-utils.js';

async function runWatchTests() {
  console.log('🎭 Browser Test Setup (Watch Mode)');
  console.log('===================================');

  const success = await ensurePlaywrightBrowsers();
  if (!success) {
    process.exit(1);
  }

  console.log('🧪 Running browser tests in watch mode...');
  runCommand('npx web-test-runner --watch');
}

runWatchTests();
