# sensor_manager

Monorepo for an IoT sensor management platform.

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
