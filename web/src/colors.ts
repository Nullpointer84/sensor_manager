// Centralized color palette so charts and cards stay in sync.

const palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export function locationColor(locationId: number): string {
  // stable mapping; deterministic by id
  return palette[(locationId - 1) % palette.length] ?? palette[0]!;
}
