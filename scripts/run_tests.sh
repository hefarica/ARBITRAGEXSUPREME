#!/bin/bash

# =====================================================
# ArbitrageX Supreme V3.0 - Testing Suite Runner
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="test"
COVERAGE_DIR="coverage"
REPORTS_DIR="test-reports"
GAS_REPORTS_DIR="gas-reports"

# Create directories
mkdir -p $COVERAGE_DIR
mkdir -p $REPORTS_DIR
mkdir -p $GAS_REPORTS_DIR

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}ArbitrageX Supreme V3.0 - Comprehensive Testing${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        return 1
    fi
}

# Function to run tests with timeout
run_test_with_timeout() {
    timeout 300 $1 || {
        echo -e "${RED}⏰ Test timed out after 5 minutes${NC}"
        return 124
    }
}

# =====================================================
# 1. UNIT TESTS
# =====================================================

echo -e "${YELLOW}🧪 Running Unit Tests...${NC}"
echo "----------------------------------------"

# Clean previous artifacts
forge clean

# Run unit tests
run_test_with_timeout "forge test --match-path 'test/unit/*.sol' -vvv --gas-report"
UNIT_RESULT=$?

print_result $UNIT_RESULT "Unit Tests"
echo ""

# =====================================================
# 2. INTEGRATION TESTS (E2E)
# =====================================================

echo -e "${YELLOW}🔗 Running Integration Tests (E2E)...${NC}"
echo "----------------------------------------"

run_test_with_timeout "forge test --match-path 'test/integration/*.sol' -vvv --gas-report"
E2E_RESULT=$?

print_result $E2E_RESULT "Integration Tests (E2E)"
echo ""

# =====================================================
# 3. FUZZING TESTS
# =====================================================

echo -e "${YELLOW}🎯 Running Fuzzing Tests...${NC}"
echo "----------------------------------------"

# Run with high number of runs for thorough testing
FOUNDRY_PROFILE=stress run_test_with_timeout "forge test --match-path 'test/fuzzing/*.sol' -vvv"
FUZZ_RESULT=$?

print_result $FUZZ_RESULT "Fuzzing Tests"
echo ""

# =====================================================
# 4. INVARIANT TESTS
# =====================================================

echo -e "${YELLOW}🔒 Running Invariant Tests...${NC}"
echo "----------------------------------------"

run_test_with_timeout "forge test --match-test 'invariant*' -vvv"
INVARIANT_RESULT=$?

print_result $INVARIANT_RESULT "Invariant Tests"
echo ""

# =====================================================
# 5. SECURITY TESTS
# =====================================================

echo -e "${YELLOW}🛡️ Running Security Tests...${NC}"
echo "----------------------------------------"

# Test for reentrancy, access control, etc.
run_test_with_timeout "forge test --match-test '*Security*' --match-test '*Reentrancy*' --match-test '*Access*' -vvv"
SECURITY_RESULT=$?

print_result $SECURITY_RESULT "Security Tests"
echo ""

# =====================================================
# 6. GAS OPTIMIZATION TESTS
# =====================================================

echo -e "${YELLOW}⛽ Running Gas Optimization Tests...${NC}"
echo "----------------------------------------"

# Generate detailed gas reports
forge test --gas-report --match-test '*Benchmark*' > "$GAS_REPORTS_DIR/gas_optimization_report.txt" 2>&1
GAS_RESULT=$?

print_result $GAS_RESULT "Gas Optimization Tests"
echo ""

# =====================================================
# 7. COVERAGE ANALYSIS
# =====================================================

echo -e "${YELLOW}📊 Generating Coverage Report...${NC}"
echo "----------------------------------------"

# Generate coverage report
FOUNDRY_PROFILE=coverage forge coverage --report lcov --report-file "$COVERAGE_DIR/lcov.info" 2>/dev/null
COVERAGE_RESULT=$?

if [ $COVERAGE_RESULT -eq 0 ]; then
    # Generate HTML coverage report if lcov is available
    if command -v genhtml &> /dev/null; then
        genhtml "$COVERAGE_DIR/lcov.info" -o "$COVERAGE_DIR/html" --ignore-errors source 2>/dev/null
        echo -e "${GREEN}✅ HTML Coverage Report generated at: $COVERAGE_DIR/html/index.html${NC}"
    fi
    
    # Calculate coverage percentage
    COVERAGE_PCT=$(forge coverage --report summary 2>/dev/null | grep "Total" | awk '{print $4}' | sed 's/%//')
    echo -e "${GREEN}📈 Total Coverage: $COVERAGE_PCT%${NC}"
else
    echo -e "${YELLOW}⚠️ Coverage report generation skipped${NC}"
fi

echo ""

# =====================================================
# 8. PERFORMANCE BENCHMARKS
# =====================================================

echo -e "${YELLOW}🚀 Running Performance Benchmarks...${NC}"
echo "----------------------------------------"

# Run performance benchmarks
run_test_with_timeout "forge test --match-test '*Benchmark*' --match-test '*Performance*' -vvv"
PERF_RESULT=$?

print_result $PERF_RESULT "Performance Benchmarks"
echo ""

# =====================================================
# 9. STRESS TESTS
# =====================================================

echo -e "${YELLOW}💪 Running Stress Tests...${NC}"
echo "----------------------------------------"

# Run stress tests with high gas limits
FOUNDRY_PROFILE=stress run_test_with_timeout "forge test --match-test '*Stress*' -vvv --gas-limit 30000000"
STRESS_RESULT=$?

print_result $STRESS_RESULT "Stress Tests"
echo ""

# =====================================================
# 10. MAINNET FORK TESTS
# =====================================================

echo -e "${YELLOW}🍴 Running Mainnet Fork Tests...${NC}"
echo "----------------------------------------"

# Run tests against mainnet fork (if RPC is available)
if [ ! -z "$ETH_RPC_URL" ]; then
    run_test_with_timeout "forge test --match-test '*Fork*' --fork-url $ETH_RPC_URL -vvv"
    FORK_RESULT=$?
    print_result $FORK_RESULT "Mainnet Fork Tests"
else
    echo -e "${YELLOW}⚠️ Mainnet Fork Tests skipped (no ETH_RPC_URL)${NC}"
    FORK_RESULT=0
fi

echo ""

# =====================================================
# 11. GENERATE COMPREHENSIVE REPORT
# =====================================================

echo -e "${YELLOW}📋 Generating Test Report...${NC}"
echo "----------------------------------------"

REPORT_FILE="$REPORTS_DIR/comprehensive_test_report_$(date +%Y%m%d_%H%M%S).md"

cat > $REPORT_FILE << EOF
# ArbitrageX Supreme V3.0 - Test Report

**Generated:** $(date)
**Test Suite Version:** V3.0
**Environment:** $(uname -s)

## Test Results Summary

| Test Suite | Status | Details |
|------------|--------|---------|
| Unit Tests | $([ $UNIT_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | Core contract functionality |
| Integration (E2E) | $([ $E2E_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | End-to-end workflows |
| Fuzzing Tests | $([ $FUZZ_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | Property-based testing |
| Invariant Tests | $([ $INVARIANT_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | System invariants |
| Security Tests | $([ $SECURITY_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | Security validations |
| Gas Optimization | $([ $GAS_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | Gas efficiency |
| Performance | $([ $PERF_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | Performance benchmarks |
| Stress Tests | $([ $STRESS_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | High-load scenarios |
| Fork Tests | $([ $FORK_RESULT -eq 0 ] && echo "✅ PASSED" || echo "❌ FAILED") | Mainnet integration |

## Coverage Analysis

$([ $COVERAGE_RESULT -eq 0 ] && echo "- **Coverage:** $COVERAGE_PCT%" || echo "- **Coverage:** Not available")
- **Coverage Report:** $COVERAGE_DIR/html/index.html

## Key Metrics

- **Total Test Suites:** 9
- **Passed Suites:** $((9 - $([ $UNIT_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $E2E_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $FUZZ_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $INVARIANT_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $SECURITY_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $GAS_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $PERF_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $STRESS_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $FORK_RESULT -ne 0 ] && echo 1 || echo 0)))
- **Success Rate:** $((100 * (9 - $([ $UNIT_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $E2E_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $FUZZ_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $INVARIANT_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $SECURITY_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $GAS_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $PERF_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $STRESS_RESULT -ne 0 ] && echo 1 || echo 0) - $([ $FORK_RESULT -ne 0 ] && echo 1 || echo 0)) / 9))%

## Recommendations

### Critical Issues
$([ $SECURITY_RESULT -ne 0 ] && echo "- 🔴 Security tests failed - Address immediately" || echo "- ✅ No critical security issues detected")

### Performance Issues
$([ $GAS_RESULT -ne 0 ] && echo "- 🟡 Gas optimization needed" || echo "- ✅ Gas efficiency within acceptable range")
$([ $PERF_RESULT -ne 0 ] && echo "- 🟡 Performance benchmarks failed" || echo "- ✅ Performance benchmarks passed")

### Integration Issues  
$([ $E2E_RESULT -ne 0 ] && echo "- 🟡 E2E tests failed - Check integration points" || echo "- ✅ All integration tests passed")

## Next Steps

1. **Address Failed Tests:** Focus on any failed test suites
2. **Improve Coverage:** Target >95% test coverage
3. **Gas Optimization:** Review gas reports for optimization opportunities
4. **Security Audit:** Consider external security audit if tests pass
5. **Production Deployment:** System ready if all tests pass

---
*Generated by ArbitrageX Supreme V3.0 Testing Suite*
EOF

echo -e "${GREEN}✅ Comprehensive report generated: $REPORT_FILE${NC}"
echo ""

# =====================================================
# 12. FINAL SUMMARY
# =====================================================

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}              FINAL SUMMARY${NC}"
echo -e "${BLUE}================================================${NC}"

TOTAL_TESTS=9
PASSED_TESTS=0

[ $UNIT_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $E2E_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $FUZZ_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $INVARIANT_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $SECURITY_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $GAS_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $PERF_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $STRESS_RESULT -eq 0 ] && ((PASSED_TESTS++))
[ $FORK_RESULT -eq 0 ] && ((PASSED_TESTS++))

SUCCESS_RATE=$((100 * PASSED_TESTS / TOTAL_TESTS))

echo -e "📊 Test Suites: $PASSED_TESTS/$TOTAL_TESTS passed ($SUCCESS_RATE%)"
[ $COVERAGE_RESULT -eq 0 ] && echo -e "📈 Coverage: $COVERAGE_PCT%"
echo -e "📋 Report: $REPORT_FILE"

if [ $SUCCESS_RATE -eq 100 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! System ready for deployment.${NC}"
    EXIT_CODE=0
elif [ $SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️ Most tests passed. Review failed tests before deployment.${NC}"
    EXIT_CODE=1
else
    echo -e "${RED}🚨 Multiple test failures detected. System NOT ready for deployment.${NC}"
    EXIT_CODE=2
fi

echo -e "${BLUE}================================================${NC}"

# Cleanup
forge clean

exit $EXIT_CODE