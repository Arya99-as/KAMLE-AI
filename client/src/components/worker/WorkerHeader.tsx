import { Link } from "react-router-dom";
import { Search, Bell, User, Menu } from "lucide-react";
import { Avatar } from "../ui/primitives";
import { useAuth } from "../../context/AuthContext";

export default function WorkerHeader() {
  const { user } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-line bg-white px-4 py-3 lg:px-8 sticky top-0 z-10 shadow-sm">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button className="lg:hidden p-2 rounded hover:bg-gray-100">
          <Menu size={20} />
        </button>
        <div className="relative hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search jobs, enquiries..."
            className="rounded-lg border border-line bg-gray-50 pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-64"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-full hover:bg-gray-100">
          <Bell size={20} className="text-slate-600" />
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">3</span>
        </button>
        <Link to="/onboarding" className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 transition">
          <Avatar name={user?.name ?? "Worker"} size={32} />
          <div className="hidden sm:block text-left">
            <div className="text-sm font-semibold text-slate-800 leading-tight">{user?.name ?? "Worker"}</div>
            <div className="text-xs text-muted leading-tight">Worker</div>
          </div>
          <User size={16} className="text-muted" />
        </Link>
      </div>
    </header>
  );
}
