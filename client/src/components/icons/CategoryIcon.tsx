import {
  Car,
  Droplets,
  Hammer,
  Laptop,
  Paintbrush,
  Refrigerator,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  plumbing: Droplets,
  electrical: Zap,
  "appliance repair": Refrigerator,
  carpentry: Hammer,
  painting: Paintbrush,
  cleaning: Sparkles,
  "vehicle repair": Car,
  "computer repair": Laptop,
  other: Wrench,
  default: Wrench,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const key = name.toLowerCase();
  const Icon = ICON_MAP[key] ?? Wrench;
  return <Icon className={className} aria-hidden />;
}

export { ICON_MAP };