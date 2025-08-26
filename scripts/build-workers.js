import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

async function buildWorkers() {
  console.log('Building worker files...');
  
  const workerFiles = [
    {
      input: './spec/worker/bridge-worker.ts',
      output: './spec/worker/bridge-worker.bundle.js'
    }
  ];

  for (const { input, output } of workerFiles) {
    try {
      console.log(`Building ${input} -> ${output}`);
      
      const result = await build({
        entryPoints: [input],
        bundle: true,
        format: 'iife', // Immediately Invoked Function Expression for workers
        target: 'es2020',
        platform: 'browser',
        outfile: output,
        write: false, // We'll write manually to handle any post-processing
        minify: false, // Keep readable for debugging
        sourcemap: false,
        resolveExtensions: ['.ts', '.js'],
        loader: {
          '.ts': 'ts'
        }
      });

      // Ensure output directory exists
      mkdirSync(dirname(output), { recursive: true });
      
      // Write the bundled worker
      if (result.outputFiles && result.outputFiles.length > 0) {
        writeFileSync(output, result.outputFiles[0].text);
        console.log(`✓ Built ${output}`);
      } else {
        throw new Error('No output generated');
      }
      
    } catch (error) {
      console.error(`✗ Failed to build ${input}:`, error);
      process.exit(1);
    }
  }
  
  console.log('All workers built successfully!');
}

buildWorkers().catch(console.error);