# Optional CPU runtime; requires a separately reviewed model directory.
# Do not enable for public speech until Member 4 supplies the authenticated
# adapter and pins/tests the complete inference dependency/model combination.
FROM python:3.12-slim-bookworm@sha256:935c3c5b12357a7e10caa9c1e6ca5692344d97cf229832ef584be2cec9fc03df
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export PIP_CERT=/run/secrets/proxy_ca; fi; \
    pip install --no-cache-dir whisperlivekit==0.2.26
RUN useradd --uid 10001 --create-home asr
USER asr
EXPOSE 8000
