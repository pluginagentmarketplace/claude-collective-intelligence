"""
Main Agent Client for Python
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from datetime import datetime

import aiohttp

from .errors import (
    AgentClientError,
    ValidationError,
    NotFoundError,
    TimeoutError as ClientTimeoutError,
)
from .types import Agent, AgentCreateParams, Task, TaskSubmitParams, ClientMetrics, HealthStatus
from .pool import ConnectionPool, PoolConfig
from .retry import retry, RetryPresets, RetryConfig
from .managers import AgentsManager, TasksManager

logger = logging.getLogger(__name__)


class AgentClient:
    """Main Agent Client"""

    def __init__(
        self,
        api_url: str,
        api_key: str,
        timeout: int = 30,
        max_retries: int = 3,
        retry_config: Optional[RetryConfig] = None,
        pool_config: Optional[PoolConfig] = None,
    ) -> None:
        self.api_url = self._validate_url(api_url)
        self.api_key = self._validate_key(api_key)
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_config = retry_config or RetryPresets.MODERATE
        self.pool_config = pool_config or PoolConfig()

        self.pool = ConnectionPool(
            self.api_url, self._get_headers(), self.pool_config
        )

        self.metrics = ClientMetrics()
        self.request_id = 0

        self.agents = AgentsManager(self)
        self.tasks = TasksManager(self)

    @staticmethod
    def _validate_url(url: str) -> str:
        """Validate API URL"""
        if not url:
            raise ValidationError("api_url is required")
        if not url.startswith("http"):
            raise ValidationError("api_url must start with http:// or https://")
        return url.rstrip("/")

    @staticmethod
    def _validate_key(api_key: str) -> str:
        """Validate API key"""
        if not api_key:
            raise ValidationError("api_key is required")
        return api_key

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "ai-agent-sdk-python/1.0.0",
        }

    def _generate_request_id(self) -> str:
        """Generate request ID"""
        self.request_id += 1
        return f"{self.request_id}-{datetime.utcnow().isoformat()}"

    def _update_metrics(self, success: bool, latency: float) -> None:
        """Update request metrics"""
        self.metrics.total_requests += 1

        if success:
            self.metrics.successful_requests += 1
        else:
            self.metrics.failed_requests += 1
            self.metrics.total_errors += 1

        avg = self.metrics.average_latency
        self.metrics.average_latency = (
            avg * (self.metrics.total_requests - 1) + latency
        ) / self.metrics.total_requests

        self.metrics.success_rate = (
            self.metrics.successful_requests / self.metrics.total_requests
        ) * 100
        self.metrics.error_rate = (
            self.metrics.failed_requests / self.metrics.total_requests
        ) * 100

    async def initialize(self) -> None:
        """Initialize the client"""
        await self.pool.initialize()
        logger.info("Agent client initialized")

    async def request(
        self,
        method: str,
        path: str,
        data: Optional[Any] = None,
        timeout: Optional[int] = None,
        retries: Optional[int] = None,
    ) -> Any:
        """Make HTTP request"""
        if not self.pool.session:
            await self.initialize()

        request_id = self._generate_request_id()
        start_time = time.time()

        async def make_request() -> Any:
            try:
                session = await self.pool.acquire()
                url = f"{self.api_url}{path}"

                async with session.request(
                    method,
                    url,
                    json=data,
                    timeout=aiohttp.ClientTimeout(total=timeout or self.timeout),
                ) as response:
                    body = await response.json()

                    if response.status >= 400:
                        self._handle_error_response(response.status, body)

                    if isinstance(body, dict) and not body.get("success", True):
                        error = body.get("error", {})
                        raise AgentClientError(
                            error.get("message", "Unknown error"),
                            error.get("code", "UNKNOWN"),
                            response.status,
                            error.get("details"),
                        )

                    return body.get("data", body)
            except aiohttp.ClientError as error:
                raise AgentClientError(str(error), "HTTP_ERROR") from error

        try:
            result = await retry(
                make_request,
                self.retry_config,
            )
            self._update_metrics(True, time.time() - start_time)
            return result
        except Exception as error:
            self._update_metrics(False, time.time() - start_time)
            self.metrics.last_error = {
                "message": str(error),
                "timestamp": datetime.utcnow().isoformat(),
            }
            raise

    def _handle_error_response(self, status: int, body: Dict[str, Any]) -> None:
        """Handle error responses"""
        error = body.get("error", {})
        message = error.get("message", "Unknown error")
        code = error.get("code", "UNKNOWN")
        details = error.get("details")

        if status == 400:
            raise ValidationError(message, details)
        elif status == 401:
            raise AgentClientError(message, "UNAUTHORIZED", status)
        elif status == 403:
            raise AgentClientError(message, "FORBIDDEN", status)
        elif status == 404:
            raise NotFoundError(message)
        elif status == 429:
            raise AgentClientError(message, "RATE_LIMIT", status)
        elif status >= 500:
            raise AgentClientError(message, "SERVER_ERROR", status)
        else:
            raise AgentClientError(message, code, status, details)

    async def health(self) -> HealthStatus:
        """Check health status"""
        return await self.request("GET", "/health")

    def get_metrics(self) -> ClientMetrics:
        """Get client metrics"""
        return self.metrics

    async def close(self) -> None:
        """Close the client"""
        await self.pool.close()
        logger.info("Agent client closed")

    async def __aenter__(self):
        """Async context manager entry"""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
