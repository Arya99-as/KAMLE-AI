import { UserRound, Wrench } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api";
import { Button, Field, Input } from "../../components/ui/primitives";
import { Logo } from "../../components/brand/Logo";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [role, setRole] = useState<"customer" | "worker">(params.get("role") === "worker" ? "worker" : "customer");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ name, phone, email: email || undefined, password, role, location });
      navigate(role === "worker" ? "/worker/onboarding" : "/account", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create your account right now.");
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
            <h1 className="mt-4 text-xl font-bold">Create your account</h1>
            <p className="mt-1 text-sm text-muted">One account for every role on KAMLE AI.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-semibold transition ${role === "customer" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted hover:border-brand-300"}`}
            >
              <UserRound size={20} /> I need a worker
            </button>
            <button
              type="button"
              onClick={() => setRole("worker")}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-semibold transition ${role === "worker" ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted hover:border-brand-300"}`}
            >
              <Wrench size={20} /> I am a worker
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required minLength={2} />
            </Field>
            <Field label="Phone number">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 9800000001" required pattern="^\+?[0-9\s-]{7,15}$" />
            </Field>
            <Field label="Email (optional)">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Field label="Your area (optional)">
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Kolhapur" />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </Field>
            {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-brand-700 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}