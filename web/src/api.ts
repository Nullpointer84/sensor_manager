export type Sensor = {
  id: string;
  name: string;
  location: string | null;
  online: boolean;
  lastSeenAt: string | null;
};

export async function fetchSensors(): Promise<Sensor[]> {
  const res = await fetch("/api/sensors");
  if (!res.ok) throw new Error(`GET /api/sensors failed: ${res.status}`);
  return res.json();
}
