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
      product: 'webkit',
      launchOptions: { 
        headless: true
        // Note: WebKit/Safari doesn't support Chrome-specific args like --disable-extensions
        // Keep launch options minimal for maximum compatibility
      }
    })
  ],
  // Timeouts - WebKit may need longer timeouts
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
