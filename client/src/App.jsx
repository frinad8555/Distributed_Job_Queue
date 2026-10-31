
import { useState, useEffect } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  Command,
  Database,
  Ellipsis,
  Gauge,
  Layers3,
  LayoutDashboard,
  ListFilter,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Workflow,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const REFRESH_INTERVAL_KEY = "queueflow-refresh-interval";
const DEFAULT_REFRESH_INTERVAL = 5000;

function readRefreshInterval() {
  try {
    const savedValue = Number(window.localStorage.getItem(REFRESH_INTERVAL_KEY));
    return [5000, 10000, 30000].includes(savedValue) ? savedValue : DEFAULT_REFRESH_INTERVAL;
  } catch {
    return DEFAULT_REFRESH_INTERVAL;
  }
}

function useDashboardRefreshInterval() {
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

function saveRefreshInterval(value) {
  try {
    window.localStorage.setItem(REFRESH_INTERVAL_KEY, String(value));
  } catch {
    // Keep the preference active for this session when storage is unavailable.
  }
  window.dispatchEvent(new Event("queueflow-settings-change"));
}

const navGroups = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Jobs", icon: Layers3 },
      { label: "Workers", icon: Workflow },
      { label: "Dead-letter queue", icon: ShieldAlert },
    ],
  },
  {
    label: "OBSERVABILITY",
    items: [
      { label: "Metrics", icon: Gauge },
      { label: "Activity logs", icon: Activity },
    ],
  },
];

function StatusBadge({ status }) {
  const styles = {
    COMPLETED: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    RUNNING: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    QUEUED: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    DEAD_LETTER: "border-rose-400/20 bg-rose-400/10 text-rose-300",
  };

  const dotStyles = {
    COMPLETED: "bg-emerald-400",
    RUNNING: "bg-blue-400 animate-pulse",
    QUEUED: "bg-violet-400",
    DEAD_LETTER: "bg-rose-400",
  };

  const label = status === "DEAD_LETTER" ? "DEAD LETTER" : status;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide ${styles[status] ?? "border-slate-600 text-slate-300"
        }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotStyles[status] ?? "bg-slate-400"}`} />
      {label}
    </span>
  );
}

function MetricCard({
  title,
  value,
  change,
  description,
  icon: Icon,
  iconColor,
  trend = "up",
}) {
  return (
    <div className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 transition-colors hover:border-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        <div className={`rounded-lg border border-white/5 p-2.5 ${iconColor}`}>
          <Icon size={19} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1 font-medium ${trend === "down" ? "text-rose-300" : "text-emerald-300"
            }`}
        >
          {trend === "down" ? (
            <ArrowDownRight size={14} />
          ) : (
            <ArrowUpRight size={14} />
          )}
          {change}
        </span>
        <span className="text-slate-500">{description}</span>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">
        {payload[0].value} jobs
      </p>
    </div>
  );
}

function PieStatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];

  return (
    <div
      style={{
        backgroundColor: "#111827",
        border: "1px solid #475569",
        borderRadius: "8px",
        padding: "10px 14px",
        color: "#FFFFFF",
        opacity: 1,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
      }}
    >
      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600 }}>
        {item.name}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
        {Number(item.value).toLocaleString()} jobs
      </p>
    </div>
  );
}

function Sidebar({ activePage, setActivePage, onClose }) {
  const [jobCount, setJobCount] = useState(0);
  const [deadLetterCount, setDeadLetterCount] = useState(0);
  const refreshInterval = useDashboardRefreshInterval();

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await fetch("/jobs/stats");

        if (!response.ok) {
          throw new Error("Failed to fetch job stats");
        }

        const stats = await response.json();

        setJobCount(stats.totalJobs);
        setDeadLetterCount(stats.deadLetterJobs);
      } catch (error) {
        console.error("Failed to fetch sidebar counts:", error);
      }
    };

    fetchCounts();

    const interval = setInterval(fetchCounts, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return (
    <aside className="flex h-full flex-col bg-[#0D1322]">
      <div className="flex h-[72px] items-center gap-3 border-b border-dashboard-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500 text-white shadow-lg shadow-violet-500/20">
          <Layers3 size={20} />
        </div>
        <div>
          <p className="font-semibold tracking-tight text-white">QueueFlow</p>
          <p className="mt-0.5 text-[10px] font-medium tracking-[0.16em] text-slate-500">
            JOB QUEUE MONITOR
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-800"
            aria-label="Close navigation"
          >
            <XCircle size={18} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-6">
        <div className="mb-6 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-xs font-medium text-emerald-300">
              Queue operational
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            All systems are responding normally.
          </p>
        </div>

        {navGroups.map((group) => (
          <div key={group.label} className="mb-7">
            <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.16em] text-slate-500">
              {group.label}
            </p>

            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const selected = activePage === item.label;

                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActivePage(item.label);
                      onClose?.();
                    }}
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selected
                      ? "border border-violet-400/15 bg-violet-500/10 text-violet-200"
                      : "border border-transparent text-slate-400 hover:bg-slate-800/70 hover:text-white"
                      }`}
                  >
                    <Icon
                      size={17}
                      className={
                        selected
                          ? "text-violet-300"
                          : "text-slate-500 group-hover:text-slate-300"
                      }
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.label === "Jobs" && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${selected
                          ? "bg-violet-400/15 text-violet-200"
                          : "bg-slate-800 text-slate-400"
                          }`}
                      >
                        {jobCount}
                      </span>
                    )}

                    {item.label === "Dead-letter queue" && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${selected
                          ? "bg-violet-400/15 text-violet-200"
                          : "bg-slate-800 text-slate-400"
                          }`}
                      >
                        {deadLetterCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="border-t border-dashboard-border p-3">
        <button
          onClick={() => setActivePage("Settings")}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${activePage === "Settings"
            ? "bg-violet-500/10 text-violet-200"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
        >
          <Settings2 size={17} />
          Settings
        </button>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-800/50 p-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-blue-500 text-xs font-semibold text-white">
            QF
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-200">
              Local development
            </p>
            <p className="mt-1 truncate text-[10px] text-slate-500">
              Queue service
            </p>
          </div>
          <Ellipsis size={17} className="text-slate-500" />
        </div>
      </div>
    </aside>
  );
}

function Header({ activePage, onMenuClick }) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-4 border-b border-dashboard-border bg-[#0B1020]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg border border-dashboard-border p-2 text-slate-400 hover:bg-slate-800 lg:hidden"
          aria-label="Open navigation"
        >
          <Command size={17} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Workspace</span>
            <span>/</span>
            <span className="truncate text-slate-300">{activePage}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-white">
            {activePage}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          className="relative rounded-lg border border-dashboard-border p-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          aria-label="Notifications"
        >
          <Bell size={17} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-400 ring-2 ring-[#0B1020]" />
        </button>
        <div className="hidden h-8 w-px bg-dashboard-border sm:block" />
        <div className="hidden items-center gap-2 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs text-slate-400">Local</span>
          <ChevronDown size={14} className="text-slate-500" />
        </div>
      </div>
    </header>
  );
}

function Overview({ onViewAllJobs }) {
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

function JobsPage() {
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

  async function loadJobs(showLoading = true) {
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
  }

  useEffect(() => {
    loadJobs();
    const intervalId = setInterval(() => loadJobs(false), refreshInterval);
    return () => clearInterval(intervalId);
  }, [page, status, priority, refreshInterval]);

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


function DeadLetterPage() {
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

function WorkersPage() {
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

function MetricsPage() {
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

function ActivityLogsPage() {
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

function SettingsPage() {
  const refreshInterval = useDashboardRefreshInterval();
  const seconds = refreshInterval / 1000;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-violet-300">PREFERENCES</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Settings</h1>
        <p className="mt-2 text-sm text-slate-400">Adjust how often the dashboard refreshes its data.</p>
      </div>

      <section className="max-w-2xl rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-white">Data refresh interval</h2>
            <p className="mt-1 max-w-md text-sm text-slate-400">Applies to jobs, workers, metrics, activity logs, and sidebar counts. Changes take effect immediately.</p>
          </div>
          <select
            aria-label="Data refresh interval"
            value={refreshInterval}
            onChange={(event) => saveRefreshInterval(Number(event.target.value))}
            className="rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-violet-400"
          >
            <option value={5000}>Every 5 seconds</option>
            <option value={10000}>Every 10 seconds</option>
            <option value={30000}>Every 30 seconds</option>
          </select>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-dashboard-border pt-4">
          <p className="text-xs text-slate-500">Saved in this browser · Current interval: {seconds} seconds</p>
          {refreshInterval !== DEFAULT_REFRESH_INTERVAL && (
            <button onClick={() => saveRefreshInterval(DEFAULT_REFRESH_INTERVAL)} className="text-xs font-medium text-violet-300 hover:text-violet-200">Reset to default</button>
          )}
        </div>
      </section>
    </div>
  );
}

function PlaceholderPage({ page }) {
  const pageInfo = {
    Jobs: {
      icon: Layers3,
      description: "Search, filter, inspect, and manage queued jobs.",
    },
    Workers: {
      icon: Workflow,
      description: "Monitor worker processes and their execution status.",
    },
    "Dead-letter queue": {
      icon: ShieldAlert,
      description: "Review failed jobs and prepare them for retry.",
    },
    Metrics: {
      icon: Gauge,
      description: "Explore queue throughput, wait times, and execution latency.",
    },
    "Activity logs": {
      icon: Activity,
      description: "Inspect recent queue events and worker activity.",
    },
    Settings: {
      icon: Settings2,
      description: "Configure dashboard preferences and API connectivity.",
    },
  };

  const info = pageInfo[page] ?? {
    icon: Database,
    description: "Monitor and manage your job queue.",
  };
  const Icon = info.icon;

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center px-5 text-center">
      <div className="rounded-2xl border border-violet-400/15 bg-violet-500/10 p-4 text-violet-300">
        <Icon size={28} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-white">{page}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
        {info.description}
      </p>
      <div className="mt-6 rounded-lg border border-dashboard-border bg-dashboard-panel px-4 py-3 text-xs text-slate-500">
        This section is coming soon.
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dashboard-bg text-slate-200">
      <div className="flex min-h-screen">
        <div className="hidden w-[250px] shrink-0 border-r border-dashboard-border lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar activePage={activePage} setActivePage={setActivePage} />
          </div>
        </div>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-black/70"
              onClick={() => setMobileSidebarOpen(false)}
              aria-label="Close navigation overlay"
            />
            <div className="absolute inset-y-0 left-0 w-[270px] shadow-2xl">
              <Sidebar
                activePage={activePage}
                setActivePage={setActivePage}
                onClose={() => setMobileSidebarOpen(false)}
              />
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <Header
            activePage={activePage}
            onMenuClick={() => setMobileSidebarOpen(true)}
          />
          <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
            {activePage === "Overview" ? (
              <Overview onViewAllJobs={() => setActivePage("Jobs")} />
            ) : activePage === "Jobs" ? (
              <JobsPage />
            ) : activePage === "Dead-letter queue" ? (
              <DeadLetterPage />
            ) : activePage === "Workers" ? (
              <WorkersPage />
            ) : activePage === "Metrics" ? (
              <MetricsPage />
            ) : activePage === "Activity logs" ? (
              <ActivityLogsPage />
            ) : activePage === "Settings" ? (
              <SettingsPage />
            ) : (
              <PlaceholderPage page={activePage} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
