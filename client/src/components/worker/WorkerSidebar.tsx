import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Settings,
  HelpCircle,
  LogOut,
  BarChart2,
  List,
  CheckSquare,
  DollarSign,
  Image,
  FileText,
  Star,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/dashboard/worker", label: "Dashboard", icon: Home, end: true },
  { to: "/dashboard/worker/enquiries", label: "My Enquiries", icon: List },
  { to: "/dashboard/worker/accepted", label: "Accepted Jobs", icon: CheckSquare },
  { to: "/dashboard/worker/completed", label: "Completed Jobs", icon: FileText },
  { to: "/dashboard/worker/services", label: "My Services", icon: BarChart2 },
  { to: "/dashboard/worker/portfolio", label: "My Portfolio", icon: Image },
  { to: "/dashboard/worker/reviews", label: "My Reviews", icon: Star },
  { to: "/dashboard/worker/earnings", label: "Earnings", icon: DollarSign },
  { to: "/dashboard/worker/messages", label: "Messages", icon: MessageSquare, badge: 3 },
  { to: "/dashboard/worker/profile", label: "My Profile", icon: User },
  { to: "/dashboard/worker/settings", label: "Settings", icon: Settings },
];

export default function WorkerSidebar() {
  const [open, setOpen] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div
      className={`bg-white border-r border-line flex flex-col shrink-0 transition-all duration-200 ${open ? "w-60" : "w-16"}`}
      style={{ minHeight: "100vh" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-line">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-xs">K</span>
          </div>
          {open && (
            <div>
              <div className="text-sm font-black text-slate-800 leading-tight">KAMLE AI</div>
              <div className="text-[10px] text-muted leading-tight">Worker Panel</div>
            </div>
          )}
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-1 rounded hover:bg-gray-100 text-muted shrink-0"
        >
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:bg-gray-50 hover:text-slate-900"
                }`
              }
              title={!open ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {open && <span className="flex-1 truncate">{item.label}</span>}
              {open && item.badge && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-line py-3 px-2 space-y-1">
        <Link
          to="/support"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-gray-50 transition-colors`}
          title={!open ? "Help & Support" : undefined}
        >
          <HelpCircle size={18} className="shrink-0" />
          {open && <span>Help & Support</span>}
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          title={!open ? "Logout" : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {open && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
