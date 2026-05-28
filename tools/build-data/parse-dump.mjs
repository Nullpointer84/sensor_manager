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

/** Trend / IAQ chart window, in days back from the latest timestamp in the data. */
const TREND_WINDOW_DAYS = 30;

// Column order for each INSERT we care about. Used to map positional VALUES
// tuples into named row objects.
const SCHEMA = {
  measurement_locations: ["id", "name", "desc"],
  device_usage_history: ["id", "hwid", "location_id", "start_date", "end_date"],
  temperature_log: ["entry_date", "hwid", "temp", "temp1"],
  temperature_log_updated: ["id", "start_date", "end_date", "hwid", "temp", "temp1"],
  temperature_log_indoor: ["id", "hwid", "start_date", "end_date", "temp", "humidity", "pressure"],
  iaq_log_indoor: ["id", "hwid", "log_date", "accuracy", "iaq_static", "co2", "breath_voc", "gas_percentage"],
};

// =====================================================================
// SQL tokenizer (NULL | quoted string | number)
// =====================================================================

function parseSqlValue(s, i) {
  if (s.startsWith("NULL", i)) return [null, i + 4];
  if (s[i] === "'") return parseSqlString(s, i);
  return parseSqlNumber(s, i);
}

function parseSqlString(s, i) {
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
  throw new Error("Unterminated SQL string literal");
}

function parseSqlNumber(s, i) {
  let j = i;
  if (s[j] === "-") j++;
  while (j < s.length && /[0-9.]/.test(s[j])) j++;
  return [Number(s.substring(i, j)), j];
}

/** Parses a VALUES blob like `(1,'a',NULL),(2,'b',3.14)` into an array of value arrays. */
function parseValuesBlob(s) {
  const rows = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] !== "(") throw new Error(`Expected '(' at position ${i}, got '${s[i]}'`);
    i++;
    const row = [];
    while (true) {
      const [v, next] = parseSqlValue(s, i);
      row.push(v);
      i = next;
      if (s[i] === ",") { i++; continue; }
      if (s[i] === ")") { i++; break; }
      throw new Error(`Expected ',' or ')' at position ${i}, got '${s[i]}'`);
    }
    rows.push(row);
    if (i < s.length && s[i] === ",") { i++; continue; }
    break;
  }
  return rows;
}

// =====================================================================
// Dump file -> in-memory tables
// =====================================================================

function loadTables() {
  if (!fs.existsSync(DUMP)) {
    throw new Error(`Dump not found: ${DUMP}`);
  }
  const content = fs.readFileSync(DUMP, "utf8");

  const tables = {};
  for (const name of Object.keys(SCHEMA)) tables[name] = [];

  const insertRe = /^INSERT INTO `(\w+)` VALUES (.+);$/;
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(insertRe);
    if (!m) continue;
    const [, tableName, valuesBlob] = m;
    const columns = SCHEMA[tableName];
    if (!columns) continue;
    for (const valueTuple of parseValuesBlob(valuesBlob)) {
      const row = {};
      for (let k = 0; k < columns.length; k++) row[columns[k]] = valueTuple[k];
      tables[tableName].push(row);
    }
  }
  return tables;
}

// =====================================================================
// Time helpers
//
// MySQL dump timestamps are "YYYY-MM-DD HH:MM:SS" without zone. The original
// deployment was a single household/lab; we treat them as UTC throughout.
// =====================================================================

function mysqlTsToMs(ts) {
  return ts === null ? null : new Date(ts.replace(" ", "T") + "Z").getTime();
}

function msToIso(ms) {
  return ms === null ? null : new Date(ms).toISOString();
}

function msToDateString(ms) {
  // "YYYY-MM-DD" of the UTC day containing this epoch.
  return new Date(ms).toISOString().substring(0, 10);
}

// =====================================================================
// Usage history: pre-index by hwid with epoch-ms boundaries.
// Every reading lookup goes through this index, so we parse timestamps once.
// =====================================================================

/**
 * @typedef {{ hwid: string, locationId: number|null, startMs: number, endMs: number }} UsageInterval
 * endMs is Infinity for an open (active) assignment.
 */

/** Returns a Map<hwid, UsageInterval[]>, each list sorted by startMs. */
function indexUsageByHwid(usageRows) {
  const byHwid = new Map();
  for (const u of usageRows) {
    const interval = {
      hwid: u.hwid,
      locationId: u.location_id,
      startMs: mysqlTsToMs(u.start_date),
      endMs: u.end_date === null ? Infinity : mysqlTsToMs(u.end_date),
    };
    const list = byHwid.get(u.hwid) ?? [];
    list.push(interval);
    byHwid.set(u.hwid, list);
  }
  for (const list of byHwid.values()) list.sort((a, b) => a.startMs - b.startMs);
  return byHwid;
}

/** Returns the locationId the device with `hwid` was assigned to at `tsMs`, or null. */
function locationOfDeviceAtMs(usageByHwid, hwid, tsMs) {
  const list = usageByHwid.get(hwid);
  if (!list) return null;
  for (const u of list) {
    if (u.startMs <= tsMs && tsMs <= u.endMs) return u.locationId;
  }
  return null;
}

// =====================================================================
// Small numeric helpers
// =====================================================================

function round(n, places) {
  if (n === null || n === undefined) return null;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function mean(xs) {
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

// =====================================================================
// Generic daily aggregator: groups readings by (date, location) and lets the
// caller decide what stats to compute via `makePoint`.
// =====================================================================

/**
 * @param {object[]} rows  raw reading rows; must have a `hwid` field
 * @param {object} options
 * @param {(row: object) => number|null} options.extractTsMs   epoch ms of the row, or null to skip
 * @param {(row: object) => number|null} options.extractValue  value to aggregate, or null to skip
 * @param {number} options.daysBack                            window size relative to the data's max ts
 * @param {Map<string, UsageInterval[]>} options.usageByHwid
 * @param {Map<number, string>} options.locationNameById
 * @param {(bucket: {date: string, locationId: number, locationName: string, values: number[]}) => object} options.makePoint
 */
function dailyAggregateByLocation(rows, options) {
  const { extractTsMs, extractValue, daysBack, usageByHwid, locationNameById, makePoint } = options;

  // First pass: find the anchor (max timestamp). Done regardless of whether
  // the value is null, so that a window doesn't shift when values are missing.
  let anchorMs = -Infinity;
  for (const r of rows) {
    const tsMs = extractTsMs(r);
    if (tsMs !== null && tsMs > anchorMs) anchorMs = tsMs;
  }
  if (anchorMs === -Infinity) return [];
  const windowStartMs = anchorMs - daysBack * 24 * 3600 * 1000;

  // Second pass: bucket by (date, location).
  const buckets = new Map();
  for (const r of rows) {
    const tsMs = extractTsMs(r);
    if (tsMs === null || tsMs < windowStartMs) continue;
    const value = extractValue(r);
    if (value === null) continue;
    const locId = locationOfDeviceAtMs(usageByHwid, r.hwid, tsMs);
    if (locId === null) continue;

    const date = msToDateString(tsMs);
    const key = `${date}|${locId}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date, locationId: locId, locationName: locationNameById.get(locId), values: [] };
      buckets.set(key, bucket);
    }
    bucket.values.push(Number(value));
  }

  return Array.from(buckets.values())
    .map(makePoint)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.locationId - b.locationId));
}

// =====================================================================
// Aggregations: stats
// =====================================================================

function buildStats(tables) {
  const distinctHwids = new Set();
  for (const u of tables.device_usage_history) distinctHwids.add(u.hwid);

  const readingCount =
    tables.temperature_log.length +
    tables.temperature_log_indoor.length +
    tables.iaq_log_indoor.length;

  let earliestMs = Infinity;
  let latestMs = -Infinity;
  const acceptTs = (ts) => {
    const ms = mysqlTsToMs(ts);
    if (ms === null) return;
    if (ms < earliestMs) earliestMs = ms;
    if (ms > latestMs) latestMs = ms;
  };
  for (const r of tables.temperature_log) acceptTs(r.entry_date);
  for (const r of tables.temperature_log_indoor) {
    acceptTs(r.start_date);
    acceptTs(r.end_date);
  }
  for (const r of tables.iaq_log_indoor) acceptTs(r.log_date);

  return {
    deviceCount: distinctHwids.size,
    locationCount: tables.measurement_locations.length,
    readingCount,
    earliestReadingAt: msToIso(earliestMs),
    latestReadingAt: msToIso(latestMs),
  };
}

// =====================================================================
// Aggregations: locations
// =====================================================================

function buildLocations(tables) {
  // Start with one entry per location.
  const byId = new Map();
  for (const loc of tables.measurement_locations) {
    byId.set(loc.id, {
      id: loc.id,
      name: loc.name,
      description: loc.desc,
      currentDeviceHwid: null,
      currentDeviceSinceMs: -Infinity,
    });
  }

  // Current device per location = open (end_date IS NULL) assignment with
  // the latest start_date.
  for (const u of tables.device_usage_history) {
    if (u.end_date !== null || u.location_id === null) continue;
    const loc = byId.get(u.location_id);
    if (!loc) continue;
    const startMs = mysqlTsToMs(u.start_date);
    if (startMs > loc.currentDeviceSinceMs) {
      loc.currentDeviceHwid = u.hwid;
      loc.currentDeviceSinceMs = startMs;
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => a.id - b.id)
    .map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      currentDeviceHwid: l.currentDeviceHwid,
      currentDeviceSince: l.currentDeviceSinceMs === -Infinity ? null : msToIso(l.currentDeviceSinceMs),
    }));
}

// =====================================================================
// Aggregations: devices
// =====================================================================

function buildDevices(tables, usageByHwid) {
  const locationNameById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));

  // First/last seen per device, scanned across all reading tables.
  const firstSeenByHwid = new Map();
  const lastSeenByHwid = new Map();
  const observeReading = (hwid, ts) => {
    const ms = mysqlTsToMs(ts);
    if (!hwid || ms === null) return;
    if (!firstSeenByHwid.has(hwid) || ms < firstSeenByHwid.get(hwid)) firstSeenByHwid.set(hwid, ms);
    if (!lastSeenByHwid.has(hwid) || ms > lastSeenByHwid.get(hwid)) lastSeenByHwid.set(hwid, ms);
  };
  for (const r of tables.temperature_log) observeReading(r.hwid, r.entry_date);
  for (const r of tables.temperature_log_indoor) {
    observeReading(r.hwid, r.start_date);
    observeReading(r.hwid, r.end_date);
  }
  for (const r of tables.iaq_log_indoor) observeReading(r.hwid, r.log_date);

  // Current location = the open (endMs === Infinity) interval with the latest startMs.
  const currentLocationByHwid = new Map();
  for (const [hwid, intervals] of usageByHwid) {
    let best = null;
    for (const u of intervals) {
      if (u.endMs !== Infinity) continue;
      if (!best || u.startMs > best.startMs) best = u;
    }
    if (best) currentLocationByHwid.set(hwid, best.locationId);
  }

  const allHwids = new Set([...lastSeenByHwid.keys(), ...usageByHwid.keys()]);
  return Array.from(allHwids)
    .sort()
    .map((hwid) => {
      const currentLocationId = currentLocationByHwid.get(hwid) ?? null;
      return {
        hwid,
        currentLocationId,
        currentLocationName:
          currentLocationId === null ? null : locationNameById.get(currentLocationId) ?? null,
        firstSeenAt: firstSeenByHwid.has(hwid) ? msToIso(firstSeenByHwid.get(hwid)) : null,
        lastSeenAt: lastSeenByHwid.has(hwid) ? msToIso(lastSeenByHwid.get(hwid)) : null,
      };
    });
}

// =====================================================================
// Aggregations: latest readings per location
// =====================================================================

/** Latest temperature_log_indoor reading attributed to each location. */
function latestIndoorPerLocation(indoorRows, usageByHwid) {
  const latestByLoc = new Map();
  for (const r of indoorRows) {
    const tsMs = mysqlTsToMs(r.end_date ?? r.start_date);
    if (tsMs === null) continue;
    const locId = locationOfDeviceAtMs(usageByHwid, r.hwid, tsMs);
    if (locId === null) continue;
    const prev = latestByLoc.get(locId);
    if (!prev || tsMs > prev.tsMs) {
      latestByLoc.set(locId, {
        tsMs,
        hwid: r.hwid,
        indoorTempC: r.temp,
        humidityPct: r.humidity,
        pressureHpa: r.pressure,
      });
    }
  }
  return latestByLoc;
}

/** Latest iaq_log_indoor reading attributed to each location. */
function latestIaqPerLocation(iaqRows, usageByHwid) {
  const latestByLoc = new Map();
  for (const r of iaqRows) {
    const tsMs = mysqlTsToMs(r.log_date);
    if (tsMs === null) continue;
    const locId = locationOfDeviceAtMs(usageByHwid, r.hwid, tsMs);
    if (locId === null) continue;
    const prev = latestByLoc.get(locId);
    if (!prev || tsMs > prev.tsMs) {
      latestByLoc.set(locId, {
        tsMs,
        hwid: r.hwid,
        co2Ppm: r.co2,
        breathVoc: r.breath_voc,
        iaqStatic: r.iaq_static,
      });
    }
  }
  return latestByLoc;
}

/** Combines indoor + IAQ latest readings per location into the final output shape. */
function mergeLatestReadings(locations, latestIndoorByLoc, latestIaqByLoc) {
  const out = [];
  for (const loc of locations) {
    const indoor = latestIndoorByLoc.get(loc.id);
    const iaq = latestIaqByLoc.get(loc.id);
    if (!indoor && !iaq) continue;

    // The headline timestamp/device is whichever source is most recent.
    const headline = indoor && iaq ? (indoor.tsMs >= iaq.tsMs ? indoor : iaq) : (indoor ?? iaq);

    out.push({
      locationId: loc.id,
      locationName: loc.name,
      deviceHwid: headline.hwid,
      timestamp: msToIso(headline.tsMs),
      indoorTempC: indoor?.indoorTempC ?? null,
      humidityPct: indoor?.humidityPct ?? null,
      pressureHpa: indoor?.pressureHpa ?? null,
      co2Ppm: iaq?.co2Ppm ?? null,
      breathVoc: iaq?.breathVoc ?? null,
      iaqStatic: iaq?.iaqStatic ?? null,
    });
  }
  return out;
}

function buildLatestReadings(tables, usageByHwid) {
  const latestIndoor = latestIndoorPerLocation(tables.temperature_log_indoor, usageByHwid);
  const latestIaq = latestIaqPerLocation(tables.iaq_log_indoor, usageByHwid);
  return mergeLatestReadings(tables.measurement_locations, latestIndoor, latestIaq);
}

// =====================================================================
// Aggregations: temperature trend & CO2 summary
// (both via dailyAggregateByLocation)
// =====================================================================

function buildTemperatureTrend(tables, usageByHwid) {
  const locationNameById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));
  return dailyAggregateByLocation(tables.temperature_log_indoor, {
    extractTsMs: (r) => mysqlTsToMs(r.end_date ?? r.start_date),
    extractValue: (r) => r.temp,
    daysBack: TREND_WINDOW_DAYS,
    usageByHwid,
    locationNameById,
    makePoint: ({ date, locationId, locationName, values }) => ({
      date,
      locationId,
      locationName,
      meanTempC: round(mean(values), 2),
      minTempC: round(Math.min(...values), 2),
      maxTempC: round(Math.max(...values), 2),
    }),
  });
}

function buildIaqSummary(tables, usageByHwid) {
  const locationNameById = new Map(tables.measurement_locations.map((l) => [l.id, l.name]));
  return dailyAggregateByLocation(tables.iaq_log_indoor, {
    extractTsMs: (r) => mysqlTsToMs(r.log_date),
    extractValue: (r) => r.co2,
    daysBack: TREND_WINDOW_DAYS,
    usageByHwid,
    locationNameById,
    makePoint: ({ date, locationId, locationName, values }) => ({
      date,
      locationId,
      locationName,
      meanCo2Ppm: round(mean(values), 1),
      peakCo2Ppm: round(Math.max(...values), 1),
    }),
  });
}

// =====================================================================
// Main
// =====================================================================

function writeJson(name, data) {
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  const size = Array.isArray(data) ? `${data.length} rows` : "object";
  console.log(`  wrote ${path.relative(REPO_ROOT, file)} (${size})`);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Parsing dump...");
  const t0 = Date.now();
  const tables = loadTables();
  console.log(`  parsed in ${Date.now() - t0}ms`);
  for (const [name, rows] of Object.entries(tables)) {
    console.log(`    ${name}: ${rows.length} rows`);
  }

  // Pre-index usage history once — every reading-vs-location lookup uses this.
  const usageByHwid = indexUsageByHwid(tables.device_usage_history);

  console.log("Aggregating & writing JSON...");
  writeJson("stats.json", buildStats(tables));
  writeJson("locations.json", buildLocations(tables));
  writeJson("devices.json", buildDevices(tables, usageByHwid));
  writeJson("latest-readings.json", buildLatestReadings(tables, usageByHwid));
  writeJson("temperature-trend.json", buildTemperatureTrend(tables, usageByHwid));
  writeJson("iaq-summary.json", buildIaqSummary(tables, usageByHwid));

  console.log(`Done in ${Date.now() - t0}ms.`);
}

main();
