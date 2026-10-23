# Official upstream source pinned by commit and archive checksum; registry image is unavailable.
FROM golang:1.24-bookworm AS builder
ADD --checksum=sha256:ac3bc23e5d91981a89921800a931a59aad27146434f952e9a79076b919d8a661 https://codeload.github.com/minio/minio/tar.gz/f19c534b9f457773dcd043d977433e1a71525c3b /tmp/minio.tar.gz
RUN mkdir /src && tar -xzf /tmp/minio.tar.gz -C /src --strip-components=1
WORKDIR /src
ENV GOMAXPROCS=4 CGO_ENABLED=0
RUN --mount=type=secret,id=build_ca,required=false --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    if [ -f /run/secrets/build_ca ]; then export SSL_CERT_FILE=/run/secrets/build_ca; fi; \
    go build -p 4 -trimpath -o /minio .
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /minio /usr/local/bin/minio
RUN mkdir /data && chown 1000:1000 /data
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/minio"]
