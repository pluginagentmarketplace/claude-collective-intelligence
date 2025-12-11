"""
Base Task - Abstract Base Class for All Pipeline Tasks
=======================================================
Tüm task'lar bu sınıftan türer. Scalable, testable, chainable.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
import json


class TaskStatus(Enum):
    """Task execution status"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class TaskResult:
    """Task execution result - chain edilebilir output"""
    task_name: str
    status: TaskStatus
    data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[float] = None

    def to_dict(self) -> dict:
        return {
            'task_name': self.task_name,
            'status': self.status.value,
            'data': self.data,
            'error': self.error,
            'started_at': self.started_at,
            'completed_at': self.completed_at,
            'duration_ms': self.duration_ms
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)


class BaseTask(ABC):
    """
    Abstract Base Task - Tüm task'ların base class'ı

    Usage:
        class MyTask(BaseTask):
            name = "my_task"
            description = "Does something useful"

            def execute(self, context: dict) -> TaskResult:
                # Do work
                return TaskResult(...)
    """

    name: str = "base_task"
    description: str = "Base task - override this"
    version: str = "1.0.0"

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self._result: Optional[TaskResult] = None

    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> TaskResult:
        """
        Ana task logic'i burada implement edilir.

        Args:
            context: Önceki task'lardan gelen data (chain)

        Returns:
            TaskResult: Task sonucu (sonraki task'a geçer)
        """
        pass

    def run(self, context: Dict[str, Any] = None) -> TaskResult:
        """
        Task'ı çalıştır - timing ve error handling dahil

        Args:
            context: Input data from previous tasks

        Returns:
            TaskResult with status and output data
        """
        context = context or {}
        start_time = datetime.now()

        print(f"\n{'='*60}")
        print(f"🚀 Starting Task: {self.name}")
        print(f"   {self.description}")
        print(f"{'='*60}")

        try:
            self._result = self.execute(context)
            self._result.status = TaskStatus.SUCCESS

        except Exception as e:
            self._result = TaskResult(
                task_name=self.name,
                status=TaskStatus.FAILED,
                error=str(e)
            )
            print(f"❌ Task Failed: {e}")

        finally:
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds() * 1000

            self._result.started_at = start_time.isoformat()
            self._result.completed_at = end_time.isoformat()
            self._result.duration_ms = round(duration, 2)

            status_icon = "✅" if self._result.status == TaskStatus.SUCCESS else "❌"
            print(f"\n{status_icon} Task {self.name} completed in {duration:.0f}ms")

        return self._result

    def validate_config(self) -> bool:
        """Config validation - override if needed"""
        return True

    def __repr__(self) -> str:
        return f"<Task:{self.name} v{self.version}>"
