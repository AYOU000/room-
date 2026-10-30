#!/bin/sh
set -eu
# Compose runs migrations once in its dedicated migrate service.
exec node dist/index.js
