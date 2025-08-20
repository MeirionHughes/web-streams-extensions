#!/bin/bash

# Test the CI badge generation logic locally
echo "Testing CI badge generation logic..."

# Extract coverage percentages from coverage-summary.json
STATEMENTS=$(node -p "Math.round(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json', 'utf8')).total.statements.pct)")
LINES=$(node -p "Math.round(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json', 'utf8')).total.lines.pct)")
FUNCTIONS=$(node -p "Math.round(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json', 'utf8')).total.functions.pct)")
BRANCHES=$(node -p "Math.round(JSON.parse(require('fs').readFileSync('coverage/coverage-summary.json', 'utf8')).total.branches.pct)")

echo "Coverage: Statements=${STATEMENTS}%, Lines=${LINES}%, Functions=${FUNCTIONS}%, Branches=${BRANCHES}%"

# Create shields.io compatible JSON
cat > coverage/coverage-badge.json << EOF
{
  "schemaVersion": 1,
  "label": "coverage",
  "message": "${STATEMENTS}%",
  "color": "brightgreen"
}
EOF

echo "✅ Generated coverage-badge.json"
cat coverage/coverage-badge.json

# Also create detailed coverage JSON for reference
cat > coverage/coverage-details.json << EOF
{
  "statements": ${STATEMENTS},
  "lines": ${LINES},
  "functions": ${FUNCTIONS},
  "branches": ${BRANCHES},
  "overall": ${STATEMENTS}
}
EOF

echo "✅ Generated coverage-details.json"
cat coverage/coverage-details.json