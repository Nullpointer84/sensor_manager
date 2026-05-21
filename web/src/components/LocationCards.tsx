import { useCallback } from "react";
import { fetchLatestReadings, type LatestReading } from "../api";
import { formatDateTime, formatMetric } from "../format";
import { useApi } from "../hooks/useApi";
import { locationColor } from "../colors";

export default function LocationCards() {
  const fetcher = useCallback(() => fetchLatestReadings(), []);
  const state = useApi(fetcher);

  return (
    <section className="section">
      <header className="section-header">
        <h2>Latest readings</h2>
        <p>One snapshot per location, taken from the most recently reporting device.</p>
      </header>

      {state.status === "loading" && <p>Loading…</p>}
      {state.status === "error" && <p className="error">{state.error}</p>}
      {state.status === "ok" && (
        <div className="card-grid">
          {state.data.map((r) => (
            <LocationCard key={r.locationId} reading={r} />
          ))}
        </div>
      )}
    </section>
  );
}

function LocationCard({ reading }: { reading: LatestReading }) {
  const accent = locationColor(reading.locationId);
  return (
    <article className="card" style={{ borderTopColor: accent }}>
      <header>
        <h3>{reading.locationName}</h3>
        {reading.timestamp && (
          <time dateTime={reading.timestamp}>{formatDateTime(reading.timestamp)}</time>
        )}
      </header>
      <dl className="card-metrics">
        <Metric label="Temperature" value={formatMetric(reading.indoorTempC, " °C", 1)} />
        <Metric label="Humidity" value={formatMetric(reading.humidityPct, " %", 1)} />
        <Metric label="Pressure" value={formatMetric(reading.pressureHpa, " hPa", 1)} />
        <Metric label="CO₂" value={formatMetric(reading.co2Ppm, " ppm", 0)} />
      </dl>
      {reading.deviceHwid && <footer className="card-foot">Device {reading.deviceHwid}</footer>}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
