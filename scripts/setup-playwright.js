#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine platform-specific playwright install locations
const playwrightInstallPaths = {
  win32: [
    join(process.env.USERPROFILE || '', 'AppData', 'Local', 'ms-playwright'),
    join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  ],
  darwin: [
    join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright')
  ],
  linux: [
    join(process.env.HOME || '', '.cache', 'ms-playwright')
  ]
};

// Browser executables to check for
const browserChecks = {
  chromium: {
    win32: 'chromium_headless_shell-*/chrome-win/headless_shell.exe',
    darwin: 'chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    linux: 'chromium-*/chrome-linux/chrome'
  },
  firefox: {
    win32: 'firefox-*/firefox/firefox.exe',
    darwin: 'firefox-*/firefox/Firefox.app/Contents/MacOS/firefox',
    linux: 'firefox-*/firefox/firefox'
  },
  webkit: {
    win32: 'webkit-*/Playwright.exe',
    darwin: 'webkit-*/pw_run.sh',
    linux: 'webkit-*/pw_run.sh'
  }
};

/**
 * Check if playwright browsers are installed
 */
function areBrowsersInstalled() {
  const platform = process.platform;
  const installPaths = playwrightInstallPaths[platform] || playwrightInstallPaths.linux;
  
  console.log('🔍 Checking for Playwright browser installations...');
  
  for (const installPath of installPaths) {
    if (existsSync(installPath)) {
      console.log(`   Found Playwright directory: ${installPath}`);
      
      // Check if all three browsers exist
      let browsersFound = 0;
      const browsers = ['chromium', 'firefox', 'webkit'];
      
      for (const browser of browsers) {
        try {
          // Use glob-like check by listing directories and checking patterns
          const entries = readdirSync(installPath, { withFileTypes: true });
          
          const found = entries.some(entry => {
            if (entry.isDirectory()) {
              const dirName = entry.name;
              // Check if directory name matches the browser pattern prefix
              return dirName.startsWith(browser + '-') || dirName.startsWith(browser + '_');
            }
            return false;
          });
          
          if (found) {
            browsersFound++;
            console.log(`   ✅ ${browser} found`);
          } else {
            console.log(`   ❌ ${browser} not found`);
          }
        } catch (error) {
          console.log(`   ❌ ${browser} check failed: ${error.message}`);
        }
      }
      
      if (browsersFound === 3) {
        console.log('✅ All Playwright browsers are installed');
        return true;
      }
    }
  }
  
  console.log('❌ Playwright browsers are not fully installed');
  return false;
}

/**
 * Install playwright browsers
 */
function installPlaywrightBrowsers() {
  console.log('🚀 Installing Playwright browsers...');
  console.log('   This may take a few minutes as browsers are downloaded...');
  
  try {
    // Run playwright install with inherited stdio so user can see progress
    execSync('npx playwright install', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log('✅ Playwright browsers installed successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to install Playwright browsers:', error.message);
    return false;
  }
}

/**
 * Check if playwright package is installed
 */
function isPlaywrightInstalled() {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json');
    if (!existsSync(packageJsonPath)) {
      return false;
    }
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const hasPlaywright = 
      (packageJson.dependencies && packageJson.dependencies.playwright) ||
      (packageJson.devDependencies && packageJson.devDependencies.playwright) ||
      (packageJson.devDependencies && packageJson.devDependencies['@web/test-runner-playwright']);
    
    return !!hasPlaywright;
  } catch (error) {
    console.log('⚠️  Could not check package.json for Playwright dependency');
    return false;
  }
}

/**
 * Main setup function
 */
async function setupPlaywright() {
  console.log('🎭 Playwright Browser Setup');
  console.log('==========================');
  
  // Check if playwright is in dependencies
  if (!isPlaywrightInstalled()) {
    console.log('⚠️  Playwright not found in package.json dependencies');
    console.log('   Make sure @web/test-runner-playwright is installed');
    return false;
  }
  
  // Check if browsers are already installed
  if (areBrowsersInstalled()) {
    console.log('🎉 Setup complete - browsers ready!');
    return true;
  }
  
  // Install browsers
  const success = installPlaywrightBrowsers();
  
  if (success) {
    // Verify installation
    if (areBrowsersInstalled()) {
      console.log('🎉 Setup complete - browsers ready!');
      return true;
    } else {
      console.log('❌ Installation completed but browsers still not detected');
      return false;
    }
  }
  
  return false;
}

/**
 * Run the target command after setup
 */
async function runCommand(command, args = []) {
  const success = await setupPlaywright();
  
  if (!success) {
    console.error('❌ Failed to setup Playwright browsers');
    process.exit(1);
  }
  
  console.log(`\n🚀 Running: ${command} ${args.join(' ')}`);
  console.log('================================\n');
  
  try {
    execSync(`${command} ${args.join(' ')}`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    console.error(`❌ Command failed: ${error.message}`);
    process.exit(error.status || 1);
  }
}

// Export for use as module or run directly
export { setupPlaywright, runCommand };

// If called directly, run the command passed as arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.error('Usage: node setup-playwright.js <command> [args...]');
    console.error('Example: node setup-playwright.js npm run test:browser');
    process.exit(1);
  }
  
  runCommand(command, args);
}
