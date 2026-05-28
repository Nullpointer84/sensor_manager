// Zero-dependency multi-series line chart rendered as inline SVG.
// Scales to its container via viewBox + CSS width 100%.

export type SeriesPoint = { x: number; y: number };

export type Series = {
  name: string;
  color: string;
  data: SeriesPoint[];
};

type Props = {
  series: Series[];
  yUnit?: string;
  xTickFormatter?: (x: number) => string;
  yTickFormatter?: (y: number) => string;
  /** Number of horizontal grid lines / Y ticks. Default 4. */
  yTicks?: number;
  /** Approximate number of X ticks. Default 5. */
  xTicks?: number;
  ariaLabel?: string;
};

const W = 800;
const H = 320;
const PAD_L = 56;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 36;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

export default function LineChart({
  series,
  yUnit = "",
  xTickFormatter = (x) => String(x),
  yTickFormatter = (y) => y.toFixed(1),
  yTicks = 4,
  xTicks = 5,
  ariaLabel,
}: Props) {
  const allPoints = series.flatMap((s) => s.data);
  if (allPoints.length === 0) {
    return <div className="chart-empty">No data to display.</div>;
  }

  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  // pad Y range so lines aren't flush with the top/bottom
  const yPad = (yMax - yMin) * 0.08 || 1;
  yMin -= yPad;
  yMax += yPad;

  const xScale = (x: number) =>
    PAD_L + ((x - xMin) / (xMax - xMin || 1)) * PLOT_W;
  const yScale = (y: number) =>
    PAD_T + (1 - (y - yMin) / (yMax - yMin || 1)) * PLOT_H;

  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    yMin + ((yMax - yMin) * i) / yTicks,
  );

  const xTickValues = Array.from({ length: xTicks }, (_, i) =>
    xMin + ((xMax - xMin) * i) / (xTicks - 1),
  );

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel ?? "Line chart"}
        preserveAspectRatio="none"
      >
        {/* Y gridlines + labels */}
        {yTickValues.map((yt, i) => {
          const y = yScale(yt);
          return (
            <g key={`y-${i}`} className="chart-grid">
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} />
              <text x={PAD_L - 8} y={y} dy="0.32em" textAnchor="end">
                {yTickFormatter(yt)}
                {yUnit}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {xTickValues.map((xt, i) => {
          const x = xScale(xt);
          return (
            <g key={`x-${i}`} className="chart-grid">
              <line x1={x} x2={x} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H + 4} />
              <text x={x} y={PAD_T + PLOT_H + 18} textAnchor="middle">
                {xTickFormatter(xt)}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {series.map((s) => {
          if (s.data.length === 0) return null;
          const d = s.data
            .slice()
            .sort((a, b) => a.x - b.x)
            .map((p, i) => `${i === 0 ? "M" : "L"}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={s.name}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name} className="chart-legend-item">
            <span className="chart-legend-swatch" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
