import { useCallback, useMemo } from "react";
import { fetchCo2Summary, type Co2SummaryPoint } from "../api";
import { locationColor } from "../colors";
import { useApi } from "../hooks/useApi";
import LineChart, { type Series } from "./LineChart";

const dateTickFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export default function Co2Chart() {
  const fetcher = useCallback(() => fetchCo2Summary(), []);
  const state = useApi(fetcher);

  const series = useMemo(() => buildSeries(state.status === "ok" ? state.data : []), [state]);

  return (
    <section id="air" className="section">
      <header className="section-header">
        <h2>Air quality (CO₂)</h2>
        <p>Daily mean CO₂ concentration per location. Lower is better — values above 1,000 ppm indicate poor ventilation.</p>
      </header>

      {state.status === "loading" && <p>Loading…</p>}
      {state.status === "error" && <p className="error">{state.error}</p>}
      {state.status === "ok" && series.length === 0 && (
        <p className="muted">No CO₂ readings in the selected window.</p>
      )}
      {state.status === "ok" && series.length > 0 && (
        <LineChart
          series={series}
          yUnit=" ppm"
          ariaLabel="Daily mean CO2 by location"
          xTickFormatter={(x) => dateTickFmt.format(new Date(x))}
          yTickFormatter={(y) => Math.round(y).toString()}
        />
      )}
    </section>
  );
}

function buildSeries(points: Co2SummaryPoint[]): Series[] {
  const byLocation = new Map<number, Co2SummaryPoint[]>();
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
      y: r.meanCo2Ppm,
    })),
  }));
}
