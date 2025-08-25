# Multi-stage Docker build for ML Service
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    software-properties-common \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --create-home --shell /bin/bash ml_user
USER ml_user
WORKDIR /home/ml_user

# Install Python dependencies
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Development stage
FROM base as development

# Copy source code
COPY --chown=ml_user:ml_user . .

# Install development dependencies
RUN pip install --user pytest pytest-asyncio black flake8 mypy

# Set environment for development
ENV ML_API_HOST=0.0.0.0 \
    ML_API_PORT=8001 \
    DEBUG=true \
    LOG_LEVEL=DEBUG

# Expose port
EXPOSE 8001

# Run development server
CMD ["python", "-m", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]

# Production stage
FROM base as production

# Copy only necessary files
COPY --chown=ml_user:ml_user src/ ./src/
COPY --chown=ml_user:ml_user pyproject.toml ./

# Create necessary directories
RUN mkdir -p models/trained features artifacts experiments logs

# Set production environment
ENV ML_API_HOST=0.0.0.0 \
    ML_API_PORT=8001 \
    DEBUG=false \
    LOG_LEVEL=INFO \
    PYTHONPATH=/home/ml_user

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Expose port
EXPOSE 8001

# Run production server
CMD ["python", "-m", "gunicorn", "src.api.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8001"]