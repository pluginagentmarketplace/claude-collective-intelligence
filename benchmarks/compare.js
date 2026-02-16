#!/usr/bin/env node

/**
 * Performance Test Comparison Tool
 * Compares current test results with baseline and generates analysis
 *
 * Usage: node benchmarks/compare.js <test-results.json> [--baseline baseline.json]
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const resultsFile = args[0] || 'results.json';
const baselineFile = args.includes('--baseline')
  ? args[args.indexOf('--baseline') + 1]
  : 'benchmarks/baseline.json';

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + colorize('='.repeat(70), 'bright'));
  console.log(colorize(title, 'cyan'));
  console.log(colorize('='.repeat(70), 'bright'));
}

function printMetric(name, current, baseline, unit = '') {
  const diff = current - baseline;
  const percent = baseline !== 0 ? ((diff / baseline) * 100).toFixed(1) : 0;

  let status = colorize('→', 'dim');
  if (diff < -5) {
    status = colorize('↓', 'green') + ' IMPROVED';
  } else if (diff > 5) {
    status = colorize('↑', 'red') + ' DEGRADED';
  }

  const change = diff >= 0 ? `+${diff}` : `${diff}`;

  console.log(`  ${name.padEnd(30)} ${String(current).padStart(10)} ${unit.padEnd(8)} ${status.padEnd(15)} (${change} / ${percent}%)`);
}

function loadJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(colorize(`✗ Failed to load ${filePath}: ${error.message}`, 'red'));
    process.exit(1);
  }
}

function compareResults(current, baseline) {
  printHeader('Performance Comparison: Current vs Baseline');

  // Response Time Comparison
  printHeader('Response Time (ms)');
  if (current.response_time && baseline.load_test_baseline?.results?.response_time) {
    const base = baseline.load_test_baseline.results.response_time;
    const curr = current.response_time;

    printMetric('P50', curr.p50 || 0, base.p50, 'ms');
    printMetric('P95', curr.p95 || 0, base.p95, 'ms');
    printMetric('P99', curr.p99 || 0, base.p99, 'ms');
    printMetric('Max', curr.max || 0, base.max, 'ms');

    if (curr.p95 > 500) {
      console.log(colorize('  ⚠️  WARNING: P95 exceeds 500ms target!', 'yellow'));
    }
  }

  // Throughput Comparison
  printHeader('Throughput (req/sec)');
  if (current.throughput && baseline.load_test_baseline?.results?.throughput) {
    const base = baseline.load_test_baseline.results.throughput.value;
    const curr = current.throughput.value || current.throughput;

    printMetric('Throughput', curr, base, 'req/sec');

    if (curr < 1000) {
      console.log(colorize('  ⚠️  WARNING: Throughput below minimum target of 1000 req/sec!', 'yellow'));
    }
  }

  // Error Rate Comparison
  printHeader('Error Rate (%)');
  if (current.error_rate !== undefined && baseline.load_test_baseline?.results?.error_rate !== undefined) {
    const base = baseline.load_test_baseline.results.error_rate;
    const curr = current.error_rate || 0;

    printMetric('Error Rate', curr, base, '%');

    if (curr > 0.1) {
      console.log(colorize('  ⚠️  WARNING: Error rate exceeds 0.1% target!', 'yellow'));
    }
  }

  // Resource Metrics
  if (current.memory || current.connections || current.cpu) {
    printHeader('Resource Utilization');

    if (current.memory) {
      printMetric('Memory Usage', current.memory, 500, 'MB');
    }

    if (current.connections) {
      printMetric('Active Connections', current.connections, 25, '');
    }

    if (current.cpu) {
      printMetric('CPU Usage', current.cpu, 80, '%');
    }
  }
}

function generateSummary(current, baseline) {
  const summary = {
    status: 'PASS',
    issues: [],
    improvements: [],
    degradations: []
  };

  // Check P95 response time
  const baselineP95 = baseline.load_test_baseline?.results?.response_time?.p95 || 500;
  const currentP95 = current.response_time?.p95 || 0;

  if (currentP95 > 500) {
    summary.status = 'FAIL';
    summary.issues.push(`P95 response time (${currentP95}ms) exceeds critical target of 500ms`);
  } else if (currentP95 < baselineP95 * 0.95) {
    summary.improvements.push(`P95 response time improved by ${(baselineP95 - currentP95).toFixed(0)}ms`);
  } else if (currentP95 > baselineP95 * 1.05) {
    summary.degradations.push(`P95 response time degraded by ${(currentP95 - baselineP95).toFixed(0)}ms`);
  }

  // Check error rate
  const baselineErrors = baseline.load_test_baseline?.results?.error_rate || 0.1;
  const currentErrors = current.error_rate || 0;

  if (currentErrors > 0.1) {
    summary.status = 'FAIL';
    summary.issues.push(`Error rate (${currentErrors}%) exceeds target of 0.1%`);
  } else if (currentErrors < baselineErrors * 0.9) {
    summary.improvements.push(`Error rate improved to ${currentErrors}%`);
  } else if (currentErrors > baselineErrors * 1.1) {
    summary.degradations.push(`Error rate degraded to ${currentErrors}%`);
  }

  // Check throughput
  const baselineThroughput = baseline.load_test_baseline?.results?.throughput?.value || 1000;
  const currentThroughput = current.throughput?.value || current.throughput || 0;

  if (currentThroughput < 1000) {
    summary.status = 'FAIL';
    summary.issues.push(`Throughput (${currentThroughput} req/sec) below minimum target of 1000 req/sec`);
  } else if (currentThroughput > baselineThroughput * 1.1) {
    summary.improvements.push(`Throughput improved by ${(currentThroughput - baselineThroughput).toFixed(0)} req/sec`);
  } else if (currentThroughput < baselineThroughput * 0.9) {
    summary.degradations.push(`Throughput degraded by ${(baselineThroughput - currentThroughput).toFixed(0)} req/sec`);
  }

  return summary;
}

function printSummary(summary) {
  printHeader('Test Results Summary');

  const statusColor = summary.status === 'PASS' ? 'green' : 'red';
  console.log(`Status: ${colorize(summary.status, statusColor)}\n`);

  if (summary.issues.length > 0) {
    console.log(colorize('Critical Issues:', 'red'));
    summary.issues.forEach(issue => console.log(`  ✗ ${issue}`));
    console.log();
  }

  if (summary.degradations.length > 0) {
    console.log(colorize('Degradations:', 'yellow'));
    summary.degradations.forEach(issue => console.log(`  ↓ ${issue}`));
    console.log();
  }

  if (summary.improvements.length > 0) {
    console.log(colorize('Improvements:', 'green'));
    summary.improvements.forEach(improvement => console.log(`  ↑ ${improvement}`));
    console.log();
  }

  if (summary.issues.length === 0 && summary.degradations.length === 0) {
    console.log(colorize('✓ All metrics within acceptable ranges!', 'green'));
  }
}

function generateHTMLReport(current, baseline, summary) {
  const timestamp = new Date().toISOString();
  const reportPath = 'reports/performance-comparison.html';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report - ${timestamp}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; margin-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .status {
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-size: 18px;
            font-weight: bold;
        }
        .status.pass { background: #d4edda; color: #155724; }
        .status.fail { background: #f8d7da; color: #721c24; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #34495e;
            color: white;
            font-weight: 600;
        }
        tr:hover { background: #f9f9f9; }
        .metric-name { font-weight: 500; }
        .improved { color: #27ae60; }
        .degraded { color: #e74c3c; }
        .neutral { color: #95a5a6; }
        .issue { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .improvement { background: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .timestamp { color: #7f8c8d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Performance Test Report</h1>
        <p class="timestamp">Generated: ${timestamp}</p>

        <div class="status ${summary.status.toLowerCase()}">
            Status: ${summary.status}
        </div>

        <h2>Summary</h2>
        ${summary.issues.length > 0 ? `
        <h3>Issues</h3>
        ${summary.issues.map(i => `<div class="issue">✗ ${i}</div>`).join('')}
        ` : ''}
        ${summary.degradations.length > 0 ? `
        <h3>Degradations</h3>
        ${summary.degradations.map(d => `<div class="issue">↓ ${d}</div>`).join('')}
        ` : ''}
        ${summary.improvements.length > 0 ? `
        <h3>Improvements</h3>
        ${summary.improvements.map(i => `<div class="improvement">↑ ${i}</div>`).join('')}
        ` : ''}

        <h2>Response Time Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Baseline</th>
                <th>Difference</th>
                <th>Status</th>
            </tr>
            <tr>
                <td class="metric-name">P50</td>
                <td>${current.response_time?.p50 || '-'} ms</td>
                <td>${baseline.load_test_baseline?.results?.response_time?.p50 || '-'} ms</td>
                <td>${current.response_time?.p50 ? (current.response_time.p50 - baseline.load_test_baseline?.results?.response_time?.p50).toFixed(0) : '-'} ms</td>
                <td class="neutral">-</td>
            </tr>
            <tr>
                <td class="metric-name">P95 (Critical)</td>
                <td><strong>${current.response_time?.p95 || '-'} ms</strong></td>
                <td><strong>500 ms</strong></td>
                <td class="${current.response_time?.p95 > 500 ? 'degraded' : 'improved'}">
                    ${current.response_time?.p95 ? (current.response_time.p95 - 500).toFixed(0) : '-'} ms
                </td>
                <td class="${current.response_time?.p95 > 500 ? 'degraded' : 'improved'}">
                    ${current.response_time?.p95 > 500 ? '✗ FAIL' : '✓ PASS'}
                </td>
            </tr>
            <tr>
                <td class="metric-name">P99</td>
                <td>${current.response_time?.p99 || '-'} ms</td>
                <td>${baseline.load_test_baseline?.results?.response_time?.p99 || '-'} ms</td>
                <td>${current.response_time?.p99 ? (current.response_time.p99 - baseline.load_test_baseline?.results?.response_time?.p99).toFixed(0) : '-'} ms</td>
                <td class="neutral">-</td>
            </tr>
        </table>

        <h2>Throughput Metrics</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Target</th>
                <th>Status</th>
            </tr>
            <tr>
                <td class="metric-name">Throughput</td>
                <td><strong>${current.throughput?.value || '-'} req/sec</strong></td>
                <td><strong>&gt; 1000 req/sec</strong></td>
                <td class="${(current.throughput?.value || 0) >= 1000 ? 'improved' : 'degraded'}">
                    ${(current.throughput?.value || 0) >= 1000 ? '✓ PASS' : '✗ FAIL'}
                </td>
            </tr>
        </table>

        <h2>Error Rate</h2>
        <table>
            <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Target</th>
                <th>Status</th>
            </tr>
            <tr>
                <td class="metric-name">Error Rate</td>
                <td><strong>${(current.error_rate || 0).toFixed(3)}%</strong></td>
                <td><strong>&lt; 0.1%</strong></td>
                <td class="${(current.error_rate || 0) <= 0.1 ? 'improved' : 'degraded'}">
                    ${(current.error_rate || 0) <= 0.1 ? '✓ PASS' : '✗ FAIL'}
                </td>
            </tr>
        </table>
    </div>
</body>
</html>`;

  try {
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync(reportPath, html);
    console.log(`\n📊 HTML report generated: ${colorize(reportPath, 'cyan')}`);
  } catch (error) {
    console.warn(`⚠️  Could not generate HTML report: ${error.message}`);
  }
}

// Main execution
try {
  console.log(`\n📊 Performance Test Comparison Tool\n`);
  console.log(`Loading test results from: ${colorize(resultsFile, 'cyan')}`);
  console.log(`Loading baseline from: ${colorize(baselineFile, 'cyan')}\n`);

  const currentResults = loadJSON(resultsFile);
  const baseline = loadJSON(baselineFile);

  compareResults(currentResults, baseline);

  const summary = generateSummary(currentResults, baseline);
  printSummary(summary);

  generateHTMLReport(currentResults, baseline, summary);

  console.log();

  if (summary.status === 'FAIL') {
    process.exit(1);
  }
} catch (error) {
  console.error(colorize(`✗ Error: ${error.message}`, 'red'));
  process.exit(1);
}
