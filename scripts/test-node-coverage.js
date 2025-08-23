#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { mkdir, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

console.log('🧪 Running Node.js tests with c8 coverage');
console.log('=========================================');
console.log('📍 Project root:', projectRoot);
console.log('📍 Working directory:', process.cwd());

// Ensure coverage directory exists
await mkdir(path.join(projectRoot, 'coverage'), { recursive: true });

// Helper function to recursively find test files
async function findTestFiles(dir) {
  const files = [];
  const fullDirPath = path.join(projectRoot, dir);
  const entries = await readdir(fullDirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const subFiles = await findTestFiles(entryPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      // Normalize path separators to forward slashes for cross-platform compatibility
      files.push(entryPath.replace(/\\/g, '/'));
    }
  }
  
  return files;
}

// Explicitly find test files to debug the issue
console.log('🔍 Discovering test files...');

try {
  const testFiles = await findTestFiles('spec');
  
  console.log(`📁 Found ${testFiles.length} test files:`);
  testFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  if (testFiles.length === 0) {
    console.error('❌ No test files found!');
    
    // Debug: Check if spec directory exists
    console.log('🔍 Debugging directory structure:');
    try {
      const specContents = await readdir(path.join(projectRoot, 'spec'));
      console.log('📁 Contents of spec directory:', specContents.slice(0, 10));
    } catch (err) {
      console.error('❌ Cannot read spec directory:', err.message);
    }
    
    process.exit(1);
  }

  // Use c8 with Node.js test runner, passing explicit test files
  const c8Args = [
    '--reporter=lcov',
    '--reporter=text',
    '--reports-dir=./coverage',
    '--exclude=spec/**',
    '--exclude=**/*.spec.ts',
    '--exclude=coverage/**',
    '--exclude=dist/**',
    '--exclude=scripts/**',
    '--include=src/**',
    'node',
    '--import', 'tsx/esm',
    '--import', './scripts/test-setup.js',
    '--test',
    ...testFiles  // Pass explicit file list instead of glob
  ];

  console.log('🚀 Running command: c8', c8Args.slice(0, 15).join(' '), '... and', testFiles.length, 'test files');

  // Build the full command as a string for Windows compatibility
  const c8Path = process.platform === 'win32' ? '.\\node_modules\\.bin\\c8.cmd' : './node_modules/.bin/c8';
  const quotedTestFiles = testFiles.map(f => `"${f}"`);
  const fullCommand = `${c8Path} ${c8Args.slice(0, -testFiles.length).join(' ')} ${quotedTestFiles.join(' ')}`;
  
  console.log('📝 Full command:', fullCommand);
  
  const child = exec(fullCommand, {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_OPTIONS: '--enable-source-maps'
    }
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Tests completed successfully');
      console.log('📊 Coverage report generated at ./coverage/lcov.info');
      console.log(`📈 Summary: Ran ${testFiles.length} test files`);
      console.log('🔍 Note: Node.js test runner counts describe blocks as "tests" (226), but runs all individual it blocks (~1865)');
    } else {
      console.log(`\n❌ Tests failed with exit code ${code}`);
      process.exit(code);
    }
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start test process:', error);
    process.exit(1);
  });

} catch (error) {
  console.error('❌ Error during test file discovery:', error);
  process.exit(1);
}