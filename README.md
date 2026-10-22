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