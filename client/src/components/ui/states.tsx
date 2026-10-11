import { AlertTriangle, WifiOff, Inbox, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./primitives";

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">{icon ?? <Inbox size={26} />}</span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-light text-danger">
        <AlertTriangle size={26} />
      </span>
      <h3 className="text-base font-bold">{title ?? "Something went wrong"}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message ?? "We couldn't load this right now. Please try again."}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw size={16} /> Try again
        </Button>
      )}
    </div>
  );
}

export function OfflineState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-light text-warning">
        <WifiOff size={26} />
      </span>
      <h3 className="text-base font-bold">You seem to be offline</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message ?? "Check your internet connection and retry."}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RefreshCw size={16} /> Retry
        </Button>
      )}
    </div>
  );
}