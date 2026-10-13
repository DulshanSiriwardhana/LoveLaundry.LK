# Build context: architecture_updated_system/
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY backend/pyproject.toml ./pyproject.toml
COPY backend/app ./app
RUN pip install --upgrade pip && pip install .

EXPOSE 8100
# Binds to all interfaces inside the container; the compose file maps the port
# to loopback on the host.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
