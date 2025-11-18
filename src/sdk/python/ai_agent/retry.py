"""
Retry logic with exponential backoff
"""

import asyncio
import logging
from typing import Awaitable, Callable, Optional, TypeVar, Any

T = TypeVar("T")


class RetryConfig:
    """Retry configuration"""

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: int = 100,
        max_delay: int = 10000,
        backoff_multiplier: float = 2.0,
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.backoff_multiplier = backoff_multiplier


def calculate_delay(
    attempt: int,
    initial_delay: int,
    max_delay: int,
    backoff_multiplier: float,
) -> int:
    """Calculate delay for retry attempt"""
    delay = int(initial_delay * (backoff_multiplier ** (attempt - 1)))
    return min(delay, max_delay)


async def retry(
    fn: Callable[..., Awaitable[T]],
    config: RetryConfig,
    on_retry: Optional[Callable[[int, int, Exception], None]] = None,
    *args: Any,
    **kwargs: Any,
) -> T:
    """Retry a function with exponential backoff"""
    logger = logging.getLogger(__name__)
    last_error: Optional[Exception] = None

    for attempt in range(config.max_retries + 1):
        try:
            return await fn(*args, **kwargs)
        except Exception as error:
            last_error = error

            if attempt == config.max_retries:
                raise last_error

            delay = calculate_delay(
                attempt + 1,
                config.initial_delay,
                config.max_delay,
                config.backoff_multiplier,
            )

            if on_retry:
                on_retry(attempt + 1, delay, error)

            logger.debug(
                f"Retry attempt {attempt + 1} in {delay}ms due to: {error}"
            )
            await asyncio.sleep(delay / 1000.0)

    raise last_error


def is_retryable_error(error: Exception) -> bool:
    """Check if error is retryable"""
    message = str(error).lower()

    # Network errors are retryable
    if any(
        x in message
        for x in ["connection refused", "connection reset", "timeout", "not found"]
    ):
        return True

    # 5xx errors are retryable
    if "5" in message or "server error" in message:
        return True

    # 429 (rate limit) is retryable
    if "429" in message or "rate limit" in message:
        return True

    # 503 (service unavailable) is retryable
    if "503" in message or "service unavailable" in message:
        return True

    return False


class RetryPresets:
    """Retry configuration presets"""

    AGGRESSIVE = RetryConfig(
        max_retries=5, initial_delay=50, max_delay=5000, backoff_multiplier=2.0
    )

    MODERATE = RetryConfig(
        max_retries=3, initial_delay=100, max_delay=10000, backoff_multiplier=2.0
    )

    CONSERVATIVE = RetryConfig(
        max_retries=1, initial_delay=500, max_delay=5000, backoff_multiplier=2.0
    )

    NONE = RetryConfig(
        max_retries=0, initial_delay=0, max_delay=0, backoff_multiplier=1.0
    )
