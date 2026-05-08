# sensor_manager — Claude guide

IoT sensor management platform. Monorepo with a Kotlin/Spring Boot REST API and a React/TypeScript web client.

## Layout

```
backend/   Kotlin + Spring Boot 3 service (Gradle Kotlin DSL, JDK 21)
web/       React 19 + TypeScript SPA (Vite 6)
```

The two are independent builds — there is no top-level Gradle or workspace file. Run each from its own directory.

## Backend (`backend/`)

- Kotlin 2.1, Spring Boot 3.4, Java toolchain 21.
- Package root: `com.sensormanager`. Domain code lives in feature packages (e.g. `com.sensormanager.sensor`), not in layered packages (`controller/`, `service/`).
- Entry point: [SensorManagerApplication.kt](backend/src/main/kotlin/com/sensormanager/SensorManagerApplication.kt).
- REST endpoints are mounted under `/api/...`. The example list endpoint is [SensorController.kt](backend/src/main/kotlin/com/sensormanager/sensor/SensorController.kt).
- Config: [application.yml](backend/src/main/resources/application.yml). Server port 8080. Actuator exposes `health` and `info`.
- No persistence layer is wired yet — the example controller returns a hard-coded list. Add a database starter (Postgres + JPA, or jOOQ/Exposed) before introducing real storage.

### Common commands

```bash
cd backend
./gradlew bootRun     # run the API on :8080
./gradlew test        # JUnit 5 + Spring Boot test
./gradlew build       # full build incl. tests
```

The Gradle wrapper jar is not committed yet — run `gradle wrapper` once with a local Gradle install to materialize it, or commit the wrapper before first CI run.

## Web (`web/`)

- React 19, TypeScript 5.7, Vite 6.
- Entry: [main.tsx](web/src/main.tsx) → [App.tsx](web/src/App.tsx). API calls live in [api.ts](web/src/api.ts).
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

- **Feature-based packages on the backend.** When adding a new domain concept (e.g. `device`, `alert`, `reading`), create `com.sensormanager.<feature>/` and put the model, repository, service, and controller together. Don't introduce a `controllers/` or `services/` top-level package.
- **API shape.** REST under `/api/<resource>`. JSON field names follow Jackson defaults (camelCase). `Instant` serializes to ISO-8601 strings — the web type for those fields is `string`.
- **IDs are UUIDs**, not auto-increment integers. Generate server-side.
- **No secrets in `application.yml`.** Use environment variables or Spring profiles when wiring real config; commit only safe defaults.

## Things not yet decided

These are open and should be raised with the user before being chosen unilaterally:

- Database (Postgres assumed, but not wired).
- Sensor ingest transport (HTTP push, MQTT, or both).
- Auth — there is none currently. Endpoints are open.
- Deployment target (container, JAR, cloud).
