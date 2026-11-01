import { useState, useEffect } from "react";
import { Activity, RefreshCw, Workflow } from "lucide-react";
import { useDashboardRefreshInterval } from "../hooks/dashboardPreferences";

export default function WorkersPage() {
  const refreshInterval = useDashboardRefreshInterval();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadWorkers(showLoading = true) {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const response = await fetch("/workers");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load workers.");
      if (!Array.isArray(data)) throw new Error("Unexpected response from GET /workers.");
      setWorkers(data);
    } catch (loadError) {
      setError(loadError.message || "Could not load workers.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkers();
    const intervalId = setInterval(() => loadWorkers(false), refreshInterval);
    return () => clearInterval(intervalId);
  }, [refreshInterval]);

  const onlineWorkers = workers.filter((worker) => {
    const heartbeatAge = worker.lastHeartbeat ? Date.now() - new Date(worker.lastHeartbeat).getTime() : Infinity;
    return !worker.stoppedAt && heartbeatAge <= 15000;
  });
  const runningJobs = onlineWorkers.reduce((total, worker) => total + Number(worker.runningJobs || 0), 0);

  function heartbeatLabel(value) {
    if (!value) return "No heartbeat recorded";
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
    if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
    return new Date(value).toLocaleString();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-violet-300">WORKSPACE / WORKERS</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Workers</h1>
          <p className="mt-2 text-sm text-slate-400">Monitor workers currently processing jobs and their latest heartbeats.</p>
        </div>
        <button onClick={() => loadWorkers()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-panel px-3 py-2.5 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5">
          <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">Online workers</p>
            <Workflow size={18} className="text-violet-300" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{onlineWorkers.length}</p>
          <p className="mt-2 text-xs text-slate-500">Workers sending recent heartbeats</p>
        </div>
        <div className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Jobs in progress</p>
            <Activity size={18} className="text-blue-300" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-white">{runningJobs}</p>
          <p className="mt-2 text-xs text-slate-500">Assigned to currently processing workers</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-panel">
        <div className="border-b border-dashboard-border px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-white">Worker activity</h2>
          <p className="mt-1 text-xs text-slate-500">Updated automatically every 5 seconds</p>
        </div>
        {error ? (
          <div className="p-8 text-center text-sm text-rose-300">{error}</div>
        ) : loading && workers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading workers...</div>
        ) : workers.length === 0 ? (
          <div className="p-10 text-center">
            <Workflow size={24} className="mx-auto text-slate-500" />
            <p className="mt-3 text-sm font-medium text-slate-300">No workers are processing jobs</p>
            <p className="mt-1 text-xs text-slate-500">Workers appear here while they hold running jobs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left">
              <thead className="bg-[#0D1322]">
                <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Worker</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Running jobs</th>
                  <th className="px-4 py-3.5">Current jobs</th>
                  <th className="px-5 py-3.5">Last heartbeat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashboard-border/70">
                {workers.map((worker) => {
                  const heartbeatAge = worker.lastHeartbeat ? Date.now() - new Date(worker.lastHeartbeat).getTime() : Infinity;
                  const isResponsive = !worker.stoppedAt && heartbeatAge <= 15000;
                  const isOffline = Boolean(worker.stoppedAt);
                  const badgeStyle = isResponsive
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                    : isOffline
                      ? "border-slate-600 bg-slate-700/40 text-slate-400"
                      : "border-amber-400/20 bg-amber-400/10 text-amber-300";
                  return (
                    <tr key={worker.workerId} className="align-top hover:bg-slate-800/30">
                      <td className="px-5 py-4 font-mono text-xs text-slate-200">{worker.workerId}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-semibold ${badgeStyle}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isResponsive ? "bg-emerald-400" : isOffline ? "bg-slate-400" : "bg-amber-400"}`} />
                          {isResponsive ? "ONLINE" : isOffline ? "OFFLINE" : "HEARTBEAT DELAYED"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm tabular-nums text-slate-300">{worker.runningJobs}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          {(worker.jobs || []).map((job) => (
                            <div key={job.id} className="text-xs text-slate-300">
                              <span className="font-medium">{job.type}</span>
                              <span className="ml-2 font-mono text-[10px] text-slate-500">#{job.id}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400">{isOffline ? `Stopped ${heartbeatLabel(worker.stoppedAt)}` : heartbeatLabel(worker.lastHeartbeat)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
