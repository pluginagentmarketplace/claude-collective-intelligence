# K6 Performance Test Suite Runner (PowerShell)
# Runs all performance tests and generates reports

param(
    [string]$ApiBaseUrl = "http://localhost:3000",
    [string]$TestEnv = "development",
    [switch]$Verbose = $false
)

# Configuration
$REPORTS_DIR = "reports"
$BENCHMARKS_DIR = "benchmarks"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"

# Colors
function Write-Header {
    param([string]$Message)
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║ $($Message.PadRight(62)) ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
}

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "→ $Message" -ForegroundColor Yellow
}

# Main
Write-Header "K6 Performance Testing Framework - Production-Grade"
Write-Host ""

# Check if K6 is installed
try {
    $k6Version = k6 version 2>$null
    Write-Success "K6 found: $k6Version"
} catch {
    Write-Error-Custom "K6 is not installed"
    Write-Host "Install K6: https://k6.io/docs/getting-started/installation/" -ForegroundColor Yellow
    exit 1
}

# Create directories
New-Item -ItemType Directory -Force -Path $REPORTS_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $BENCHMARKS_DIR | Out-Null

# Show test plan
Write-Info "Test Plan:"
Write-Host ""
Write-Host "1. Load Test (15 min)"
Write-Host "   └─ Gradual ramp: 10 → 100 → 1000 req/sec"
Write-Host ""
Write-Host "2. Spike Test (10 min)"
Write-Host "   └─ Normal + 5x spike + recovery"
Write-Host ""
Write-Host "3. Soak Test (30 min)"
Write-Host "   └─ Sustained 50-100 req/sec"
Write-Host ""
Write-Host "⚠️  Total runtime: ~55 minutes"
Write-Host ""

# Confirm
$confirm = Read-Host "Continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Aborted" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Info "Starting tests..."
Write-Host ""

# Function to run test
function Run-Test {
    param(
        [string]$TestName,
        [string]$TestFile,
        [string]$Duration
    )

    Write-Section "$TestName"
    Write-Host ""

    if (-not (Test-Path $TestFile)) {
        Write-Error-Custom "Test file not found: $TestFile"
        return $false
    }

    $resultFile = Join-Path $REPORTS_DIR "${TestName}_${TIMESTAMP}.json"
    $logFile = Join-Path $REPORTS_DIR "${TestName}_${TIMESTAMP}.log"

    Write-Host "⏱️  Duration: $Duration"
    Write-Host "📝 Results: $resultFile"
    Write-Host ""

    # Run K6 test
    $env:API_BASE_URL = $ApiBaseUrl
    $env:TEST_ENV = $TestEnv
    $env:VERBOSE = $Verbose.ToString().ToLower()

    try {
        if ($Verbose) {
            k6 run `
                --out "json=$resultFile" `
                -e "API_BASE_URL=$ApiBaseUrl" `
                -e "TEST_ENV=$TestEnv" `
                -e "VERBOSE=$($Verbose.ToString().ToLower())" `
                $TestFile 2>&1 | Tee-Object -FilePath $logFile
        } else {
            k6 run `
                --out "json=$resultFile" `
                -e "API_BASE_URL=$ApiBaseUrl" `
                -e "TEST_ENV=$TestEnv" `
                -e "VERBOSE=$($Verbose.ToString().ToLower())" `
                $TestFile > $logFile 2>&1
        }

        Write-Host ""
        Write-Success "$TestName completed successfully"
        Write-Host "  Results: $resultFile"
        return $true
    } catch {
        Write-Host ""
        Write-Error-Custom "$TestName failed"
        Write-Host "  Log: $logFile"
        return $false
    }
}

# Run all tests
$passedTests = @()
$failedTests = @()

if (Run-Test "load-test" "k6-scripts/load-test.js" "15 minutes") {
    $passedTests += "Load Test"
} else {
    $failedTests += "Load Test"
}

if (Run-Test "spike-test" "k6-scripts/spike-test.js" "10 minutes") {
    $passedTests += "Spike Test"
} else {
    $failedTests += "Spike Test"
}

if (Run-Test "soak-test" "k6-scripts/soak-test.js" "30 minutes") {
    $passedTests += "Soak Test"
} else {
    $failedTests += "Soak Test"
}

# Summary
Write-Header "Test Summary"
Write-Host ""

if ($passedTests.Count -gt 0) {
    Write-Success "Passed ($($passedTests.Count)):"
    foreach ($test in $passedTests) {
        Write-Host "  ✓ $test" -ForegroundColor Green
    }
    Write-Host ""
}

if ($failedTests.Count -gt 0) {
    Write-Error-Custom "Failed ($($failedTests.Count)):"
    foreach ($test in $failedTests) {
        Write-Host "  ✗ $test" -ForegroundColor Red
    }
    Write-Host ""
}

Write-Host "📊 Report Directory: $(Get-Location)\$REPORTS_DIR"
Write-Host ""

Write-Info "Generating analysis..."
Write-Host ""

# List result files
$results = Get-ChildItem -Path $REPORTS_DIR -Filter "*_${TIMESTAMP}.json" -ErrorAction SilentlyContinue
if ($results.Count -gt 0) {
    Write-Host "Available results:"
    foreach ($result in $results) {
        $size = "{0:N0}" -f $result.Length
        Write-Host "  $($result.FullName) ($size bytes)"
    }
} else {
    Write-Host "No result files generated"
}

Write-Host ""

# Instructions
if ($results.Count -gt 0) {
    Write-Info "To compare with baseline:"
    Write-Host ""
    $firstResult = $results[0].FullName
    Write-Host "  node benchmarks/compare.js `"$firstResult`""
    Write-Host ""
}

# Final status
Write-Host ""
if ($failedTests.Count -eq 0) {
    Write-Success "All tests completed successfully!"
    exit 0
} else {
    Write-Error-Custom "Some tests failed. Check logs for details."
    exit 1
}
