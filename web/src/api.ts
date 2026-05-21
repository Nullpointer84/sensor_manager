// Typed REST client for /api/landing/*. The UI only talks to this module —
// it has no idea whether the backend reads from JSON snapshots or a database.

export type SensorStats = {
  deviceCount: number;
  locationCount: number;
  readingCount: number;
  earliestReadingAt: string;
  latestReadingAt: string;
};

export type Location = {
  id: number;
  name: string;
  description: string | null;
  currentDeviceHwid: string | null;
  currentDeviceSince: string | null;
};

export type Device = {
  hwid: string;
  currentLocationId: number | null;
  currentLocationName: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
};

export type LatestReading = {
  locationId: number;
  locationName: string;
  deviceHwid: string | null;
  timestamp: string | null;
  indoorTempC: number | null;
  humidityPct: number | null;
  pressureHpa: number | null;
  co2Ppm: number | null;
  breathVoc: number | null;
  iaqStatic: number | null;
};

export type TemperatureTrendPoint = {
  date: string; // YYYY-MM-DD
  locationId: number;
  locationName: string;
  meanTempC: number;
  minTempC: number;
  maxTempC: number;
};

export type Co2SummaryPoint = {
  date: string; // YYYY-MM-DD
  locationId: number;
  locationName: string;
  meanCo2Ppm: number;
  peakCo2Ppm: number;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchStats = () => get<SensorStats>("/api/landing/stats");
export const fetchLocations = () => get<Location[]>("/api/landing/locations");
export const fetchDevices = () => get<Device[]>("/api/landing/devices");
export const fetchLatestReadings = () => get<LatestReading[]>("/api/landing/latest-readings");
export const fetchTemperatureTrend = () =>
  get<TemperatureTrendPoint[]>("/api/landing/temperature-trend");
export const fetchCo2Summary = () => get<Co2SummaryPoint[]>("/api/landing/co2-summary");
