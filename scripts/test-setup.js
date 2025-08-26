// Setup file for Node.js test runner to provide global test functions
// This makes describe/it/beforeEach/afterEach available globally, matching browser behavior

import { describe as nodeDescribe, it as nodeIt, before as nodeBefore, after as nodeAfter, beforeEach as nodeBeforeEach, afterEach as nodeAfterEach } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { isMainThread } from 'worker_threads';
import Worker from './node-worker.js';

// Make test functions globally available
globalThis.describe = nodeDescribe;
globalThis.it = nodeIt;
globalThis.before = nodeBefore;
globalThis.after = nodeAfter;
globalThis.beforeEach = nodeBeforeEach;
globalThis.afterEach = nodeAfterEach;



// Get current directory for resolving worker paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);


// Polyfill Worker for Node.js using web-worker package (only in main thread)
if (isMainThread && typeof globalThis.Worker === 'undefined') {
  const NodeWorker = Worker;
  
  if (typeof NodeWorker !== 'function') {
    throw new Error(`NodeWorker is not a function. Got: ${typeof NodeWorker}. This indicates an issue with the worker polyfill import.`);
  }
  
  // Set up require globally for the polyfill
  globalThis.require = createRequire(import.meta.url);
  // Also set up process and other Node.js globals that the polyfill might need
  if (typeof globalThis.process === 'undefined') {
    globalThis.process = process;
  }
  
  globalThis.Worker = class extends NodeWorker {
    constructor(url, options) {
      // Convert file path to data: URL by reading and embedding the content
      let workerUrl;
      let filePath;
      
      if (url instanceof URL) {
        if (url.protocol === 'file:') {
          filePath = fileURLToPath(url);
        } else {
          workerUrl = url.href;
        }
      } else if (typeof url === 'string') {
        if (url.startsWith('data:')) {
          workerUrl = url;
        } else if (url.startsWith('file://')) {
          filePath = fileURLToPath(url);
        } else if (url.startsWith('./') || url.startsWith('../')) {
          // Resolve relative to the current module/test file
          filePath = resolve(projectRoot, 'spec/worker', url);
        } else {
          // Assume it's an absolute path
          filePath = url;
        }
      }
      
      // If we have a file path, convert to data: URL
      if (filePath) {
        try {
          const fileContent = readFileSync(filePath, 'utf8');
          const base64Content = Buffer.from(fileContent).toString('base64');
          workerUrl = `data:application/javascript;base64,${base64Content}`;
        } catch (error) {
          console.error(`Failed to read worker file ${filePath}:`, error);
          throw error;
        }
      }
      
      console.log(`Creating worker with data URL (length: ${workerUrl?.length || 0})`);
      super(workerUrl, options);
    }
  };
} else if (!isMainThread) {
  // In worker thread, skip Worker polyfill setup
}
