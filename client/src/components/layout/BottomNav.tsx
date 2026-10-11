import { Heart, Home, Search, UserRound, Sparkles } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useChat } from "../../features/chat/ChatContext";
import { useAuth } from "../../context/AuthContext";

export function BottomNav() {
  const { openChat } = useChat();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const items = [
    { label: "Home", icon: <Home size={20} />, to: "/", end: true },
    { label: "Discover", icon: <Search size={20} />, to: "/discover", end: false },
    { label: "AI", icon: <Sparkles size={20} />, to: "", end: false },
    { label: "Saved", icon: <Heart size={20} />, to: "/account?tab=favorites", end: false },
    { label: "Account", icon: <UserRound size={20} />, to: "/account", end: false },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur md:hidden" aria-label="Bottom navigation">
      <div className="grid grid-cols-5">
        {items.map((item) =>
          item.label === "AI" ? (
            <button
              key={item.label}
              onClick={() => {
                if (!isAuthenticated) navigate("/login");
                else openChat();
              }}
              className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-ai"
              aria-label="Open KAMLE AI chat"
            >
              {item.icon}
              {item.label}
            </button>
          ) : (
            <NavLink key={item.label} to={item.to} end={item.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${isActive ? "text-brand-700" : "text-muted"}`}>
              {item.icon}
              {item.label}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}