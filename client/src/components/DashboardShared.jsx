import { createElement } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatusBadge({ status }) {
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

export function MetricCard({
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
          {createElement(Icon, { size: 19 })}
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

export function ChartTooltip({ active, payload, label }) {
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

export function PieStatusTooltip({ active, payload }) {
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
