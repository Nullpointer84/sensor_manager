# Implementation notes — landing page

A working build-doc for the marketing landing page that ships on the `landing_page` branch. Companion to [`CLAUDE.md`](CLAUDE.md), which is the agent-facing "rules of the road"; this doc is for humans onboarding or extending the code.

---

## What's in this work

A public, read-only marketing landing page that visualizes the historical sensor data from the original "temperature" MySQL deployment (Jan – May 2024, 5 devices, 3 locations, ~160k readings).

It has three working surfaces:

1. **Hero stats** — devices, locations, total readings, data date range.
2. **Latest readings** — one card per location with current temp/humidity/pressure/CO₂.
3. **Charts** — daily-mean indoor temperature trend and daily-mean CO₂ trend, both per location, last 30 days.

All data is intentionally public. There is no authentication.

## Architecture in one picture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       React components                              │
│   HeroStats · LocationCards · TemperatureChart · Co2Chart           │
│                            │                                        │
│                            ▼                                        │
│                       web/src/api.ts                                │
│        the only module in /web that touches fetch()                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTP /api/landing/*
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LandingController (com.sensormanager.landing)          │
│         thin REST layer, depends only on repository interfaces      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┬───────────────┐
       ▼                     ▼                     ▼               ▼
 StatsRepository      LocationRepository    DeviceRepository  ReadingRepository
       │                     │                     │               │
       │ (interfaces — this is the swap point)                     │
       ▼                     ▼                     ▼               ▼
 JsonStatsRepo        JsonLocationRepo     JsonDeviceRepo    JsonReadingRepo
                              │
                              ▼
                  backend/src/main/resources/data/*.json
                              ▲
                              │  produced offline by
              ┌───────────────┴───────────────┐
              │  node tools/build-data/       │
              │       parse-dump.mjs          │
              └───────────────┬───────────────┘
                              │ reads
                              ▼
                     database/database.sql
                     (committed mysqldump)
```

**Why this shape:** the UI knows about an HTTP contract and nothing else. The controller knows about repository interfaces and nothing else. When we move to a real database the only files that change are `Json*Repository` → `Jdbc*Repository` (new) and the `database/` + `tools/build-data/` pipeline (decommissioned). No controller, no React component, no API type changes.

## Data flow, end to end

1. `database/database.sql` — the canonical mysqldump from the original "temperature" database. Treated as the source of truth for landing-page data.
2. `node tools/build-data/parse-dump.mjs` — zero-dependency Node script. Parses MySQL `INSERT` statements directly (no DB needed), joins readings against `device_usage_history` to determine which location each reading belongs to at the moment it was taken, then writes six pre-aggregated JSON files into `backend/src/main/resources/data/`. Run from the repo root whenever the dump changes; the output JSONs are committed.
3. Spring Boot starts → each `Json*Repository` lazily loads its file via `ClassPathResource("data/<file>.json")` on first access → Jackson with the Kotlin module deserializes directly into the domain data classes (`Location`, `Device`, `LatestReading`, etc.).
4. `LandingController` exposes six `GET` endpoints under `/api/landing/*`. They are all parameterless; the controller is a one-line pass-through to the repository methods.
5. The React app calls those endpoints through `web/src/api.ts`. The Vite dev server proxies `/api/*` to `http://localhost:8080` (see [vite.config.ts](web/vite.config.ts)).
6. Components hold their own fetch state via the `useApi` hook and render hero copy, cards, and inline-SVG charts.

The 30-day window for charts is anchored to the **max timestamp present in the data**, not wall-clock now (the dump is historical).

## File map by layer

### Pipeline

| File | Role |
|---|---|
| `database/database.sql` | mysqldump (committed) — source of truth |
| `tools/build-data/parse-dump.mjs` | Parser + aggregator |
| `tools/build-data/README.md` | Runbook |
| `backend/src/main/resources/data/stats.json` | Hero totals |
| `backend/src/main/resources/data/locations.json` | Locations + currently-assigned device |
| `backend/src/main/resources/data/devices.json` | Devices + current location + first/last seen |
| `backend/src/main/resources/data/latest-readings.json` | Latest reading per location |
| `backend/src/main/resources/data/temperature-trend.json` | Daily indoor temperature aggregates |
| `backend/src/main/resources/data/iaq-summary.json` | Daily CO₂ aggregates |

### Backend (Kotlin, Spring Boot 3.4, JDK 21)

| Package | Files | Purpose |
|---|---|---|
| `com.sensormanager.landing` | [LandingController.kt](backend/src/main/kotlin/com/sensormanager/landing/LandingController.kt) | REST surface; depends only on repository interfaces. |
| `com.sensormanager.location` | `Location.kt`, `LocationRepository.kt`, `JsonLocationRepository.kt` | One aggregate. |
| `com.sensormanager.device` | `Device.kt`, `DeviceRepository.kt`, `JsonDeviceRepository.kt` | One aggregate. |
| `com.sensormanager.reading` | `Reading.kt`, `ReadingRepository.kt`, `JsonReadingRepository.kt` | Read-model query methods (not row-level CRUD). |
| `com.sensormanager.stats` | `SensorStats.kt`, `StatsRepository.kt`, `JsonStatsRepository.kt` | Landing-page hero totals. |

The Spring application class ([SensorManagerApplication.kt](backend/src/main/kotlin/com/sensormanager/SensorManagerApplication.kt)) and `application.yml` (Actuator: `health` + `info` only) are unchanged from the scaffold.

### Frontend (React 19, TypeScript 5.7, Vite 6)

| File | Role |
|---|---|
| `web/src/App.tsx` | Layout shell: top bar → hero → cards → temperature chart → CO₂ chart → footer. |
| `web/src/api.ts` | The only module that calls `fetch`. Typed clients for the 6 endpoints. |
| `web/src/hooks/useApi.ts` | Small `loading | ok | error` state hook. Cancels on unmount. |
| `web/src/format.ts` | `Intl`-based formatters (numbers, dates, metric values). |
| `web/src/colors.ts` | Hardcoded palette keyed by location id; used by both cards and charts. |
| `web/src/components/HeroStats.tsx` | Hero section. |
| `web/src/components/LocationCards.tsx` | Latest-reading cards. |
| `web/src/components/LineChart.tsx` | Generic multi-series SVG line chart. Zero deps. |
| `web/src/components/TemperatureChart.tsx` | Wraps `LineChart` for the temperature data. |
| `web/src/components/Co2Chart.tsx` | Wraps `LineChart` for the CO₂ data. |
| `web/src/index.css` | Hand-rolled CSS (variables, hero gradient, card grid, chart styles, responsive). |

## Backend in detail

### Repository interfaces are the storage boundary

Every aggregate has a Kotlin interface that defines _what the landing page needs from this aggregate_, not generic CRUD. For example, `ReadingRepository` doesn't expose `findAll(): List<Reading>` — it exposes:

```kotlin
interface ReadingRepository {
    fun latestPerLocation(): List<LatestReading>
    fun temperatureTrend(): List<TemperatureTrendPoint>
    fun co2Summary(): List<Co2SummaryPoint>
}
```

This is what makes the swap to a database tractable: each method maps to one SQL query (or one view) in the future JDBC implementation. The interface doesn't leak the fact that the JSON impl is pre-aggregated.

### JSON implementations

Each `Json*Repository`:

- Is annotated `@Repository` so Spring DI registers it bound to the interface type.
- Takes the auto-configured `ObjectMapper` in its constructor.
- Lazy-loads its file from the classpath on first access, caches the result for the lifetime of the application.

```kotlin
@Repository
class JsonLocationRepository(private val objectMapper: ObjectMapper) : LocationRepository {
    private val cached: List<Location> by lazy {
        ClassPathResource("data/locations.json").inputStream.use { input ->
            objectMapper.readValue(input)
        }
    }
    override fun findAll(): List<Location> = cached
}
```

No other code in the backend imports or names a concrete `Json*Repository` — the controller takes the interfaces. This is verifiable with `grep "Json.*Repository"` returning only the class definitions themselves.

### REST contract

| Method | Path | Returns |
|---|---|---|
| GET | `/api/landing/stats` | `SensorStats` |
| GET | `/api/landing/locations` | `Location[]` |
| GET | `/api/landing/devices` | `Device[]` |
| GET | `/api/landing/latest-readings` | `LatestReading[]` |
| GET | `/api/landing/temperature-trend` | `TemperatureTrendPoint[]` |
| GET | `/api/landing/co2-summary` | `Co2SummaryPoint[]` |

All handlers are parameterless. Jackson serializes `Instant` as ISO-8601 strings and `LocalDate` as `YYYY-MM-DD`. The TypeScript types mirror this in [`web/src/api.ts`](web/src/api.ts).

## Frontend in detail

### Fetching

The single hook in `useApi.ts` is the only data-fetch pattern in the UI:

```ts
const fetcher = useCallback(() => fetchStats(), []);
const state = useApi(fetcher);  // { status: "loading" | "ok" | "error", data, error }
```

Each section component fetches its own endpoint independently — all four requests happen in parallel on page load. This is intentional: no top-level orchestration, no cascading loading states, simple failure isolation (a broken endpoint affects only its own section).

### Charts (zero-dep SVG)

`LineChart.tsx` is a small but full-featured multi-series line chart written as inline SVG with a fixed `viewBox` (`0 0 800 320`) that scales to its container via CSS `width: 100%`. It computes its own X/Y scales from the input series, draws gridlines, axis labels, and one `<path>` per series. No animations, no tooltips, no hover state — kept deliberately minimal.

Adding a third metric chart is straightforward — see the "How to extend" section below.

### Styling

A single `index.css` defines CSS variables (`--bg`, `--accent`, `--radius`, etc.) and section-scoped class blocks (`.hero`, `.card`, `.chart`, `.section`). Responsive breakpoint at 720px collapses the stat row to two columns and hides the top-bar nav.

Production bundle size: **~64 KB gzipped including React** — verifiable via `npm run build`.

## Decisions log

| Decision | Alternative | Why |
|---|---|---|
| Static JSON snapshots at build time | Real MySQL via Docker Compose | Marketing landing page is read-only, historical data. JSON eliminates DB install/run for contributors and reduces ops surface to zero. Real DB will land when we add write paths. |
| Per-aggregate repository interfaces | Single `LandingDataSource` mega-interface | Per-aggregate interfaces are the natural unit for a future JDBC impl (one interface per table-ish concern) and keep the controller honest about who owns what. |
| Query-shaped repository methods (`temperatureTrend()`) | Row-level methods (`findAllReadings()`) | The JSON impl is already pre-aggregated; matching that shape in the interface avoids exposing an internal model. A future JDBC impl maps each query method to one SQL view. |
| Hand-rolled SVG charts | Recharts / Chart.js / Victory | Two simple line charts. A library would 3–10× the JS bundle and add a dependency to keep in sync. ~140 lines of SVG covers it. |
| Plain CSS in one file | Tailwind / CSS modules / styled-components | "Lightest" was the explicit constraint. One file is editable end-to-end without tooling, and one stylesheet's worth of CSS is fine for a landing page. |
| Node parser script with zero deps | A real SQL parser library / loading into MySQL and exporting | The dump uses one statement per line. A small hand-written tokenizer covers it deterministically with no `node_modules` to manage. |
| 30-day window anchored to max-timestamp-in-data | Anchored to wall-clock now | The data is historical (Jan–May 2024). Anchoring to "now" would always render an empty chart. |
| One independent fetch per section | Centralized top-level fetch | Failure isolation: a broken endpoint shows one error block instead of blanking the page. |

## How to extend

### Add a new landing endpoint

1. Add a method to the relevant repository interface, e.g. `ReadingRepository.humidityTrend()`.
2. Implement it in `JsonReadingRepository` (probably backed by a new JSON file under `data/`).
3. Extend `tools/build-data/parse-dump.mjs` to compute and write the new JSON file. Re-run it.
4. Add the controller method to `LandingController`:
   ```kotlin
   @GetMapping("/humidity-trend")
   fun humidityTrend(): List<HumidityTrendPoint> = readingRepository.humidityTrend()
   ```
5. Add the TypeScript type and `fetchHumidityTrend` helper to `web/src/api.ts`.
6. Build a section component and drop it into `App.tsx`.

### Add a new chart

1. Make sure the data endpoint exists.
2. Copy `TemperatureChart.tsx` and adjust the imports + `buildSeries` mapping.
3. Drop it into `App.tsx`.

The shared `LineChart` accepts an arbitrary number of series and custom `xTickFormatter`/`yTickFormatter`, so most charts need no new chart code.

### Add a new aggregate (e.g. alerts)

1. Create `com.sensormanager.alert/` with `Alert.kt`, `AlertRepository.kt`, and `JsonAlertRepository.kt` (or skip the JSON impl if there's no historical data).
2. Inject the new interface into `LandingController` if the landing page surfaces it, or expose via a separate controller if it's an internal concern.

### Refresh the data

```bash
node tools/build-data/parse-dump.mjs   # from the repo root
```

Then commit the changed JSON files under `backend/src/main/resources/data/`.

## Migrating from JSON to a real database

When we're ready:

1. Pick a stack — likely MySQL (to match the dump verbatim) or Postgres (if we want a clean break). Add the JDBC driver and Spring Data starter to `backend/build.gradle.kts`.
2. Bring up the database in `compose.yaml`, load `database.sql` as the seed (MySQL) or convert + load (Postgres).
3. For each aggregate, write a `Jdbc<Name>Repository` implementing the existing interface. Each repository method becomes one query — likely against a materialized view that mirrors the JSON aggregation logic from `parse-dump.mjs`.
4. Annotate the new `Jdbc*Repository` classes `@Repository`. **Delete** (or `@Profile("legacy")`-gate) the `Json*Repository` classes — Spring can't have two beans satisfying the same interface without qualification.
5. Decommission `tools/build-data/parse-dump.mjs` and the committed JSON snapshots. Keep `database/database.sql` or move it into a `seed/` location depending on whether it remains the canonical dataset.

What does **not** change in step 4: `LandingController.kt`, `web/src/api.ts`, every React component, the REST contract, the TypeScript types. That stability is the whole point of the repository-interface boundary.

## Running locally

```bash
# backend
cd backend
./gradlew bootRun         # http://localhost:8080

# web (separate terminal)
cd web
npm install
npm run dev               # http://localhost:5173
```

JDK 21 is required for the backend. The Gradle wrapper is committed — no system Gradle install needed.

## Verification done at build time

- Backend: `./gradlew test` runs `SensorManagerApplicationTests.contextLoads`, which boots the full Spring context and proves DI wires all four repositories.
- Web: `npm run build` runs `tsc -b` (strict mode, no unused locals/parameters) then Vite production build. Clean build = clean strict-typed code.
- Manual smoke test: each `/api/landing/*` endpoint returned the expected shape during the initial deployment.

## Known follow-ups not addressed here

These are deliberately out of scope for this branch and are tracked in [CLAUDE.md](CLAUDE.md):

- Production database backing (see "Migrating from JSON to a real database" above).
- Sensor ingest transport (HTTP push, MQTT, or both) — no write path exists.
- Auth for any future management UI.
- Deployment target (container, JAR, cloud).
