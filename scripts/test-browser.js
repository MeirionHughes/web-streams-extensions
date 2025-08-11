#!/usr/bin/env node

// Simple wrapper script that ensures Playwright is set up before running browser tests
import { ensurePlaywrightBrowsers, runCommand } from './test-utils.js';

async function runBrowserTests() {
  console.log('🎭 Browser Test Setup');
  console.log('=====================');

  const success = await ensurePlaywrightBrowsers();
  if (!success) {
    process.exit(1);
  }

  console.log('🧪 Running browser tests...');
  runCommand('npx web-test-runner');
}

runBrowserTests();
