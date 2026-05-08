import { useEffect, useState } from "react";
import { fetchSensors, type Sensor } from "./api";

export default function App() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSensors()
      .then(setSensors)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "failed to load"));
  }, []);

  return (
    <main>
      <h1>Sensor Manager</h1>
      {error && <p role="alert">{error}</p>}
      <ul>
        {sensors.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong> — {s.location ?? "unknown"} —{" "}
            {s.online ? "online" : "offline"}
          </li>
        ))}
      </ul>
    </main>
  );
}
