import { LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";
import { Button, Field, Input } from "../../components/ui/primitives";
import { Logo } from "../../components/brand/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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

  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo />
            <h1 className="mt-4 text-xl font-bold">Welcome back</h1>
            <p className="mt-1 text-sm text-muted">Log in to continue to KAMLE AI.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Phone or email">
              <Input autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="e.g. 9800000001 or name@example.com" required autoComplete="username" />
            </Field>
            <Field label="Password">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" required autoComplete="current-password" />
            </Field>
            {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              <LogIn size={17} /> {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            New to KAMLE AI?{" "}
            <Link to="/register" className="font-semibold text-brand-700 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          Demo accounts (password: Password123): admin@kamle.ai · customer@example.com · ramesh@example.com
        </p>
      </div>
    </div>
  );
}