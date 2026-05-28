// Locale-aware formatters shared by the landing components.

const numberFmt = new Intl.NumberFormat("en-US");
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatNumber = (n: number) => numberFmt.format(n);

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));

export function formatMetric(value: number | null, suffix: string, digits = 1) {
  if (value === null || value === undefined) return "—";
  return `${value.toFixed(digits)}${suffix}`;
}
