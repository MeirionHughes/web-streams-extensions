import { esbuildPlugin } from '@web/dev-server-esbuild';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  files: 'spec/worker/*.spec.ts',
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
        headless: true, // Back to headless for CI/automated testing
        // devtools: true,
        args: [
          '--disable-web-security', 
          '--disable-dev-shm-usage',
        ]
      }
    })
  ],
  // Timeouts
  browserStartTimeout: 30000,
  testsStartTimeout: 30000,
  testsFinishTimeout: 60000,
  
  preserveSymlinks: true,
  concurrency: 1,
  browserLogs: true // Enable console logs for debugging
};