// Setup file for Node.js test runner to provide global test functions
// This makes describe/it/beforeEach/afterEach available globally, matching browser behavior

import { describe as nodeDescribe, it as nodeIt, beforeEach as nodeBeforeEach, afterEach as nodeAfterEach } from 'node:test';

// Make test functions globally available
globalThis.describe = nodeDescribe;
globalThis.it = nodeIt; 
globalThis.beforeEach = nodeBeforeEach;
globalThis.afterEach = nodeAfterEach;