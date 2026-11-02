import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  iconBg?: string;
  iconColor?: string;
  sub?: string;
  trend?: { value: number; label: string };
}

export default function WorkerStatCard({
  title,
  value,
  icon: Icon,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-600",
  sub,
  trend,
}: Props) {
  const isUp = trend && trend.value >= 0;

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
          {trend && (
            <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${isUp ? "text-green-600" : "text-red-500"}`}>
              {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isUp ? "+" : ""}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  );
}
