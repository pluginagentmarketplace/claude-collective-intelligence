#!/usr/bin/env node
/**
 * Database E2E Test Runner
 * Runs all end-to-end tests with real RabbitMQ + PostgreSQL
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test files to run
const tests = [
  {
    name: 'Complete Agent Lifecycle',
    file: 'complete-agent-lifecycle.test.js',
    description: 'Agent registration → tasks → points → tier progression'
  },
  {
    name: 'Mentorship Flow',
    file: 'mentorship-flow.test.js',
    description: 'Mentor pairing → training → graduation'
  },
  {
    name: 'Gamification Flow',
    file: 'gamification-flow.test.js',
    description: 'Points → rewards → penalties → leaderboard'
  },
  {
    name: 'Voting Persistence',
    file: 'voting-persistence.test.js',
    description: 'Voting sessions → algorithms → audit trail'
  },
  {
    name: 'Battle System E2E',
    file: 'battle-system-e2e.test.js',
    description: 'Battles → ELO ratings → persistence'
  }
];

// Run a single test
async function runTest(test) {
  return new Promise((resolve) => {
    const testPath = join(__dirname, test.file);
    const startTime = Date.now();

    console.log(`${colors.cyan}${colors.bright}▶${colors.reset} Running: ${test.name}`);
    console.log(`  ${colors.blue}${test.description}${colors.reset}`);

    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test' }
    });

    child.on('exit', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      if (code === 0) {
        console.log(`${colors.green}✓${colors.reset} ${test.name} ${colors.bright}passed${colors.reset} (${duration}s)\n`);
        resolve({ success: true, name: test.name, duration });
      } else {
        console.log(`${colors.red}✗${colors.reset} ${test.name} ${colors.bright}failed${colors.reset} (${duration}s)\n`);
        resolve({ success: false, name: test.name, duration, exitCode: code });
      }
    });

    child.on('error', (error) => {
      console.error(`${colors.red}Error running test:${colors.reset}`, error.message);
      resolve({ success: false, name: test.name, error: error.message });
    });
  });
}

// Check if infrastructure is ready
async function checkInfrastructure() {
  console.log(`${colors.yellow}⚙${colors.reset}  Checking test infrastructure...\n`);

  const checks = [];

  // Check RabbitMQ
  checks.push(
    new Promise((resolve) => {
      const amqp = spawn('node', [
        '-e',
        `import('amqplib').then(m => m.default.connect('amqp://test_user:test_password@localhost:5673/test_vhost')).then(() => { console.log('RabbitMQ: OK'); process.exit(0); }).catch(e => { console.error('RabbitMQ:', e.message); process.exit(1); })`
      ]);
      amqp.on('exit', (code) => resolve({ service: 'RabbitMQ', ok: code === 0 }));
    })
  );

  // Check PostgreSQL
  checks.push(
    new Promise((resolve) => {
      const pg = spawn('node', [
        '-e',
        `import('pg').then(m => { const c = new m.default.Pool({host:'localhost',port:5433,user:'test_user',password:'test_password',database:'ai_agents_test'}); c.query('SELECT 1').then(() => { console.log('PostgreSQL: OK'); c.end(); process.exit(0); }).catch(e => { console.error('PostgreSQL:', e.message); c.end(); process.exit(1); }); })`
      ]);
      pg.on('exit', (code) => resolve({ service: 'PostgreSQL', ok: code === 0 }));
    })
  );

  const results = await Promise.all(checks);

  results.forEach(result => {
    if (result.ok) {
      console.log(`  ${colors.green}✓${colors.reset} ${result.service} is ready`);
    } else {
      console.log(`  ${colors.red}✗${colors.reset} ${result.service} is not available`);
    }
  });

  const allReady = results.every(r => r.ok);

  if (!allReady) {
    console.log(`\n${colors.red}${colors.bright}Infrastructure not ready!${colors.reset}`);
    console.log('\nStart with: docker-compose -f docker-compose.test.yml up -d');
    console.log('Wait 10-15 seconds for services to initialize\n');
    return false;
  }

  console.log(`\n${colors.green}${colors.bright}✓ Infrastructure ready${colors.reset}\n`);
  return true;
}

// Main test runner
async function runAllTests() {
  const startTime = Date.now();

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}🧪  Database E2E Test Suite${colors.reset}`);
  console.log('   Real RabbitMQ + PostgreSQL Integration Tests');
  console.log('='.repeat(60) + '\n');

  // Check infrastructure first
  const infrastructureReady = await checkInfrastructure();

  if (!infrastructureReady) {
    process.exit(1);
  }

  // Run tests
  const results = [];

  for (const test of tests) {
    const result = await runTest(test);
    results.push(result);
  }

  // Summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('='.repeat(60));
  console.log(`${colors.bright}📊 Test Summary${colors.reset}`);
  console.log('='.repeat(60));

  console.log(`\nTests run: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total time: ${totalDuration}s`);

  if (failed > 0) {
    console.log(`\n${colors.red}${colors.bright}Failed tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ${colors.red}✗${colors.reset} ${r.name}`);
    });
  }

  console.log('\n' + '='.repeat(60));

  if (failed === 0) {
    console.log(`${colors.green}${colors.bright}✅ All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bright}❌ ${failed} test(s) failed${colors.reset}`);
  }

  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bright}Database E2E Test Runner${colors.reset}

Usage:
  node run-database-tests.js [options]

Options:
  --help, -h        Show this help message
  --list            List all available tests

Examples:
  node run-database-tests.js
  npm run test:e2e:db
`);
  process.exit(0);
}

if (args.includes('--list')) {
  console.log(`\n${colors.bright}Available Database E2E Tests:${colors.reset}\n`);
  tests.forEach((test, index) => {
    console.log(`${index + 1}. ${colors.cyan}${test.name}${colors.reset}`);
    console.log(`   ${test.description}`);
    console.log(`   File: ${test.file}\n`);
  });
  process.exit(0);
}

// Run all tests
runAllTests().catch(error => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
