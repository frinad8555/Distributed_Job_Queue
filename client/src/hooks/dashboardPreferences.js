import { useEffect, useState } from "react";

const REFRESH_INTERVAL_KEY = "queueflow-refresh-interval";
export const DEFAULT_REFRESH_INTERVAL = 5000;

function readRefreshInterval() {
  try {
    const savedValue = Number(window.localStorage.getItem(REFRESH_INTERVAL_KEY));
    return [5000, 10000, 30000].includes(savedValue) ? savedValue : DEFAULT_REFRESH_INTERVAL;
  } catch {
    return DEFAULT_REFRESH_INTERVAL;
  }
}

export function useDashboardRefreshInterval() {
  const [refreshInterval, setRefreshInterval] = useState(readRefreshInterval);

  useEffect(() => {
    const update = () => setRefreshInterval(readRefreshInterval());
    window.addEventListener("queueflow-settings-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("queueflow-settings-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return refreshInterval;
}

export function saveRefreshInterval(value) {
  try {
    window.localStorage.setItem(REFRESH_INTERVAL_KEY, String(value));
  } catch {
    // Keep the preference active for this session when storage is unavailable.
  }
  window.dispatchEvent(new Event("queueflow-settings-change"));
}
