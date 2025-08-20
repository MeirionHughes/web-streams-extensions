#!/usr/bin/env node

import { mkdirSync, writeFileSync, readFileSync } from 'fs';
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

/**
 * Generate coverage summary JSON from LCOV data
 */
function generateCoverageSummary(stdout) {
  const lines = stdout.split('\n');
  let totalStatements = 0;
  let totalLines = 0;
  let totalFunctions = 0;
  let totalBranches = 0;
  let coveredStatements = 0;
  let coveredLines = 0;
  let coveredFunctions = 0;
  let coveredBranches = 0;

  // Parse the lcov-summary output
  for (const line of lines) {
    if (line.includes('Total Coverage:')) {
      const match = line.match(/(\d+\.?\d*)%/);
      if (match) {
        const percentage = parseFloat(match[1]);
        // Use the overall percentage for all metrics
        return {
          total: {
            statements: { pct: percentage },
            lines: { pct: percentage },
            functions: { pct: percentage },
            branches: { pct: percentage }
          }
        };
      }
    }
  }

  // Fallback to 0 if parsing fails
  return {
    total: {
      statements: { pct: 0 },
      lines: { pct: 0 },
      functions: { pct: 0 },
      branches: { pct: 0 }
    }
  };
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
    const { stdout } = await runCommand('npx', ['lcov-summary', './coverage/lcov.info']);

    // Generate coverage-summary.json for CI use
    const coverageSummary = generateCoverageSummary(stdout);
    const coverageSummaryPath = join(projectRoot, 'coverage', 'coverage-summary.json');
    writeFileSync(coverageSummaryPath, JSON.stringify(coverageSummary, null, 2));
    console.log('✅ Generated coverage-summary.json');

    // Generate basic HTML report using genhtml if available, otherwise just create a simple index
    console.log('Generating HTML coverage report...');
    try {
      await runCommand('npx', ['genhtml', './coverage/lcov.info', '-o', './coverage/lcov-report']);
      console.log('✅ Generated HTML coverage report using genhtml');
    } catch (error) {
      console.log('⚠️ genhtml not available, creating simple HTML report...');
      
      // Create a simple HTML coverage report
      const htmlReportDir = join(projectRoot, 'coverage', 'lcov-report');
      mkdirSync(htmlReportDir, { recursive: true });
      
      const percentage = coverageSummary.total.statements.pct;
      const simpleHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .coverage { font-size: 24px; color: ${percentage > 80 ? 'green' : percentage > 60 ? 'orange' : 'red'}; }
    </style>
</head>
<body>
    <h1>Coverage Report</h1>
    <div class="coverage">Total Coverage: ${percentage.toFixed(2)}%</div>
    <p>Generated on ${new Date().toISOString()}</p>
</body>
</html>`;
      
      writeFileSync(join(htmlReportDir, 'index.html'), simpleHtml);
      console.log('✅ Generated simple HTML coverage report');
    }

    console.log('✅ Coverage report generated in coverage/');
    
  } catch (error) {
    console.error('❌ Coverage generation failed:', error.message);
    process.exit(1);
  }
}

main();