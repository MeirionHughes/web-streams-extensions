#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🎭 Playwright Browser Setup');
  console.log('==========================');

  // Simple check: does playwright directory exist?
  const playwrightDir = join(process.env.USERPROFILE || process.env.HOME || '', 
    process.platform === 'win32' ? 'AppData/Local/ms-playwright' : '.cache/ms-playwright');

  console.log(`Checking for Playwright directory: ${playwrightDir}`);

  if (existsSync(playwrightDir)) {
    console.log('✅ Playwright directory exists');
    
    // Quick check if browsers might be there
    try {
      const entries = readdirSync(playwrightDir);
      const browsers = entries.filter(entry => 
        entry.startsWith('chromium-') || 
        entry.startsWith('firefox-') || 
        entry.startsWith('webkit-')
      );
      
      console.log(`Found ${browsers.length} browser directories:`, browsers);
      
      if (browsers.length >= 3) {
        console.log('✅ Browsers appear to be installed');
        console.log('🚀 Running target command...');
        
        // Run the command
        const [,, command, ...args] = process.argv;
        if (command && args.length > 0) {
          execSync(`${command} ${args.join(' ')}`, { stdio: 'inherit' });
        }
        
        process.exit(0);
      }
    } catch (error) {
      console.log('Could not read playwright directory contents');
    }
  }

  console.log('❌ Browsers not detected, installing...');
  console.log('🚀 Installing Playwright browsers...');

  try {
    execSync('npx playwright install', { stdio: 'inherit' });
    console.log('✅ Installation complete!');
    
    // Run the target command
    const [,, command, ...args] = process.argv;
    if (command && args.length > 0) {
      console.log(`🚀 Running: ${command} ${args.join(' ')}`);
      execSync(`${command} ${args.join(' ')}`, { stdio: 'inherit' });
    }
  } catch (error) {
    console.error('❌ Installation failed:', error.message);
    process.exit(1);
  }
}

main();
