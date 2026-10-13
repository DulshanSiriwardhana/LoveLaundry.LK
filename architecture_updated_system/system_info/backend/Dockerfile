# Build context: architecture_updated_system/
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY system_info/backend/pyproject.toml ./pyproject.toml
COPY system_info/backend/app ./app
RUN pip install --upgrade pip && pip install .

EXPOSE 8810
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8810"]
