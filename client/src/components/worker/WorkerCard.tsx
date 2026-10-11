import { Clock, MapPin, MessageCircle, ShieldCheck, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PublicWorker } from "../../types";
import { formatPrice } from "../../lib/utils";
import { Avatar, Badge, Button, Chip } from "../ui/primitives";

export function WorkerCard({ worker, onContact }: { worker: PublicWorker; onContact?: () => void }) {
  const navigate = useNavigate();
  const verified = worker.verificationStatus === "verified";
  const availableNow = worker.availability?.availableNow === true;

  return (
    <article className="card flex h-full flex-col p-5 transition hover:shadow-lift">
      <div className="flex items-start gap-3">
        <Avatar name={worker.name} src={worker.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold">{worker.name}</h3>
            {verified && (
              <Badge tone="success">
                <ShieldCheck size={12} /> Verified
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {worker.serviceAreas.slice(0, 2).join(", ")}
            </span>
            <span>·</span>
            <span>{worker.experienceYears > 0 ? `${worker.experienceYears} yrs` : "Experience unlisted"}</span>
          </div>
        </div>
      </div>

      {worker.reasons && worker.reasons.length > 0 && (
        <div className="mt-3 rounded-xl bg-ai-light p-3">
          <p className="text-[13px] leading-relaxed text-ai">
            <span className="font-semibold">Why we matched:</span> {worker.reasons.join(". ")}.
          </p>
        </div>
      )}

      <p className="mt-3 line-clamp-2 text-sm text-muted">{worker.professionalDescription}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {worker.serviceCategories.slice(0, 2).map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        {worker.skills.slice(0, 2).map((s) => (
          <Chip key={s}>{s}</Chip>
        ))}
        {worker.skills.length + worker.serviceCategories.length > 4 && (
          <Chip>+{worker.skills.length + worker.serviceCategories.length - 4} more</Chip>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Pricing</div>
          <div className="font-semibold">{formatPrice(worker.pricing)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">Availability</div>
          <div className="flex items-center gap-1 font-semibold">
            <Clock size={14} className={availableNow ? "text-success" : "text-muted"} />
            {availableNow ? "Available now" : "By arrangement"}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1">
        {worker.ratingCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            <Star size={15} className="fill-amber-400 text-amber-400" />
            {worker.ratingAverage.toFixed(1)}
            <span className="font-normal text-muted">({worker.ratingCount} review{worker.ratingCount > 1 ? "s" : ""})</span>
          </span>
        ) : (
          <span className="text-xs text-muted">No reviews yet</span>
        )}
      </div>

      <div className="mt-4 flex gap-2 border-t border-line pt-4">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(`/workers/${worker.workerId}`)}>
          View profile
        </Button>
        <Button
          className="flex-1"
          onClick={() => {
            if (onContact) onContact();
            else navigate(`/workers/${worker.workerId}`);
          }}
        >
          <MessageCircle size={16} /> Contact
        </Button>
      </div>
    </article>
  );
}