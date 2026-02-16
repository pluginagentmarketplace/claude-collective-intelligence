#!/usr/bin/env python3
"""
RAMAS: Quick RabbitMQ Connection Test

Fast verification of RabbitMQ connectivity and health.

Usage:
    python quick_connect.py              # Full health check
    python quick_connect.py --docker     # Check Docker only
    python quick_connect.py --queues     # List queues only
    python quick_connect.py --exchanges  # List exchanges only

Author: Dr. Umit Kacar
Date: 2026-01-03
"""

import argparse
import subprocess
import sys
import json
from pathlib import Path

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")


def print_success(text: str):
    """Print success message."""
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_error(text: str):
    """Print error message."""
    print(f"{Colors.RED}❌ {text}{Colors.END}")


def print_warning(text: str):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")


def print_info(text: str):
    """Print info message."""
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")


def check_docker() -> bool:
    """Check if Docker is running and RabbitMQ container is healthy."""
    print_header("Docker Health Check")

    # Check Docker daemon
    try:
        result = subprocess.run(
            ["docker", "info"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if result.returncode != 0:
            print_error("Docker daemon is not running")
            return False
        print_success("Docker daemon is running")
    except FileNotFoundError:
        print_error("Docker is not installed")
        return False
    except subprocess.TimeoutExpired:
        print_error("Docker daemon is not responding")
        return False

    # Check RabbitMQ container
    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}\t{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        if not result.stdout.strip():
            print_warning("No RabbitMQ container found")
            print_info("Start with: docker compose up -d agent_rabbitmq")
            return False

        for line in result.stdout.strip().split('\n'):
            parts = line.split('\t')
            name = parts[0]
            status = parts[1] if len(parts) > 1 else "unknown"
            if "healthy" in status.lower():
                print_success(f"Container '{name}' is healthy")
            elif "up" in status.lower():
                print_warning(f"Container '{name}' is running but health unknown")
            else:
                print_error(f"Container '{name}' status: {status}")
                return False

    except Exception as e:
        print_error(f"Error checking containers: {e}")
        return False

    return True


def check_rabbitmq_connection() -> bool:
    """Check RabbitMQ connection using rabbitmqctl."""
    print_header("RabbitMQ Connection Test")

    try:
        # Get container name
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        container_name = result.stdout.strip().split('\n')[0]

        if not container_name:
            print_error("No RabbitMQ container found")
            return False

        # Check RabbitMQ status
        result = subprocess.run(
            ["docker", "exec", container_name, "rabbitmqctl", "status"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            print_success("RabbitMQ is responding")

            # Extract version info
            for line in result.stdout.split('\n'):
                if 'RabbitMQ' in line and 'version' in line.lower():
                    print_info(line.strip())
                    break
            return True
        else:
            print_error("RabbitMQ is not responding")
            print_info(result.stderr[:200] if result.stderr else "No error details")
            return False

    except Exception as e:
        print_error(f"Connection test failed: {e}")
        return False


def list_queues() -> bool:
    """List all RabbitMQ queues."""
    print_header("RabbitMQ Queues")

    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        container_name = result.stdout.strip().split('\n')[0]

        if not container_name:
            print_error("No RabbitMQ container found")
            return False

        result = subprocess.run(
            ["docker", "exec", container_name, "rabbitmqctl", "list_queues",
             "name", "messages", "consumers", "--formatter", "table"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            if len(lines) <= 1:
                print_info("No queues found")
            else:
                print(f"\n{'Queue Name':<40} {'Messages':>10} {'Consumers':>10}")
                print("-" * 62)
                for line in lines[1:]:  # Skip header
                    parts = line.split('\t')
                    if len(parts) >= 3:
                        print(f"{parts[0]:<40} {parts[1]:>10} {parts[2]:>10}")
                print()
            return True
        else:
            print_error("Failed to list queues")
            return False

    except Exception as e:
        print_error(f"Error listing queues: {e}")
        return False


def list_exchanges() -> bool:
    """List all RabbitMQ exchanges."""
    print_header("RabbitMQ Exchanges")

    try:
        result = subprocess.run(
            ["docker", "ps", "--filter", "name=rabbitmq", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=10
        )
        container_name = result.stdout.strip().split('\n')[0]

        if not container_name:
            print_error("No RabbitMQ container found")
            return False

        result = subprocess.run(
            ["docker", "exec", container_name, "rabbitmqctl", "list_exchanges",
             "name", "type", "--formatter", "table"],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            print(f"\n{'Exchange Name':<40} {'Type':>15}")
            print("-" * 57)
            for line in lines[1:]:  # Skip header
                parts = line.split('\t')
                if len(parts) >= 2:
                    # Filter out default exchanges (start with amq.)
                    if not parts[0].startswith('amq.') and parts[0]:
                        print(f"{parts[0]:<40} {parts[1]:>15}")
            print()
            return True
        else:
            print_error("Failed to list exchanges")
            return False

    except Exception as e:
        print_error(f"Error listing exchanges: {e}")
        return False


def check_session_files() -> bool:
    """Check Pattern C session files."""
    print_header("Pattern C Session Files")

    # Check session registry
    registry_file = Path("/tmp/ramas-session-registry.json")
    if registry_file.exists():
        try:
            with open(registry_file) as f:
                data = json.load(f)
                sessions = data.get("sessions", {})
                print_success(f"Session registry found: {len(sessions)} active sessions")
                for sid, info in sessions.items():
                    participants = len(info.get("participants", []))
                    print_info(f"  - {sid[:30]}... ({participants} participants)")
        except Exception as e:
            print_warning(f"Session registry exists but couldn't read: {e}")
    else:
        print_info("Session registry not found (no sessions created yet)")

    # Check inbox files
    inbox_dir = Path("/tmp/ramas-session-inboxes")
    if inbox_dir.exists():
        inbox_files = list(inbox_dir.glob("*.json"))
        print_success(f"Inbox directory found: {len(inbox_files)} agent inboxes")
        for inbox in inbox_files[:5]:  # Show first 5
            print_info(f"  - {inbox.name}")
        if len(inbox_files) > 5:
            print_info(f"  ... and {len(inbox_files) - 5} more")
    else:
        print_info("Inbox directory not found (no agents registered yet)")

    # Check window registry
    window_registry = Path("/tmp/ramas-windows.json")
    if window_registry.exists():
        try:
            with open(window_registry) as f:
                data = json.load(f)
                windows = data.get("windows", {})
                print_success(f"Window registry found: {len(windows)} agents")
                for agent_id, info in windows.items():
                    status = info.get("status", "unknown")
                    print_info(f"  - {agent_id}: {status.upper()}")
        except Exception as e:
            print_warning(f"Window registry exists but couldn't read: {e}")
    else:
        print_info("Window registry not found (demo not running)")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="RAMAS Quick RabbitMQ Connection Test",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python quick_connect.py              # Full health check
  python quick_connect.py --docker     # Check Docker only
  python quick_connect.py --queues     # List queues
  python quick_connect.py --exchanges  # List exchanges
  python quick_connect.py --sessions   # Check Pattern C files
        """
    )

    parser.add_argument("--docker", action="store_true", help="Check Docker only")
    parser.add_argument("--queues", action="store_true", help="List queues only")
    parser.add_argument("--exchanges", action="store_true", help="List exchanges only")
    parser.add_argument("--sessions", action="store_true", help="Check Pattern C session files")

    args = parser.parse_args()

    # If specific check requested
    if args.docker:
        sys.exit(0 if check_docker() else 1)

    if args.queues:
        check_docker()
        sys.exit(0 if list_queues() else 1)

    if args.exchanges:
        check_docker()
        sys.exit(0 if list_exchanges() else 1)

    if args.sessions:
        sys.exit(0 if check_session_files() else 1)

    # Full health check
    print_header("RAMAS Quick Connect")
    print("Running full health check...\n")

    all_ok = True

    if not check_docker():
        all_ok = False

    if all_ok and not check_rabbitmq_connection():
        all_ok = False

    if all_ok:
        list_queues()
        list_exchanges()

    check_session_files()

    # Summary
    print_header("Summary")
    if all_ok:
        print_success("All systems operational!")
        print_info("RabbitMQ Management UI: http://localhost:15672")
        print_info("Credentials: admin / rabbitmq123")
    else:
        print_error("Some checks failed. See above for details.")
        print_info("Start RabbitMQ: docker compose up -d agent_rabbitmq")

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
