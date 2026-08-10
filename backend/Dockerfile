FROM python:3.11-slim

WORKDIR /app

# psycopg2-binary doesn't need libpq-dev at runtime, but gcc/libpq-dev cover
# any source builds triggered by a future dependency bump.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
