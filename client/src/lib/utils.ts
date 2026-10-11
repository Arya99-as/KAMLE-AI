export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? "").toUpperCase())
    .join("");
}

export function formatPrice(pricing: { type: string; amount?: number; currency: string; note?: string } | undefined): string {
  if (!pricing) return "Quote";
  if (pricing.type === "quote") return "Quote";
  if (typeof pricing.amount !== "number") return pricing.type === "hourly" ? "Hourly" : "Quote";
  const sym = pricing.currency === "INR" ? "\u20B9" : pricing.currency;
  const label = pricing.type === "hourly" ? "/hr" : pricing.type === "fixed" ? "" : "";
  return `${sym}${pricing.amount}${label}`;
}

export function formatDate(iso: string | Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatRelative(iso: string | Date): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}\u2026` : s;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}