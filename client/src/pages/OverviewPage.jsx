import { useState, useEffect } from "react";
import { CheckCircle2, Clock3, Code2, Ellipsis, Layers3, ListFilter, Play, Plus, RefreshCw, ShieldAlert, XCircle, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatusBadge, MetricCard, ChartTooltip, PieStatusTooltip } from "../components/DashboardShared";
import { useDashboardRefreshInterval } from "../hooks/dashboardPreferences";

export default function Overview({ onViewAllJobs }) {
  const refreshInterval = useDashboardRefreshInterval();
  const [jobFilter, setJobFilter] = useState("ALL");
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobsError, setJobsError] = useState("");
  const [stats, setStats] = useState(null);
  const [createJobOpen, setCreateJobOpen] = useState(false);
  const [creatingJob, setCreatingJob] = useState(false);
  const [createJobError, setCreateJobError] = useState("");
  const [createJobForm, setCreateJobForm] = useState({ type: "", payload: "{}", priority: "0", idempotencyKey: "" });

  const statusData = [
    {
      name: "Completed",
      value: Number(stats?.completedJobs ?? 0),
      fill: "#34D399",
    },
    {
      name: "Queued",
      value: Number(stats?.queuedJobs ?? 0),
      fill: "#A78BFA",
    },
    {
      name: "Running",
      value: Number(stats?.runningJobs ?? 0),
      fill: "#60A5FA",
    },
    {
      name: "Dead Letter",
      value: Number(stats?.deadLetterJobs ?? 0),
      fill: "#EF4444",
    },
  ];

  useEffect(() => {
    let active = true;

    const fetchStats = async () => {
      try {
        const response = await fetch("/jobs/stats");
        if (!response.ok) {
          throw new Error("Failed to fetch job statistics");
        }

        const data = await response.json();

        if (active) {
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      }
    };

    fetchStats();

    const interval = setInterval(fetchStats, refreshInterval);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshInterval]);

  useEffect(() => {
    let isActive = true;

    async function fetchJobs() {
      try {
        const response = await fetch("/jobs");

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const data = await response.json();

        const jobList = Array.isArray(data)
          ? data
          : data.jobs;

        if (!Array.isArray(jobList)) {
          throw new Error("Unexpected response format from GET /jobs");
        }

        if (isActive) {
          setJobs(jobList);
          setJobsError("");
        }
      } catch (error) {
        if (isActive) {
          setJobsError(error.message || "Could not load jobs.");
        }
      } finally {
        if (isActive) {
          setLoadingJobs(false);
        }
      }
    }

    fetchJobs();

    const intervalId = setInterval(fetchJobs, refreshInterval);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [refreshInterval]);

  const filteredJobs =
    jobFilter === "ALL"
      ? jobs
      : jobs.filter((job) => job.status === jobFilter);

  const jobCounts = {
    COMPLETED: stats?.completedJobs ?? 0,
    QUEUED: stats?.queuedJobs ?? 0,
    RUNNING: stats?.runningJobs ?? 0,
    DEAD_LETTER: stats?.deadLetterJobs ?? 0,
  };

  async function createJob(event) {
    event.preventDefault();
    setCreateJobError("");

    let payload;
    try {
      payload = JSON.parse(createJobForm.payload);
      if (payload === null) throw new Error("Payload cannot be null.");
    } catch (error) {
      setCreateJobError(error instanceof SyntaxError ? "Enter valid JSON for the payload." : error.message);
      return;
    }

    setCreatingJob(true);
    try {
      const body = {
        type: createJobForm.type.trim(),
        payload,
        priority: Number(createJobForm.priority),
      };
      if (createJobForm.idempotencyKey.trim()) body.idempotency_key = createJobForm.idempotencyKey.trim();

      const response = await fetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to create job.");

      setJobs((current) => [data, ...current.filter((job) => job.id !== data.id)]);
      setCreateJobOpen(false);
      setCreateJobForm({ type: "", payload: "{}", priority: "0", idempotencyKey: "" });
      setStats((current) => current ? {
        ...current,
        totalJobs: Number(current.totalJobs ?? 0) + 1,
        queuedJobs: Number(current.queuedJobs ?? 0) + 1,
      } : current);
    } catch (error) {
      setCreateJobError(error.message || "Failed to create job.");
    } finally {
      setCreatingJob(false);
    }
  }

  return (
    <>
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            <p className="text-xs font-medium tracking-wide text-violet-300">
              SYSTEM OVERVIEW
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Queue overview
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Monitor job execution, queue health, and worker activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg border border-dashboard-border bg-dashboard-panel px-3 py-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => { setCreateJobError(""); setCreateJobOpen(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/10 transition hover:bg-violet-400"
          >
            <Plus size={15} />
            Create job
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <MetricCard
          title="Total jobs"
          value={(stats?.totalJobs ?? 0).toLocaleString()}
          change="Live count"
          description="all jobs in the database"
          icon={Layers3}
          iconColor="bg-violet-400/10 text-violet-300"
        />

        <MetricCard
          title="Total completed"
          value={jobCounts.COMPLETED.toLocaleString()}
          change="Live count"
          description="completed jobs"
          icon={CheckCircle2}
          iconColor="bg-emerald-400/10 text-emerald-300"
        />

        <MetricCard
          title="Queued jobs"
          value={jobCounts.QUEUED.toLocaleString()}
          change="Live count"
          description="waiting to be processed"
          icon={Clock3}
          iconColor="bg-violet-400/10 text-violet-300"
        />

        <MetricCard
          title="Currently running"
          value={jobCounts.RUNNING.toLocaleString()}
          change="Live count"
          description="active executions"
          icon={Play}
          iconColor="bg-blue-400/10 text-blue-300"
        />

        <MetricCard
          title="Dead-letter jobs"
          value={jobCounts.DEAD_LETTER.toLocaleString()}
          change="Live count"
          description="jobs awaiting recovery or review"
          icon={ShieldAlert}
          iconColor="bg-rose-400/10 text-rose-300"
        />

      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Job throughput</h2>
              <p className="mt-1 text-xs text-slate-500">
                Jobs created over the last 7 days
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-8">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-white">
                {(stats?.dailyJobs ?? [])
                  .reduce((total, day) => total + Number(day.jobs), 0)
                  .toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Jobs created
              </p>
            </div>

            <div className="pb-1">
              <p className="text-sm font-medium text-slate-400">
                Live statistics
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Refreshed every 5 seconds
              </p>
            </div>
          </div>

          <div className="h-[245px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.dailyJobs ?? []}
                margin={{ top: 8, right: 5, left: -22, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b7cff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b7cff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="#263044"
                  strokeDasharray="3 5"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  axisLine={true}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  axisLine={true}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickCount={5}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="jobs"
                  stroke="#9b8cff"
                  strokeWidth={2}
                  fill="url(#throughputFill)"
                  activeDot={{
                    r: 4,
                    fill: "#c4b5fd",
                    stroke: "#111827",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            Processed jobs
          </div>
        </section>

        <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
          <div>
            <h2 className="font-semibold text-white">Job distribution</h2>
            <p className="mt-1 text-xs text-slate-500">
              Current status breakdown
            </p>
          </div>

          <div className="relative mx-auto mt-4 h-[220px] max-w-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={88}
                  paddingAngle={0}
                  minAngle={2}
                  stroke="none"
                />

                <Tooltip
                  content={<PieStatusTooltip />}
                  shared={false}
                  wrapperStyle={{
                    zIndex: 1000,
                    outline: "none",
                    pointerEvents: "none",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-white">{stats?.totalJobs}</span>
              <span className="mt-1 text-[10px] text-slate-500">
                Total jobs
              </span>
            </div>
          </div>

          <div className="mt-2 space-y-3">
            {statusData.map((item) => (
              <div key={item.name} className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="flex-1 text-xs text-slate-400">
                  {item.name}
                </span>
                <span className="text-xs font-medium tabular-nums text-slate-200">
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-dashboard-border bg-dashboard-panel">
        <div className="flex flex-col justify-between gap-4 border-b border-dashboard-border p-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-semibold text-white">Recent jobs</h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest jobs submitted to your queue
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2">
              <ListFilter size={14} className="text-slate-500" />
              <select
                value={jobFilter}
                onChange={(event) => setJobFilter(event.target.value)}
                className="max-w-[145px] cursor-pointer bg-transparent text-xs text-slate-300 outline-none"
              >
                <option value="ALL" className="bg-[#111827] text-slate-200">
                  All statuses
                </option>
                <option value="QUEUED" className="bg-[#111827] text-violet-300">
                  Queued
                </option>
                <option value="RUNNING" className="bg-[#111827] text-blue-300">
                  Running
                </option>
                <option value="COMPLETED" className="bg-[#111827] text-emerald-300">
                  Completed
                </option>
                <option value="DEAD_LETTER" className="bg-[#111827] text-rose-300">
                  Dead-letter
                </option>
              </select>
            </div>
            <button
              onClick={onViewAllJobs}
              className="rounded-lg border border-dashboard-border px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              View all jobs
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-[#0D1322]">
              <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className="px-6 py-3.5">Job</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Priority</th>
                <th className="px-4 py-3.5">Attempts</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashboard-border/70">
              {loadingJobs ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    Loading jobs...
                  </td>
                </tr>
              ) : jobsError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-rose-300">
                    Failed to load jobs: {jobsError}
                  </td>
                </tr>
              ) : (
                <>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="transition-colors hover:bg-slate-800/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg border border-slate-700/70 bg-slate-800/70 p-2 text-slate-400">
                            <Code2 size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-200">
                              {job.type}
                            </p>
                            <p className="mt-1 font-mono text-[10px] text-slate-500">
                              {job.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="flex items-center gap-1.5 text-xs text-slate-300">
                          <Zap
                            size={13}
                            className={job.priority >= 4 ? "text-amber-300" : "text-slate-500"}
                          />
                          {job.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs tabular-nums text-slate-400">
                        {job.retry_count ?? job.attempts ?? 0}
                        {" / "}
                        {job.max_retries ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-400">
                        {job.created_at
                          ? new Date(job.created_at).toLocaleString()
                          : job.created ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => window.alert(`Job ID: ${job.id}`)}
                          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-700 hover:text-white"
                          aria-label={`More information about ${job.id}`}
                        >
                          <Ellipsis size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                        No jobs match this status.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-2 border-t border-dashboard-border px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span>Showing {filteredJobs.length} jobs</span>
          <span>Latest jobs in your queue</span>
        </div>
      </section>

      <footer className="mt-6 flex flex-col justify-between gap-2 pb-2 text-[11px] text-slate-600 sm:flex-row">
        <span>QueueFlow · Job Queue Management</span>
      </footer>

      {createJobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !creatingJob) setCreateJobOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="create-job-title" className="w-full max-w-lg rounded-2xl border border-dashboard-border bg-[#111827] p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 id="create-job-title" className="text-lg font-semibold text-white">Create job</h2>
                <p className="mt-1 text-sm text-slate-400">Add a job to the queue.</p>
              </div>
              <button type="button" onClick={() => setCreateJobOpen(false)} disabled={creatingJob} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"><XCircle size={18} /></button>
            </div>
            <form onSubmit={createJob} className="space-y-4">
              <label className="block text-sm text-slate-300">Job type
                <input required maxLength={100} value={createJobForm.type} onChange={(event) => setCreateJobForm({ ...createJobForm, type: event.target.value })} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" placeholder="e.g. send_email" />
              </label>
              <label className="block text-sm text-slate-300">Payload (JSON)
                <textarea required rows={5} value={createJobForm.payload} onChange={(event) => setCreateJobForm({ ...createJobForm, payload: event.target.value })} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-violet-400" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-300">Priority
                  <input type="number" min="0" step="1" required value={createJobForm.priority} onChange={(event) => setCreateJobForm({ ...createJobForm, priority: event.target.value })} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" />
                </label>
                <label className="block text-sm text-slate-300">Idempotency key <span className="text-slate-500">(optional)</span>
                  <input maxLength={255} value={createJobForm.idempotencyKey} onChange={(event) => setCreateJobForm({ ...createJobForm, idempotencyKey: event.target.value })} className="mt-1.5 w-full rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400" />
                </label>
              </div>
              {createJobError && <p role="alert" className="text-sm text-rose-300">{createJobError}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setCreateJobOpen(false)} disabled={creatingJob} className="rounded-lg border border-dashboard-border px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={creatingJob} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50">{creatingJob ? "Creating…" : "Create job"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
