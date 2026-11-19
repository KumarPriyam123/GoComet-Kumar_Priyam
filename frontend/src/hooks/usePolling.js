import { useCallback, useEffect, useRef, useState } from 'react';

// Loads data immediately, then again every `intervalMs`.
// If a refresh fails we keep showing the last good data along with the error.
export function usePolling(load, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, error, loading: !data && !error, refresh };
}
