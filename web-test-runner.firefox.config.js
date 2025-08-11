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
      product: 'firefox',
      launchOptions: { 
        headless: true,
        args: [
          // Firefox-specific performance settings
          '--disable-extensions',
          '--disable-addons'
        ]
      }
    })
  ],
  // Timeouts - Firefox may need longer timeouts
  browserStartTimeout: 90000,
  testsStartTimeout: 90000,
  testsFinishTimeout: 180000,
  
  // Handle ES modules properly
  preserveSymlinks: true,
  
  // Configure for CI environment
  concurrency: 1,
  
  // Suppress browser logs for expected errors
  browserLogs: false
};
