import { cn } from "../lib/utils";

interface LogoProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
  imageClassName?: string;
}

const sizeMap = {
  xs: "h-7",
  sm: "h-8",
  md: "h-10",
  lg: "h-12",
  xl: "h-14",
};

export function Logo({ size = "md", showTagline = false, className, imageClassName }: LogoProps) {
  return (
    <div className={cn("flex flex-col items-start", className)}>
      <img
        src="/assets/kamle-ai-logo.png"
        alt="KAMLE AI - Describe Your Problem. Discover the Right Local Worker."
        className={cn("w-auto object-contain", sizeMap[size], imageClassName)}
        loading="eager"
        decoding="async"
      />
      {showTagline && (
        <p className="mt-1 text-[10px] text-muted sm:text-xs">
          Describe Your Problem. Discover the Right Local Worker.
        </p>
      )}
    </div>
  );
}

export default Logo;
