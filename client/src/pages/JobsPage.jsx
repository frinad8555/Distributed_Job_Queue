import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Search, XCircle } from "lucide-react";
import { StatusBadge } from "../components/DashboardShared";
import { useDashboardRefreshInterval } from "../hooks/dashboardPreferences";

export default function JobsPage() {
  const refreshInterval = useDashboardRefreshInterval();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [page, setPage] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);
  const [notice, setNotice] = useState("");
  const [retrying, setRetrying] = useState(false);

  const limit = 20;

  const loadJobs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      });

      if (status !== "ALL") params.set("status", status);
      if (priority !== "ALL") params.set("priority", priority);

      const response = await fetch(`/jobs?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load jobs");
      }

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response format from GET /jobs");
      }

      setJobs(data);
    } catch (err) {
      setError(err.message || "Could not load jobs");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [limit, page, priority, status]);

  useEffect(() => {
    loadJobs();
    const intervalId = setInterval(() => loadJobs(false), refreshInterval);
    return () => clearInterval(intervalId);
  }, [loadJobs, refreshInterval]);

  const filteredJobs = jobs.filter((job) => {
    const query = search.trim().toLowerCase();

    return (
      !query ||
      String(job.id).toLowerCase().includes(query) ||
      String(job.type ?? "").toLowerCase().includes(query)
    );
  });

  async function openJob(job) {
    setSelectedJob(job);

    try {
      const response = await fetch(`/jobs/${job.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load job details");
      }

      setSelectedJob(data);
    } catch (err) {
      setNotice(err.message || "Could not load job details");
    }
  }

  async function retryJob(job) {
    if (!window.confirm(`Retry dead-letter job ${job.id}?`)) return;

    setRetrying(true);
    setNotice("");

    try {
      const response = await fetch(`/jobs/${job.id}/retry`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to retry job");
      }

      setNotice(`Job ${job.id} was queued for retry.`);
      setSelectedJob(null);
      await loadJobs();
    } catch (err) {
      setNotice(err.message || "Could not retry job");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-violet-300">
            WORKSPACE / JOB EXPLORER
          </p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Jobs
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Search, inspect, and manage jobs in your queue.
          </p>
        </div>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-panel px-3 py-2.5 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashboard-border bg-dashboard-panel px-4 py-3 text-sm text-slate-300">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss message">
            <XCircle size={16} />
          </button>
        </div>
      )}

      <section className="rounded-xl border border-dashboard-border bg-dashboard-panel">
        <div className="grid grid-cols-1 gap-3 border-b border-dashboard-border p-4 md:grid-cols-3">
          <div className="flex items-center gap-2 rounded-lg border border-dashboard-border bg-[#0B1020] px-3">
            <Search size={15} className="shrink-0 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID or job type..."
              className="w-full bg-transparent py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-300 outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="COMPLETED">Completed</option>
            <option value="DEAD_LETTER">Dead-letter</option>
          </select>

          <select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(0);
            }}
            className="rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-300 outline-none"
          >
            <option value="ALL">All priorities</option>
            {[0, 1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                Priority {value}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead className="bg-[#0D1322]">
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Job</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Retries</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-dashboard-border/70">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                    Loading jobs...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-rose-300">
                    {error}
                  </td>
                </tr>
              ) : filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                    No matching jobs found.
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30">
                    <td className="px-5 py-4">
                      <p className="text-xs font-medium text-slate-200">
                        {job.type}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-slate-500">
                        ID: {job.id}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-300">
                      {job.priority}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">
                      {job.retry_count ?? 0} / {job.max_retries ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-400">
                      {job.created_at
                        ? new Date(job.created_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openJob(job)}
                          className="rounded-md border border-dashboard-border px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                        >
                          Details
                        </button>
                        {job.status === "DEAD_LETTER" && (
                          <button
                            onClick={() => retryJob(job)}
                            disabled={retrying}
                            className="rounded-md bg-violet-500/15 px-2.5 py-1.5 text-xs text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-dashboard-border px-5 py-4 sm:flex-row sm:items-center">
          <span className="text-xs text-slate-500">
            {loading
              ? "Loading..."
              : `Showing ${filteredJobs.length} of ${jobs.length} jobs on this page`}
          </span>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              disabled={page === 0 || loading}
              className="rounded-lg border border-dashboard-border px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || jobs.length < limit}
              className="rounded-lg border border-dashboard-border px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedJob(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-details-title"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-dashboard-border bg-[#111827] p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="job-details-title" className="text-lg font-semibold text-white">
                  Job details
                </h2>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  ID: {selectedJob.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-md p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                aria-label="Close job details"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ["Type", selectedJob.type],
                ["Status", selectedJob.status],
                ["Priority", selectedJob.priority],
                ["Retry count", selectedJob.retry_count],
                ["Max retries", selectedJob.max_retries],
                ["Created", selectedJob.created_at
                  ? new Date(selectedJob.created_at).toLocaleString()
                  : "—"],
                ["Started", selectedJob.started_at
                  ? new Date(selectedJob.started_at).toLocaleString()
                  : "—"],
                ["Completed", selectedJob.completed_at
                  ? new Date(selectedJob.completed_at).toLocaleString()
                  : "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-dashboard-border bg-[#0B1020] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-200">
                    {value ?? "—"}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-400">Payload</p>
              <pre className="max-h-64 overflow-auto rounded-lg border border-dashboard-border bg-[#0B1020] p-4 text-xs text-slate-300">
                {JSON.stringify(selectedJob.payload, null, 2) ?? "No payload"}
              </pre>
            </div>

            {selectedJob.status === "DEAD_LETTER" && (
              <button
                onClick={() => retryJob(selectedJob)}
                disabled={retrying}
                className="mt-5 rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
              >
                {retrying ? "Retrying..." : "Retry this job"}
              </button>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
