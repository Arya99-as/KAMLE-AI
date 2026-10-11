import { Menu, MapPin, Search, X, LogOut, LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLocation } from "../../context/LocationContext";
import { Avatar, Button } from "../ui/primitives";
import { Logo } from "../brand/Logo";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/discover", label: "Discover" },
  { to: "/account", label: "Dashboard" },
];

export function Header() {
  const { user, logout } = useAuth();
  const { location, setLocation } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const locRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (locRef.current && !locRef.current.contains(e.target as Node)) setLocOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3">
        <Link to="/" className="shrink-0" aria-label="KAMLE AI home">
          <Logo />
        </Link>

        <div className="relative hidden md:block" ref={locRef}>
          <button
            className="btn-secondary gap-1.5 text-sm"
            onClick={() => setLocOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={locOpen}
          >
            <MapPin size={15} className="text-brand-600" /> {location}
          </button>
          {locOpen && (
            <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-white p-3 shadow-lift" role="listbox">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = new FormData(e.currentTarget).get("loc") as string;
                  if (input?.trim()) setLocation(input.trim());
                  setLocOpen(false);
                }}
              >
                <label className="label">Your service area</label>
                <div className="flex gap-2">
                  <input name="loc" className="input" placeholder="e.g. Kolhapur" defaultValue={location} aria-label="Service area" />
                  <Button type="submit" size="sm">Set</Button>
                </div>
              </form>
            </div>
          )}
        </div>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-slate-100 hover:text-ink"}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/discover" className="btn-ghost p-2.5" aria-label="Search workers">
            <Search size={18} />
          </Link>

          {user ? (
            <>
              <Link to="/account" className="hidden sm:block">
                <div className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 hover:border-brand-300">
                  <Avatar name={user.name} src={user.avatarUrl} size={30} />
                  <span className="text-sm font-semibold">{user.name.split(" ")[0]}</span>
                </div>
              </Link>
              <button className="btn-ghost p-2.5 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
              <button className="btn-ghost hidden px-2.5 lg:inline-flex" onClick={logout} aria-label="Log out">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost hidden sm:inline-flex">
                <LogIn size={16} /> Log in
              </Link>
              <Link to="/register" className="btn-primary hidden sm:inline-flex">
                Sign up
              </Link>
              <button className="btn-ghost p-2.5 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile location */}
      <div className="border-t border-line px-4 py-2 md:hidden">
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const input = new FormData(e.currentTarget).get("loc") as string;
            if (input?.trim()) setLocation(input.trim());
          }}
        >
          <MapPin size={15} className="shrink-0 text-brand-600" />
          <input name="loc" className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted" placeholder={`Service area · ${location}`} aria-label="Service area" />
        </form>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-white p-5 shadow-lift">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-muted hover:bg-slate-100" aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            {user && (
              <Link to="/account" className="mb-4 flex items-center gap-3 rounded-xl bg-brand-50 p-3" onClick={() => setMobileOpen(false)}>
                <Avatar name={user.name} src={user.avatarUrl} size={36} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{user.name}</div>
                  <div className="text-xs capitalize text-muted">{user.role} dashboard</div>
                </div>
              </Link>
            )}
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"} onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-100">
                  {n.label}
                </NavLink>
              ))}
              {!user && (
                <>
                  <Link to="/login" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-100" onClick={() => setMobileOpen(false)}>
                    Log in
                  </Link>
                  <Link to="/register" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-100" onClick={() => setMobileOpen(false)}>
                    Sign up
                  </Link>
                </>
              )}
              {user && (
                <>
                  <Link to="/worker/onboarding" className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-100" onClick={() => setMobileOpen(false)}>
                    Become a Worker
                  </Link>
                  <button className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-danger hover:bg-slate-100" onClick={() => { logout(); setMobileOpen(false); navigate("/"); }}>
                    <LogOut size={16} /> Log out
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}