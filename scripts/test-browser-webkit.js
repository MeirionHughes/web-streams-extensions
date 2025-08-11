#!/usr/bin/env node

// Simple wrapper script for WebKit-only browser tests
import { ensurePlaywrightBrowsers, runCommand } from './test-utils.js';

async function runWebKitTests() {
  console.log('🎭 WebKit Browser Test Setup');
  console.log('============================');

  const success = await ensurePlaywrightBrowsers();
  if (!success) {
    process.exit(1);
  }

  console.log('🧪 Running WebKit browser tests...');
  runCommand('npx web-test-runner --config web-test-runner.webkit.config.js');
}

runWebKitTests();
