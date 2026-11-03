import { CheckCircle2, Loader2, LogIn, ShieldCheck, ShoppingBag, Sparkles, Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";
import { Button, Field, Input } from "../../components/ui/primitives";
import { Logo } from "../../components/brand/Logo";

type DemoRole = "admin" | "customer" | "worker";

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [demoLoadingRole, setDemoLoadingRole] = useState<DemoRole | null>(null);
  const [demoSuccess, setDemoSuccess] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const isBusy = submitting || demoLoadingRole !== null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDemoError(null);
    setDemoSuccess(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/account", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to log in right now.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(role: DemoRole) {
    setError(null);
    setDemoError(null);
    setDemoSuccess(null);
    setDemoLoadingRole(role);

    const roleLabels: Record<DemoRole, string> = {
      admin: "Admin",
      customer: "Customer",
      worker: "Worker",
    };

    const targetRoutes: Record<DemoRole, string> = {
      admin: "/account/admin",
      customer: "/account/customer",
      worker: "/account/worker",
    };

    try {
      const authenticatedUser = await demoLogin(role);
      const label = roleLabels[role];
      setDemoSuccess(`Authenticated as ${label} (${authenticatedUser.name || label}). Opening dashboard...`);

      // Smooth brief transition to show feedback before navigating to role-specific dashboard
      setTimeout(() => {
        const from = (location.state as { from?: string } | null)?.from;
        const target = from && from !== "/login" ? from : targetRoutes[authenticatedUser.role as DemoRole] || "/account";
        navigate(target, { replace: true });
      }, 350);
    } catch (err) {
      setDemoError(err instanceof ApiError ? err.message : `Unable to authenticate as demo ${role}.`);
      setDemoLoadingRole(null);
    }
  }

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-lg">
        <div className="card p-8 shadow-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo size="md" />
            <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Log in to continue to KAMLE AI.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Phone or email">
              <Input
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9800000001 or name@example.com"
                required
                autoComplete="username"
                disabled={isBusy}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                autoComplete="current-password"
                disabled={isBusy}
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger animate-in fade-in">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isBusy}>
              <LogIn size={17} /> {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>

          {/* Quick Demo Access Section */}
          <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-brand-600" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Quick Demo Access
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                1-Click Role Login
              </span>
            </div>

            <p className="mb-4 text-xs text-slate-500">
              Select any role to test full end-to-end features with dedicated demo accounts.
            </p>

            {demoSuccess && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 animate-in fade-in">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{demoSuccess}</span>
              </div>
            )}

            {demoError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-danger-light px-3 py-2 text-xs font-medium text-danger animate-in fade-in">
                {demoError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {/* Admin Demo Button */}
              <button
                type="button"
                onClick={() => handleDemoLogin("admin")}
                disabled={isBusy}
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 transition group-hover:scale-105">
                  {demoLoadingRole === "admin" ? (
                    <Loader2 size={18} className="animate-spin text-indigo-700" />
                  ) : (
                    <ShieldCheck size={18} />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-800">Admin Demo</span>
                <span className="text-[10px] text-slate-500">Operations Console</span>
              </button>

              {/* Customer Demo Button */}
              <button
                type="button"
                onClick={() => handleDemoLogin("customer")}
                disabled={isBusy}
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition group-hover:scale-105">
                  {demoLoadingRole === "customer" ? (
                    <Loader2 size={18} className="animate-spin text-emerald-700" />
                  ) : (
                    <ShoppingBag size={18} />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-800">Customer Demo</span>
                <span className="text-[10px] text-slate-500">Discover & Hire</span>
              </button>

              {/* Worker Demo Button */}
              <button
                type="button"
                onClick={() => handleDemoLogin("worker")}
                disabled={isBusy}
                className="group flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center transition hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 transition group-hover:scale-105">
                  {demoLoadingRole === "worker" ? (
                    <Loader2 size={18} className="animate-spin text-amber-700" />
                  ) : (
                    <Wrench size={18} />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-800">Worker Demo</span>
                <span className="text-[10px] text-slate-500">Jobs & Earnings</span>
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            New to KAMLE AI?{" "}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Demo access is enabled for evaluation. Passwords are never exposed in client code.
        </p>
      </div>
    </div>
  );
}
