
import { useState } from "react";
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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const throughputData = [
  { time: "00:00", jobs: 120 },
  { time: "02:00", jobs: 185 },
  { time: "04:00", jobs: 150 },
  { time: "06:00", jobs: 290 },
  { time: "08:00", jobs: 240 },
  { time: "10:00", jobs: 365 },
  { time: "12:00", jobs: 315 },
  { time: "14:00", jobs: 440 },
  { time: "16:00", jobs: 385 },
  { time: "18:00", jobs: 510 },
  { time: "20:00", jobs: 460 },
  { time: "22:00", jobs: 580 },
];

const statusData = [
  { name: "Completed", value: 8421, color: "#34d399" },
  { name: "Queued", value: 128, color: "#a78bfa" },
  { name: "Running", value: 12, color: "#60a5fa" },
  { name: "Failed", value: 7, color: "#fb7185" },
];

const initialJobs = [
  {
    id: "job_a81f2c",
    type: "send-email",
    status: "COMPLETED",
    priority: 3,
    attempts: "1 / 3",
    created: "12 sec ago",
  },
  {
    id: "job_b239d1",
    type: "generate-report",
    status: "RUNNING",
    priority: 5,
    attempts: "1 / 3",
    created: "24 sec ago",
  },
  {
    id: "job_c614e8",
    type: "sync-records",
    status: "QUEUED",
    priority: 2,
    attempts: "0 / 3",
    created: "38 sec ago",
  },
  {
    id: "job_d803a7",
    type: "process-payment",
    status: "COMPLETED",
    priority: 5,
    attempts: "1 / 3",
    created: "51 sec ago",
  },
  {
    id: "job_e427b9",
    type: "send-notification",
    status: "DEAD_LETTER",
    priority: 1,
    attempts: "3 / 3",
    created: "2 min ago",
  },
  {
    id: "job_f195c3",
    type: "resize-image",
    status: "QUEUED",
    priority: 2,
    attempts: "0 / 3",
    created: "3 min ago",
  },
];

const navGroups = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Jobs", icon: Layers3, count: "128" },
      { label: "Workers", icon: Workflow },
      { label: "Dead-letter queue", icon: ShieldAlert, count: "7" },
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
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide ${
        styles[status] ?? "border-slate-600 text-slate-300"
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
          className={`inline-flex items-center gap-1 font-medium ${
            trend === "down" ? "text-rose-300" : "text-emerald-300"
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

function Sidebar({ activePage, setActivePage, onClose }) {
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
                    className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      selected
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
                    {item.count && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          selected
                            ? "bg-violet-400/15 text-violet-200"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {item.count}
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
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
            activePage === "Settings"
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
              Mock environment
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
        <div className="hidden items-center gap-2 rounded-lg border border-dashboard-border bg-slate-900/70 px-3 py-2 md:flex">
          <Search size={15} className="text-slate-500" />
          <span className="text-xs text-slate-500">Search anything...</span>
          <kbd className="ml-6 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-500">
            Ctrl K
          </kbd>
        </div>
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

function Overview() {
  const [period, setPeriod] = useState("24 hours");
  const [jobFilter, setJobFilter] = useState("ALL");

  const filteredJobs =
    jobFilter === "ALL"
      ? initialJobs
      : initialJobs.filter((job) => job.status === jobFilter);

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
            onClick={() =>
              window.alert(
                "Job creation will be enabled when the dashboard is connected to your API."
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-500/10 transition hover:bg-violet-400"
          >
            <Plus size={15} />
            Create job
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total completed"
          value="8,421"
          change="+12.8%"
          description="vs. previous period"
          icon={CheckCircle2}
          iconColor="bg-emerald-400/10 text-emerald-300"
        />
        <MetricCard
          title="Queued jobs"
          value="128"
          change="+8.2%"
          description="waiting to be processed"
          icon={Clock3}
          iconColor="bg-violet-400/10 text-violet-300"
        />
        <MetricCard
          title="Currently running"
          value="12"
          change="+2 workers"
          description="active executions"
          icon={Play}
          iconColor="bg-blue-400/10 text-blue-300"
        />
        <MetricCard
          title="Dead-letter jobs"
          value="7"
          change="-3.4%"
          description="vs. previous period"
          icon={ShieldAlert}
          iconColor="bg-rose-400/10 text-rose-300"
          trend="down"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="rounded-xl border border-dashboard-border bg-dashboard-panel p-5 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Job throughput</h2>
              <p className="mt-1 text-xs text-slate-500">
                Jobs processed over time
              </p>
            </div>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-lg border border-dashboard-border bg-[#0B1020] px-3 py-2 text-xs text-slate-300 outline-none focus:border-violet-400"
            >
              <option>24 hours</option>
              <option>7 days</option>
              <option>30 days</option>
            </select>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-8">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-white">
                4,892
              </p>
              <p className="mt-1 text-xs text-slate-500">Jobs processed</p>
            </div>
            <div className="pb-1">
              <p className="flex items-center gap-1 text-sm font-medium text-emerald-300">
                <ArrowUpRight size={15} />
                18.6%
              </p>
              <p className="mt-1 text-xs text-slate-500">vs. previous period</p>
            </div>
          </div>

          <div className="h-[245px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={throughputData}
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
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
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
            <span className="ml-auto">Illustrative data</span>
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
                  paddingAngle={4}
                  stroke="none"
                >
                  {statusData.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold text-white">8,568</span>
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
                  style={{ backgroundColor: item.color }}
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
                className="max-w-[145px] bg-transparent text-xs text-slate-300 outline-none"
              >
                <option value="ALL">All statuses</option>
                <option value="QUEUED">Queued</option>
                <option value="RUNNING">Running</option>
                <option value="COMPLETED">Completed</option>
                <option value="DEAD_LETTER">Dead-letter</option>
              </select>
            </div>
            <button
              onClick={() =>
                window.alert(
                  "The full job explorer will be implemented in the next step."
                )
              }
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
              {filteredJobs.map((job) => (
                <tr
                  key={job.id}
                  className="transition-colors hover:bg-slate-800/30"
                >
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
                        className={
                          job.priority >= 4
                            ? "text-amber-300"
                            : "text-slate-500"
                        }
                      />
                      {job.priority}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs tabular-nums text-slate-400">
                    {job.attempts}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-400">
                    {job.created}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      onClick={() =>
                        window.alert(
                          `Job details for ${job.id} will be available when we build the job explorer.`
                        )
                      }
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
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No mock jobs match this status.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-2 border-t border-dashboard-border px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <span>Showing {filteredJobs.length} sample jobs</span>
          <span>Pagination will be added with the API integration.</span>
        </div>
      </section>

      <footer className="mt-6 flex flex-col justify-between gap-2 pb-2 text-[11px] text-slate-600 sm:flex-row">
        <span>QueueFlow · Job Queue Management</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Preview mode — data is not live
        </span>
      </footer>
    </>
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
        This section will be implemented in the next development step.
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
              <Overview />
            ) : (
              <PlaceholderPage page={activePage} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
