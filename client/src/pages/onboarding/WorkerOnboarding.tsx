import { Check, ChevronLeft, ChevronRight, Loader2, Send, Upload, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getCategories, getMyWorkerProfile, saveWorkerProfile, uploadForm } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { ServiceCategory, WorkerProfile } from "../../types";
import { Button, Chip, Field, Input, Select, Textarea, Badge, Modal } from "../../components/ui/primitives";
import { ErrorState } from "../../components/ui/states";
import { CategoryIcon } from "../../components/icons/CategoryIcon";

const STEPS = ["Personal", "Professional", "Service", "Portfolio", "Review"];

interface FormState {
  professionalDescription: string;
  serviceCategories: string[];
  skills: string[];
  experienceYears: number;
  experienceSummary: string;
  serviceAreas: string[];
  pricingType: "fixed" | "hourly" | "quote";
  pricingAmount: string;
  pricingNote: string;
  availableNow: boolean;
  availabilityDays: string[];
  availabilityNote: string;
  portfolioImages: string[];
  verificationDocuments: { label: string; url: string }[];
  consent: boolean;
}

function emptyForm(): FormState {
  return {
    professionalDescription: "",
    serviceCategories: [],
    skills: [],
    experienceYears: 0,
    experienceSummary: "",
    serviceAreas: [],
    pricingType: "quote",
    pricingAmount: "",
    pricingNote: "",
    availableNow: true,
    availabilityDays: [],
    availabilityNote: "",
    portfolioImages: [],
    verificationDocuments: [],
    consent: false,
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function TagInput({ tags, onChange, placeholder, ariaLabel }: { tags: string[]; onChange: (next: string[]) => void; placeholder: string; ariaLabel: string }) {
  const [value, setValue] = useState("");

  function add() {
    const item = value.trim().replace(/,+$/, "");
    if (item && !tags.some((t) => t.toLowerCase() === item.toLowerCase())) {
      onChange([...tags, item]);
    }
    setValue("");
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !value && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-xl border border-line bg-white p-2 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
        {tags.map((t) => (
          <Chip key={t}>
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="rounded-full p-0.5 hover:bg-brand-100">
              <X size={11} />
            </button>
          </Chip>
        ))}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={tags.length ? "" : placeholder}
          aria-label={ariaLabel}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <span className="mt-1 block text-xs text-muted">Press Enter to add.</span>
    </div>
  );
}

export default function WorkerOnboarding() {
  const navigate = useNavigate();
  const { user, setWorkerProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [existing, setExisting] = useState<WorkerProfile | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [cats, profile] = await Promise.all([getCategories(), getMyWorkerProfile()]);
        setCategories(cats.categories);
        if (profile.workerProfile) {
          setExisting(profile.workerProfile);
          const p = profile.workerProfile;
          setForm({
            professionalDescription: p.professionalDescription ?? "",
            serviceCategories: p.serviceCategories,
            skills: p.skills,
            experienceYears: p.experienceYears ?? 0,
            experienceSummary: p.experienceSummary ?? "",
            serviceAreas: p.serviceAreas,
            pricingType: p.pricing?.type ?? "quote",
            pricingAmount: p.pricing?.amount ? String(p.pricing.amount) : "",
            pricingNote: p.pricing?.note ?? "",
            availableNow: p.availability?.availableNow ?? true,
            availabilityDays: p.availability?.days ?? [],
            availabilityNote: p.availability?.note ?? "",
            portfolioImages: p.portfolioImages ?? [],
            verificationDocuments: p.verificationDocuments ?? [],
            consent: true,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patch(p: Partial<FormState>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function validateStep(i: number): string | null {
    switch (i) {
      case 0:
        return null;
      case 1:
        if (form.serviceCategories.length === 0) return "Select at least one service category.";
        if (form.skills.length === 0) return "Add at least one skill.";
        if (form.professionalDescription.trim().length < 20) return "Describe your services (minimum 20 characters).";
        return null;
      case 2:
        if (form.serviceAreas.length === 0) return "Add at least one service area.";
        if (form.pricingType !== "quote" && (!form.pricingAmount || Number(form.pricingAmount) <= 0)) return "Provide a price for fixed or hourly pricing.";
        return null;
      case 3:
        return null;
      default:
        return null;
    }
  }

  async function goNext() {
    const validation = validateStep(step);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const validation = validateStep(4);
    if (validation) {
      setError(validation);
      return;
    }
    if (!form.consent) {
      setError("Please accept the verification and policy consent to submit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        professionalDescription: form.professionalDescription,
        serviceCategories: form.serviceCategories,
        skills: form.skills,
        experienceYears: form.experienceYears,
        experienceSummary: form.experienceSummary,
        serviceAreas: form.serviceAreas,
        pricing: { type: form.pricingType, amount: form.pricingType === "quote" ? undefined : Number(form.pricingAmount), currency: "INR", note: form.pricingNote },
        availability: { availableNow: form.availableNow, days: form.availabilityDays, note: form.availabilityNote },
        portfolioImages: form.portfolioImages,
        verificationDocuments: form.verificationDocuments,
        consent: true,
      };
      const useCreate = !existing || existing.approvalStatus !== "approved";
      const result = await saveWorkerProfile(body, useCreate);
      setWorkerProfile(result.workerProfile);
      setDone(result.workerProfile.approvalStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your profile.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onUploadImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const res = await uploadForm("/workers/me/portfolio", "images", files);
      patch({ portfolioImages: res.workerProfile.portfolioImages ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function onUploadDocs(files: FileList | null) {
    if (!files || files.length === 0) return;
    try {
      const res = await uploadForm("/workers/me/documents", "documents", files);
      patch({ verificationDocuments: res.workerProfile.verificationDocuments ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  if (loading) return <div className="container-x py-10 text-center text-sm text-muted">Loading your profile…</div>;
  if (error && !existing && step === 0) return <div className="container-x py-10"><ErrorState message={error} /></div>;

  return (
    <div className="container-x max-w-3xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Become a KAMLE worker</h1>
        <p className="mt-1 text-sm text-muted">Complete your profile to be reviewed for approval. Pending profiles appear in the search only after approval.</p>
      </div>

      <ol className="mb-8 flex items-center justify-between gap-1">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-success text-white" : i === step ? "bg-brand-600 text-white" : "bg-slate-200 text-muted"}`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span className={`hidden text-xs font-semibold sm:block ${i <= step ? "text-ink" : "text-muted"}`}>{label}</span>
            {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 flex-1 rounded ${i < step ? "bg-success" : "bg-slate-200"}`} />}
          </li>
        ))}
      </ol>

      {error && <p className="mb-4 rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      <form onSubmit={onSubmit} className="card p-6">
        {/* STEP 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Personal information</h2>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-brand-600">
                {avatar ? <img src={avatar} alt="Profile" className="h-full w-full object-cover" /> : <span className="text-lg font-bold">{user?.name?.[0]?.toUpperCase() ?? "W"}</span>}
              </div>
              <label className="btn-secondary cursor-pointer text-sm">
                <Upload size={15} /> Upload photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) setAvatar(URL.createObjectURL(file));
                  }}
                />
              </label>
              <span className="text-xs text-muted">
                Note: uploading a profile photo is not yet linked to account settings. Worker avatar updates are supported by the backend profile flow.
              </span>
            </div>
            <Field label="Full name">
              <Input value={user?.name ?? ""} disabled />
            </Field>
            <Field label="Phone number">
              <Input value={user?.phone ?? ""} disabled />
            </Field>
          </div>
        )}

        {/* STEP 2 */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Professional information</h2>
            <Field label="Service categories">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {categories.map((c) => {
                  const active = form.serviceCategories.includes(c.name);
                  return (
                    <button
                      type="button"
                      key={c._id}
                      onClick={() => patch({ serviceCategories: active ? form.serviceCategories.filter((x) => x !== c.name) : [...form.serviceCategories, c.name] })}
                      className={`flex items-center gap-2 rounded-xl border-2 p-3 text-left text-sm font-semibold transition ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted hover:border-brand-300"}`}
                    >
                      <CategoryIcon name={c.name} className="h-4 w-4 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Skills" hint="e.g. Leak Repair, Refrigerator Repair, Wiring & Rewiring">
              <TagInput tags={form.skills} onChange={(v) => patch({ skills: v })} placeholder="Add a skill" ariaLabel="Add a skill" />
            </Field>
            <Field label="Years of experience">
              <Select value={form.experienceYears} onChange={(e) => patch({ experienceYears: Number(e.target.value) })}>
                {Array.from({ length: 25 }).map((_, i) => (
                  <option key={i} value={i}>
                    {i} year{i !== 1 ? "s" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Describe your services" hint="Explain what work you do and how you work. Minimum 20 characters.">
              <Textarea rows={3} value={form.professionalDescription} onChange={(e) => patch({ professionalDescription: e.target.value })} placeholder="e.g. Certified plumber handling taps, pipes and bathrooms." />
            </Field>
            <Field label="Experience summary (optional)">
              <Textarea rows={2} value={form.experienceSummary} onChange={(e) => patch({ experienceSummary: e.target.value })} placeholder="A short summary of your background." />
            </Field>
          </div>
        )}

        {/* STEP 3 */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Service information</h2>
            <Field label="Service areas" hint="Towns or cities you serve.">
              <TagInput tags={form.serviceAreas} onChange={(v) => patch({ serviceAreas: v })} placeholder="e.g. Kolhapur" ariaLabel="Add a service area" />
            </Field>
            <Field label="Pricing type">
              <Select value={form.pricingType} onChange={(e) => patch({ pricingType: e.target.value as FormState["pricingType"] })}>
                <option value="quote">Request a quote (recommended)</option>
                <option value="fixed">Fixed price</option>
                <option value="hourly">Hourly rate</option>
              </Select>
            </Field>
            {form.pricingType !== "quote" && (
              <Field label={`Price${form.pricingType === "hourly" ? " per hour" : ""} (₹)`}>
                <Input type="number" min={0} value={form.pricingAmount} onChange={(e) => patch({ pricingAmount: e.target.value })} placeholder="e.g. 500" />
              </Field>
            )}
            <Field label="Pricing note (optional)">
              <Input value={form.pricingNote} onChange={(e) => patch({ pricingNote: e.target.value })} placeholder="e.g. Parts charged separately" />
            </Field>
            <Field label="Availability">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => patch({ availableNow: !form.availableNow })}
                  aria-pressed={form.availableNow}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${form.availableNow ? "bg-success" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.availableNow ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className="text-sm font-semibold">{form.availableNow ? "Available now" : "Available by arrangement"}</span>
              </div>
            </Field>
            <Field label="Working days">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const active = form.availabilityDays.includes(d);
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => patch({ availabilityDays: active ? form.availabilityDays.filter((x) => x !== d) : [...form.availabilityDays, d] })}
                      className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition ${active ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-muted"}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        {/* STEP 4 */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold">Portfolio and verification</h2>
            <Field label="Portfolio images" hint="JPG/PNG/WEBP, up to 8 images, 5MB each.">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-canvas p-6 text-center hover:border-brand-300">
                <Upload size={22} className="text-muted" />
                <span className="mt-2 text-sm font-semibold">Add portfolio images</span>
                <span className="text-xs text-muted">Photos of your recent work.</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => void onUploadImages(e.target.files)} />
              </label>
            </Field>
            {form.portfolioImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {form.portfolioImages.map((img) => (
                  <img key={img} src={img} alt="Work sample" className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
                ))}
              </div>
            )}

            <Field label="Verification documents" hint="ID proof such as a license or Aadhaar. JPG/PNG/WEBP/PDF.">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-canvas p-6 text-center hover:border-brand-300">
                <Upload size={22} className="text-muted" />
                <span className="mt-2 text-sm font-semibold">Upload documents</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => void onUploadDocs(e.target.files)} />
              </label>
            </Field>
            {form.verificationDocuments.length > 0 && (
              <ul className="space-y-1">
                {form.verificationDocuments.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="truncate">{d.label}</span>
                    <Badge tone="brand">Uploaded</Badge>
                  </li>
                ))}
              </ul>
            )}

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={form.consent} onChange={(e) => patch({ consent: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-line text-brand-600" />
              <span>
                I confirm the information I provide is accurate, and I consent to KAMLE AI verifying my documents and displaying my approved profile to customers.{" "}
                <Link to="/terms" className="text-brand-700 hover:underline">
                  Terms
                </Link>
              </span>
            </label>
          </div>
        )}

        {/* STEP 5 */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Review and submit</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-bold text-muted">Categories</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">{form.serviceCategories.map((c) => <Chip key={c}>{c}</Chip>)}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted">Skills</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">{form.skills.map((s) => <Chip key={s}>{s}</Chip>) || <span className="text-muted">—</span>}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="font-bold text-muted">Experience</dt>
                  <dd>{form.experienceYears} years</dd>
                </div>
                <div>
                  <dt className="font-bold text-muted">Areas</dt>
                  <dd>{form.serviceAreas.join(", ") || "—"}</dd>
                </div>
              </div>
              <div>
                <dt className="font-bold text-muted">Description</dt>
                <dd className="mt-1 text-muted">{form.professionalDescription}</dd>
              </div>
              <div>
                <dt className="font-bold text-muted">Pricing</dt>
                <dd>
                  {form.pricingType === "quote" ? "Custom quote" : `${form.pricingType === "hourly" ? "Hourly" : "Fixed"} ₹${form.pricingAmount}`}
                  {form.pricingNote ? ` — ${form.pricingNote}` : ""}
                </dd>
              </div>
            </dl>
            <div className="rounded-xl bg-brand-light p-4 text-sm text-brand-800">
              {existing?.approvalStatus === "approved" ? (
                <>Your profile is approved and public. Editing keeps it live.</>
              ) : (
                <>After submission, an admin will review your profile. While <strong>pending</strong>, you won't appear in public search.</>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={() => (step === 0 ? navigate(-1) : (setError(null), setStep(step - 1)))}>
            <ChevronLeft size={16} /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => void goNext()}>
              Continue <ChevronRight size={16} />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit for review
            </Button>
          )}
        </div>
      </form>

      <Modal open={Boolean(done)} onClose={() => navigate("/account/worker")} title="Profile submitted">
        <div>
          <p className="text-sm text-muted">
            Your profile status is now <span className="font-bold capitalize text-ink">{done}</span>.{" "}
            {done === "approved" && "You are now visible to customers."}
            {done === "rejected" && "The admin left a reason — read it in your dashboard and resubmit."}
            {(done === "pending" || done === "draft") && "An admin will review it, usually within 24 hours. Pending profiles won't show in public search."}
          </p>
          <Button className="mt-5 w-full" onClick={() => navigate("/account/worker")}>
            Go to my dashboard
          </Button>
        </div>
      </Modal>
    </div>
  );
}