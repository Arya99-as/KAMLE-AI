import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";
import { Spinner } from "../components/ui/primitives";

export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/account" replace />;
  }

  return <>{children}</>;
}

export function RedirectByRole() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case "admin":
      return <Navigate to="/account/admin" replace />;
    case "worker":
      return <Navigate to="/account/worker" replace />;
    default:
      return <Navigate to="/account/customer" replace />;
  }
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/account" replace />;

  return <>{children}</>;
}