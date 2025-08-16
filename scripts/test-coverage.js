#!/usr/bin/env node

import { mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Run a command and return a promise that resolves when it completes
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      cwd: projectRoot,
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}. stderr: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    // Create coverage directory
    console.log('Creating coverage directory...');
    mkdirSync(join(projectRoot, 'coverage'), { recursive: true });

    // Run tests with coverage using glob pattern
    console.log('Running tests with coverage...');
    await runCommand('node', [
      '--import', 'tsx/esm',
      '--import', './test-setup.js',
      '--experimental-test-coverage',
      '--test-reporter=lcov',
      '--test-reporter-destination=./coverage/lcov.info',
      '--test',
      './spec/**/*.spec.ts'
    ]);

    // Generate coverage summary
    console.log('Generating coverage summary...');
    await runCommand('npx', ['lcov-summary', './coverage/lcov.info']);

    // Generate HTML coverage report
    console.log('Generating HTML coverage report...');
    await runCommand('npx', ['lcov-viewer', 'lcov', './coverage/lcov.info', '-o', './coverage/lcov-report']);

    console.log('✅ Coverage report generated in coverage/lcov-report/');
    
  } catch (error) {
    console.error('❌ Coverage generation failed:', error.message);
    process.exit(1);
  }
}

main();