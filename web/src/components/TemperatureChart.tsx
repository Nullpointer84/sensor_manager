import { useCallback, useMemo } from "react";
import { fetchTemperatureTrend, type TemperatureTrendPoint } from "../api";
import { locationColor } from "../colors";
import { useApi } from "../hooks/useApi";
import LineChart, { type Series } from "./LineChart";

const dateTickFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default function TemperatureChart() {
  const fetcher = useCallback(() => fetchTemperatureTrend(), []);
  const state = useApi(fetcher);

  const series = useMemo(() => buildSeries(state.status === "ok" ? state.data : []), [state]);

  return (
    <section className="section">
      <header className="section-header">
        <h2>Indoor temperature trend</h2>
        <p>Daily mean temperature per location, last 30 days of recorded data.</p>
      </header>

      {state.status === "loading" && <p>Loading…</p>}
      {state.status === "error" && <p className="error">{state.error}</p>}
      {state.status === "ok" && (
        <LineChart
          series={series}
          yUnit=" °C"
          ariaLabel="Daily mean indoor temperature by location"
          xTickFormatter={(x) => dateTickFmt.format(new Date(x))}
        />
      )}
    </section>
  );
}

function buildSeries(points: TemperatureTrendPoint[]): Series[] {
  const byLocation = new Map<number, TemperatureTrendPoint[]>();
  for (const p of points) {
    const list = byLocation.get(p.locationId) ?? [];
    list.push(p);
    byLocation.set(p.locationId, list);
  }
  return Array.from(byLocation.entries()).map(([locationId, rows]) => ({
    name: rows[0]!.locationName,
    color: locationColor(locationId),
    data: rows.map((r) => ({
      x: new Date(r.date + "T00:00:00Z").getTime(),
      y: r.meanTempC,
    })),
  }));
}
