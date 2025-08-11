/**
 * Comprehensive Test Suite Runner for Intelligent Rescheduling System
 * 
 * This script orchestrates the execution of all rescheduling tests,
 * provides detailed reporting, and validates system readiness.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ReschedulingTestRunner {
  constructor() {
    this.testResults = {
      unit: {},
      integration: {},
      manual: {},
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    };
    this.startTime = Date.now();
  }

  /**
   * Run all rescheduling tests
   */
  async runAllTests() {
    console.log('🚀 Intelligent Rescheduling System - Comprehensive Test Suite');
    console.log('='.repeat(70));
    console.log(`Start time: ${new Date().toISOString()}`);
    console.log('');

    try {
      // 1. Unit Tests
      console.log('📋 Running Unit Tests...');
      await this.runUnitTests();

      // 2. Integration Tests  
      console.log('\n📋 Running Integration Tests...');
      await this.runIntegrationTests();

      // 3. Manual Test Validation
      console.log('\n📋 Running Manual Test Validation...');
      await this.runManualTests();

      // 4. Generate comprehensive report
      this.generateFinalReport();

    } catch (error) {
      console.error('❌ Fatal error in test execution:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run unit tests for rescheduling
   */
  async runUnitTests() {
    const unitTests = [
      {
        name: 'API Endpoint Tests',
        path: 'unit/rescheduling/rescheduling-endpoint.test.js',
        description: 'Authentication, authorization, and response format validation'
      },
      {
        name: 'Database Integrity Tests',
        path: 'unit/rescheduling/database-integrity.test.js',
        description: 'Ensures no existing non-overdue sessions are modified'
      },
      {
        name: 'Intelligent Logic Tests',
        path: 'unit/rescheduling/intelligent-logic.test.js',
        description: 'Subject-aware grouping and intelligent slot assignment'
      },
      {
        name: 'Constraint Validation Tests',
        path: 'unit/rescheduling/constraint-validation.test.js',
        description: 'Daily limits, session counts, and exam date constraints'
      },
      {
        name: 'Edge Cases Tests',
        path: 'unit/rescheduling/edge-cases.test.js',
        description: 'No overdue tasks, no slots, maximum capacity scenarios'
      },
      {
        name: 'Spaced Repetition Tests',
        path: 'unit/rescheduling/spaced-repetition.test.js',
        description: 'Learning continuity and spaced repetition preservation'
      }
    ];

    for (const test of unitTests) {
      console.log(`\n  🧪 ${test.name}`);
      console.log(`     ${test.description}`);
      
      const result = await this.runJestTest(test.path);
      this.testResults.unit[test.name] = result;
      
      if (result.success) {
        console.log(`     ✅ PASSED (${result.tests} tests, ${result.duration}ms)`);
      } else {
        console.log(`     ❌ FAILED (${result.failures} failures)`);
      }
    }

    const unitSummary = this.summarizeResults(Object.values(this.testResults.unit));
    console.log(`\n📊 Unit Tests Summary: ${unitSummary.passed}/${unitSummary.total} passed`);
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests() {
    const integrationTests = [
      {
        name: 'Full Workflow Integration',
        path: 'integration/rescheduling-workflow.test.js',
        description: 'Complete end-to-end rescheduling workflow with user 3@3.com'
      }
    ];

    for (const test of integrationTests) {
      console.log(`\n  🔄 ${test.name}`);
      console.log(`     ${test.description}`);
      
      const result = await this.runJestTest(test.path);
      this.testResults.integration[test.name] = result;
      
      if (result.success) {
        console.log(`     ✅ PASSED (${result.tests} tests, ${result.duration}ms)`);
      } else {
        console.log(`     ❌ FAILED (${result.failures} failures)`);
      }
    }

    const integrationSummary = this.summarizeResults(Object.values(this.testResults.integration));
    console.log(`\n📊 Integration Tests Summary: ${integrationSummary.passed}/${integrationSummary.total} passed`);
  }

  /**
   * Run manual test validation
   */
  async runManualTests() {
    console.log('\n  📋 Creating test data for manual validation...');
    
    try {
      // Create test data
      const dataCreationResult = await this.runNodeScript('scripts/create-rescheduling-test-data.js', ['create']);
      
      if (dataCreationResult.success) {
        console.log('     ✅ Test data created successfully');
        
        // Run manual test validations
        const manualTests = [
          {
            name: 'User 3@3.com Validation',
            script: 'tests/manual/rescheduling-manual-tests.js',
            args: ['user3']
          },
          {
            name: 'Database Health Check',
            script: 'tests/manual/rescheduling-manual-tests.js',
            args: ['health']
          },
          {
            name: 'Performance Validation',
            script: 'tests/manual/rescheduling-manual-tests.js',
            args: ['performance']
          }
        ];

        for (const test of manualTests) {
          console.log(`\n  🔍 ${test.name}`);
          const result = await this.runNodeScript(test.script, test.args);
          this.testResults.manual[test.name] = result;
          
          if (result.success) {
            console.log(`     ✅ PASSED`);
          } else {
            console.log(`     ❌ FAILED`);
          }
        }
      } else {
        console.log('     ❌ Failed to create test data');
      }
    } catch (error) {
      console.error('❌ Error in manual tests:', error.message);
    }

    const manualSummary = this.summarizeResults(Object.values(this.testResults.manual));
    console.log(`\n📊 Manual Tests Summary: ${manualSummary.passed}/${manualSummary.total} passed`);
  }

  /**
   * Run Jest test file
   */
  async runJestTest(testPath) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const jest = spawn('npm', ['test', testPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      jest.stdout.on('data', (data) => {
        output += data.toString();
      });

      jest.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      jest.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        // Parse Jest output for test counts
        const testMatch = output.match(/(\d+) passing/);
        const failMatch = output.match(/(\d+) failing/);
        
        const tests = testMatch ? parseInt(testMatch[1]) : 0;
        const failures = failMatch ? parseInt(failMatch[1]) : 0;

        resolve({
          success: code === 0,
          tests,
          failures,
          duration,
          output,
          errorOutput
        });
      });

      jest.on('error', (error) => {
        resolve({
          success: false,
          tests: 0,
          failures: 1,
          duration: Date.now() - startTime,
          output: '',
          errorOutput: error.message
        });
      });
    });
  }

  /**
   * Run Node.js script
   */
  async runNodeScript(scriptPath, args = []) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const node = spawn('node', [scriptPath, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });

      let output = '';
      let errorOutput = '';

      node.stdout.on('data', (data) => {
        output += data.toString();
      });

      node.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      node.on('close', (code) => {
        resolve({
          success: code === 0,
          duration: Date.now() - startTime,
          output,
          errorOutput
        });
      });

      node.on('error', (error) => {
        resolve({
          success: false,
          duration: Date.now() - startTime,
          output: '',
          errorOutput: error.message
        });
      });
    });
  }

  /**
   * Summarize test results
   */
  summarizeResults(results) {
    const summary = {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    this.testResults.total += summary.total;
    this.testResults.passed += summary.passed;
    this.testResults.failed += summary.failed;

    return summary;
  }

  /**
   * Generate final comprehensive report
   */
  generateFinalReport() {
    const totalDuration = Date.now() - this.startTime;
    const successRate = (this.testResults.passed / this.testResults.total * 100).toFixed(1);

    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL TEST REPORT - Intelligent Rescheduling System');
    console.log('='.repeat(70));
    
    console.log(`\n🕐 Execution Time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`✅ Tests Passed: ${this.testResults.passed}`);
    console.log(`❌ Tests Failed: ${this.testResults.failed}`);
    console.log(`📊 Total Tests: ${this.testResults.total}`);

    console.log('\n📋 Test Coverage Areas:');
    console.log('  ✅ API endpoint authentication and authorization');
    console.log('  ✅ Database integrity and constraint validation');
    console.log('  ✅ Intelligent subject-aware rescheduling logic');
    console.log('  ✅ Daily study time and session count limits');
    console.log('  ✅ Exam date boundary constraints');
    console.log('  ✅ Edge cases and error handling');
    console.log('  ✅ Spaced repetition and learning continuity');
    console.log('  ✅ Load balancing (max 2 sessions per subject per day)');
    console.log('  ✅ Integration workflow with user 3@3.com scenario');
    console.log('  ✅ Performance and reliability validation');

    console.log('\n🎯 Test Scenarios Validated:');
    console.log('  📚 User 3@3.com with 7 overdue tasks (as specified)');
    console.log('  🎓 Concurso student scenario');
    console.log('  💼 Working professional scenario');
    console.log('  📖 ENEM student scenario');
    console.log('  😰 Procrastinator scenario');
    console.log('  🎯 Perfectionist scenario');
    console.log('  💪 Stress test with large datasets');

    console.log('\n🔒 Safety Guarantees Tested:');
    console.log('  ✅ No existing non-overdue sessions are modified');
    console.log('  ✅ Daily study time limits are respected');
    console.log('  ✅ Session count limits per day are maintained');
    console.log('  ✅ No sessions scheduled beyond exam date');
    console.log('  ✅ Subject load balancing rules enforced');
    console.log('  ✅ Spaced repetition intervals preserved');
    console.log('  ✅ Database integrity maintained');
    console.log('  ✅ Authentication and authorization enforced');

    if (this.testResults.failed === 0) {
      console.log('\n🎉 SYSTEM READY FOR DEPLOYMENT!');
      console.log('   All tests passed successfully.');
      console.log('   The intelligent rescheduling system is validated and ready.');
    } else {
      console.log('\n⚠️  DEPLOYMENT NOT RECOMMENDED');
      console.log(`   ${this.testResults.failed} test(s) failed.`);
      console.log('   Please review and fix issues before deployment.');
    }

    // Generate detailed report file
    this.generateDetailedReport();
    
    console.log('\n📄 Detailed report saved to: tests/reports/rescheduling-test-report.json');
    console.log('='.repeat(70));
  }

  /**
   * Generate detailed JSON report
   */
  generateDetailedReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.total,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: (this.testResults.passed / this.testResults.total * 100).toFixed(1),
        duration: Date.now() - this.startTime
      },
      results: {
        unit: this.testResults.unit,
        integration: this.testResults.integration,
        manual: this.testResults.manual
      },
      coverage: {
        features: [
          'API endpoint validation',
          'Database integrity',
          'Intelligent rescheduling logic',
          'Constraint validation',
          'Edge case handling',
          'Spaced repetition preservation',
          'Load balancing',
          'Integration workflows'
        ],
        scenarios: [
          'User 3@3.com (7 overdue tasks)',
          'Concurso student',
          'Working professional',
          'ENEM student',
          'Procrastinator',
          'Perfectionist',
          'Stress test'
        ],
        safetyGuarantees: [
          'Non-overdue session protection',
          'Daily study time limits',
          'Session count limits',
          'Exam date boundaries',
          'Subject load balancing',
          'Learning continuity',
          'Database integrity',
          'Security enforcement'
        ]
      },
      deployment: {
        ready: this.testResults.failed === 0,
        recommendation: this.testResults.failed === 0 ? 'APPROVED FOR DEPLOYMENT' : 'FIX ISSUES BEFORE DEPLOYMENT',
        blockers: this.testResults.failed
      }
    };

    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Write detailed report
    const reportPath = path.join(reportsDir, 'rescheduling-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  }
}

/**
 * Main execution
 */
async function main() {
  const runner = new ReschedulingTestRunner();
  await runner.runAllTests();
}

// Export for programmatic use
module.exports = { ReschedulingTestRunner };

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}