#!/usr/bin/env node

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

/**
 * Run a command and return a promise that resolves when it completes
 */
function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      cwd: projectRoot,
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr?.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with exit code ${code}. stderr: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Generate coverage summary JSON from LCOV data
 */
function generateCoverageSummary(lcovPath) {
  let totalLines = 0;
  let totalFunctions = 0;
  let totalBranches = 0;
  let coveredLines = 0;
  let coveredFunctions = 0;
  let coveredBranches = 0;

  try {
    if (!existsSync(lcovPath)) {
      throw new Error('LCOV file not found');
    }

    const lcovData = readFileSync(lcovPath, 'utf8');
    const sections = lcovData.split('end_of_record');
    
    for (const section of sections) {
      if (section.trim()) {
        const lines = section.trim().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('LF:')) {
            totalLines += parseInt(line.substring(3)) || 0;
          } else if (line.startsWith('LH:')) {
            coveredLines += parseInt(line.substring(3)) || 0;
          } else if (line.startsWith('FNF:')) {
            totalFunctions += parseInt(line.substring(4)) || 0;
          } else if (line.startsWith('FNH:')) {
            coveredFunctions += parseInt(line.substring(4)) || 0;
          } else if (line.startsWith('BRF:')) {
            totalBranches += parseInt(line.substring(4)) || 0;
          } else if (line.startsWith('BRH:')) {
            coveredBranches += parseInt(line.substring(4)) || 0;
          }
        }
      }
    }

    // Calculate percentages
    const linesPercentage = totalLines > 0 ? (coveredLines / totalLines * 100) : 100;
    const functionsPercentage = totalFunctions > 0 ? (coveredFunctions / totalFunctions * 100) : 100;
    const branchesPercentage = totalBranches > 0 ? (coveredBranches / totalBranches * 100) : 100;
    
    // Use lines percentage as statements percentage (common practice)
    const statementsPercentage = linesPercentage;

    console.log(`Coverage Summary:`);
    console.log(`  Lines: ${coveredLines}/${totalLines} (${linesPercentage.toFixed(2)}%)`);
    console.log(`  Functions: ${coveredFunctions}/${totalFunctions} (${functionsPercentage.toFixed(2)}%)`);
    console.log(`  Branches: ${coveredBranches}/${totalBranches} (${branchesPercentage.toFixed(2)}%)`);

    return {
      total: {
        statements: { 
          pct: statementsPercentage,
          total: totalLines,
          covered: coveredLines
        },
        lines: { 
          pct: linesPercentage,
          total: totalLines,
          covered: coveredLines
        },
        functions: { 
          pct: functionsPercentage,
          total: totalFunctions,
          covered: coveredFunctions
        },
        branches: { 
          pct: branchesPercentage,
          total: totalBranches,
          covered: coveredBranches
        }
      }
    };
  } catch (error) {
    console.error('Error parsing LCOV data:', error.message);
    
    // Fallback to 0 if parsing fails
    return {
      total: {
        statements: { pct: 0, total: 0, covered: 0 },
        lines: { pct: 0, total: 0, covered: 0 },
        functions: { pct: 0, total: 0, covered: 0 },
        branches: { pct: 0, total: 0, covered: 0 }
      }
    };
  }
}

async function main() {
  try {
    // Create coverage directory
    console.log('Creating coverage directory...');
    mkdirSync(join(projectRoot, 'coverage'), { recursive: true });

    // Run tests with c8 coverage
    console.log('Running tests with coverage...');
    await runCommand('npx', [
      'c8',
      '--reporter=lcov',
      '--reporter=text',
      '--reports-dir=./coverage',
      '--exclude=spec/**',
      '--exclude=**/*.spec.ts',
      'node',
      '--import', 'tsx/esm',
      '--import', './scripts/test-setup.js',
      '--test',
      './spec/**/*.spec.ts'
    ]);

    // Generate coverage summary
    console.log('Generating coverage summary...');
    const lcovPath = join(projectRoot, 'coverage', 'lcov.info');
    
    // Generate coverage-summary.json for CI use
    const coverageSummary = generateCoverageSummary(lcovPath);
    const coverageSummaryPath = join(projectRoot, 'coverage', 'coverage-summary.json');
    writeFileSync(coverageSummaryPath, JSON.stringify(coverageSummary, null, 2));
    console.log('✅ Generated coverage-summary.json');

    // Generate detailed HTML report from LCOV data
    console.log('Generating detailed HTML coverage report...');
    try {
      const htmlReportDir = join(projectRoot, 'coverage', 'lcov-report');
      mkdirSync(htmlReportDir, { recursive: true });
      
      // Parse LCOV data to get file-level coverage
      const lcovPath = join(projectRoot, 'coverage', 'lcov.info');
      let fileDetails = [];
      
      if (existsSync(lcovPath)) {
        const lcovData = readFileSync(lcovPath, 'utf8');
        const sections = lcovData.split('end_of_record');
        
        for (const section of sections) {
          if (section.trim()) {
            const lines = section.trim().split('\n');
            let file = '';
            let linesFound = 0, linesHit = 0;
            let functionsFound = 0, functionsHit = 0;
            let branchesFound = 0, branchesHit = 0;
            
            for (const line of lines) {
              if (line.startsWith('SF:')) {
                file = line.substring(3).replace(process.cwd(), '').replace(/\\/g, '/');
                if (file.startsWith('/')) file = file.substring(1);
              } else if (line.startsWith('LF:')) {
                linesFound = parseInt(line.substring(3));
              } else if (line.startsWith('LH:')) {
                linesHit = parseInt(line.substring(3));
              } else if (line.startsWith('FNF:')) {
                functionsFound = parseInt(line.substring(4));
              } else if (line.startsWith('FNH:')) {
                functionsHit = parseInt(line.substring(4));
              } else if (line.startsWith('BRF:')) {
                branchesFound = parseInt(line.substring(4));
              } else if (line.startsWith('BRH:')) {
                branchesHit = parseInt(line.substring(4));
              }
            }
            
            if (file) {
              const lineCoverage = linesFound > 0 ? (linesHit / linesFound * 100) : 100;
              const functionCoverage = functionsFound > 0 ? (functionsHit / functionsFound * 100) : 100;
              const branchCoverage = branchesFound > 0 ? (branchesHit / branchesFound * 100) : 100;
              
              fileDetails.push({
                file,
                lineCoverage,
                functionCoverage,
                branchCoverage,
                linesHit,
                linesFound,
                functionsHit,
                functionsFound,
                branchesHit,
                branchesFound
              });
            }
          }
        }
      }
      
      // Sort files by coverage (lowest first to highlight areas needing attention)
      fileDetails.sort((a, b) => a.lineCoverage - b.lineCoverage);
      
      const percentage = coverageSummary.total.statements.pct;
      const color = percentage > 80 ? '#28a745' : percentage > 60 ? '#ffc107' : '#dc3545';
      
      // Generate file rows with proper coverage highlighting
      const fileRows = fileDetails.map(file => {
        const lineColor = file.lineCoverage > 80 ? '#28a745' : file.lineCoverage > 60 ? '#ffc107' : '#dc3545';
        const funcColor = file.functionCoverage > 80 ? '#28a745' : file.functionCoverage > 60 ? '#ffc107' : '#dc3545';
        const branchColor = file.branchCoverage > 80 ? '#28a745' : file.branchCoverage > 60 ? '#ffc107' : '#dc3545';
        
        return `
                <tr>
                    <td style="font-family: 'SFMono-Regular', Consolas, monospace; font-size: 12px;">${file.file}</td>
                    <td style="text-align: center;"><span style="color: ${lineColor}; font-weight: bold;">${file.lineCoverage.toFixed(1)}%</span></td>
                    <td style="text-align: center; font-family: monospace;">${file.linesHit}/${file.linesFound}</td>
                    <td style="text-align: center;"><span style="color: ${funcColor}; font-weight: bold;">${file.functionCoverage.toFixed(1)}%</span></td>
                    <td style="text-align: center;"><span style="color: ${branchColor}; font-weight: bold;">${file.branchCoverage.toFixed(1)}%</span></td>
                </tr>`;
      }).join('');
      
      const detailedHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - Web Streams Extensions</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            margin: 0; background: #f6f8fa; line-height: 1.5; color: #24292f;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 32px 0; text-align: center;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 0 24px; }
        .title { margin: 0 0 16px 0; font-size: 36px; font-weight: 700; }
        .subtitle { margin: 0 0 24px 0; font-size: 18px; opacity: 0.9; }
        .coverage-badge { 
            display: inline-block; 
            background: rgba(255, 255, 255, 0.2); 
            backdrop-filter: blur(10px);
            color: white; 
            padding: 12px 24px; 
            border-radius: 8px; 
            font-weight: 600; 
            font-size: 16px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .main-content { padding: 32px 0; }
        .summary-card { 
            background: #fff; 
            border: 1px solid #d1d9e0; 
            border-radius: 16px; 
            padding: 32px; 
            margin: 24px 0;
            box-shadow: 0 4px 6px rgba(27,31,36,0.04);
        }
        .summary-title { margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #24292f; }
        .metrics { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
            gap: 20px; 
            margin: 24px 0; 
        }
        .metric { 
            text-align: center; 
            padding: 24px; 
            background: #f6f8fa; 
            border-radius: 12px; 
            border: 1px solid #d1d9e0;
            transition: transform 0.2s ease;
        }
        .metric:hover { transform: translateY(-2px); }
        .metric-value { 
            display: block; 
            font-size: 32px; 
            font-weight: 800; 
            color: ${color}; 
            margin-bottom: 8px;
        }
        .metric-label { 
            display: block; 
            font-size: 14px; 
            color: #656d76; 
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .files-section { 
            background: #fff; 
            border: 1px solid #d1d9e0; 
            border-radius: 16px; 
            margin: 24px 0;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(27,31,36,0.04);
        }
        .section-header { 
            padding: 24px 32px; 
            background: #f6f8fa; 
            border-bottom: 1px solid #d1d9e0; 
        }
        .section-title { 
            margin: 0; 
            font-size: 20px; 
            font-weight: 600; 
            color: #24292f; 
        }
        .table-container { overflow-x: auto; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            background: #fff;
        }
        th, td { 
            padding: 16px 24px; 
            text-align: left; 
            border-bottom: 1px solid #d1d9e0; 
        }
        th { 
            background: #f6f8fa; 
            font-weight: 600; 
            color: #24292f; 
            font-size: 14px;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        td { font-size: 14px; }
        tr:last-child td { border-bottom: none; }
        tr:hover { background: #f6f8fa; }
        .footer { 
            text-align: center; 
            padding: 32px; 
            color: #656d76; 
            border-top: 1px solid #d1d9e0; 
            margin-top: 32px; 
            background: #fff;
        }
        .footer a { 
            color: #0969da; 
            text-decoration: none; 
            font-weight: 500;
            margin: 0 16px;
        }
        .footer a:hover { text-decoration: underline; }
        .stats-summary {
            background: #fff;
            border: 1px solid #d1d9e0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
            text-align: center;
        }
        .large-number {
            font-size: 48px;
            font-weight: 800;
            color: ${color};
            margin: 0;
            line-height: 1;
        }
        .large-label {
            font-size: 16px;
            color: #656d76;
            margin: 8px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <h1 class="title">📊 Coverage Report</h1>
            <p class="subtitle">Comprehensive test coverage analysis for Web Streams Extensions</p>
            <div class="coverage-badge">Overall Coverage: ${percentage.toFixed(2)}%</div>
        </div>
    </div>
    
    <div class="container main-content">
        <div class="stats-summary">
            <div class="large-number">${percentage.toFixed(1)}%</div>
            <div class="large-label">Total Coverage</div>
        </div>
        
        <div class="summary-card">
            <h2 class="summary-title">📈 Coverage Breakdown</h2>
            <div class="metrics">
                <div class="metric">
                    <span class="metric-value">${coverageSummary.total.statements.pct.toFixed(1)}%</span>
                    <span class="metric-label">Statements</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${coverageSummary.total.lines.pct.toFixed(1)}%</span>
                    <span class="metric-label">Lines</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${coverageSummary.total.functions.pct.toFixed(1)}%</span>
                    <span class="metric-label">Functions</span>
                </div>
                <div class="metric">
                    <span class="metric-value">${coverageSummary.total.branches.pct.toFixed(1)}%</span>
                    <span class="metric-label">Branches</span>
                </div>
            </div>
        </div>
        
        <div class="files-section">
            <div class="section-header">
                <h3 class="section-title">📁 File Coverage Details (${fileDetails.length} files)</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>File</th>
                            <th style="text-align: center;">Line Coverage</th>
                            <th style="text-align: center;">Lines Hit/Total</th>
                            <th style="text-align: center;">Function Coverage</th>
                            <th style="text-align: center;">Branch Coverage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fileRows}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p>
            Generated on ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC<br>
            <a href="../lcov.info" download>📥 Download LCOV Data</a>
            <a href="../coverage-summary.json" download>📊 Download JSON Summary</a>
        </p>
    </div>
</body>
</html>`;
      
      writeFileSync(join(htmlReportDir, 'index.html'), detailedHtml);
      console.log('✅ Generated detailed HTML coverage report with file-level breakdown');
      
    } catch (error) {
      console.log('⚠️ Detailed HTML generation failed, creating fallback report...');
      console.error('Error details:', error);
      
      // Final fallback
      const htmlReportDir = join(projectRoot, 'coverage', 'lcov-report');
      mkdirSync(htmlReportDir, { recursive: true });
      
      const percentage = coverageSummary.total.statements.pct;
      const basicHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Coverage Report</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .coverage { font-size: 24px; color: ${percentage > 80 ? 'green' : percentage > 60 ? 'orange' : 'red'}; }
    </style>
</head>
<body>
    <h1>Coverage Report</h1>
    <div class="coverage">Total Coverage: ${percentage.toFixed(2)}%</div>
    <p>Statements: ${coverageSummary.total.statements.pct.toFixed(2)}%</p>
    <p>Lines: ${coverageSummary.total.lines.pct.toFixed(2)}%</p>
    <p>Functions: ${coverageSummary.total.functions.pct.toFixed(2)}%</p>
    <p>Branches: ${coverageSummary.total.branches.pct.toFixed(2)}%</p>
    <p>Generated on ${new Date().toISOString()}</p>
    <p><a href="../lcov.info" download>Download LCOV Data</a></p>
</body>
</html>`;
      
      writeFileSync(join(htmlReportDir, 'index.html'), basicHtml);
      console.log('✅ Generated basic HTML coverage report');
    }

    console.log('✅ Coverage report generated in coverage/');
    
  } catch (error) {
    console.error('❌ Coverage generation failed:', error.message);
    process.exit(1);
  }
}

main();