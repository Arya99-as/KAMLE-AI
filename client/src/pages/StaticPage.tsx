import { ArrowUpRight, HelpCircle, Lock, MessageCircle, Sparkles, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "../components/brand/Logo";

const CONTENT: Record<string, { eyebrow: string; title: string; sections: { heading: string; body: string }[] }> = {
  "About KAMLE AI": {
    eyebrow: "Who we are",
    title: "Local workers, discovered by AI.",
    sections: [
      { heading: "Our mission", body: "KAMLE AI connects people to trusted local service workers — plumbers, electricians, carpenters, cleaners, technicians and more — using natural-language matching. Describe your problem and the platform finds workers whose skills, locations and pricing fit." },
      { heading: "How it works", body: "Customers describe a problem to KAMLE AI. The AI extracts structured requirements (category, skills, location, budget, urgency) and ranks eligible workers with a transparent, weight-based scoring system. Candidates see exactly why each worker was suggested." },
      { heading: "Trust & safety", body: "Worker profiles are reviewed and approved by our team before they appear publicly. Verified documents earn a 'Verified' badge, and every review is moderated. Users can also report suspicious or unprofessional behaviour at any time." },
      { heading: "For workers", body: "Workers can create a professional profile, list their service areas and pricing, upload portfolio photos and verification documents — then grow reputation through genuine completed jobs and customer reviews." },
    ],
  },
  "Customer Support": {
    eyebrow: "We're here to help",
    title: "How can we help you today?",
    sections: [
      { heading: "Getting started", body: "Create an account as a customer, then either browse the Discover page, or chat with KAMLE AI describing your problem to get ranked worker matches in seconds." },
      { heading: "Sending an enquiry", body: "Open a worker's profile and send an enquiry describing the work you need. The worker can accept or decline. Once the job is done, both sides mark it completed and a review can be left." },
      { heading: "Worker approval & enquiries", body: "Workers see incoming job requests in their dashboard. Accept to start the thread, then mark the job completed when done. If a profile is pending, it won't appear in search until an admin approves it." },
      { heading: "Contact a real person", body: "For questions not answered here, reach out through the community or report an issue from any worker profile. We typically respond within 24 hours." },
    ],
  },
  "Privacy Policy": {
    eyebrow: "Your data, protected",
    title: "Privacy made transparent.",
    sections: [
      { heading: "What we collect", body: "We collect only what's needed to operate the marketplace: name, phone, email (optional), your area, worker profile details, and interaction data such as enquiries and reviews. Phone numbers are shown to counterparties only after a genuine interaction begins." },
      { heading: "How we use it", body: "Your details power matching, worker approval, job enquiries and safety features like reporting. We never sell your personal data. AI matching uses your problem description purely to find suitable workers." },
      { heading: "Review moderation", body: "Reviews are public only after approval by our moderation team. You can request the removal of a review by reporting the profile it belongs to." },
      { heading: "Account control", body: "You may request account deactivation at any time via our support channels. Suspended or deactivated profiles are hidden from search." },
    ],
  },
  "Terms and Conditions": {
    eyebrow: "The fine print",
    title: "A fair marketplace for everyone.",
    sections: [
      { heading: "Role of the platform", body: "KAMLE AI is a discovery and connection platform. It introduces customers and workers; the actual service agreement and job terms are between the two parties. Prices shown or quoted on profiles are starting points agreed during the enquiry." },
      { heading: "Worker standards", body: "Workers must provide accurate profile information and competent service. Misuse, false claims or unprofessional behaviour may lead to rejection, suspension or removal at our discretion." },
      { heading: "Reviews & AI honesty", body: "Reviews must reflect genuine completed jobs. Our AI assistant never invents workers, prices or ratings — recommendations are always based on approved, real profiles." },
      { heading: "Limitation of liability", body: "To the maximum extent permitted by law, KAMLE AI is not liable for work quality, pricing disputes, or issues arising directly between workers and customers. Always agree on scope and price clearly before work begins." },
    ],
  },
};

const ICONS = {
  "About KAMLE AI": Sparkles,
  "Customer Support": HelpCircle,
  "Privacy Policy": Lock,
  "Terms and Conditions": Users,
};

export default function StaticPage({ title }: { title: string }) {
  const { pathname } = useLocation();
  const content = CONTENT[title];
  const Icon = ICONS[title as keyof typeof ICONS] ?? Users;

  if (!content) {
    return (
      <div className="container-x py-12 text-center">
        <p className="text-sm text-muted">This page doesn't exist.</p>
        <Link to="/" className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="container-x max-w-3xl py-10">
      <div className="mb-8 flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-light text-ai">
          <Icon size={26} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{content.eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight">{content.title}</h1>
        </div>
      </div>

      <div className="space-y-6">
        {content.sections.map((s) => (
          <section key={s.heading} className="card p-6">
            <h2 className="font-bold">{s.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-brand-light p-5 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold text-brand-800">
          <Logo /> powered by KAMLE AI
        </p>
        <Link to={pathname === "/support" ? "/discover" : "/support"} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ai hover:underline">
          {pathname === "/support" ? "Browse workers instead" : "Need more help? Visit Support"} <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
        <MessageCircle size={14} /> Questions? The KAMLE AI chat assistant is available on every page.
      </div>
    </div>
  );
}