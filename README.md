# Room — Real-Time Debate Platform

Room is a web-based debate platform where two participants can join a debate room and communicate in real time.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL 16
- **Real-time audio:** LiveKit and WebRTC
- **Containers:** Docker and Docker Compose

## Prerequisites

Install the following tools before starting:

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

Make sure Docker Desktop is running before executing Docker commands.

## Getting Started

### 1. Clone the Repository

```bash
git clone <REPOSITORY_URL>
cd Room
```

Replace `<REPOSITORY_URL>` with the Git repository URL.

### 2. Configure Environment Variables

The project uses environment variables for application configuration and credentials.

Create your local `.env` file from the example:

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**macOS / Linux**

```bash
cp .env.example .env
```

Open `.env` and fill in the required values.

Check `.env.example` for the environment variables required by this version of the project. These may include:

- Database connection settings
- LiveKit API key and secret
- Backend configuration
- Other service credentials used by Docker Compose

Use the correct values for your local environment. Do not copy real credentials into `.env.example`.

**Security:** Never commit `.env`, API secrets, passwords, or access tokens to Git. Keep `.env.example` limited to variable names and safe placeholder values.

### 3. Start the Project

From the project root, run:

```bash
docker compose up -d --build
```

Docker Compose builds the application images and starts the configured services in the background. The first run may take several minutes while Docker downloads images and installs dependencies.

### 4. Check Service Status

```bash
docker compose ps
```

Check the logs if a service fails to start:

```bash
docker compose logs --tail 100
```

To inspect a particular service:

```bash
docker compose logs --tail 100 api
```

Use the service names defined in `docker-compose.yml` if they differ from the example.

### 5. Open Room

When the services are running, open:

| Service | Local address |
|---|---|
| Room frontend | http://localhost:5173 |
| Backend health check | http://localhost:4000/health |
| LiveKit server | ws://localhost:7880 |

The backend health endpoint should return a successful response when the API is available.

The LiveKit WebSocket address is used by the browser for real-time communication in the local development setup.

### 6. Stop the Project

To stop the running containers:

```bash
docker compose down
```

This stops and removes the Compose containers but preserves named database volumes.

To start the project again:

```bash
docker compose up -d
```

**Do not use `docker compose down -v`** unless you intentionally want to remove the associated named volumes and potentially delete local database data.

## Troubleshooting

### Docker is not running

Start Docker Desktop and wait until its engine is ready.

### A service fails to start

Check the status and logs:

```bash
docker compose ps
docker compose logs --tail 100
```

### Environment configuration errors

Confirm that `.env` exists in the project root and contains all required variables with valid values.

### Audio calls do not connect

Room uses LiveKit and WebRTC for browser audio. A successful backend connection does not guarantee that the media connection works.

If the call fails, check the LiveKit logs and network configuration. WebRTC may require additional UDP connectivity and appropriate ICE candidate addresses.

## Development Notes

- Keep `.env` local and never commit secrets.
- Use `.env.example` to document required configuration variables.
- Check service logs before changing Docker or network settings.
- Preserve the database volume when restarting the development environment.

## Project Status

Room is under active development. Some features, including real-time audio connectivity, may require further testing and configuration.
