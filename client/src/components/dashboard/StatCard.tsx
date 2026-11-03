import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: LucideIcon;
  sub?: string;
  trend?: {
    value: number;
    label: string;
  };
  tone?: "blue" | "emerald" | "amber" | "purple" | "rose" | "slate";
  onClick?: () => void;
}

const TONES = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-100",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-100",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-100",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-100",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    border: "border-rose-100",
  },
  slate: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
};

export function StatCard({
  title,
  value,
  icon: Icon,
  sub,
  trend,
  tone = "blue",
  onClick,
}: StatCardProps) {
  const t = TONES[tone];
  const isUp = trend && trend.value >= 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border ${t.border} bg-white p-5 shadow-sm transition hover:shadow-md ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{title}</p>
          <div className="mt-2 text-2xl font-black text-ink">{value}</div>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
          {trend && (
            <p
              className={`mt-2 flex items-center gap-1 text-xs font-semibold ${
                isUp ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isUp ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.bg}`}>
          <Icon size={20} className={t.text} />
        </div>
      </div>
    </div>
  );
}
