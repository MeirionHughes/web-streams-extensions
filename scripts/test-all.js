#!/usr/bin/env node

// Simple wrapper script that runs Node.js tests first, then browser tests with auto-setup
import { ensurePlaywrightBrowsers, runCommand } from './test-utils.js';

async function runAllTests() {
  console.log('🧪 Running All Tests');
  console.log('====================');

  try {
    // First run Node.js tests
    console.log('\n📋 Step 1: Running Node.js tests...');
    runCommand('npm run test');
    
    console.log('\n📋 Step 2: Setting up browser tests...');
    const success = await ensurePlaywrightBrowsers();
    if (!success) {
      process.exit(1);
    }
    
    console.log('\n🧪 Running browser tests...');
    runCommand('npx web-test-runner');
    
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(error.status || 1);
  }
}

runAllTests();
