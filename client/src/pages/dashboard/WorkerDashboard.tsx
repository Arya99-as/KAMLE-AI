import { Briefcase, Check, Inbox, MapPin, MessageSquare, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listEnquiries, updateEnquiryStatus } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Enquiry } from "../../types";
import { Badge, Button, Chip, Modal, PageHeader, Spinner, StatusBadge, Tabs } from "../../components/ui/primitives";
import { EmptyState } from "../../components/ui/states";
import { formatPrice } from "../../lib/utils";

function otherParty(e: Enquiry, meId: string) {
  const ref = String(e.customerId) === meId ? e.workerId : e.customerId;
  return typeof ref === "string" ? { _id: ref, name: "User" } : ref;
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const { user, workerProfile } = useAuth();
  const meId = user?.id ?? "";

  const [tab, setTab] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [received, setReceived] = useState<Enquiry[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r] = await Promise.all([listEnquiries("received")]);
      setReceived(r.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profile = workerProfile;
  const status = profile?.approvalStatus ?? (workerProfile === null ? "requires_setup" : "draft");

  const stats = useMemo(
    () => [
      { label: "New enquiries", value: received.filter((e) => e.status === "sent").length, icon: <Inbox size={20} /> },
      { label: "Accepted", value: received.filter((e) => e.status === "accepted").length, icon: <Check size={20} /> },
      { label: "Completed", value: received.filter((e) => e.status === "completed").length, icon: <Briefcase size={20} /> },
      { label: "Reviews", value: profile?.ratingCount ?? 0, icon: <Star size={20} /> },
    ],
    [received, profile],
  );

  async function updateStatus(id: string, next: string) {
    setActionError(null);
    try {
      await updateEnquiryStatus(id, next);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update the enquiry.");
    }
  }

  const [detail, setDetail] = useState<Enquiry | null>(null);

  type StatusInfo = { label: string; tone: "success" | "warning" | "danger" | "muted"; text: string };
  const statusCards: Record<string, StatusInfo> = {
    requires_setup: { label: "No profile yet", tone: "muted", text: "Create your worker profile to start receiving jobs." },
    draft: { label: "Draft", tone: "muted", text: "Your profile is saved as a draft. Submit it for review when ready." },
    pending: { label: "Pending review", tone: "warning", text: "An admin is reviewing your profile. Pending profiles don't appear in public search." },
    approved: { label: "Approved", tone: "success", text: "You're live! Customers can now find and contact you." },
    rejected: { label: "Rejected", tone: "danger", text: profile?.rejectionReason ? `Reason: ${profile.rejectionReason}` : "Your profile was rejected. Review the reason and resubmit." },
  };
  const statusInfo = (statusCards[status] ?? statusCards.draft) as StatusInfo;

  return (
    <div className="container-x py-8">
      <PageHeader title={`Welcome, ${user?.name?.split(" ")[0] ?? "Worker"}`} subtitle="Manage your profile and incoming job enquiries." />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Briefcase size={18} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold">Worker profile</span>
              <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted">{statusInfo.text}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate("/worker/onboarding")}>
            {status === "rejected" ? "Edit & resubmit" : "Edit profile"}
          </Button>
        </div>
      </div>

      {actionError && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{actionError}</p>}

      <Tabs tabs={["Overview", "Received enquiries", "Reviews", "Profile summary"]} active={tab} onChange={setTab} />

      {/* Overview */}
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
                  <h2 className="font-bold">New enquiries</h2>
                  <Button variant="ghost" size="sm" onClick={() => setTab("Received enquiries")}>
                    View all
                  </Button>
                </div>
                {received.filter((e) => e.status === "sent").length === 0 ? (
                  <p className="mt-3 text-sm text-muted">You'll see new job enquiries here when customers contact you.</p>
                ) : (
                  <ul className="mt-3 divide-y divide-line">
                    {received
                      .filter((e) => e.status === "sent")
                      .slice(0, 5)
                      .map((e) => (
                        <li key={e._id} className="flex items-center justify-between gap-3 py-3">
                          <div>
                            <p className="text-sm font-semibold">{otherParty(e, meId).name}</p>
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

      {/* Received enquiries */}
      {tab === "Received enquiries" && (
        <div className="mt-6">
          {loading ? (
            <Spinner className="mt-10" />
          ) : received.length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title="No enquiries yet" message="When customers send enquiries, they'll appear here to accept or decline." />
          ) : (
            <ul className="space-y-3">
              {received.map((e) => {
                const customer = otherParty(e, meId);
                return (
                  <li key={e._id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {customer.name} <StatusBadge status={e.status} />
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {e.serviceCategory} · {e.location || "Location unshared"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setDetail(e)}>
                          View
                        </Button>
                        {(e.status === "sent" || e.status === "accepted") && (
                          <>
                            <Button size="sm" onClick={() => void updateStatus(e._id, "completed")} disabled={e.status !== "accepted"}>
                              <Check size={14} /> Complete
                            </Button>
                            {e.status === "sent" && (
                              <Button variant="secondary" size="sm" onClick={() => void updateStatus(e._id, "declined")}>
                                <X size={14} /> Decline
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-muted">{e.problemDescription}</p>
                    <p className="mt-2 text-xs text-muted">Sent {new Date(e.createdAt).toLocaleString()}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Reviews */}
      {tab === "Reviews" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="font-bold">What customers say</h2>
            {!profile || (profile.ratingCount ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-muted">No reviews yet. Keep doing great work!</p>
            ) : (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-3xl font-bold">{profile.ratingAverage.toFixed(1)}</span>
                  <div>
                    <span className="inline-flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} size={16} className={i <= Math.round(profile.ratingAverage) ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                      ))}
                    </span>
                    <p className="text-xs text-muted">based on {profile.ratingCount} review{profile.ratingCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">Approved reviews appear on your public profile.</p>
              </>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-bold">For a great profile</h2>
            <p className="mt-3 text-sm text-muted">
              Do '<em>yes</em>' to every enquiry; complete jobs on time; and politely decline or reschedule when busy. Customers can only review you after a completed
              enquiry.
            </p>
          </div>
        </div>
      )}

      {/* Profile summary */}
      {tab === "Profile summary" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Services</h2>
            <div className="flex flex-wrap gap-2">
              {profile?.serviceCategories.map((c) => (
                <Chip key={c}>{c}</Chip>
              ))}
              {profile?.skills.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Availability & pricing</h2>
            <p className="flex items-center gap-2 text-sm">
              <MapPin size={15} className="text-muted" /> {profile?.serviceAreas.join(", ") || "No areas listed"}
            </p>
            <p className="mt-2 text-sm font-semibold">{profile ? formatPrice(profile.pricing) : "No pricing set"}</p>
            {profile?.availability.availableNow && <Badge tone="success" className="mt-2">Available now</Badge>}
            {profile?.availability.days.length ? <p className="mt-2 text-xs text-muted">Working days: {profile.availability.days.join(", ")}</p> : null}
          </div>
          <div className="card p-5">
            <h2 className="mb-2 font-bold">Description</h2>
            <p className="text-sm text-muted">{profile?.professionalDescription || "Not described yet."}</p>
            <p className="mt-2 text-sm text-muted">
              <Star size={14} className="mr-1 inline" />
              <span className="font-semibold">{profile?.experienceYears ?? 0} years</span> experience
            </p>
          </div>
          <div className="card p-5">
            <h2 className="mb-2 font-bold">Verification</h2>
            <p className="text-sm text-muted">
              Status: <span className="font-semibold capitalize">{profile?.verificationStatus ?? "unverified"}</span>
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => navigate("/worker/onboarding")}>
              Manage documents
            </Button>
          </div>
        </div>
      )}

      {/* Enquiry detail modal */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Enquiry details">
        {detail && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-bold">From:</span> {otherParty(detail, meId).name}
            </p>
            <p>
              <span className="font-bold">Problem:</span> <span className="text-muted">{detail.problemDescription}</span>
            </p>
            <p>
              <span className="font-bold">Category:</span> {detail.serviceCategory}
            </p>
            <p>
              <span className="font-bold">Location:</span> {detail.location || "Not shared"}
            </p>
            <div className="flex gap-2 pt-2">
              {detail.status === "sent" && (
                <>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setDetail(null);
                      void updateStatus(detail._id, "accepted");
                    }}
                  >
                    <Check size={15} /> Accept
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setDetail(null)}>
                    Close
                  </Button>
                </>
              )}
              {detail.status === "accepted" && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    setDetail(null);
                    void updateStatus(detail._id, "completed");
                  }}
                >
                  <Check size={15} /> Mark completed
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted">
        <MessageSquare size={14} /> Pending? You can still chat with KAMLE AI for guidance.
      </div>
    </div>
  );
}