import { type ReactNode } from "react";
import WorkerSidebar from "./WorkerSidebar";
import WorkerHeader from "./WorkerHeader";

interface Props {
  children: ReactNode;
}

export default function WorkerLayout({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Fixed Sidebar */}
      <WorkerSidebar />
      {/* Main area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Sticky Header */}
        <WorkerHeader />
        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
