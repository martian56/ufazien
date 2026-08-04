# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV DJANGO_SETTINGS_MODULE=ufazien.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        build-essential \
        libpq-dev \
        curl \
        git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . /app/

# Create directories for static files and media
RUN mkdir -p /app/static /app/media

# Create hosting directory and set permissions
RUN mkdir -p /srv/hosting \
    && chmod 755 /srv/hosting

# Collect static files. Needs no database, so it stays at build time.
# migrate / create_subscription_plans moved to entrypoint.sh: running them here
# required a live production database during every image build.
RUN python manage.py collectstatic --noinput

RUN chmod +x /app/entrypoint.sh

# Create a non-root user
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app \
    && chown -R appuser:appuser /srv/hosting
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/ || exit 1

# Run the application
# Note: Using single worker for WebSocket support (multiple workers don't work with WebSockets)
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "ufazien.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "120"]

