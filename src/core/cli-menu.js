#!/usr/bin/env node
/**
 * Claude Collective Intelligence - Unified CLI Menu
 *
 * Interactive access to all 8 AI mechanisms:
 * - Brainstorm, Voting, Battle, Mentorship
 * - Rewards, Penalties, Reputation, Orchestrator
 *
 * @author Dr. Umit Kacar
 * @version 1.0.0
 */

import chalk from 'chalk';
import ora from 'ora';
import { createInterface } from 'readline';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import net from 'net';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EXAMPLES_DIR = join(__dirname, '..', 'examples');

// RabbitMQ configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:rabbitmq123@localhost:5672';
const RABBITMQ_HOST = 'localhost';
const RABBITMQ_PORT = 5672;

// Menu configuration
const MENU_OPTIONS = [
  { key: '1', name: 'Brainstorm Session', file: 'brainstorm-scenario.js', rabbit: true, icon: '🧠', desc: 'Multi-agent collaborative idea generation' },
  { key: '2', name: 'Voting System', file: 'voting-scenario.js', rabbit: true, icon: '🗳️', desc: '5 democratic voting algorithms' },
  { key: '3', name: 'Battle Arena', file: 'battle-scenario.js', rabbit: false, icon: '⚔️', desc: '1v1 duels, speed races, leaderboards' },
  { key: '4', name: 'Mentorship Program', file: 'mentorship-scenario.js', rabbit: true, icon: '🎓', desc: '10x training acceleration (30→3 days)' },
  { key: '5', name: 'Rewards Demo', file: 'rewards-scenario.js', rabbit: false, icon: '🎁', desc: 'Tier progression: Bronze→Gold' },
  { key: '6', name: 'Penalties Demo', file: 'penalties-scenario.js', rabbit: true, icon: '⚠️', desc: '6 progressive levels + retraining' },
  { key: '7', name: 'Reputation System', file: 'reputation-scenario.js', rabbit: true, icon: '📊', desc: 'EigenTrust peer reputation' },
  { key: '8', name: 'Full Demo', file: 'all', rabbit: true, icon: '🚀', desc: 'Run all standalone demos sequentially' },
  { key: '9', name: 'System Status', file: 'status', rabbit: false, icon: '⚙️', desc: 'Check RabbitMQ & system health' },
  { key: '0', name: 'Exit', file: 'exit', rabbit: false, icon: '👋', desc: 'Exit the menu' }
];

// Standalone demos (no RabbitMQ required)
const STANDALONE_DEMOS = ['battle-scenario.js', 'rewards-scenario.js'];

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Display the branded header
 */
function displayHeader() {
  console.clear();
  console.log(chalk.cyan('╔═══════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('     🧠 CLAUDE COLLECTIVE INTELLIGENCE                        ') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.gray('        AI Agent Swarm Framework v1.0.0                       ') + chalk.cyan('║'));
  console.log(chalk.cyan('╠═══════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan('║') + chalk.yellow('  8 AI Mechanisms') + chalk.gray(' | ') + chalk.green('13 Examples') + chalk.gray(' | ') + chalk.magenta('Production Ready') + chalk.gray('       ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════════╝'));
  console.log();
}

/**
 * Check if RabbitMQ is available
 * @returns {Promise<boolean>}
 */
async function checkRabbitMQ() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);

    socket.connect(RABBITMQ_PORT, RABBITMQ_HOST, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Display prerequisites status
 */
async function displayStatus() {
  const spinner = ora('Checking system status...').start();

  const rabbitOk = await checkRabbitMQ();

  spinner.stop();

  console.log(chalk.bold('\n📋 System Status:\n'));

  // RabbitMQ status
  if (rabbitOk) {
    console.log(chalk.green('  ✅ RabbitMQ') + chalk.gray(` - Connected (${RABBITMQ_HOST}:${RABBITMQ_PORT})`));
  } else {
    console.log(chalk.red('  ❌ RabbitMQ') + chalk.gray(' - Not available'));
    console.log(chalk.yellow('     💡 Start with: docker compose up -d'));
  }

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]);
  if (nodeMajor >= 18) {
    console.log(chalk.green(`  ✅ Node.js`) + chalk.gray(` - ${nodeVersion}`));
  } else {
    console.log(chalk.red(`  ❌ Node.js`) + chalk.gray(` - ${nodeVersion} (requires 18+)`));
  }

  // Environment
  console.log(chalk.green('  ✅ Environment') + chalk.gray(` - ${process.env.NODE_ENV || 'development'}`));

  console.log();

  return rabbitOk;
}

/**
 * Display the menu options
 * @param {boolean} rabbitOk - Whether RabbitMQ is available
 */
function displayMenu(rabbitOk) {
  console.log(chalk.bold('📋 Select an option:\n'));

  for (const option of MENU_OPTIONS) {
    const keyStyle = chalk.cyan.bold(`[${option.key}]`);
    const nameStyle = chalk.white(option.name);
    const descStyle = chalk.gray(option.desc);

    // Show warning if RabbitMQ required but not available
    let statusIndicator = '';
    if (option.rabbit && !rabbitOk && option.file !== 'status' && option.file !== 'exit' && option.file !== 'all') {
      statusIndicator = chalk.yellow(' ⚠️ (needs RabbitMQ)');
    }

    console.log(`  ${keyStyle} ${option.icon} ${nameStyle}${statusIndicator}`);
    console.log(`      ${descStyle}`);
  }

  console.log();
}

/**
 * Run a single example
 * @param {Object} option - Menu option object
 * @returns {Promise<void>}
 */
async function runExample(option) {
  const examplePath = join(EXAMPLES_DIR, option.file);

  console.log(chalk.cyan(`\n🚀 Starting ${option.name}...\n`));
  console.log(chalk.gray('─'.repeat(60)));
  console.log();

  return new Promise((resolve) => {
    const child = spawn('node', [examplePath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        RABBITMQ_URL,
        NODE_OPTIONS: '--experimental-vm-modules'
      },
      cwd: join(__dirname, '..')
    });

    child.on('close', (code) => {
      console.log();
      console.log(chalk.gray('─'.repeat(60)));
      if (code === 0) {
        console.log(chalk.green(`\n✅ ${option.name} completed successfully!`));
      } else {
        console.log(chalk.yellow(`\n⚠️ ${option.name} exited with code ${code}`));
      }
      resolve();
    });

    child.on('error', (error) => {
      console.log(chalk.red(`\n❌ Error running ${option.name}: ${error.message}`));
      resolve();
    });
  });
}

/**
 * Run all standalone demos sequentially
 */
async function runFullDemo() {
  console.log(chalk.cyan('\n🚀 Running Full Demo (Standalone demos)...\n'));

  const standaloneOptions = MENU_OPTIONS.filter(opt =>
    STANDALONE_DEMOS.includes(opt.file)
  );

  for (const option of standaloneOptions) {
    console.log(chalk.bold(`\n━━━ ${option.icon} ${option.name} ━━━\n`));
    await runExample(option);

    // Brief pause between demos
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(chalk.green('\n🎉 Full Demo completed!\n'));
}

/**
 * Prompt user for input
 * @param {string} question - Question to ask
 * @returns {Promise<string>}
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Handle user selection
 * @param {string} choice - User's choice
 * @param {boolean} rabbitOk - Whether RabbitMQ is available
 * @returns {Promise<boolean>} - Whether to continue the menu loop
 */
async function handleChoice(choice, rabbitOk) {
  const option = MENU_OPTIONS.find(opt => opt.key === choice);

  if (!option) {
    console.log(chalk.red('\n❌ Invalid option. Please try again.\n'));
    await prompt(chalk.gray('Press Enter to continue...'));
    return true;
  }

  // Handle exit
  if (option.file === 'exit') {
    console.log(chalk.cyan('\n👋 Goodbye! Thanks for using Claude Collective Intelligence.\n'));
    return false;
  }

  // Handle system status
  if (option.file === 'status') {
    await displayStatus();
    await prompt(chalk.gray('Press Enter to continue...'));
    return true;
  }

  // Handle full demo
  if (option.file === 'all') {
    await runFullDemo();
    await prompt(chalk.gray('Press Enter to return to menu...'));
    return true;
  }

  // Check RabbitMQ requirement
  if (option.rabbit && !rabbitOk) {
    console.log(chalk.yellow(`\n⚠️ ${option.name} requires RabbitMQ.`));
    console.log(chalk.gray('Start RabbitMQ with: docker compose up -d\n'));

    const proceed = await prompt(chalk.cyan('Try anyway? (y/N): '));
    if (proceed.toLowerCase() !== 'y') {
      return true;
    }
  }

  // Run the example
  await runExample(option);
  await prompt(chalk.gray('\nPress Enter to return to menu...'));
  return true;
}

/**
 * Main menu loop
 */
async function main() {
  // Display header
  displayHeader();

  // Check prerequisites
  console.log(chalk.gray('Checking system status...\n'));
  const rabbitOk = await checkRabbitMQ();

  if (rabbitOk) {
    console.log(chalk.green('✅ RabbitMQ is available\n'));
  } else {
    console.log(chalk.yellow('⚠️ RabbitMQ is not running'));
    console.log(chalk.gray('   Some demos require RabbitMQ. Start with: docker compose up -d\n'));
  }

  // Menu loop
  let continueLoop = true;
  while (continueLoop) {
    displayHeader();
    displayMenu(rabbitOk);

    const choice = await prompt(chalk.cyan('Enter your choice [0-9]: '));
    continueLoop = await handleChoice(choice, rabbitOk);
  }

  rl.close();
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.cyan('\n\n👋 Interrupted. Goodbye!\n'));
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  rl.close();
  process.exit(0);
});

// Run the menu
main().catch((error) => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
