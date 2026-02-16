#!/usr/bin/env node
/**
 * E2E Test Runner - Run all test suites
 *
 * Usage:
 *   node tests/e2e/run-all.js              # Run all tests
 *   node tests/e2e/run-all.js --quick      # Skip performance tests
 *   node tests/e2e/run-all.js --perf       # Only performance tests
 *   node tests/e2e/run-all.js --verbose    # Verbose output
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const flags = {
  quick: args.includes('--quick'),
  perf: args.includes('--perf'),
  verbose: args.includes('--verbose'),
  help: args.includes('--help') || args.includes('-h')
};

// Test suite definitions
const TEST_SUITES = [
  {
    name: '5-Terminal Scenario',
    file: '5-terminal-scenario.test.js',
    category: 'functional',
    description: 'Tests complete multi-agent collaborative workflow',
    estimatedTime: '15-30s'
  },
  {
    name: 'Git Worktree Integration',
    file: 'git-worktree.test.js',
    category: 'integration',
    description: 'Tests agent coordination across git worktrees',
    estimatedTime: '20-40s'
  },
  {
    name: 'Failure Recovery',
    file: 'failure-recovery.test.js',
    category: 'resilience',
    description: 'Tests system resilience and recovery mechanisms',
    estimatedTime: '25-45s'
  },
  {
    name: 'Scaling',
    file: 'scaling.test.js',
    category: 'scaling',
    description: 'Tests dynamic scaling and load balancing',
    estimatedTime: '30-60s'
  },
  {
    name: 'Performance Benchmark',
    file: 'performance.test.js',
    category: 'performance',
    description: 'Comprehensive performance testing and analysis',
    estimatedTime: '60-120s'
  }
];

// Test results
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  details: []
};

/**
 * Display help
 */
function displayHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           E2E Test Runner - Multi-Agent System             ║
╚════════════════════════════════════════════════════════════╝

Usage:
  node tests/e2e/run-all.js [options]

Options:
  --quick       Skip performance tests (faster execution)
  --perf        Run only performance tests
  --verbose     Show detailed output from tests
  --help, -h    Show this help message

Test Suites:
${TEST_SUITES.map((suite, i) => `  ${i + 1}. ${suite.name} (${suite.estimatedTime})
     ${suite.description}`).join('\n\n')}

Examples:
  # Run all tests
  node tests/e2e/run-all.js

  # Quick test run (skip performance)
  node tests/e2e/run-all.js --quick

  # Only performance tests
  node tests/e2e/run-all.js --perf

  # Verbose output
  node tests/e2e/run-all.js --verbose

Prerequisites:
  - RabbitMQ running on localhost:5672
  - Node.js >= 18
  - Dependencies installed (npm install)
`);
}

/**
 * Run a single test suite
 */
async function runTest(suite) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Running: ${suite.name}`);
    console.log(`  Category: ${suite.category}`);
    console.log(`  Estimated time: ${suite.estimatedTime}`);
    console.log(`${'='.repeat(60)}\n`);

    const startTime = performance.now();
    const testPath = path.join(__dirname, suite.file);

    const child = spawn('node', [testPath], {
      stdio: flags.verbose ? 'inherit' : 'pipe',
      env: { ...process.env }
    });

    let output = '';
    let errorOutput = '';

    if (!flags.verbose) {
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
    }

    child.on('close', (code) => {
      const duration = performance.now() - startTime;
      const passed = code === 0;

      const result = {
        name: suite.name,
        file: suite.file,
        category: suite.category,
        passed,
        duration,
        exitCode: code,
        output: flags.verbose ? null : output,
        errorOutput: flags.verbose ? null : errorOutput
      };

      results.total++;
      if (passed) {
        results.passed++;
        console.log(`\n✅ PASSED: ${suite.name}`);
      } else {
        results.failed++;
        console.log(`\n❌ FAILED: ${suite.name}`);
        if (!flags.verbose && errorOutput) {
          console.log('\nError output:');
          console.log(errorOutput);
        }
      }
      console.log(`⏱️  Duration: ${(duration / 1000).toFixed(2)}s\n`);

      results.details.push(result);
      resolve(result);
    });

    child.on('error', (error) => {
      console.error(`\n❌ ERROR running ${suite.name}:`, error.message);
      results.total++;
      results.failed++;
      results.details.push({
        name: suite.name,
        file: suite.file,
        category: suite.category,
        passed: false,
        duration: 0,
        error: error.message
      });
      resolve({ passed: false });
    });
  });
}

/**
 * Display summary
 */
function displaySummary(totalDuration) {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Overall Results:`);
  console.log(`   Total tests:    ${results.total}`);
  console.log(`   ✅ Passed:      ${results.passed}`);
  console.log(`   ❌ Failed:      ${results.failed}`);
  console.log(`   ⏭️  Skipped:     ${results.skipped}`);
  console.log(`   ⏱️  Total time:  ${(totalDuration / 1000).toFixed(2)}s\n`);

  console.log(`📋 Test Details:\n`);

  for (const result of results.details) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const time = (result.duration / 1000).toFixed(2);
    console.log(`   ${status} - ${result.name} (${time}s)`);
  }

  console.log('\n');

  // Calculate success rate
  const successRate = results.total > 0
    ? (results.passed / results.total * 100).toFixed(2)
    : 0;

  if (successRate === 100) {
    console.log('🎉 All tests passed! System is working correctly.\n');
  } else if (successRate >= 80) {
    console.log(`⚠️  Most tests passed (${successRate}%), but some failures detected.\n`);
  } else {
    console.log(`❌ Significant failures detected (${successRate}% success rate).\n`);
  }

  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

/**
 * Check prerequisites
 */
async function checkPrerequisites() {
  console.log('\n🔍 Checking prerequisites...\n');

  // Check RabbitMQ connection
  try {
    const response = await fetch('http://localhost:15672/api/overview', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + Buffer.from('guest:guest').toString('base64')
      }
    });

    if (response.ok) {
      console.log('✅ RabbitMQ is running and accessible\n');
      return true;
    } else {
      console.log('⚠️  RabbitMQ is running but responded with:', response.status, '\n');
      return true; // Continue anyway
    }
  } catch (error) {
    console.log('❌ RabbitMQ is not accessible on localhost:15672');
    console.log('   Make sure RabbitMQ is running:');
    console.log('   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management\n');
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        E2E Test Suite - Multi-Agent Orchestration         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (flags.help) {
    displayHelp();
    process.exit(0);
  }

  // Check prerequisites
  const prereqsOk = await checkPrerequisites();
  if (!prereqsOk) {
    console.log('❌ Prerequisites not met. Exiting.\n');
    process.exit(1);
  }

  // Filter test suites based on flags
  let suitesToRun = TEST_SUITES;

  if (flags.quick) {
    suitesToRun = TEST_SUITES.filter(s => s.category !== 'performance');
    console.log('🏃 Quick mode: Skipping performance tests\n');
    results.skipped = TEST_SUITES.length - suitesToRun.length;
  } else if (flags.perf) {
    suitesToRun = TEST_SUITES.filter(s => s.category === 'performance');
    console.log('⚡ Performance mode: Running only performance tests\n');
    results.skipped = TEST_SUITES.length - suitesToRun.length;
  }

  console.log(`📝 Running ${suitesToRun.length} test suite(s)...\n`);

  const overallStartTime = performance.now();

  // Run tests sequentially
  for (const suite of suitesToRun) {
    await runTest(suite);

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const totalDuration = performance.now() - overallStartTime;

  // Display summary
  displaySummary(totalDuration);

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});
