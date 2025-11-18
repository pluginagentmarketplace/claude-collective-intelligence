"""
Error classes for AI Agent SDK
"""

from typing import Any, Optional


class AgentClientError(Exception):
    """Base exception for Agent Client"""

    def __init__(
        self,
        message: str,
        code: str = "AGENT_CLIENT_ERROR",
        status_code: Optional[int] = None,
        details: Optional[Any] = None,
    ) -> None:
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details
        super().__init__(message)

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}("
            f"message={self.message!r}, "
            f"code={self.code!r}, "
            f"status_code={self.status_code!r})"
        )


class ValidationError(AgentClientError):
    """Validation error"""

    def __init__(self, message: str, details: Optional[Any] = None) -> None:
        super().__init__(message, "VALIDATION_ERROR", 400, details)


class AuthenticationError(AgentClientError):
    """Authentication error"""

    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(message, "AUTHENTICATION_ERROR", 401)


class AuthorizationError(AgentClientError):
    """Authorization error"""

    def __init__(self, message: str = "Not authorized") -> None:
        super().__init__(message, "AUTHORIZATION_ERROR", 403)


class NotFoundError(AgentClientError):
    """Not found error"""

    def __init__(
        self,
        message: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
    ) -> None:
        self.resource_type = resource_type
        self.resource_id = resource_id
        super().__init__(message, "NOT_FOUND", 404)


class TimeoutError(AgentClientError):
    """Timeout error"""

    def __init__(
        self, message: str = "Request timeout", timeout: Optional[int] = None
    ) -> None:
        self.timeout = timeout
        super().__init__(message, "TIMEOUT", 408)


class RateLimitError(AgentClientError):
    """Rate limit error"""

    def __init__(
        self, message: str = "Rate limit exceeded", retry_after: Optional[int] = None
    ) -> None:
        self.retry_after = retry_after
        super().__init__(message, "RATE_LIMIT", 429)


class ServerError(AgentClientError):
    """Server error"""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message, "SERVER_ERROR", status_code)


class NetworkError(AgentClientError):
    """Network error"""

    def __init__(
        self, message: str, original_error: Optional[Exception] = None
    ) -> None:
        self.original_error = original_error
        super().__init__(message, "NETWORK_ERROR")


class ConnectionError(AgentClientError):
    """Connection error"""

    def __init__(self, message: str = "Failed to connect") -> None:
        super().__init__(message, "CONNECTION_ERROR")


class StreamError(AgentClientError):
    """Stream error"""

    def __init__(self, message: str) -> None:
        super().__init__(message, "STREAM_ERROR")
