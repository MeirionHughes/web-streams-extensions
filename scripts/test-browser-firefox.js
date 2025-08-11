#!/usr/bin/env node

// Simple wrapper script for Firefox-only browser tests
import { ensurePlaywrightBrowsers, runCommand } from './test-utils.js';

async function runFirefoxTests() {
  console.log('🎭 Firefox Browser Test Setup');
  console.log('=============================');

  const success = await ensurePlaywrightBrowsers();
  if (!success) {
    process.exit(1);
  }

  console.log('🧪 Running Firefox browser tests...');
  runCommand('npx web-test-runner --config web-test-runner.firefox.config.js');
}

runFirefoxTests();
