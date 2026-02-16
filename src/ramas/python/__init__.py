"""
RAMAS - Reactive Agent Messaging & Automation System

Python implementation using iTerm2 Python API instead of AppleScript.

Migration from:
- applescript-controller.js → controller.py
- status-daemon.js → daemon.py
- window-registry.js → registry.py
- ramas-exchanges.js → exchanges.py

Key improvements:
- No more Quote Hell (Python handles strings natively)
- No more Tab Title Trap (Python API uses session.name correctly)
- Async/await throughout (modern Python patterns)
- Single runtime (no Node.js/Python hybrid)

Author: Dr. Umit Kacar
Date: 2026-01-01
"""

__version__ = "2.0.0"
__author__ = "Dr. Umit Kacar"

from .controller import (
    ITerm2Controller,
    send_esc,
    send_ctrl_c,
    send_message,
    update_title,
    update_status_title,
    update_status_badge,
    interrupt_and_message,
    urgent_interrupt,
)

from .registry import (
    WindowRegistry,
    REGISTRY_PATH,
)

from .exchanges import (
    EXCHANGES,
    QUEUES,
    setup_all,
)

from .daemon import StatusDaemon

# Pattern C-003: Autonomous Multi-Agent Orchestration
from .agent_trigger import (
    AgentTrigger,
    get_agent_trigger,
)

from .workflow_engine import (
    WorkflowEngine,
    WorkflowState,
    get_workflow_engine,
)

# Pattern C-003 v3: Redis Registry for instant wake signals
from .redis_registry import (
    RedisRegistry,
    get_redis_registry,
)

__all__ = [
    # Version
    "__version__",
    "__author__",

    # Controller
    "ITerm2Controller",
    "send_esc",
    "send_ctrl_c",
    "send_message",
    "update_title",
    "update_status_title",
    "interrupt_and_message",
    "urgent_interrupt",

    # Registry
    "WindowRegistry",
    "REGISTRY_PATH",

    # Exchanges
    "EXCHANGES",
    "QUEUES",
    "setup_all",

    # Daemon
    "StatusDaemon",

    # Pattern C-003: Autonomous Orchestration
    "AgentTrigger",
    "get_agent_trigger",
    "WorkflowEngine",
    "WorkflowState",
    "get_workflow_engine",

    # Pattern C-003 v3: Redis Registry
    "RedisRegistry",
    "get_redis_registry",
]
