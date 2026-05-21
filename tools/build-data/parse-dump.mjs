// One-off parser: mysqldump (database/database.sql) -> aggregated JSON
// files under backend/src/main/resources/data/. No external dependencies.
//
// Run from repo root:
//   node tools/build-data/parse-dump.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const DUMP = path.join(REPO_ROOT, "database", "database.sql");
const OUT_DIR = path.join(REPO_ROOT, "backend", "src", "main", "resources", "data");

const SCHEMA = {
  measurement_locations: ["id", "name", "desc"],
  device_usage_history: ["id", "hwid", "location_id", "start_date", "end_date"],
  temperature_log: ["entry_date", "hwid", "temp", "temp1"],
  temperature_log_updated: ["id", "start_date", "end_date", "hwid", "temp", "temp1"],
  temperature_log_indoor: ["id", "hwid", "start_date", "end_date", "temp", "humidity", "pressure"],
  iaq_log_indoor: ["id", "hwid", "log_date", "accuracy", "iaq_static", "co2", "breath_voc", "gas_percentage"],
};

// ---------- SQL parsing ----------

function parseValue(s, i) {
  if (s.startsWith("NULL", i)) return [null, i + 4];
  if (s[i] === "'") {
    let j = i + 1;
    let out = "";
    while (j < s.length) {
      const c = s[j];
      if (c === "\\") {
        const n = s[j + 1];
        if (n === "n") out += "\n";
        else if (n === "t") out += "\t";
        else if (n === "r") out += "\r";
        else if (n === "0") out += "\0";
        else out += n;
        j += 2;
      } else if (c === "'" && s[j + 1] === "'") {
        out += "'";
        j += 2;
      } else if (c === "'") {
        return [out, j + 1];
      } else {
        out += c;
        j++;
      }
    }
    throw new Error("Unterminated string literal");
  }
  // number (possibly negative, possibly decimal)
  let j = i;
  if (s[j] === "-") j++;
  while (j < s.length && /[0-9.]/.test(s[j])) j++;
  return [Number(s.substring(i, j)), j];
}

function parseValuesBlob(s) {
  // s looks like: (v,v,...),(v,v,...),...
  const rows = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "(") throw new Error(`Expected ( at ${i}, got ${s[i]}`);
    i++;
    const row = [];
    while (true) {
      const [v, ni] = parseValue(s, i);
      row.push(v);
      i = ni;
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === ")") {
        i++;
        break;
      }
      throw new Error(`Expected , or ) at ${i}, got '${s[i]}'`);
    }
    rows.push(row);
    if (i < s.length && s[i] === ",") {
      i++;
      continue;
    }
    break;
  }
  return rows;
}

function loadTables() {
  const content = fs.readFileSync(DUMP, "utf8");
  const tables = {};
  for (const name of Object.keys(SCHEMA)) tables[name] = [];

  const insertRe = /^INSERT INTO `(\w+)` VALUES (.+);$/;
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(insertRe);
    if (!m) continue;
    const [, table, valuesBlob] = m;
    const cols = SCHEMA[table];
    if (!cols) continue;
    const rawRows = parseValuesBlob(valuesBlob);
    for (const r of rawRows) {
      const obj = {};
      for (let k = 0; k < cols.length; k++) obj[cols[k]] = r[k];
      tables[table].push(obj);
    }
  }
  return tables;
}

// ---------- Helpers ----------

// MySQL timestamps come in as "YYYY-MM-DD HH:MM:SS" (no zone). The original
// system was a single household / lab; treat them as UTC for consistency.
function tsToIso(ts) {
  if (!ts) return null;
  return new Date(ts.replace(" ", "T") + "Z").toISOString();
}

function tsToEpochMs(ts) {
  return new Date(ts.replace(" ", "T") + "Z").getTime();
}

function dateOf(ts) {
  return ts.substring(0, 10); // YYYY-MM-DD
}

function locationOfDeviceAt(deviceUsage, hwid, ts) {
  // Find usage row matching hwid where start <= ts <= end (or end null)
  const tsMs = tsToEpochMs(ts);
  for (const u of deviceUsage) {
    if (u.hwid !== hwid) continue;
    const startMs = tsToEpochMs(u.start_date);
    if (startMs > tsMs) continue;
    if (u.end_date === null) return u.location_id;
    const endMs = tsToEpochMs(u.end_date);
    if (endMs >= tsMs) return u.location_id;
  }
  return null;
}

function round(n, places) {
  if (n === null || n === undefined) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

// ---------- Aggregations ----------

function buildStats(tables) {
  const deviceHwids = new Set();
  for (const u of tables.device_usage_history) deviceHwids.add(u.hwid);

  const readingCount =
    tables.temperature_log.length +
    tables.temperature_log_indoor.length +
    tables.iaq_log_indoor.length;

  let earliestMs = Infinity;
  let latestMs = -Infinity;
  const touch = (ts) => {
    if (!ts) return;
    const m = tsToEpochMs(ts);
    if (m < earliestMs) earliestMs = m;
    if (m > latestMs) latestMs = m;
  };
  for (const r of tables.temperature_log) touch(r.entry_date);
  for (const r of tables.temperature_log_indoor) {
    touch(r.start_date);
    touch(r.end_date);
  }
  for (const r of tables.iaq_log_indoor) touch(r.log_date);

  return {
    deviceCount: deviceHwids.size,
    locationCount: tables.measurement_locations.length,
    readingCount,
    earliestReadingAt: new Date(earliestMs).toISOString(),
    latestReadingAt: new Date(latestMs).toISOString(),
  };
}

function buildLocations(tables) {
  const byId = new Map();
  for (const l of tables.measurement_locations) {
    byId.set(l.id, {
      id: l.id,
      name: l.name,
      description: l.desc,
      currentDeviceHwid: null,
      currentDeviceSince: null,
    });
  }
  // Active assignment per location = device_usage_history row with null end_date,
  // tiebreak by most recent start_date.
  for (const u of tables.device_usage_history) {
    if (u.end_date !== null) continue;
    if (u.location_id === null) continue;
    const loc = byId.get(u.location_id);
    if (!loc) continue;
    if (
      loc.currentDeviceSince === null ||
      tsToEpochMs(u.start_date) > tsToEpochMs(loc.currentDeviceSince.replace("T", " ").replace("Z", ""))
    ) {
      loc.currentDeviceHwid = u.hwid;
      loc.currentDeviceSince = tsToIso(u.start_date);
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

function buildDevices(tables) {
  const lastSeenByHwid = new Map();
  const firstSeenByHwid = new Map();
  const touch = (hwid, ts) => {
    if (!hwid || !ts) return;
    const ms = tsToEpochMs(ts);
    if (!lastSeenByHwid.has(hwid) || ms > lastSeenByHwid.get(hwid)) lastSeenByHwid.set(hwid, ms);
    if (!firstSeenByHwid.has(hwid) || ms < firstSeenByHwid.get(hwid)) firstSeenByHwid.set(hwid, ms);
  };
  for (const r of tables.temperature_log) touch(r.hwid, r.entry_date);
  for (const r of tables.temperature_log_indoor) {
    touch(r.hwid, r.start_date);
    touch(r.hwid, r.end_date);
  }
  for (const r of tables.iaq_log_indoor) touch(r.hwid, r.log_date);

  const locById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));

  // Current location for a device = its row in device_usage_history with end_date null,
  // tiebreak by latest start_date.
  const currentAssignByHwid = new Map();
  for (const u of tables.device_usage_history) {
    if (u.end_date !== null) continue;
    const prev = currentAssignByHwid.get(u.hwid);
    if (!prev || tsToEpochMs(u.start_date) > tsToEpochMs(prev.start_date)) {
      currentAssignByHwid.set(u.hwid, u);
    }
  }

  const allHwids = new Set([
    ...lastSeenByHwid.keys(),
    ...tables.device_usage_history.map((u) => u.hwid),
  ]);

  return Array.from(allHwids)
    .sort()
    .map((hwid) => {
      const assign = currentAssignByHwid.get(hwid);
      return {
        hwid,
        currentLocationId: assign?.location_id ?? null,
        currentLocationName: assign ? locById.get(assign.location_id) ?? null : null,
        firstSeenAt: firstSeenByHwid.has(hwid)
          ? new Date(firstSeenByHwid.get(hwid)).toISOString()
          : null,
        lastSeenAt: lastSeenByHwid.has(hwid)
          ? new Date(lastSeenByHwid.get(hwid)).toISOString()
          : null,
      };
    });
}

function buildLatestReadings(tables) {
  const locById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));

  // For each location, find the latest indoor reading and latest IAQ reading
  // for the currently-assigned device.
  const byLocation = new Map();
  for (const l of tables.measurement_locations) {
    byLocation.set(l.id, {
      locationId: l.id,
      locationName: l.name,
      deviceHwid: null,
      timestamp: null,
      indoorTempC: null,
      humidityPct: null,
      pressureHpa: null,
      co2Ppm: null,
      breathVoc: null,
      iaqStatic: null,
    });
  }

  // Need the location of each reading at the time it was taken.
  for (const r of tables.temperature_log_indoor) {
    const locId = locationOfDeviceAt(tables.device_usage_history, r.hwid, r.end_date ?? r.start_date);
    if (locId === null) continue;
    const row = byLocation.get(locId);
    if (!row) continue;
    const ts = r.end_date ?? r.start_date;
    if (row.timestamp === null || tsToEpochMs(ts) > tsToEpochMs(row.timestamp.replace("T", " ").replace("Z", ""))) {
      row.timestamp = tsToIso(ts);
      row.deviceHwid = r.hwid;
      row.indoorTempC = r.temp;
      row.humidityPct = r.humidity;
      row.pressureHpa = r.pressure;
    }
  }
  for (const r of tables.iaq_log_indoor) {
    const locId = locationOfDeviceAt(tables.device_usage_history, r.hwid, r.log_date);
    if (locId === null) continue;
    const row = byLocation.get(locId);
    if (!row) continue;
    // Always update CO2 fields if this iaq reading is newer than any iaq we've
    // seen for this location; track separately so it doesn't fight with the
    // indoor-temp timestamp.
    if (
      row._co2At === undefined ||
      tsToEpochMs(r.log_date) > row._co2At
    ) {
      row._co2At = tsToEpochMs(r.log_date);
      row.co2Ppm = r.co2;
      row.breathVoc = r.breath_voc;
      row.iaqStatic = r.iaq_static;
      // also bump the headline timestamp forward if iaq is newer
      if (row.timestamp === null || row._co2At > tsToEpochMs(row.timestamp.replace("T", " ").replace("Z", ""))) {
        row.timestamp = new Date(row._co2At).toISOString();
      }
      // device hwid follows whatever has the latest reading
      if (!row.deviceHwid) row.deviceHwid = r.hwid;
    }
  }

  const out = Array.from(byLocation.values()).map((r) => {
    const { _co2At, ...rest } = r;
    return rest;
  });
  // Only return locations that have at least one reading.
  return out.filter((r) => r.timestamp !== null);
}

function buildTemperatureTrend(tables, daysBack = 30) {
  // Daily mean/min/max indoor temp per location, for the last N days of data.
  const locById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));

  // Anchor on max timestamp in temperature_log_indoor.
  let anchorMs = -Infinity;
  for (const r of tables.temperature_log_indoor) {
    const m = tsToEpochMs(r.end_date ?? r.start_date);
    if (m > anchorMs) anchorMs = m;
  }
  const windowStartMs = anchorMs - daysBack * 24 * 3600 * 1000;

  // Map of "date|locationId" -> { sum, min, max, count }
  const buckets = new Map();
  for (const r of tables.temperature_log_indoor) {
    if (r.temp === null) continue;
    const ts = r.end_date ?? r.start_date;
    const tsMs = tsToEpochMs(ts);
    if (tsMs < windowStartMs) continue;
    const locId = locationOfDeviceAt(tables.device_usage_history, r.hwid, ts);
    if (locId === null) continue;
    const key = `${dateOf(ts)}|${locId}`;
    let b = buckets.get(key);
    if (!b) {
      b = { date: dateOf(ts), locationId: locId, locationName: locById.get(locId), sum: 0, count: 0, min: Infinity, max: -Infinity };
      buckets.set(key, b);
    }
    b.sum += Number(r.temp);
    b.count++;
    if (r.temp < b.min) b.min = Number(r.temp);
    if (r.temp > b.max) b.max = Number(r.temp);
  }

  return Array.from(buckets.values())
    .map((b) => ({
      date: b.date,
      locationId: b.locationId,
      locationName: b.locationName,
      meanTempC: round(b.sum / b.count, 2),
      minTempC: round(b.min, 2),
      maxTempC: round(b.max, 2),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.locationId - b.locationId));
}

function buildIaqSummary(tables, daysBack = 30) {
  const locById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));

  let anchorMs = -Infinity;
  for (const r of tables.iaq_log_indoor) {
    const m = tsToEpochMs(r.log_date);
    if (m > anchorMs) anchorMs = m;
  }
  const windowStartMs = anchorMs - daysBack * 24 * 3600 * 1000;

  const buckets = new Map();
  for (const r of tables.iaq_log_indoor) {
    if (r.co2 === null) continue;
    const tsMs = tsToEpochMs(r.log_date);
    if (tsMs < windowStartMs) continue;
    const locId = locationOfDeviceAt(tables.device_usage_history, r.hwid, r.log_date);
    if (locId === null) continue;
    const key = `${dateOf(r.log_date)}|${locId}`;
    let b = buckets.get(key);
    if (!b) {
      b = { date: dateOf(r.log_date), locationId: locId, locationName: locById.get(locId), sum: 0, count: 0, peak: -Infinity };
      buckets.set(key, b);
    }
    b.sum += Number(r.co2);
    b.count++;
    if (r.co2 > b.peak) b.peak = Number(r.co2);
  }

  return Array.from(buckets.values())
    .map((b) => ({
      date: b.date,
      locationId: b.locationId,
      locationName: b.locationName,
      meanCo2Ppm: round(b.sum / b.count, 1),
      peakCo2Ppm: round(b.peak, 1),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.locationId - b.locationId));
}

// ---------- Main ----------

function writeJson(name, data) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(`  wrote ${path.relative(REPO_ROOT, file)} (${Array.isArray(data) ? data.length + " rows" : "object"})`);
}

function main() {
  if (!fs.existsSync(DUMP)) {
    console.error(`Dump not found: ${DUMP}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Parsing dump...");
  const t0 = Date.now();
  const tables = loadTables();
  const t1 = Date.now();
  console.log(`  parsed in ${t1 - t0}ms`);
  for (const [name, rows] of Object.entries(tables)) {
    console.log(`    ${name}: ${rows.length} rows`);
  }

  console.log("Aggregating & writing JSON...");
  writeJson("stats.json", buildStats(tables));
  writeJson("locations.json", buildLocations(tables));
  writeJson("devices.json", buildDevices(tables));
  writeJson("latest-readings.json", buildLatestReadings(tables));
  writeJson("temperature-trend.json", buildTemperatureTrend(tables, 30));
  writeJson("iaq-summary.json", buildIaqSummary(tables, 30));

  console.log(`Done in ${Date.now() - t0}ms.`);
}

main();
