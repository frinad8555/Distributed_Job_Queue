import { useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardRefreshInterval } from "../hooks/dashboardPreferences";

export default function MetricsPage() {
  const refreshInterval = useDashboardRefreshInterval();
  const [range, setRange] = useState("7d");
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMetrics(showLoading = true) {
      if (showLoading && active) setLoading(true);
      try {
        const response = await fetch(`/metrics?range=${range}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load metrics.");
        if (active) {
          setMetrics(data);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load metrics.");
      } finally {
        if (active && showLoading) setLoading(false);
      }
    }

    loadMetrics();
    const intervalId = setInterval(() => loadMetrics(false), refreshInterval);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [range, refreshInterval]);

  const summary = metrics?.summary;
  const activity = metrics?.activity ?? [];
  const hasRateData = activity.some((point) => point.retry_rate != null || point.failure_rate != null);
  const formatDuration = (seconds) => {
    if (seconds == null) return "—";
    const value = Number(seconds);
    if (value < 60) return `${value}s`;
    const minutes = Math.floor(value / 60);
    const remainingSeconds = value % 60;
    return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };
  const chartTooltip = {
    contentStyle: { backgroundColor: "#111827", border: "1px solid #334155", borderRadius: 8 },
    labelStyle: { color: "#94a3b8", fontSize: 12 },
    itemStyle: { fontSize: 12 },
    formatter: (value, name) => [value == null ? "—" : value, ({ completed: "Completed", failed: "Dead-lettered", queue_depth: "Queued jobs", wait_seconds: "Wait", execution_seconds: "Execution", failure_rate: "Failure rate", retry_rate: "Retry rate" })[name] ?? name],
  };
  const cards = [
    { title: "Completed", value: summary?.completedInRange ?? "—", detail: `in the last ${range}` },
    { title: "Success rate", value: summary?.successRate == null ? "—" : `${summary.successRate}%`, detail: "of recorded completed or failed outcomes" },
    { title: "Wait time · P50", value: formatDuration(summary?.p50WaitSeconds), detail: `P95 ${formatDuration(summary?.p95WaitSeconds)} · avg ${formatDuration(summary?.averageWaitSeconds)}` },
    { title: "Execution time · P50", value: formatDuration(summary?.p50ExecutionSeconds), detail: `P95 ${formatDuration(summary?.p95ExecutionSeconds)} · avg ${formatDuration(summary?.averageExecutionSeconds)}` },
    { title: "Queued now", value: summary?.queued ?? "—", detail: "current queue depth" },
    { title: "Online workers", value: summary?.onlineWorkers ?? "—", detail: `${summary?.running ?? 0} jobs running` },
    { title: "Retry rate", value: summary?.retryRate == null ? "—" : `${summary.retryRate}%`, detail: `${summary?.retryEvents ?? 0} retries across ${summary?.startedAttempts ?? 0} starts` },
    { title: "Dead-lettered", value: summary?.failedInRange ?? "—", detail: `in the last ${range}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-violet-300">OBSERVABILITY / METRICS</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Queue metrics</h1>
          <p className="mt-2 text-sm text-slate-400">Throughput, latency, retries, queue depth, and worker activity.</p>
        </div>
        <label className="flex items-center gap-3 text-xs text-slate-400">
          Time range
          <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none">
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
      </div>

      {error && <div role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">{error}</div>}
      {loading && !metrics ? (
        <div className="rounded-xl border border-dashboard-border bg-dashboard-panel p-10 text-center text-sm text-slate-400">Loading metrics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <div key={card.title} className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5">
                <p className="text-sm text-slate-400">{card.title}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{card.value}</p>
                <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
              </div>
            ))}
          </div>
          {metrics?.historyAvailableFrom && <p className="text-xs text-slate-500">Lifecycle event tracking began {new Date(metrics.historyAvailableFrom).toLocaleString()}; retry, failure, and queue history before then is unavailable.</p>}

          <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
            <div>
              <h2 className="font-semibold text-white">Completed and failed jobs</h2>
              <p className="mt-1 text-xs text-slate-500">Job outcomes recorded in each time bucket</p>
            </div>
            <div className="mt-5 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="metricsCompleted" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34D399" stopOpacity={0.3} /><stop offset="95%" stopColor="#34D399" stopOpacity={0} /></linearGradient>
                    <linearGradient id="metricsFailed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FB7185" stopOpacity={0.25} /><stop offset="95%" stopColor="#FB7185" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#263044" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip {...chartTooltip} />
                  <Area type="monotone" dataKey="completed" stroke="#34D399" fill="url(#metricsCompleted)" strokeWidth={2} />
                  <Area type="monotone" dataKey="failed" stroke="#FB7185" fill="url(#metricsFailed)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex gap-5 text-[11px] text-slate-400"><span className="text-emerald-300">● Completed</span><span className="text-rose-300">● Dead-lettered</span></div>
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
              <h2 className="font-semibold text-white">Queue depth</h2>
              <p className="mt-1 text-xs text-slate-500">Queued jobs over time</p>
              <div className="mt-4 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs><linearGradient id="queueDepthFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A78BFA" stopOpacity={0.3} /><stop offset="95%" stopColor="#A78BFA" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#263044" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip {...chartTooltip} />
                    <Area type="monotone" dataKey="queue_depth" stroke="#A78BFA" fill="url(#queueDepthFill)" strokeWidth={2} connectNulls={false} dot={{ r: 3, fill: "#A78BFA", stroke: "#111827", strokeWidth: 1 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {metrics?.historyAvailableFrom && <p className="mt-2 text-[11px] text-slate-500">Queue history starts {new Date(metrics.historyAvailableFrom).toLocaleString()}.</p>}
            </section>

            <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
              <h2 className="font-semibold text-white">Wait and execution time</h2>
              <p className="mt-1 text-xs text-slate-500">Average duration for completed jobs</p>
              <div className="mt-4 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#263044" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip {...chartTooltip} formatter={(value, name) => [formatDuration(value), name === "wait_seconds" ? "Average wait" : "Average execution"]} />
                    <Area type="monotone" dataKey="wait_seconds" stroke="#60A5FA" fill="transparent" strokeWidth={2} connectNulls />
                    <Area type="monotone" dataKey="execution_seconds" stroke="#FBBF24" fill="transparent" strokeWidth={2} connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex gap-5 text-[11px] text-slate-400"><span className="text-blue-300">● Wait</span><span className="text-amber-300">● Execution</span></div>
            </section>

            <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
              <h2 className="font-semibold text-white">Retry and failure rates</h2>
              <p className="mt-1 text-xs text-slate-500">Retries per 100 starts and dead-letter share of outcomes</p>
              {hasRateData ? <div className="mt-4 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activity} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#263044" strokeDasharray="3 5" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, "auto"]} tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <Tooltip {...chartTooltip} formatter={(value, name) => [value == null ? "—" : `${value}%`, name === "retry_rate" ? "Retry rate" : "Failure rate"]} />
                    <Area type="monotone" dataKey="retry_rate" stroke="#A78BFA" fill="transparent" strokeWidth={2} connectNulls={false} dot={{ r: 3, fill: "#A78BFA", stroke: "#111827", strokeWidth: 1 }} activeDot={{ r: 5 }} />
                    <Area type="monotone" dataKey="failure_rate" stroke="#FB7185" fill="transparent" strokeWidth={2} connectNulls={false} dot={{ r: 3, fill: "#FB7185", stroke: "#111827", strokeWidth: 1 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div> : <div className="mt-4 flex h-[250px] items-center justify-center rounded-lg border border-dashed border-dashboard-border px-6 text-center text-sm text-slate-500">No jobs have started or reached a terminal outcome in this time range, so rates are not available yet.</div>}
              <div className="mt-2 flex gap-5 text-[11px] text-slate-400"><span className="text-violet-300">● Retry rate</span><span className="text-rose-300">● Failure rate</span></div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
