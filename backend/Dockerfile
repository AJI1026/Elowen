FROM python:3.11-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend requirements
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# App + shared functions package (business logic)
COPY backend /app/backend
COPY functions /app/functions

ENV PYTHONPATH=/app/backend:/app/functions
ENV ELOWEN_DATA_DIR=/data
ENV ELOWEN_DB_PATH=/data/elowen.sqlite3
ENV ELOWEN_IMAGES_DIR=/data/images
ENV ELOWEN_SEED_DIR=/app/backend/seed
ENV ELOWEN_AUTO_SEED=1

WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
