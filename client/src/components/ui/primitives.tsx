import { Star, StarHalf, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn, initials } from "../../lib/utils";

/* ------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ai" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ai: "btn-ai",
  ghost: "btn-ghost",
  danger: "btn bg-danger text-white hover:bg-red-700",
};

const sizeClass = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-base",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(variantClass[variant], sizeClass[size], className)} {...props} />;
}

/* -------------------------------- Input --------------------------------- */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("input min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("input appearance-none", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/* -------------------------------- Badge --------------------------------- */

type Tone = "default" | "brand" | "success" | "danger" | "warning" | "ai" | "muted";

const toneClass: Record<Tone, string> = {
  default: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-light text-success",
  danger: "bg-danger-light text-danger",
  warning: "bg-warning-light text-warning",
  ai: "bg-ai-light text-ai",
  muted: "bg-slate-100 text-muted",
};

export function Badge({ tone = "default", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    PENDING: { label: "Pending", tone: "warning" },
    ACCEPTED: { label: "Accepted", tone: "brand" },
    REJECTED: { label: "Rejected", tone: "danger" },
    IN_PROGRESS: { label: "In Progress", tone: "brand" },
    COMPLETED: { label: "Completed", tone: "success" },
    CANCELLED: { label: "Cancelled", tone: "muted" },
    DISPUTED: { label: "Disputed", tone: "danger" },
    approved: { label: "Approved", tone: "success" },
    pending: { label: "Pending review", tone: "warning" },
    rejected: { label: "Rejected", tone: "danger" },
    draft: { label: "Draft", tone: "muted" },
    verified: { label: "Verified", tone: "success" },
    unverified: { label: "Unverified", tone: "muted" },
    active: { label: "Active", tone: "success" },
    suspended: { label: "Suspended", tone: "danger" },
    deactivated: { label: "Deactivated", tone: "muted" },
    sent: { label: "Sent", tone: "brand" },
    accepted: { label: "Accepted", tone: "brand" },
    declined: { label: "Declined", tone: "danger" },
    completed: { label: "Completed", tone: "success" },
    cancelled: { label: "Cancelled", tone: "muted" },
    open: { label: "Open", tone: "warning" },
    reviewing: { label: "Reviewing", tone: "warning" },
    resolved: { label: "Resolved", tone: "success" },
    dismissed: { label: "Dismissed", tone: "muted" },
  };
  const config = map[status] ?? { label: status, tone: "default" as Tone };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

/* -------------------------------- Chip ---------------------------------- */

export function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("chip", className)}>{children}</span>;
}

/* ------------------------------- Avatar --------------------------------- */

export function Avatar({ name, src, size = 44, className }: { name: string; src?: string; size?: number; className?: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={cn("rounded-full object-cover ring-2 ring-line", className)}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  ) : (
    <span
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------- Rating --------------------------------- */

export function Stars({ value, count, className }: { value: number; count?: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={`Rated ${value.toFixed(1)} out of 5`}>
      <span className="inline-flex items-center text-amber-400">
        {[1, 2, 3, 4, 5].map((i) => {
          if (rounded >= i) return <Star key={i} size={14} fill="currentColor" strokeWidth={0} />;
          if (rounded === i - 0.5) return <StarHalf key={i} size={14} fill="currentColor" strokeWidth={0} />;
          return <Star key={i} size={14} className="text-slate-300" fill="currentColor" strokeWidth={0} />;
        })}
      </span>
      {value > 0 && <span className="text-sm font-semibold">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}

/* --------------------------- Skeleton / Spinner -------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent", className)} role="status" aria-label="Loading" />
  );
}

/** Skeleton worker cards for loading states. */
export function WorkerGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- Modal --------------------------------- */

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-slate-900/50 backdrop-sm" onClick={onClose} aria-label="Close dialog" />
      <div className={cn("relative z-10 w-full rounded-t-2xl bg-white p-5 shadow-lift sm:m-4 sm:max-w-lg sm:rounded-2xl", wide && "sm:max-w-2xl")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------- Tabs ---------------------------------- */

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 no-scrollbar" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition",
            active === tab ? "bg-brand-600 text-white" : "text-muted hover:bg-slate-100 hover:text-ink",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- StatCard -------------------------------- */

export function StatCard({ label, value, icon, tone = "brand" }: { label: string; value: number | string; icon: ReactNode; tone?: Tone }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClass[tone])}>{icon}</span>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="mt-1 text-sm text-muted">{label}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}