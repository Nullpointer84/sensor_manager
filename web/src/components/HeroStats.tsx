import { useCallback } from "react";
import { fetchStats } from "../api";
import { formatDate, formatNumber } from "../format";
import { useApi } from "../hooks/useApi";

export default function HeroStats() {
  const fetcher = useCallback(() => fetchStats(), []);
  const state = useApi(fetcher);

  return (
    <section className="hero">
      <div className="hero-inner">
        <p className="eyebrow">Indoor environment monitoring</p>
        <h1>
          Real-time visibility into the air you breathe<span className="accent">.</span>
        </h1>
        <p className="lede">
          Sensor Manager collects temperature, humidity, pressure and air-quality
          readings from low-power devices across every room — and turns them
          into trends you can act on.
        </p>

        {state.status === "loading" && <p className="hero-meta">Loading stats…</p>}
        {state.status === "error" && <p className="hero-meta error">{state.error}</p>}
        {state.status === "ok" && (
          <dl className="stat-row">
            <Stat label="Devices deployed" value={formatNumber(state.data.deviceCount)} />
            <Stat label="Locations" value={formatNumber(state.data.locationCount)} />
            <Stat label="Readings collected" value={formatNumber(state.data.readingCount)} />
            <Stat
              label="Range"
              value={`${formatDate(state.data.earliestReadingAt)} – ${formatDate(state.data.latestReadingAt)}`}
            />
          </dl>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dd>{value}</dd>
      <dt>{label}</dt>
    </div>
  );
}
