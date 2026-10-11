import { cn } from "../../lib/utils";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M10 22V10l12 12V10" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={30} />
      {!compact && (
        <span className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tracking-tight">KAMLE</span>
          <span className="rounded-md bg-ai px-1.5 py-0.5 text-xs font-bold text-white">AI</span>
        </span>
      )}
    </span>
  );
}