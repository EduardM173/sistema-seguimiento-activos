FROM python:3.11-slim

# System deps (for psycopg2, pillow, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
        libffi-dev \
        libssl-dev \
        libjpeg-dev \
        zlib1g-dev \
        poppler-utils \
        iputils-ping \ 
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --upgrade pip --timeout=300
RUN pip install --timeout=300 --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY migrations/ ./migrations/

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
