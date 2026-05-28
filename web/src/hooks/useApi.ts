import { useEffect, useState } from "react";

type State<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ok"; data: T; error: null }
  | { status: "error"; data: null; error: string };

/**
 * Tiny fetch hook. Re-runs when `fetcher` identity changes — pass a stable
 * reference (e.g. an imported function) to avoid re-fetch loops.
 */
export function useApi<T>(fetcher: () => Promise<T>): State<T> {
  const [state, setState] = useState<State<T>>({
    status: "loading",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    fetcher()
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            data: null,
            error: e instanceof Error ? e.message : "Request failed",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return state;
}
