# Room — Structured Debate Platform

Room is a structured 1v1 debate platform that enforces a deterministic debate lifecycle. It separates arguments into a timed Solo Round and a live WebSocket-driven Open Discussion Round, evaluating participants independently on factual accuracy and persuasive strength.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, served via Nginx
- **Backend:** Node.js, Express, TypeScript, WebSockets, structured as a modular monolith
- **Database:** PostgreSQL 16
- **Infrastructure:** Docker and Docker Compose

---

## How to Run the Project Locally

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- Git installed

### Important Network Note: Docker Image Pull Timeouts

If you are using a restricted network and Docker encounters errors such as `failed to fetch anonymous token`, connection timeouts, or `dial tcp connection attempt failed`, Docker may be unable to reach the image registry.

Try the following:

1. Verify that Docker Desktop is running.
2. Check your internet connection and proxy configuration.
3. If you use a VPN or proxy client such as Clash or V2Ray, check whether Docker traffic is routed through it. Enabling TUN mode may help, depending on your client and network configuration.
4. Restart Docker Desktop after changing network settings.

**Note:** TUN mode is not always required. The correct solution depends on your proxy configuration and the specific connection error.

### 1. Clone the Repository

If you have not cloned the project yet, run:

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_REPOSITORY_DIRECTORY>
```

Replace the placeholders with your actual repository URL and directory name.

If you already have the project locally, open a terminal in its root directory.

### 2. Build and Start the Docker Stack

Run this command from the project root, where your Docker Compose configuration is located:

```bash
docker compose up --build -d
```

This builds the configured images and starts the services in the background.

> If your installation uses the legacy standalone Compose command, you can use `docker-compose` instead.

### 3. Check the Running Services

```bash
docker compose ps
```

Check the logs if a service fails to start:

```bash
docker compose logs
```

To inspect a specific service, use:

```bash
docker compose logs -f <SERVICE_NAME>
```

Replace `<SERVICE_NAME>` with the actual service name defined in your Compose configuration.

### 4. Access the Application

Open the frontend URL configured in your Docker Compose file, typically:

```text
http://localhost
```

If Nginx is mapped to a different host port, use that port instead. The backend API and database ports depend on your Compose configuration.

### 5. Stop the Application

To stop and remove the running containers and Compose network, run:

```bash
docker compose down
```

This does not normally delete the database volume, so your persisted database data should remain available when you start the stack again.

**Warning:** Avoid `docker compose down -v` unless you intentionally want to remove the associated volumes and potentially delete your local database data.

---

## Troubleshooting

| Problem | Suggested action |
|---|---|
| Docker image pull timeout | Check internet access, proxy routing, and Docker Desktop connectivity. |
| Port already in use | Check the host port mappings and stop conflicting services. |
| Backend fails to connect to PostgreSQL | Verify the database service, environment variables, credentials, and startup dependencies. |
| Frontend cannot reach the API | Verify the API URL, Nginx proxy configuration, and backend service status. |
| Container exits unexpectedly | Inspect logs with `docker compose logs`. |

## Development Notes

- Run Docker Compose commands from the project root.
- Keep environment variables and credentials in the appropriate environment configuration files.
- Do not commit passwords, API keys, or other secrets to Git.
- Refer to the project's Docker Compose configuration for the actual service names, port mappings, and environment variables.
