const fs = require('fs');
const path = require('path');

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
      console.log(`Renamed: ${fullPath} -> ${newPath}`);
      
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
    console.log(`Updated imports in: ${filePath}`);
  } catch (error) {
    console.error(`Error updating imports in ${filePath}:`, error.message);
  }
}

// Main execution
const cjsDir = path.join(__dirname, '..', 'dist', 'cjs');

if (fs.existsSync(cjsDir)) {
  console.log('Converting CommonJS .js files to .cjs...');
  renameJsToCjs(cjsDir);
  console.log('CommonJS file conversion complete!');
} else {
  console.error('CJS build directory not found:', cjsDir);
  process.exit(1);
}
