FROM python:3.12-slim
WORKDIR /app

# Build from the system-manegment/ directory: docker build -f monolith/Dockerfile .
# The vendor sources are read-only; loader.py resolves ROOT as parents[3] of its
# own file (/app/src/monolith/loader.py -> /), so they must land at these paths.
COPY monolith/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY monolith/src ./src
COPY bill-service/src/bill_service /bill-service/src/bill_service
COPY user-service/src/user_service /user-service/src/user_service
COPY quotation-service/src/quotation_service /quotation-service/src/quotation_service
COPY worker-service/src/worker_service /worker-service/src/worker_service
COPY laundry-management/src /laundry-management/src
COPY love-ai/src /love-ai/src

ENV PYTHONPATH=/app/src
EXPOSE 8000
CMD ["uvicorn", "monolith.main:app", "--host", "0.0.0.0", "--port", "8000"]
