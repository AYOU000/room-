# Optional CPU runtime; requires a separately reviewed model directory.
# Do not enable for public speech until Member 4 supplies the authenticated
# adapter and pins/tests the complete inference dependency/model combination.
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir whisperlivekit==0.2.26
RUN useradd --uid 10001 --create-home asr
USER asr
EXPOSE 8000
