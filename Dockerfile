FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RULES_PLEASE_UPLOAD_PDFS=1

WORKDIR /app
COPY requirements-worker.txt ./
RUN pip install --no-cache-dir -r requirements-worker.txt

COPY app_server.py convex_worker.py boardgames_ranks.csv ./
RUN mkdir -p /app/data/pdfs /app/data/covers /app/data/indexes

CMD ["python", "convex_worker.py"]
