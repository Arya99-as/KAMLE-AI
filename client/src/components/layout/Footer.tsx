import { Link } from "react-router-dom";
import { Logo } from "../brand/Logo";

const GROUPS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Company",
    links: [
      { label: "About KAMLE AI", to: "/about" },
      { label: "Become a Worker", to: "/register?role=worker" },
      { label: "Customer Support", to: "/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Terms and Conditions", to: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="container-x grid gap-8 py-10 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Describe your problem. Discover the right local worker. KAMLE AI helps you connect with verified local professionals.
          </p>
        </div>
        {GROUPS.map((g) => (
          <div key={g.title}>
            <h3 className="text-sm font-bold">{g.title}</h3>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-sm text-muted hover:text-brand-700">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-x flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-muted">
          <span>© {new Date().getFullYear()} KAMLE AI. All rights reserved.</span>
          <span>Your Problem. The Right Local Expert.</span>
        </div>
      </div>
    </footer>
  );
}