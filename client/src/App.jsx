import { useState, useEffect } from "react";
import { Activity, Bell, Command, Database, Gauge, Layers3, LayoutDashboard, Search, Settings2, ShieldAlert, Workflow, XCircle } from "lucide-react";
import OverviewPage from "./pages/OverviewPage";
import DeadLetterPage from "./pages/DeadLetterPage";
import WorkersPage from "./pages/WorkersPage";
import JobsPage from "./pages/JobsPage";
import MetricsPage from "./pages/MetricsPage";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import { DEFAULT_REFRESH_INTERVAL, saveRefreshInterval, useDashboardRefreshInterval } from "./hooks/dashboardPreferences";
import { StatusBadge } from "./components/DashboardShared";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

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
        <span className="hidden max-w-[240px] truncate text-xs text-slate-400 sm:block" title={API_URL}>
          {API_URL}
        </span>
      </div>
    </header>
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
              <OverviewPage onViewAllJobs={() => setActivePage("Jobs")} />
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
