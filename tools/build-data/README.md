# build-data

One-off data pipeline: parses `database/database.sql` (mysqldump) and emits
aggregated JSON files into `backend/src/main/resources/data/` so the backend
can serve the landing page without a live database.

Re-run this when the dump changes. Output JSONs are committed.

## Usage

From the repo root:

```bash
node tools/build-data/parse-dump.mjs
```

No dependencies. Requires Node 20+.

## What it produces

| File | Purpose |
|---|---|
| `stats.json` | Hero totals: devices, locations, readings, date range |
| `locations.json` | Locations + the device currently assigned to each |
| `devices.json` | Devices + their most recent location + last-seen timestamp |
| `latest-readings.json` | Latest indoor temp / humidity / pressure / CO2 per location |
| `temperature-trend.json` | Daily mean/min/max indoor temp per location (last 30 days of data) |
| `iaq-summary.json` | Daily mean/peak CO2 per location (last 30 days of data) |

## Notes

The "last 30 days" window is anchored to the **max timestamp present in the
data**, not wall-clock now — the dump is historical (Jan–May 2024).
