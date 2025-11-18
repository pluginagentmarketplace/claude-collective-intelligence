"""
Connection pool for managing HTTP connections
"""

import asyncio
import logging
from typing import Optional
import aiohttp

logger = logging.getLogger(__name__)


class PoolConfig:
    """Connection pool configuration"""

    def __init__(self, max_connections: int = 10, max_idle_time: int = 60000):
        self.max_connections = max_connections
        self.max_idle_time = max_idle_time


class ConnectionPool:
    """Async connection pool"""

    def __init__(
        self,
        base_url: str,
        headers: dict,
        config: PoolConfig,
    ):
        self.base_url = base_url
        self.headers = headers
        self.config = config
        self.connector = aiohttp.TCPConnector(limit=config.max_connections)
        self.session: Optional[aiohttp.ClientSession] = None
        self._closed = False

    async def initialize(self) -> None:
        """Initialize the pool"""
        if self.session is None:
            self.session = aiohttp.ClientSession(
                connector=self.connector, headers=self.headers
            )
            logger.debug("Connection pool initialized")

    async def acquire(self) -> aiohttp.ClientSession:
        """Get a session from the pool"""
        if self.session is None:
            await self.initialize()
        return self.session

    async def close(self) -> None:
        """Close the pool"""
        if self.session:
            await self.session.close()
            self._closed = True
            logger.debug("Connection pool closed")

    def get_stats(self) -> dict:
        """Get pool statistics"""
        return {
            "connector_limit": self.connector.limit,
            "connector_limited_semaphore": self.connector._limit_sem._value
            if self.connector._limit_sem
            else None,
        }
