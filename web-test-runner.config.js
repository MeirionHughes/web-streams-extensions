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
        args: [
          '--disable-web-security', 
          '--disable-dev-shm-usage',
          // Disable throttling and background timer throttling
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          // Disable throttling of JavaScript timers in background tabs
          '--disable-background-media-suspend',
          '--disable-low-res-tiling',
          // Disable CPU and GPU throttling
          '--disable-background-mode',
          '--disable-default-apps',
          // High precision timing
          '--enable-precise-memory-info',
          '--enable-high-resolution-time',
          // Disable other throttling mechanisms
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-domain-reliability',
          '--disable-features=TranslateUI,VizDisplayCompositor'
        ]
      }
    }),
    playwrightLauncher({ 
      product: 'firefox',
      launchOptions: { 
        headless: true
      }
    }),
    playwrightLauncher({ 
      product: 'webkit',
      launchOptions: { 
        headless: true
      }
    })
  ],
  // Timeouts
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
