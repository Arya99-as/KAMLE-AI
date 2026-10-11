import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CalendarClock,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { addFavorite, createEnquiry, getWorker, removeFavorite } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "../context/LocationContext";
import type { WorkerDetail } from "../services/api";
import type { Review } from "../types";
import { formatPrice, formatRelative } from "../lib/utils";
import { Avatar, Badge, Button, Chip, Modal, Skeleton, Stars, Textarea } from "../components/ui/primitives";
import { ErrorState } from "../components/ui/states";

export default function WorkerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { location: defaultLocation } = useLocation();
  const [data, setData] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");
  const [area, setArea] = useState(defaultLocation);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getWorker(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't load this worker.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmitEnquiry() {
    if (!data || !id) return;
    if (problem.trim().length < 10) return;
    setSubmitting(true);
    try {
      await createEnquiry({
        workerId: data.worker.userId,
        serviceCategory: data.worker.serviceCategories[0] ?? "General",
        problemDescription: problem.trim(),
        location: area.trim(),
      });
      setSent(true);
      setEnquiryOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the enquiry. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function openEnquiry() {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (user?.role !== "customer") return;
    setSent(false);
    setEnquiryOpen(true);
  }

  async function toggleFavorite() {
    if (!data) return;
    try {
      if (favorited) {
        await removeFavorite(data.worker.userId);
        setFavorited(false);
      } else {
        await addFavorite(data.worker.userId);
        setFavorited(true);
      }
    } catch {
      setError("Could not update favorites right now.");
    }
  }

  if (loading) {
    return (
      <div className="container-x py-6">
        <Skeleton className="h-10 w-40" />
        <div className="card mt-5 p-6">
          <div className="flex gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className="container-x py-6"><ErrorState message={error} onRetry={() => void load()} /></div>;
  if (!data) return null;

  const { worker, reviews } = data;
  const canFavorite = isAuthenticated && user?.role === "customer";
  const phone = worker.phone?.replace(/\D/g, "");

  return (
    <div className="container-x py-6">
      <button onClick={() => navigate(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <section className="card overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-brand-600 to-brand-800" />
        <div className="p-6 pt-0">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar name={worker.name} src={worker.avatarUrl} size={84} className="ring-4 ring-white" />
              <div className="pt-10">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight">{worker.name}</h1>
                  {worker.verificationStatus === "verified" && (
                    <Badge tone="success">
                      <ShieldCheck size={13} /> Verified
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {worker.serviceAreas.join(", ")}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Briefcase size={14} /> {worker.experienceYears > 0 ? `${worker.experienceYears} years experience` : "Experience unlisted"}
                  </span>
                  {worker.ratingCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-ink">
                      <Stars value={worker.ratingAverage} count={worker.ratingCount} />
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canFavorite && (
                <Button variant="secondary" onClick={() => void toggleFavorite()} aria-pressed={favorited}>
                  <Heart size={16} className={favorited ? "fill-danger text-danger" : ""} />
                  {favorited ? "Saved" : "Save"}
                </Button>
              )}
              {phone && (
                <>
                  <a className="btn-secondary" href={`tel:${phone}`}>
                    <Phone size={16} /> Call
                  </a>
                  <a className="btn bg-success text-white hover:opacity-90" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                </>
              )}
              <Button onClick={openEnquiry} disabled={!isAuthenticated || user?.role !== "customer"}>
                <Send size={16} /> Send enquiry
              </Button>
            </div>
          </div>
        </div>
      </section>

      {sent && (
        <div className="card mt-4 border-success bg-success-light p-4 text-sm text-success">
          Your enquiry was sent. <Link to="/account/customer" className="font-semibold underline">Track it in your dashboard</Link> — the worker can accept, decline or complete it.
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* About */}
          <section className="card p-6">
            <h2 className="text-lg font-bold">About</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink">{worker.professionalDescription || "This worker hasn't added a description yet."}</p>
            {worker.experienceSummary && <p className="mt-3 text-sm leading-relaxed text-muted">{worker.experienceSummary}</p>}
          </section>

          {/* Skills & categories */}
          <section className="card p-6">
            <h2 className="text-lg font-bold">Services & skills</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {worker.serviceCategories.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
            </div>
            {worker.skills.length > 0 && (
              <>
                <h3 className="mt-5 text-sm font-bold text-muted">Skills</h3>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {worker.skills.map((s) => (
                    <li key={s} className="flex items-center gap-2 text-sm">
                      <BadgeCheck size={15} className="shrink-0 text-brand-600" /> {s}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Portfolio */}
          {worker.portfolioImages && worker.portfolioImages.length > 0 && (
            <section className="card p-6">
              <h2 className="text-lg font-bold">Portfolio</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {worker.portfolioImages.map((img, i) => (
                  <img key={i} src={img} alt="Work sample" className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Customer reviews</h2>
              {worker.ratingCount > 0 && (
                <span className="text-sm text-muted">
                  <Stars value={worker.ratingAverage} count={worker.ratingCount} />
                </span>
              )}
            </div>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted">This worker has no customer reviews yet. Only genuine reviews after completed work appear here.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reviews.map((r: Review) => (
                  <li key={r.id ?? r._id} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold">{r.customerName}</span>
                        <span className="ml-2 text-xs text-muted">{formatRelative(r.createdAt)}</span>
                      </div>
                      <Stars value={r.rating} />
                    </div>
                    {r.comment && <p className="mt-1.5 text-sm text-muted">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-lg font-bold">Pricing</h2>
            <p className="mt-2 text-2xl font-extrabold">{formatPrice(worker.pricing)}</p>
            {worker.pricing.note && <p className="mt-1 text-sm text-muted">{worker.pricing.note}</p>}
            <p className="mt-3 text-xs text-muted">
              {worker.pricing.type === "quote" ? "The worker provides a custom quote for your specific job." : "Agree on the final amount with the worker before work begins."}
            </p>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <CalendarClock size={18} className="text-brand-600" /> Availability
            </h2>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${worker.availability.availableNow ? "bg-success" : "bg-slate-300"}`} />
              <span className="text-sm font-semibold">{worker.availability.availableNow ? "Currently available" : "Available by arrangement"}</span>
            </div>
            {worker.availability.days.length > 0 && (
              <p className="mt-2 text-sm text-muted">Working days: {worker.availability.days.join(", ")}</p>
            )}
            {worker.availability.note && <p className="mt-1 text-sm text-muted">{worker.availability.note}</p>}
            <p className="mt-3 text-xs text-muted">Availability comes from the worker's profile and may change — confirm before travelling.</p>
          </section>

          <section className="card p-6">
            <h2 className="flex items-center gap-1.5 text-lg font-bold">
              <Wallet size={18} className="text-brand-600" /> Verification
            </h2>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <ShieldCheck size={15} className={worker.verificationStatus === "verified" ? "text-success" : "text-muted"} />
              {worker.verificationStatus === "verified" ? "Documents verified by KAMLE AI." : "Profile approved; document verification status pending."}
            </p>
            <p className="mt-3 text-xs text-muted">All workers shown here have an approved profile. We never display fictional badges.</p>
          </section>

          <section className="card p-6">
            <h2 className="text-lg font-bold">Have an issue?</h2>
            <p className="mt-1 text-sm text-muted">If you've interacted with this worker and faced a problem, help us keep the platform safe.</p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => (isAuthenticated ? navigate(`/account/customer?report=${worker.userId}`) : navigate("/login"))}
            >
              Report this worker
            </Button>
          </section>
        </div>
      </div>

      {/* Enquiry modal */}
      <Modal open={enquiryOpen} onClose={() => setEnquiryOpen(false)} title={`Send an enquiry to ${worker.name.split(" ")[0]}`}>
        {sent ? (
          <div>
            <p className="text-sm text-success">Enquiry sent.</p>
            <Button className="mt-4 w-full" onClick={() => setEnquiryOpen(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSubmitEnquiry();
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="label">What do you need help with?</span>
              <Textarea rows={4} placeholder="Describe your problem in a few lines..." value={problem} onChange={(e) => setProblem(e.target.value)} required minLength={10} />
            </label>
            <label className="block">
              <span className="label">Service area</span>
              <input className="input" value={area} onChange={(e) => setArea(e.target.value)} />
            </label>
            <p className="text-xs text-muted">
              This creates an enquiry record. It does <strong>not</strong> confirm a booking — the worker must accept it. You'll be able to track it in your dashboard.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setEnquiryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || problem.trim().length < 10} className="flex-1">
                {submitting ? "Sending..." : "Send enquiry"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}