# Coverage Documentation

This project provides comprehensive test coverage reporting with multiple options for different use cases.

## Coverage Scripts

### Standard Coverage (`npm run test:cover`)

**Best for:** CI/CD, GitHub Pages deployment, and quick coverage overview

- ✅ **Fast execution** - Uses Node.js built-in coverage
- ✅ **CI/CD optimized** - Generates JSON files for badges and GitHub Pages deployment
- ✅ **Beautiful HTML report** - Custom-styled report with file-level breakdown
- ✅ **LCOV compatible** - Generates standard LCOV format for other tools

**Generated files:**
- `coverage/lcov.info` - LCOV format data
- `coverage/coverage-summary.json` - Summary stats for CI
- `coverage/coverage-badge.json` - Badge data for shields.io
- `coverage/lcov-report/index.html` - Custom HTML report with file details

### Detailed Coverage (`npm run test:cover:c8`)

**Best for:** Local development, detailed analysis, and line-by-line coverage inspection

- 🔍 **Detailed line-by-line coverage** - Shows exactly which lines are covered
- 🎨 **Syntax highlighting** - Pretty-printed code with coverage annotations
- 📊 **Professional HTML reports** - Industry-standard c8 coverage reports
- 🔧 **Developer-friendly** - Perfect for identifying specific uncovered lines

**Generated files:**
- `coverage/c8-html/index.html` - Detailed c8 HTML report with file navigation
- `coverage/c8-html/src/` - Individual file coverage reports with syntax highlighting
- `coverage/c8-html/spec/` - Test file coverage reports

## Coverage Levels

| Metric | Target | Current |
|--------|--------|---------|
| Statements | > 95% | 98.75% ✅ |
| Lines | > 95% | 98.75% ✅ |
| Functions | > 95% | 98.75% ✅ |
| Branches | > 95% | 98.75% ✅ |

## GitHub Pages Integration

The standard coverage script (`npm run test:cover`) is configured to work with GitHub Pages deployment:

1. **Automated deployment** - Coverage reports are automatically deployed to GitHub Pages on every merge to master
2. **Live badge** - The README badge updates automatically based on latest coverage
3. **Browseable reports** - HTML reports are available at the GitHub Pages URL

## Local Development Workflow

```bash
# Quick coverage check
npm run test:cover

# Detailed coverage analysis
npm run test:cover:c8

# Open detailed HTML report in browser
# Navigate to coverage/c8-html/index.html

# Check coverage badge status
cat coverage/coverage-badge.json
```

## CI/CD Integration

The coverage workflow in `.github/workflows/test.yml` automatically:

1. Runs tests with coverage
2. Generates coverage reports and badges
3. Deploys HTML reports to GitHub Pages (master branch only)
4. Updates the coverage badge in the README

## Coverage Badge

The coverage badge in the README is generated from `coverage-badge.json` and hosted via GitHub Pages. It automatically updates with each deployment and shows the current coverage percentage with appropriate color coding:

- 🟢 **Green** (95%+) - Excellent coverage
- 🟡 **Yellow** (80-94%) - Good coverage
- 🔴 **Red** (<80%) - Needs improvement

## Coverage Exclusions

The following are excluded from coverage calculations:
- Test files (`spec/**/*.spec.ts`)
- Type definition files (`**/*.d.ts`)
- Build output (`dist/**`)
- Node modules
- Configuration files

## Tips for Improving Coverage

1. **Use detailed reports** - Run `npm run test:cover:c8` to see exactly which lines need coverage
2. **Focus on low-coverage files** - Both reports sort files by coverage to highlight areas needing attention
3. **Check branch coverage** - Make sure all conditional logic paths are tested
4. **Test error paths** - Ensure error handling code is covered