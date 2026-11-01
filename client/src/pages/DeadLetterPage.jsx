import { useState, useEffect } from "react";
import { RefreshCw, Search, ShieldAlert, XCircle } from "lucide-react";
import { useDashboardRefreshInterval } from "../hooks/dashboardPreferences";

export default function DeadLetterPage() {
  const refreshInterval = useDashboardRefreshInterval();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [retryingId, setRetryingId] = useState(null);
  const [notice, setNotice] = useState("");

  const loadJobs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const response = await fetch("/jobs/dead-letter");

      if (!response.ok) {
        throw new Error("Failed to load dead-letter jobs.");
      }

      const data = await response.json();
      setJobs(data);
    } catch (err) {
      setError(err.message || "Unable to load dead-letter jobs.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();

    const interval = setInterval(() => {
      loadJobs(false);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const filteredJobs = jobs.filter((job) => {
    const query = search.toLowerCase();

    return (
      String(job.id).toLowerCase().includes(query) ||
      String(job.type || "").toLowerCase().includes(query) ||
      String(job.status || "").toLowerCase().includes(query)
    );
  });

  const openDetails = async (job) => {
    setSelectedJob(job);

    try {
      const response = await fetch(`/jobs/${job.id}`);

      if (!response.ok) {
        throw new Error("Could not load job details.");
      }

      const data = await response.json();
      setSelectedJob(data);
    } catch (err) {
      setNotice(err.message || "Could not load job details.");
    }
  };

  const retryJob = async (job) => {
    const confirmed = window.confirm(
      `Retry job ${job.id}? It will be returned to the queue.`
    );

    if (!confirmed) return;

    setRetryingId(job.id);
    setNotice("");

    try {
      const response = await fetch(`/jobs/${job.id}/retry`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to retry job.");
      }

      setNotice(`Job ${job.id} has been requeued.`);
      setSelectedJob(null);
      await loadJobs();
    } catch (err) {
      setNotice(err.message || "Failed to retry job.");
    } finally {
      setRetryingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={22} className="text-rose-400" />
            <h1 className="text-2xl font-semibold text-white">
              Dead-letter Queue
            </h1>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Inspect permanently failed jobs and requeue them when appropriate.
          </p>
        </div>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-panel px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-dashboard-border bg-dashboard-panel px-4 py-3 text-sm text-slate-200">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            className="text-slate-400 hover:text-white"
            aria-label="Dismiss notification"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5">
          <p className="text-sm text-slate-400">Dead-letter jobs</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {jobs.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Total jobs currently in the dead-letter queue
          </p>
        </div>

        <div className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5">
          <p className="text-sm text-slate-400">Displayed results</p>
          <p className="mt-2 text-3xl font-semibold text-white">
            {filteredJobs.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Matching your current search
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-dashboard-border bg-dashboard-panel">
        <div className="flex flex-col gap-3 border-b border-dashboard-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-medium text-white">Failed jobs</h2>

          <div className="relative w-full sm:max-w-xs">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID or job type..."
              className="w-full rounded-lg border border-dashboard-border bg-[#0B1020] py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
            />
          </div>
        </div>

        {error && (
          <div className="p-6 text-sm text-rose-300">
            {error}
            <button
              onClick={loadJobs}
              className="ml-3 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        {loading && jobs.length === 0 && !error ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Loading dead-letter jobs...
          </div>
        ) : !error && filteredJobs.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldAlert size={28} className="mx-auto text-slate-600" />
            <p className="mt-3 font-medium text-white">
              {jobs.length === 0
                ? "No dead-letter jobs"
                : "No matching jobs"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {jobs.length === 0
                ? "Jobs that exhaust their retries will appear here."
                : "Try another job ID or type."}
            </p>
          </div>
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0B1020] text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Job ID</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Retries</th>
                  <th className="px-5 py-3 font-medium">Failed at</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashboard-border">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/30">
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-300">
                      #{job.id}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-200">
                      {job.type || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-300">
                      {job.retry_count ?? 0}
                      {job.max_retries != null
                        ? ` / ${job.max_retries}`
                        : ""}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">
                      {formatDate(
                        job.completed_at || job.updated_at || job.created_at
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openDetails(job)}
                          className="rounded-md border border-dashboard-border px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => retryJob(job)}
                          disabled={retryingId === job.id}
                          className="rounded-md bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
                        >
                          {retryingId === job.id ? "Retrying..." : "Retry"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedJob(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="dead-letter-modal-title"
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-dashboard-border bg-[#111827] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="dead-letter-modal-title"
                  className="text-lg font-semibold text-white"
                >
                  Job #{selectedJob.id}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Dead-letter job details
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close job details"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-[#0B1020] p-3">
                <p className="text-xs text-slate-500">Type</p>
                <p className="mt-1 break-words text-sm text-white">
                  {selectedJob.type || "—"}
                </p>
              </div>
              <div className="rounded-lg bg-[#0B1020] p-3">
                <p className="text-xs text-slate-500">Status</p>
                <p className="mt-1 text-sm text-rose-300">
                  {selectedJob.status || "DEAD_LETTER"}
                </p>
              </div>
              <div className="rounded-lg bg-[#0B1020] p-3">
                <p className="text-xs text-slate-500">Retry count</p>
                <p className="mt-1 text-sm text-white">
                  {selectedJob.retry_count ?? 0}
                  {selectedJob.max_retries != null
                    ? ` / ${selectedJob.max_retries}`
                    : ""}
                </p>
              </div>
              <div className="rounded-lg bg-[#0B1020] p-3">
                <p className="text-xs text-slate-500">Created at</p>
                <p className="mt-1 text-sm text-white">
                  {formatDate(selectedJob.created_at)}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="mb-2 text-sm font-medium text-slate-200">
                Error information
              </h3>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#0B1020] p-4 text-xs text-rose-200">
                {selectedJob.last_error ||
                  "No error message is stored for this job."}
              </pre>
            </div>

            <div className="mt-5">
              <h3 className="mb-2 text-sm font-medium text-slate-200">
                Payload
              </h3>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#0B1020] p-4 text-xs text-slate-300">
                {JSON.stringify(selectedJob.payload ?? {}, null, 2)}
              </pre>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setSelectedJob(null)}
                className="rounded-lg border border-dashboard-border px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => retryJob(selectedJob)}
                disabled={retryingId === selectedJob.id}
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-50"
              >
                {retryingId === selectedJob.id ? "Retrying..." : "Retry job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
