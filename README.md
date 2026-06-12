# sensor_manager

[![CI/CD](https://github.com/Nullpointer84/sensor_manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Nullpointer84/sensor_manager/actions/workflows/ci.yml)

Monorepo for an IoT sensor management platform.

**Live demo:** <https://sensor-manager-nullpointer84.fly.dev> (deployed automatically from `main`)

- `backend/` — Kotlin + Spring Boot 3 REST API (Gradle Kotlin DSL).
- `web/` — React + TypeScript single-page app (Vite).

## Quick start

### Backend

```bash
cd backend
./gradlew bootRun
```

API listens on `http://localhost:8080`.

### Web

```bash
cd web
npm install
npm run dev
```

Dev server runs on `http://localhost:5173` and proxies `/api` to the backend.

## Deployment

Pushes to `main` run tests and deploy a single Docker container (backend serving both the API and the built SPA) to Fly.io via GitHub Actions. See [DEPLOYMENT.md](DEPLOYMENT.md) for the one-time setup and the full pipeline description.
