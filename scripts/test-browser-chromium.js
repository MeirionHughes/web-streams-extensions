#!/usr/bin/env node

// Simple wrapper script for Chromium-only browser tests
import { ensurePlaywrightBrowsers, runCommand } from './test-utils.js';

async function runChromiumTests() {
  console.log('🎭 Chromium Browser Test Setup');
  console.log('==============================');

  const success = await ensurePlaywrightBrowsers();
  if (!success) {
    process.exit(1);
  }

  console.log('🧪 Running Chromium browser tests...');
  runCommand('npx web-test-runner --config web-test-runner.chromium.config.js');
}

runChromiumTests();
