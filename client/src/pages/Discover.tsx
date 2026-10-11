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
    [], // eslint-disable-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Keep the URL in sync for sharing.
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
    <div className="container-x py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discover workers</h1>
          <p className="mt-1 text-sm text-muted">Browse approved local professionals. No pending or rejected profiles are shown.</p>
        </div>
        <Button variant="secondary" className="lg:hidden" onClick={() => setMobileFilters((v) => !v)}>
          <SlidersHorizontal size={16} /> Filters
          {hasActiveFilters && <Badge tone="brand">{1}</Badge>}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Filters sidebar */}
        <aside className={`${mobileFilters ? "block" : "hidden"} lg:block`}>
          <div className="card sticky top-20 space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Filter size={16} /> Filters
              </h2>
              {hasActiveFilters && (
                <button onClick={clearAll} className="text-xs font-semibold text-brand-700 hover:underline">
                  Clear all
                </button>
              )}
            </div>

            <label className="block">
              <span className="label">Keyword</span>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" placeholder="e.g. fridge repair" value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} />
              </div>
            </label>

            <label className="block">
              <span className="label">Service category</span>
              <Select value={filters.category} onChange={(e) => setFilters({ category: e.target.value })}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="label">Skills</span>
              <input className="input" placeholder="Comma separated, e.g. Leak Repair" value={filters.skills} onChange={(e) => setFilters({ skills: e.target.value })} />
            </label>

            <label className="block">
              <span className="label">Location</span>
              <div className="relative">
                <MapPin size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" placeholder={defaultLocation} value={filters.location} onChange={(e) => setFilters({ location: e.target.value })} />
              </div>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="label">Min rating</span>
                <Select value={filters.minRating} onChange={(e) => setFilters({ minRating: e.target.value })}>
                  <option value="">Any</option>
                  {["4.5", "4.0", "3.5", "3.0"].map((r) => (
                    <option key={r} value={r}>
                      {r}+
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="label">Experience</span>
                <Select value={filters.minExperience} onChange={(e) => setFilters({ minExperience: e.target.value })}>
                  <option value="">Any</option>
                  {["1", "3", "5", "8"].map((y) => (
                    <option key={y} value={y}>
                      {y}+ yrs
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            <label className="block">
              <span className="label">Sort by</span>
              <Select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
                <option value="relevance">Best match</option>
                <option value="rating">Highest rating</option>
                <option value="experience">Most experienced</option>
                <option value="reviews">Most reviews</option>
              </Select>
            </label>

            <Button className="w-full lg:hidden" onClick={() => setMobileFilters(false)}>
              Show results
            </Button>
          </div>
        </aside>

        {/* Results */}
        <section>
          {loading ? (
            <WorkerGridSkeleton count={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : result && result.total === 0 ? (
            <EmptyState
              title="No approved workers match your search yet"
              message={hasActiveFilters ? "Try broadening your service area or removing a filter." : "Check back soon — new workers join KAMLE AI every week."}
              action={
                hasActiveFilters ? (
                  <Button variant="secondary" onClick={clearAll}>
                    <X size={16} /> Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between text-sm text-muted">
                <span>
                  {result && <strong className="text-ink">{result.total}</strong>} approved worker{result && result.total !== 1 ? "s" : ""} found
                  {filters.location && (
                    <>
                      {" "}serving <strong className="text-ink">{filters.location}</strong>
                    </>
                  )}
                </span>
                <span className="hidden sm:inline">{result && result.page} of {result && result.totalPages}</span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {result?.items.map((w: PublicWorker) => <WorkerCard key={w.workerId} worker={w} />)}
              </div>

              {result && result.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-3">
                  <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters({ page: filters.page - 1 })}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted">Page {filters.page} of {result.totalPages}</span>
                  <Button variant="secondary" disabled={!result.hasNext} onClick={() => setFilters({ page: filters.page + 1 })}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}