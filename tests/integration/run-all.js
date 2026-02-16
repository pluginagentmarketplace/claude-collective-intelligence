#!/usr/bin/env node
/**
 * Integration Test Runner
 * Runs all integration tests and reports results
 */

import TaskDistributionTest from './task-distribution.test.js';
import BrainstormingTest from './brainstorming.test.js';
import FailureHandlingTest from './failure-handling.test.js';
import MultiAgentTest from './multi-agent.test.js';
import MonitoringTest from './monitoring.test.js';

class IntegrationTestRunner {
  constructor() {
    this.testSuites = [
      { name: 'Task Distribution', class: TaskDistributionTest },
      { name: 'Brainstorming', class: BrainstormingTest },
      { name: 'Failure Handling', class: FailureHandlingTest },
      { name: 'Multi-Agent Coordination', class: MultiAgentTest },
      { name: 'Monitoring', class: MonitoringTest }
    ];

    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      suites: []
    };
  }

  async runAll() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     RABBITMQ AI AGENT - INTEGRATION TEST SUITE             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const startTime = Date.now();

    for (const suite of this.testSuites) {
      console.log(`\n${'='.repeat(62)}`);
      console.log(`Running: ${suite.name}`);
      console.log('='.repeat(62));

      const suiteStartTime = Date.now();

      try {
        const testInstance = new suite.class();
        const success = await testInstance.runTests();

        const suiteEndTime = Date.now();
        const duration = suiteEndTime - suiteStartTime;

        this.results.suites.push({
          name: suite.name,
          success,
          duration,
          passed: testInstance.testResults.passed,
          failed: testInstance.testResults.failed,
          errors: testInstance.testResults.errors
        });

        this.results.total += testInstance.testResults.passed + testInstance.testResults.failed;
        this.results.passed += testInstance.testResults.passed;
        this.results.failed += testInstance.testResults.failed;

        if (success) {
          console.log(`\n✅ ${suite.name} - PASSED (${duration}ms)`);
        } else {
          console.log(`\n❌ ${suite.name} - FAILED (${duration}ms)`);
        }
      } catch (error) {
        console.error(`\n❌ ${suite.name} - ERROR: ${error.message}`);
        this.results.suites.push({
          name: suite.name,
          success: false,
          duration: Date.now() - suiteStartTime,
          passed: 0,
          failed: 1,
          errors: [error.message]
        });
        this.results.failed++;
        this.results.total++;
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    this.printSummary(totalDuration);

    return this.results.failed === 0;
  }

  printSummary(duration) {
    console.log('\n\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║              INTEGRATION TEST SUMMARY                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Overall stats
    console.log('Overall Results:');
    console.log(`  Total Test Suites: ${this.testSuites.length}`);
    console.log(`  Total Tests: ${this.results.total}`);
    console.log(`  ✅ Passed: ${this.results.passed}`);
    console.log(`  ❌ Failed: ${this.results.failed}`);
    console.log(`  Duration: ${(duration / 1000).toFixed(2)}s\n`);

    // Suite breakdown
    console.log('Test Suite Breakdown:');
    this.results.suites.forEach((suite, index) => {
      const status = suite.success ? '✅' : '❌';
      const durationSec = (suite.duration / 1000).toFixed(2);
      console.log(`  ${index + 1}. ${status} ${suite.name}`);
      console.log(`     Passed: ${suite.passed}, Failed: ${suite.failed}, Duration: ${durationSec}s`);

      if (suite.errors && suite.errors.length > 0) {
        console.log('     Errors:');
        suite.errors.forEach(error => {
          console.log(`       - ${error}`);
        });
      }
    });

    // Final verdict
    console.log('\n' + '═'.repeat(62));
    if (this.results.failed === 0) {
      console.log('🎉 ALL TESTS PASSED! 🎉');
    } else {
      console.log(`⚠️  ${this.results.failed} TEST(S) FAILED`);
    }
    console.log('═'.repeat(62) + '\n');
  }
}

// Run all tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new IntegrationTestRunner();

  runner.runAll()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error running tests:', error);
      process.exit(1);
    });
}

export default IntegrationTestRunner;
