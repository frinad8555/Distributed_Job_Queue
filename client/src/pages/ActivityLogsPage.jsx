import { useState, useEffect } from "react";
import { Activity, RefreshCw, Search, XCircle } from "lucide-react";
import { useDashboardRefreshInterval } from "../hooks/dashboardPreferences";

export default function ActivityLogsPage() {
  const refreshInterval = useDashboardRefreshInterval();
  const [range, setRange] = useState("24h");
  const [eventType, setEventType] = useState("ALL");
  const [jobStatus, setJobStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [page, setPage] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ events: [], total: 0, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadLogs(showLoading = true) {
      if (showLoading && active) setLoading(true);
      const params = new URLSearchParams({
        range,
        type: eventType,
        status: jobStatus,
        search: search.trim(),
        workerId: workerId.trim(),
        limit: String(result.limit),
        offset: String(page * result.limit),
      });

      try {
        const response = await fetch(`/activity-logs?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load activity logs.");
        if (active) {
          setResult(data);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load activity logs.");
      } finally {
        if (active && showLoading) setLoading(false);
      }
    }

    const debounce = setTimeout(() => loadLogs(), 250);
    const intervalId = setInterval(() => loadLogs(false), refreshInterval);
    return () => {
      active = false;
      clearTimeout(debounce);
      clearInterval(intervalId);
    };
  }, [range, eventType, jobStatus, search, workerId, page, result.limit, refreshKey, refreshInterval]);

  const eventLabels = {
    queued: "Job queued",
    started: "Job started",
    completed: "Job completed",
    retry_queued: "Job requeued",
    dead_lettered: "Moved to dead-letter",
    recovered: "Job recovered",
    worker_started: "Worker started",
    worker_heartbeat: "Worker heartbeat",
    worker_stopped: "Worker stopped",
  };
  const eventStyles = {
    completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    started: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    queued: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    retry_queued: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    dead_lettered: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    recovered: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
  };
  const pageCount = Math.max(1, Math.ceil(result.total / result.limit));
  const firstRow = result.total ? page * result.limit + 1 : 0;
  const lastRow = Math.min((page + 1) * result.limit, result.total);

  function eventSummary(event) {
    if (event.details?.error) return event.details.error;
    if (event.details?.source === "manual") return "Manually requeued";
    if (event.details?.source) return `Source: ${event.details.source}`;
    if (event.details?.retryCount) return `Retry ${event.details.retryCount}; delay ${event.details.delaySeconds}s`;
    return "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-violet-300">OBSERVABILITY / ACTIVITY LOGS</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Activity logs</h1>
          <p className="mt-2 text-sm text-slate-400">A searchable timeline of job and worker events. Worker heartbeats are sampled once per minute; history starts when event tracking is enabled.</p>
        </div>
        <button onClick={() => { setPage(0); setError(""); setRefreshKey((key) => key + 1); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-panel px-3 py-2.5 text-xs font-medium text-slate-300 hover:text-white">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-panel">
        <div className="grid grid-cols-1 gap-3 border-b border-dashboard-border p-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="block text-xs text-slate-500">Search job ID or type
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search job ID or type..." className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-400" />
          </label>
          <label className="block text-xs text-slate-500">Worker ID
            <input value={workerId} onChange={(event) => { setWorkerId(event.target.value); setPage(0); }} placeholder="Filter by worker..." className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-violet-400" />
          </label>
          <label className="block text-xs text-slate-500">Event type
            <select value={eventType} onChange={(event) => { setEventType(event.target.value); setPage(0); }} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none">
              <option value="ALL">All events</option>
              {Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-xs text-slate-500">Current job status
            <select value={jobStatus} onChange={(event) => { setJobStatus(event.target.value); setPage(0); }} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none">
              <option value="ALL">All statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="DEAD_LETTER">Dead-letter</option>
            </select>
          </label>
          <label className="block text-xs text-slate-500">Time range
            <select value={range} onChange={(event) => { setRange(event.target.value); setPage(0); }} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none">
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
        </div>

        {error ? (
          <div className="p-8 text-center text-sm text-rose-300">{error}</div>
        ) : loading && result.events.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading activity...</div>
        ) : result.events.length === 0 ? (
          <div className="p-10 text-center">
            <Activity size={24} className="mx-auto text-slate-500" />
            <p className="mt-3 text-sm font-medium text-slate-300">No matching activity</p>
            <p className="mt-1 text-xs text-slate-500">Try a wider time range or clear a filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#0D1322]">
                <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-4 py-3.5">Event</th>
                  <th className="px-4 py-3.5">Job</th>
                  <th className="px-4 py-3.5">Worker</th>
                  <th className="px-4 py-3.5">Details</th>
                  <th className="px-5 py-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashboard-border/70">
                {result.events.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-400">{new Date(event.occurredAt).toLocaleString()}</td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${eventStyles[event.type] ?? "border-slate-600 bg-slate-700/30 text-slate-300"}`}>{eventLabels[event.type] ?? event.type}</span></td>
                    <td className="px-4 py-4 text-xs text-slate-300">{event.jobId ? <><span className="font-medium">{event.jobType || "Job"}</span><span className="ml-2 font-mono text-[10px] text-slate-500">#{event.jobId}</span></> : "—"}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-400">{event.workerId || "—"}</td>
                    <td className="max-w-[280px] truncate px-4 py-4 text-xs text-slate-400" title={eventSummary(event)}>{eventSummary(event)}</td>
                    <td className="px-5 py-4 text-right"><button onClick={() => setSelectedEvent(event)} className="rounded-md border border-dashboard-border px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col justify-between gap-3 border-t border-dashboard-border px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span>Showing {firstRow}–{lastRow} of {result.total} events</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading} className="rounded-md border border-dashboard-border px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40">Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1 || loading} className="rounded-md border border-dashboard-border px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEvent(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="activity-detail-title" className="w-full max-w-xl rounded-2xl border border-dashboard-border bg-[#111827] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 id="activity-detail-title" className="text-lg font-semibold text-white">{eventLabels[selectedEvent.type] ?? selectedEvent.type}</h2>
                <p className="mt-1 text-xs text-slate-400">{new Date(selectedEvent.occurredAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedEvent(null)} aria-label="Close event details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><XCircle size={18} /></button>
            </div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-[#0B1020] p-3"><dt className="text-xs text-slate-500">Job</dt><dd className="mt-1 break-all text-sm text-slate-200">{selectedEvent.jobId ? `${selectedEvent.jobType || "Job"} · #${selectedEvent.jobId}` : "—"}</dd></div>
              <div className="rounded-lg bg-[#0B1020] p-3"><dt className="text-xs text-slate-500">Worker</dt><dd className="mt-1 break-all font-mono text-sm text-slate-200">{selectedEvent.workerId || "—"}</dd></div>
            </dl>
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-slate-200">Event details</h3>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#0B1020] p-4 text-xs text-slate-300">{Object.keys(selectedEvent.details || {}).length ? JSON.stringify(selectedEvent.details, null, 2) : "No additional details."}</pre>
            </div>
            <div className="mt-5 flex justify-end"><button onClick={() => setSelectedEvent(null)} className="rounded-lg border border-dashboard-border px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Close</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
