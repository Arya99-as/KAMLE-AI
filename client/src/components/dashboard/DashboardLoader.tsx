import { Spinner } from "../ui/primitives";

interface DashboardLoaderProps {
  message?: string;
}

export function DashboardLoader({ message = "Loading dashboard data..." }: DashboardLoaderProps) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <Spinner />
      <p className="mt-4 text-sm font-medium text-muted">{message}</p>
    </div>
  );
}
