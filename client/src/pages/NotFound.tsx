import { Compass, Search, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/primitives";

export default function NotFound() {
  return (
    <div className="container-x flex min-h-[70vh] items-center justify-center py-10">
      <div className="max-w-md text-center">
        <p className="text-7xl font-black tracking-tight text-brand-600">404</p>
        <h1 className="mt-4 text-2xl font-bold">This page wandered off.</h1>
        <p className="mt-2 text-sm text-muted">The page you're looking for doesn't exist or has moved. Let's get you back on track.</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Link to="/">
            <Button>
              <Compass size={16} /> Back home
            </Button>
          </Link>
          <Link to="/discover">
            <Button variant="secondary">
              <Search size={16} /> Discover workers
            </Button>
          </Link>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted">
          <Wrench size={14} /> Try asking the KAMLE AI assistant instead.
        </p>
      </div>
    </div>
  );
}