# RAMAS Dashboard Backend - Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM python:3.12-slim as builder

WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir uv

# Copy requirements and install dependencies
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt

# Stage 2: Production stage
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
