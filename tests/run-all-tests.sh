#!/bin/bash
cd /home/rajat/Downloads/apogee
echo "╔═══════════════════════════════════════════════════════╗"
echo "║           APOGEE 4.0 — FULL TEST SUITE               ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_SKIP=0

for test in tests/e2e-auth.test.js tests/e2e-organizations.test.js tests/e2e-all-modules.test.js tests/e2e-crm.test.js; do
  name=$(basename "$test" .test.js)
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Running: $name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  output=$(timeout 300 node "$test" 2>&1)
  result=$?
  
  if [ $result -eq 0 ]; then
    echo "$output" | tail -5
    # Extract pass/fail counts
    passed=$(echo "$output" | grep -oP "✓ Passed:\s*\K\d+" | tail -1)
    failed=$(echo "$output" | grep -oP "✗ Failed:\s*\K\d+" | tail -1)
    if [ -n "$passed" ]; then TOTAL_PASS=$((TOTAL_PASS + passed)); fi
    if [ -n "$failed" ]; then TOTAL_FAIL=$((TOTAL_FAIL + failed)); fi
    echo "  ✅ PASSED: $name"
  else
    echo "$output" | tail -10
    echo "  ⚠️  FAILED: $name (exit code $result)"
  fi
  echo ""
done

echo "╔═══════════════════════════════════════════════════════╗"
echo "║                    FINAL RESULTS                      ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║  Total Passed: $TOTAL_PASS                                    ║"
echo "║  Total Failed: $TOTAL_FAIL                                    ║"
echo "╚═══════════════════════════════════════════════════════╝"
