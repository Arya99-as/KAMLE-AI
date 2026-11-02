import { Filter, MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchWorkers, getCategories, type SearchResult } from "../services/api";
import type { PublicWorker, ServiceCategory } from "../types";
import { useLocation } from "../context/LocationContext";
import { WorkerCard } from "../components/worker/WorkerCard";
import { Button, Select, WorkerGridSkeleton, Badge } from "../components/ui/primitives";
import { EmptyState, ErrorState } from "../components/ui/states";

interface Filters {
  q: string;
  category: string;
  location: string;
  skills: string;
  minRating: string;
  minExperience: string;
  sort: string;
  page: number;
}

const EMPTY: Filters = { q: "", category: "", location: "", skills: "", minRating: "", minExperience: "", sort: "relevance", page: 1 };

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const { location: defaultLocation, setLocation } = useLocation();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [mobileFilters, setMobileFilters] = useState(false);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initial: Filters = useMemo(
    () => ({
      q: params.get("q") ?? "",
      category: params.get("category") ?? "",
      location: params.get("location") ?? "",
      skills: params.get("skills") ?? "",
      minRating: params.get("minRating") ?? "",
      minExperience: params.get("minExperience") ?? "",
      sort: params.get("sort") ?? "relevance",
      page: Number(params.get("page")) || 1,
    }),
    [],
  );

  const [filters, setFiltersState] = useState<Filters>(initial);

  function setFilters(patch: Partial<Filters>) {
    setFiltersState((prev) => {
      const next = { ...prev, ...patch };
      if ("page" in patch) return next;
      return { ...next, page: 1 };
    });
  }

  useEffect(() => {
    void getCategories().then((d) => setCategories(d.categories)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void load();
    }, 250);
    return () => clearTimeout(timeout);
  }, [filters]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await searchWorkers({
        q: filters.q || undefined,
        category: filters.category || undefined,
        location: filters.location || defaultLocation || undefined,
        skills: filters.skills || undefined,
        minRating: filters.minRating ? Number(filters.minRating) : undefined,
        minExperience: filters.minExperience ? Number(filters.minExperience) : undefined,
        sort: filters.sort === "relevance" ? undefined : filters.sort,
        page: filters.page,
        limit: 12,
      });
      setResult(data);
      setParams(
        {
          q: filters.q || "",
          category: filters.category || "",
          location: filters.location || "",
          minRating: filters.minRating || "",
          minExperience: filters.minExperience || "",
          sort: filters.sort === "relevance" ? "" : filters.sort,
          page: String(filters.page),
        },
        { replace: true },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't load workers. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const hasActiveFilters = Boolean(filters.q || filters.category || filters.location || filters.skills || filters.minRating || filters.minExperience || filters.sort !== "relevance");

  function clearAll() {
    setFiltersState(EMPTY);
    setLocation(defaultLocation);
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="border-b border-line bg-white">
        <div className="container-x flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-ink">Find Local Workers</h1>
            <p className="mt-1 text-sm text-muted">Discover verified professionals with transparent pricing and reviews</p>
          </div>
          <div className="flex w-full items-center gap-2 lg:w-auto">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 lg:w-[420px]">
              <Search size={18} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="Search by service, skill, or keyword"
                value={filters.q}
                onChange={(e) => setFilters({ q: e.target.value })}
              />
            </div>
            <Button variant="secondary" className="lg:hidden" onClick={() => setMobileFilters((v) => !v)}>
              <SlidersHorizontal size={16} /> Filters
              {hasActiveFilters && <Badge tone="brand">•</Badge>}
            </Button>
          </div>
        </div>
      </div>

      <div className="container-x py-6">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className={`${mobileFilters ? "block" : "hidden"} lg:block`}>
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Filter size={16} /> Filters
                </div>
                {hasActiveFilters && (
                  <button onClick={clearAll} className="text-xs font-semibold text-brand-700 hover:underline">
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="label">Category</span>
                  <Select value={filters.category} onChange={(e) => setFilters({ category: e.target.value })}>
                    <option value="">All Categories</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="label">Skills</span>
                  <input className="input" placeholder="e.g. plumbing, wiring" value={filters.skills} onChange={(e) => setFilters({ skills: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">Location</span>
                  <div className="relative">
                    <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input className="input pl-9" placeholder={defaultLocation || "City/Area"} value={filters.location} onChange={(e) => setFilters({ location: e.target.value })} />
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="label">Min Rating</span>
                    <Select value={filters.minRating} onChange={(e) => setFilters({ minRating: e.target.value })}>
                      <option value="">Any</option>
                      <option value="4.5">4.5+</option>
                      <option value="4.0">4.0+</option>
                      <option value="3.5">3.5+</option>
                      <option value="3.0">3.0+</option>
                    </Select>
                  </label>
                  <label className="block">
                    <span className="label">Experience</span>
                    <Select value={filters.minExperience} onChange={(e) => setFilters({ minExperience: e.target.value })}>
                      <option value="">Any</option>
                      <option value="1">1+ yrs</option>
                      <option value="3">3+ yrs</option>
                      <option value="5">5+ yrs</option>
                      <option value="8">8+ yrs</option>
                    </Select>
                  </label>
                </div>
                <label className="block">
                  <span className="label">Sort By</span>
                  <Select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
                    <option value="relevance">Best Match</option>
                    <option value="rating">Highest Rating</option>
                    <option value="experience">Most Experienced</option>
                    <option value="reviews">Most Reviews</option>
                  </Select>
                </label>
                <Button className="w-full lg:hidden" onClick={() => setMobileFilters(false)}>
                  View Results
                </Button>
              </div>
            </div>
          </aside>

          <section>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-white px-4 py-2.5 text-sm">
              <span className="text-muted">
                <span className="font-semibold text-ink">{result?.total ?? 0}</span> verified workers
              </span>
              <span className="text-muted">
                Page {result?.page ?? 1} of {result?.totalPages ?? 1}
              </span>
            </div>

            {loading ? (
              <WorkerGridSkeleton count={6} />
            ) : error ? (
              <ErrorState message={error} onRetry={() => void load()} />
            ) : result && result.total === 0 ? (
              <EmptyState
                title="No workers found"
                message={hasActiveFilters ? "Try changing your filters to see more results." : "New professionals are added regularly."}
                action={
                  hasActiveFilters ? (
                    <Button variant="secondary" onClick={clearAll}>
                      <X size={16} /> Clear Filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {result?.items.map((w: PublicWorker) => <WorkerCard key={w.workerId} worker={w} />)}
                </div>
                {result && result.totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })}>
                      Previous
                    </Button>
                    <Button variant="secondary" size="sm" disabled={!result.hasNext} onClick={() => setFilters({ page: filters.page + 1 })}>
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
