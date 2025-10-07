const fs = require('fs');
const path = require('path');

let stats = {
  filesRenamed: 0,
  importsUpdated: 0,
  errors: []
};

function renameJsToCjs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Recursively process subdirectories
      renameJsToCjs(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      // Rename .js files to .cjs
      const newPath = fullPath.replace(/\.js$/, '.cjs');
      fs.renameSync(fullPath, newPath);
      stats.filesRenamed++;
      
      // Update imports in the renamed file to use .cjs extensions
      updateImportsInFile(newPath);
    }
  }
}

function updateImportsInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update require() calls that end with .js to use .cjs
    content = content.replace(/require\(["']([^"']+)\.js["']\)/g, 'require("$1.cjs")');
    
    // Update any other .js references in require calls
    content = content.replace(/require\(["'](\.\/.+?)\.js["']\)/g, 'require("$1.cjs")');
    
    fs.writeFileSync(filePath, content, 'utf8');
    stats.importsUpdated++;
  } catch (error) {
    stats.errors.push(`${filePath}: ${error.message}`);
  }
}

// Main execution
const cjsDir = path.join(__dirname, '..', 'dist', 'cjs');

if (fs.existsSync(cjsDir)) {
  renameJsToCjs(cjsDir);
  
  // Print summary
  console.log('CommonJS Conversion Summary:');
  console.log(`  Files renamed: ${stats.filesRenamed}`);
  console.log(`  Imports updated: ${stats.importsUpdated}`);
  if (stats.errors.length > 0) {
    console.log(`  Errors: ${stats.errors.length}`);
    stats.errors.forEach(err => console.error(`    - ${err}`));
  }
} else {
  console.error('CJS build directory not found:', cjsDir);
  process.exit(1);
}
