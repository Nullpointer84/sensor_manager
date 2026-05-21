# sensor_manager — Claude guide

IoT sensor management platform. Monorepo with a Kotlin/Spring Boot REST API and a React/TypeScript web client.

## Layout

```
backend/         Kotlin + Spring Boot 3 service (Gradle Kotlin DSL, JDK 21)
web/             React 19 + TypeScript SPA (Vite 6)
database/        Historical mysqldump used as the seed data source
tools/build-data/ One-off Node script that turns the dump into JSON for the backend
```

The two builds (backend, web) are independent — there is no top-level Gradle or workspace file. Run each from its own directory.

## Architecture: data flow & layering

The marketing landing page is fed from a **static JSON snapshot** today and will move to a real database later. The whole point of the current layering is that the UI doesn't need to know which is in play.

```
React UI                              (web/src/components/*)
   │
   ▼   typed fetch helpers in web/src/api.ts
HTTP /api/landing/*                   (stable contract)
   │
   ▼   thin REST controller in backend, no business logic
LandingController                     (com.sensormanager.landing)
   │
   ▼   depends only on repository interfaces
LocationRepository, DeviceRepository, ReadingRepository, StatsRepository
   │                                  (interfaces in each feature package)
   ▼   implementations are swappable
Json*Repository (today)               loads classpath data/*.json on first access
   ↑
   │   future: Jdbc*Repository       same interface, real database
```

**Rule:** UI code only imports from `web/src/api.ts`. Backend services only depend on repository **interfaces**, never on the JSON impls directly. When we transition to a database, the only files that change are the repository implementations — `LandingController`, `api.ts`, and every React component stay untouched.

## Data pipeline

The source of truth for landing-page data is **`database/database.sql`** (mysqldump from the original "temperature" database — indoor environment readings Jan–May 2024). It is **not** loaded at runtime. Instead:

1. `tools/build-data/parse-dump.mjs` reads the dump, parses MySQL `INSERT` statements directly (no DB needed, no deps), and emits aggregated JSON into `backend/src/main/resources/data/`:
   - `stats.json` — totals for the hero (device/location/reading counts, date range)
   - `locations.json` — locations + currently-assigned device
   - `devices.json` — devices + current location + first/last seen
   - `latest-readings.json` — latest temp/humidity/pressure/CO2 per location
   - `temperature-trend.json` — daily mean/min/max indoor temp per location, last 30 days
   - `iaq-summary.json` — daily mean/peak CO2 per location, last 30 days
2. Those JSON files are committed. The backend reads them at startup via the `Json*Repository` classes.
3. Re-run `node tools/build-data/parse-dump.mjs` from the repo root whenever the dump changes.

The "last 30 days" window is anchored to the **max timestamp in the data**, not wall-clock now (the dump is historical).

## Backend (`backend/`)

- Kotlin 2.1, Spring Boot 3.4, Java toolchain 21.
- Package root: `com.sensormanager`. Domain code lives in feature packages — one per aggregate.
- Entry point: [SensorManagerApplication.kt](backend/src/main/kotlin/com/sensormanager/SensorManagerApplication.kt).
- All REST endpoints are mounted under `/api/...`. The landing endpoints live in [LandingController.kt](backend/src/main/kotlin/com/sensormanager/landing/LandingController.kt).
- Config: [application.yml](backend/src/main/resources/application.yml). Server port 8080. Actuator exposes `health` and `info`.

### Feature packages

| Package | Contains | Notes |
|---|---|---|
| `landing` | `LandingController` | Stable REST contract for the marketing page. No business logic. |
| `location` | `Location`, `LocationRepository`, `JsonLocationRepository` | One aggregate. |
| `device` | `Device`, `DeviceRepository`, `JsonDeviceRepository` | One aggregate. |
| `reading` | `LatestReading`, `TemperatureTrendPoint`, `Co2SummaryPoint`, `ReadingRepository`, `JsonReadingRepository` | Read-model query methods, not row-level access. |
| `stats` | `SensorStats`, `StatsRepository`, `JsonStatsRepository` | Landing-page hero totals. |

The repository interface methods are **query-shaped** (e.g. `temperatureTrend()`, `latestPerLocation()`), not row-level CRUD. When we move to a database the JDBC impl translates each method into one SQL query (or a view).

### Common commands

```bash
cd backend
./gradlew bootRun     # run the API on :8080
./gradlew test        # JUnit 5 + Spring Boot test
./gradlew build       # full build incl. tests
```

The Gradle wrapper (`gradlew`, `gradlew.bat`, `gradle/wrapper/`) is committed — use it directly, no system Gradle install required. Backend requires **JDK 21**.

## Web (`web/`)

- React 19, TypeScript 5.7, Vite 6. No chart or UI libraries — line charts are inline SVG, styling is hand-rolled CSS in `index.css`.
- Entry: [main.tsx](web/src/main.tsx) → [App.tsx](web/src/App.tsx). Section components live under `web/src/components/`.
- Network access goes through [api.ts](web/src/api.ts). UI components must not call `fetch` directly.
- Dev server runs on `:5173` and proxies `/api` → `http://localhost:8080` (see [vite.config.ts](web/vite.config.ts)). Always call the backend through `/api/...` — never hard-code the backend origin in client code.
- Strict TS is on (`noUnusedLocals`, `noUnusedParameters`, `strict`). Don't relax these to silence errors; fix the call site.

### Common commands

```bash
cd web
npm install
npm run dev           # Vite dev server on :5173
npm run build         # type-check + production build
npm run preview       # serve the production build locally
```

## Working with this repo

- **Do not commit, push, or open PRs.** The user owns all git operations (staging, committing, pushing, branching, PRs). Make changes to the working tree and stop there — describe what you did and let the user handle version control. This applies even when explicitly asked by tooling like a `/create-pr` command; defer to the user instead.

## Conventions

- **Feature-based packages on the backend.** When adding a new domain concept (e.g. `alert`, `floorplan`), create `com.sensormanager.<feature>/` and put the model, repository interface, and impl(s) together. Don't introduce a `controllers/` or `services/` top-level package.
- **Repository interfaces are the storage boundary.** Add a `Json*Repository` (and later a `Jdbc*Repository`) — never let other code import a concrete impl directly. Spring DI wires the interface.
- **API shape.** REST under `/api/<resource>`. JSON field names follow Jackson defaults (camelCase). `Instant` serializes to ISO-8601 strings; `LocalDate` to `YYYY-MM-DD`. The TypeScript types for those fields are `string`.
- **No secrets in `application.yml`.** Use environment variables or Spring profiles when wiring real config; commit only safe defaults.

## Things not yet decided

These are open and should be raised with the user before being chosen unilaterally:

- **Production database** — when we replace the JSON snapshot. Original data is MySQL; staying with MySQL is the path of least resistance, but Postgres is also fine.
- **Sensor ingest transport** (HTTP push, MQTT, or both) — no write path exists yet.
- **Auth** — the public landing API is intentionally open; any admin/management UI is undecided.
- **Deployment target** (container, JAR, cloud).
