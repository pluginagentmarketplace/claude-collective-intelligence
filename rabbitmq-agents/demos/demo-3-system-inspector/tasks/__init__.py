"""
Tasks Package - System Inspector Pipeline Tasks
================================================
Her task bağımsız, test edilebilir ve chain edilebilir.

Task 1: DisplayInspectorTask - Ekran tespiti
Task 2: TerminalSetupTask - Terminal açma
Task 3: ScreenshotValidatorTask - Cross-check kanıt sistemi
Task 4: ClaudeLauncherTask - Claude dangerous mode açma
Task 5: RolePrompterTask - Claude'lara rol sorusu sor
Task Final: TaskFinal - Claude Code ve terminal guvenli kapatma
"""

from .base import BaseTask, TaskResult, TaskStatus
from .display_inspector import DisplayInspectorTask
from .terminal_setup import TerminalSetupTask
from .screenshot_validator import ScreenshotValidatorTask
from .claude_launcher import ClaudeLauncherTask
from .role_prompter import RolePrompterTask
from .task_final import TaskFinal

__all__ = [
    'BaseTask',
    'TaskResult',
    'TaskStatus',
    'DisplayInspectorTask',
    'TerminalSetupTask',
    'ScreenshotValidatorTask',
    'ClaudeLauncherTask',
    'RolePrompterTask',
    'TaskFinal',
]
