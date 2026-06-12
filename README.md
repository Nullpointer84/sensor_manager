# Sensor Manager

[![CI/CD](https://github.com/Nullpointer84/sensor_manager/actions/workflows/ci.yml/badge.svg)](https://github.com/Nullpointer84/sensor_manager/actions/workflows/ci.yml)

A web dashboard that turns a historical IoT sensor dataset into a readable view of indoor environmental conditions, so the readings from an old sensor deployment are browsable instead of locked inside a database dump.

**Live:** <https://sensor-manager-nullpointer84.fly.dev>

## What it does

Shows a public, read-only landing page for a real home/lab sensor deployment (5 devices across 3 locations, ~160 000 readings from January–May 2024). A visitor sees headline totals (devices, locations, total readings, the date range covered), a card per location with the latest temperature, humidity, pressure and CO₂, and two line charts: daily indoor-temperature trend and daily CO₂ trend per location over the last 30 days of the dataset. There is no login and no data entry — it is a viewer over a fixed dataset.

## Get started

### Requirements

- **JDK 21** — for the backend (the Gradle wrapper is committed, so no separate Gradle install is needed).
- **Node 20+** — for the web client (CI and the production image use Node 22).
- **No external services or API keys.** The data ships with the repo as committed JSON snapshots, so nothing else is required to run it locally.

### Installation

```bash
git clone https://github.com/Nullpointer84/sensor_manager
cd sensor_manager

# web dependencies (the backend uses the committed Gradle wrapper, no install step)
cd web && npm install && cd ..
```

### Configuration

None required. The app reads no environment variables and needs no `.env` file to run — the landing data is a set of committed JSON snapshots under `backend/src/main/resources/data/`, and the API is intentionally public.

The only secret in the project is `FLY_API_TOKEN`, used by the deployment pipeline. It lives in GitHub Actions Secrets and is never stored in the repository.

### Run the project

Two processes during development (each from its own directory):

```bash
# 1. backend API on http://localhost:8080
cd backend && ./gradlew bootRun

# 2. web dev server on http://localhost:5173 (proxies /api to the backend)
cd web && npm run dev
```

In production it runs as a single container instead: the backend serves both the API and the built web client from one origin (see [DEPLOYMENT.md](DEPLOYMENT.md)).

## Architecture

The system is split so the UI never needs to know where the data comes from. The React client talks only to typed fetch helpers in `web/src/api.ts`, which call a stable `/api/landing/*` HTTP contract. On the backend, a thin `LandingController` holds no business logic — it depends only on per-aggregate repository **interfaces** (`StatsRepository`, `LocationRepository`, `DeviceRepository`, `ReadingRepository`). Today those interfaces are implemented by `Json*Repository` classes that load the committed JSON snapshots; swapping in a real database later means writing new implementations of the same interfaces and changing nothing else. The snapshots themselves are produced offline by a Node script that parses the original MySQL dump — that pipeline is not part of the running app.

```
sensor_manager/
├── backend/                  # Kotlin + Spring Boot 3 REST API (JDK 21); feature packages, each with a
│                             #   repository interface + a JSON-backed implementation
├── web/                      # React 19 + TypeScript SPA (Vite 6); all network access goes through src/api.ts
├── database/                 # The original mysqldump — source of truth for the seed data, not loaded at runtime
├── tools/build-data/         # Node script that turns the dump into the committed JSON snapshots
├── Dockerfile                # Single production image: backend jar with the built SPA baked in
├── fly.toml                  # Fly.io app config (region arn, scale-to-zero, health check)
└── .github/workflows/ci.yml  # CI/CD: tests on every PR/push, deploy to Fly.io on green main
```

## Technical stack

| Component | Choice | Reason |
|---|---|---|
| Backend | Kotlin + Spring Boot 3 (JDK 21) | Mature REST stack; lets the storage boundary be expressed as plain interfaces wired by DI. |
| Frontend | React 19 + TypeScript + Vite 6 | Standard SPA tooling; strict TypeScript catches contract drift at build time. |
| Charts | Hand-written inline SVG (no chart library) | Two simple line charts don't justify a dependency; keeps the bundle at ~64 KB gzipped. |
| Data store | Committed JSON snapshots | The data is read-only and historical, so no database is needed to run or contribute; a real DB can replace it behind the repository interfaces. |
| Hosting | Fly.io, single Docker container | Backend serves API + SPA from one origin, so the client needs no CORS or backend URL config; scale-to-zero keeps cost low. |
| CI/CD | GitHub Actions | Runs backend tests, the web build, and a Docker build on every push/PR; deploys to Fly.io only on green `main`. |

## Limitations

Honest about what this does not do (yet):

- **Read-only.** There is no write path — no live sensor ingest (HTTP or MQTT), no way to add or edit data through the app.
- **Static, historical data.** The dataset is a fixed snapshot from Jan–May 2024. The "last 30 days" in the charts is anchored to the newest timestamp in that data, not the current date, so it does not update over time.
- **No authentication.** The landing API is deliberately public; there is no admin or management surface.
- **No real database.** Data is pre-aggregated JSON; the production database choice (MySQL vs Postgres) is intentionally still open.
- **Minimal charts.** The SVG charts have no tooltips, hover, or zoom — they are read-at-a-glance trend lines.
- **Cold start.** With scale-to-zero, the first request after the app has been idle takes ~1 s to wake (or ~15 s if Fly does a full stop rather than a suspend).

## Developed with

Claude Code (agent-driven development) as part of the course *Next-Generation Software Development with AI*.
