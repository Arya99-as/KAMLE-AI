import { ArrowRight, MapPin, MessageSquareText, Search, ShieldCheck, Sparkles, Star, UserCheck, UserSearch } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { recommendedWorkers, getCategories } from "../services/api";
import type { PublicWorker, ServiceCategory } from "../types";
import { qs } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../features/chat/ChatContext";
import { useLocation } from "../context/LocationContext";
import { WorkerCard } from "../components/worker/WorkerCard";
import { CategoryIcon } from "../components/icons/CategoryIcon";
import { Button, WorkerGridSkeleton } from "../components/ui/primitives";
import { ErrorState, EmptyState } from "../components/ui/states";

const EXAMPLES = ["My washing machine is not working", "I need a plumber for a water leakage problem", "My refrigerator is not cooling", "I need someone to paint my house"];

const HOW_IT_WORKS = [
  { icon: <MessageSquareText size={22} />, title: "1 · Describe your problem", text: "Type what's wrong in plain language — a leaking tap, a noisy fan or a laptop that won't start." },
  { icon: <UserSearch size={22} />, title: "2 · Get suitable recommendations", text: "KAMLE AI understands the requirement and the backend ranks approved local workers." },
  { icon: <UserCheck size={22} />, title: "3 · Compare profiles", text: "Review skills, experience, areas served, pricing and genuine customer reviews side by side." },
  { icon: <Star size={22} />, title: "4 · Contact your preferred worker", text: "Send an enquiry, then call or message your chosen professional directly." },
];

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { openChat } = useChat();
  const { location } = useLocation();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [workers, setWorkers] = useState<PublicWorker[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [catRes, workerRes] = await Promise.all([getCategories(), recommendedWorkers()]);
        if (!alive) return;
        setCategories(catRes.categories);
        setWorkers(workerRes.workers);
      } catch {
        if (alive) setError("We couldn't load workers right now.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/discover${qs({ q })}` : "/discover");
  }

  function onAskAI() {
    if (!isAuthenticated) {
      navigate("/register");
      return;
    }
    openChat();
    if (query.trim()) {
      // surface the typed problem in the chat by storing it briefly
      sessionStorage.setItem("kamle_ai_pending_query", query.trim());
    }
  }

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line bg-gradient-to-b from-brand-light via-white to-white">
        <div className="container-x pb-12 pt-12 text-center md:pt-16">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-light px-3 py-1 text-xs font-semibold text-ai">
            <Sparkles size={13} /> AI-powered local worker discovery
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-center md:text-5xl">
            Find the Right Worker for <span className="text-brand-600">Any Problem</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted md:text-lg">
            Describe your problem, discover suitable local professionals, and connect with the right person.
          </p>

          <form onSubmit={onSearch} className="mx-auto mt-8 max-w-2xl">
            <div className="card flex flex-col gap-2 p-2 shadow-lift sm:flex-row">
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search size={18} className="shrink-0 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Describe your problem..."
                  className="w-full bg-transparent py-2.5 text-base outline-none placeholder:text-slate-400"
                  aria-label="Describe your problem"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="lg" className="flex-1 sm:flex-none">
                  Search <ArrowRight size={18} />
                </Button>
                <Button type="button" variant="ai" size="lg" onClick={onAskAI}>
                  <Sparkles size={18} /> Ask AI
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted">
              <MapPin size={13} />
              <span>
                Serving <span className="font-semibold text-ink">{location}</span> and nearby areas
              </span>
            </div>
          </form>

          <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium text-muted">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuery(ex);
                }}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand-300 hover:text-brand-700"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-x py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Popular services</h2>
            <p className="mt-1 text-sm text-muted">Browse by category to find approved local workers.</p>
          </div>
          <Link to="/discover" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:inline-flex">
            View all <ArrowRight size={15} />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card h-28 p-5">
                <div className="h-10 w-10 rounded-xl bg-slate-100" />
                <div className="mt-3 h-4 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((cat) => (
              <Link
                key={cat._id}
                to={`/discover${qs({ category: cat.name })}`}
                className="card group p-5 transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
                  <CategoryIcon name={cat.name} className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-bold group-hover:text-brand-700">{cat.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{cat.description}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="border-y border-line bg-white">
        <div className="container-x py-12">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight">How KAMLE AI works</h2>
            <p className="mt-1 text-sm text-muted">From problem to professional in four simple steps.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-4">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.title} className="card p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{step.icon}</span>
                <h3 className="mt-3 text-sm font-bold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recommended workers */}
      <section className="container-x py-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Recommended workers</h2>
          <p className="mt-1 text-sm text-muted">Approved local professionals on KAMLE AI right now.</p>
        </div>

        {error && !workers ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : workers === null ? (
          <WorkerGridSkeleton count={6} />
        ) : workers.length === 0 ? (
          <EmptyState title="No approved workers yet" message="Workers you can trust will appear here once they are approved." />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {workers.map((w) => (
              <WorkerCard key={w.workerId} worker={w} />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Link to="/discover" className="btn-secondary">
            Explore all workers <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Explainable matching */}
      <section className="border-t border-line bg-white">
        <div className="container-x grid items-center gap-8 py-12 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-light px-3 py-1 text-xs font-semibold text-ai">
              <Sparkles size={13} /> Explainable matching
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">AI that explains its choices</h2>
            <p className="mt-3 text-muted">
              KAMLE AI never invents workers. It turns your problem into a structured search, then ranks approved profiles
              using real data — skills, service area, experience, ratings and pricing — and tells you why each worker
              was recommended.
            </p>
            <ul className="mt-5 space-y-3">
              {[
                { icon: <ShieldCheck size={18} />, text: "Only approved, active worker profiles are ever shown." },
                { icon: <UserCheck size={18} />, text: "Missing data is handled honestly — no fabricated prices or ratings." },
                { icon: <Star size={18} />, text: "Every recommendation lists the actual reasons behind it." },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ai-light text-ai">{item.icon}</span>
                  <span className="text-ink">{item.text}</span>
                </li>
              ))}
            </ul>
            <Button variant="ai" className="mt-6" onClick={onAskAI}>
              <Sparkles size={17} /> Try KAMLE AI chat
            </Button>
          </div>
          <div className="card bg-gradient-to-br from-ai-light to-white p-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">Customer:</span> “My bathroom tap is leaking.”
              </p>
              <div className="my-4 h-px bg-line" />
              <p className="text-sm text-ai">
                <span className="font-semibold">KAMLE AI:</span> “I can help you find a plumbing professional. Which area do you
                need service in?”
              </p>
              <div className="my-4 h-px bg-line" />
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink">Customer:</span> “Kolhapur.”
              </p>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs text-white">RP</span>
                  Ramesh Patil
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-success">
                    <ShieldCheck size={13} /> Verified
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">
                  <span className="font-semibold text-ai">Why:</span> Lists leak repair as a skill and serves Kolhapur. 8 years of
                  experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}