import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: 'spec/**/*.spec.ts',
  nodeResolve: true,
  plugins: [
    esbuildPlugin({
      ts: true,
      target: 'esnext'
    })
  ],
  browsers: [
    playwrightLauncher({ 
      product: 'chromium',
      launchOptions: { 
        headless: true,
        // Suppress console output for expected errors
        args: ['--disable-web-security', '--disable-dev-shm-usage']
      }
    })
  ],
  // Timeouts
  browserStartTimeout: 60000,
  testsStartTimeout: 60000,
  testsFinishTimeout: 120000,
  
  // Handle ES modules properly
  preserveSymlinks: true,
  
  // Configure for CI environment
  concurrency: 1,
  
  // Suppress browser logs for expected errors
  browserLogs: false
};
