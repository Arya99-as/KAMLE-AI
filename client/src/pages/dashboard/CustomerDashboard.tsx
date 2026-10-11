import { Flag, Heart, History, Inbox, Settings, Star, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createReport, createReview, listEnquiries, listFavorites, listMyReviews, removeFavorite, updateEnquiryStatus, updateMe } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Enquiry, Review, UserRef } from "../../types";
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Spinner, StatusBadge, Tabs, Textarea } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { WorkerCard } from "../../components/worker/WorkerCard";
import type { PublicWorker } from "../../types";

type FavItem = { favoriteId: string; worker: PublicWorker };

function actorName(e: Enquiry, meId: string) {
  const ref = String(e.workerId) === meId ? e.customerId : e.workerId;
  return typeof ref === "string" ? "User" : ref.name;
}

function nativeId(ref: string | UserRef) {
  return typeof ref === "string" ? ref : ref._id;
}

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const reportWorkerId = params.get("report");

  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [favorites, setFavorites] = useState<FavItem[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);

  const [reportOpen, setReportOpen] = useState(Boolean(reportWorkerId));
  const [reportUser, setReportUser] = useState<string>(reportWorkerId ?? "");

  const meId = user?.id ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [e, f, r] = await Promise.all([listEnquiries("sent"), listFavorites(), listMyReviews()]);
      setEnquiries(e.items);
      setFavorites(f.items);
      setMyReviews(r.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const completedWorkers = useMemo(() => {
    const reviewed = new Set(myReviews.map((r) => (typeof r.workerId === "string" ? r.workerId : r.workerId?._id)));
    const seen = new Set<string>();
    const out: { workerId: string; name: string }[] = [];
    for (const e of enquiries) {
      if (e.status !== "completed") continue;
      const ref = typeof e.workerId === "string" ? null : e.workerId;
      const id = nativeId(e.workerId);
      if (ref && !reviewed.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push({ workerId: id, name: ref.name });
      }
    }
    return out;
  }, [enquiries, myReviews]);

  async function updateStatus(id: string, status: string) {
    await updateEnquiryStatus(id, status);
    await load();
  }

  async function onRemoveFavorite(workerId: string) {
    await removeFavorite(workerId);
    await load();
  }

  /* Review dialog */
  const [reviewing, setReviewing] = useState<{ workerId: string; name: string } | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function submitReview(e: FormEvent) {
    e.preventDefault();
    if (!reviewing) return;
    setReviewError(null);
    try {
      await createReview({ workerId: reviewing.workerId, rating, comment });
      setReviewing(null);
      setRating(5);
      setComment("");
      await load();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not submit review.");
    }
  }

  /* Settings */
  const [name, setName] = useState(user?.name ?? "");
  const [loc, setLoc] = useState(user?.location ?? "");
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await updateMe({ name, location: loc });
      setUser(res.user);
      setSettingsMsg("Profile updated.");
      setTimeout(() => setSettingsMsg(null), 2500);
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : "Update failed.");
    }
  }

  function openReport(workerId: string) {
    setReportUser(workerId);
    setReportOpen(true);
  }

  const stats = [
    { label: "Enquiries sent", value: enquiries.length, icon: <Inbox size={20} /> },
    { label: "Saved workers", value: favorites.length, icon: <Heart size={20} /> },
    { label: "Reviews written", value: myReviews.length, icon: <Star size={20} /> },
    { label: "Completed jobs", value: enquiries.filter((e) => e.status === "completed").length, icon: <History size={20} /> },
  ];

  return (
    <div className="container-x py-8">
      <PageHeader title={`Hi, ${user?.name?.split(" ")[0] ?? "there"}`} subtitle="Your services and activity in one place." />

      <Tabs tabs={["Overview", "Enquiries", "Favorites", "Reviews", "Settings"]} active={tab} onChange={setTab} />

      {loadError && <p className="mt-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{loadError}</p>}

      {/* ------------------------------- Overview ------------------------------ */}
      {tab === "Overview" && (
        <div className="mt-6">
          {loading ? (
            <Spinner className="mt-10" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="card flex items-center gap-4 p-5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{s.icon}</span>
                    <div>
                      <div className="text-2xl font-bold leading-none">{s.value}</div>
                      <div className="mt-1 text-xs text-muted">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 card p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">Recent enquiries</h2>
                  <Button variant="ghost" size="sm" onClick={() => setTab("Enquiries")}>
                    View all
                  </Button>
                </div>
                {enquiries.length === 0 ? (
                  <EmptyState
                    icon={<Inbox size={28} />}
                    title="No enquiries yet"
                    message="Explain your problem to KAMLE AI or browse workers to get matched."
                    action={<Button onClick={() => navigate("/discover")}>Discover workers</Button>}
                  />
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {enquiries.slice(0, 5).map((e) => (
                      <li key={e._id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-sm font-semibold">{actorName(e, meId)}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted">{e.problemDescription}</p>
                        </div>
                        <StatusBadge status={e.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------------------------ Enquiries ------------------------------ */}
      {tab === "Enquiries" && (
        <div className="mt-6">
          {loading ? (
            <Spinner className="mt-10" />
          ) : enquiries.length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title="No enquiries yet" message="Send an enquiry from any worker's profile, or ask KAMLE AI for a match." />
          ) : (
            <ul className="space-y-3">
              {enquiries.map((e) => {
                const target = typeof e.workerId === "string" ? null : e.workerId;
                const targetId = nativeId(e.workerId);
                return (
                  <li key={e._id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                          <UserRound size={18} />
                        </span>
                        <div>
                          <p className="font-semibold">
                            {target ? (
                              <Link className="text-brand-700 hover:underline" to={`/workers/${targetId}`}>
                                {target.name}
                              </Link>
                            ) : (
                              "Worker"
                            )}
                            <span className="ml-2 align-middle">
                              <StatusBadge status={e.status} />
                            </span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted">{e.serviceCategory}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openReport(targetId)}>
                          <Flag size={14} /> Report
                        </Button>
                        {(e.status === "sent" || e.status === "accepted") && (
                          <Button variant="secondary" size="sm" onClick={() => void updateStatus(e._id, "cancelled")}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted">{e.problemDescription}</p>
                    <p className="mt-2 text-xs text-muted">
                      {new Date(e.createdAt).toLocaleDateString()} · {e.location || "Location unshared"}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ------------------------------ Favorites ----------------------------- */}
      {tab === "Favorites" && (
        <div className="mt-6">
          {loading ? (
            <Spinner className="mt-10" />
          ) : favorites.length === 0 ? (
            <EmptyState icon={<Heart size={28} />} title="No saved workers yet" message="Tap the heart on any worker profile to save them here." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((f) => {
                const available = f.worker.availability?.availableNow === true && f.worker.workerId;
                return (
                  <div key={f.favoriteId} className="relative">
                    <WorkerCard worker={f.worker} />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute right-3 top-16"
                      aria-label="Remove from saved"
                      onClick={() => void onRemoveFavorite(f.worker.userId)}
                    >
                      <Heart size={14} className="fill-danger text-danger" /> {available ? "Saved" : "Unavailable"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------- Reviews ------------------------------ */}
      {tab === "Reviews" && (
        <div className="mt-6">
          {loading ? (
            <Spinner className="mt-10" />
          ) : (
            <div className="space-y-6">
              <section>
                <h2 className="mb-3 font-bold">Review a completed job</h2>
                {completedWorkers.length === 0 ? (
                  <p className="text-sm text-muted">You don't have any completed jobs that need a review yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {completedWorkers.map((w) => (
                      <li key={w.workerId} className="card flex items-center justify-between p-4">
                        <span className="font-semibold">{w.name}</span>
                        <Button size="sm" onClick={() => setReviewing(w)}>
                          <Star size={14} /> Review
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h2 className="mb-3 font-bold">My published reviews</h2>
                {myReviews.length === 0 ? (
                  <p className="text-sm text-muted">You haven't written any reviews yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {myReviews.map((r) => {
                      const target = typeof r.workerId !== "string" ? r.workerId : null;
                      return (
                        <li key={r._id ?? r.id} className="card p-4">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{target ? target.name : "Worker"}</span>
                            <span className="inline-flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} size={15} className={i <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                              ))}
                            </span>
                          </div>
                          {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
                          <div className="mt-2">
                            <Badge tone={r.moderationStatus === "approved" ? "success" : r.moderationStatus === "rejected" ? "danger" : "warning"}>
                              {r.moderationStatus ?? "pending"}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------ Settings ------------------------------ */}
      {tab === "Settings" && (
        <div className="mt-6 max-w-lg">
          <form onSubmit={saveSettings} className="card space-y-4 p-6">
            <h2 className="font-bold">Account settings</h2>
            <Field label="Full name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </Field>
            <Field label="Phone">
              <Input value={user?.phone ?? ""} disabled />
            </Field>
            <Field label="Your area" hint="Helps workers understand where they'd be needed.">
              <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Kolhapur" />
            </Field>
            {settingsMsg && <p className="rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-800">{settingsMsg}</p>}
            <Button type="submit">
              <Settings size={16} /> Save changes
            </Button>
          </form>
        </div>
      )}

      {/* ------------------------------ Report modal --------------------------- */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this account">
        <ReportForm userId={reportUser} onDone={() => setReportOpen(false)} />
      </Modal>

      {/* ------------------------------ Review modal --------------------------- */}
      <Modal open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={`Review ${reviewing?.name ?? ""}`}>
        <form onSubmit={submitReview} className="space-y-4">
          <Field label="Rating">
            <StarButtonSelect value={rating} onChange={setRating} />
          </Field>
          <Field label="Comment (optional)">
            <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the work?" />
          </Field>
          {reviewError && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{reviewError}</p>}
          <Button type="submit" className="w-full">
            Publish review
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function StarButtonSelect({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          className="text-2xl transition hover:scale-110"
        >
          <Star size={26} className={i <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
        </button>
      ))}
    </div>
  );
}

function ReportForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [reason, setReason] = useState("safety_or_fraud");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReport({ reportedUserId: userId, reason, details });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Reason">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="safety_or_fraud">Safety concern / fraud</option>
          <option value="inappropriate_behavior">Inappropriate behaviour</option>
          <option value="false_information">False information</option>
          <option value="unprofessionalism">Unprofessionalism</option>
          <option value="other">Other</option>
        </Select>
      </Field>
      <Field label="Details" hint="Optional but helpful.">
        <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened?" />
      </Field>
      {error && <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}
      <Button type="submit" variant="danger" className="w-full" disabled={submitting}>
        <Flag size={15} /> {submitting ? "Submitting..." : "Submit report"}
      </Button>
    </form>
  );
}