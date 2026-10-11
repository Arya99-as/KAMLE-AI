import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { MainLayout } from "./layouts/MainLayout";
import { GuestOnly, RedirectByRole, RequireAuth } from "./guards/Guards";

const Home = lazy(() => import("./pages/Home"));
const Discover = lazy(() => import("./pages/Discover"));
const WorkerProfilePage = lazy(() => import("./pages/WorkerProfilePage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const WorkerOnboarding = lazy(() => import("./pages/onboarding/WorkerOnboarding"));
const CustomerDashboard = lazy(() => import("./pages/dashboard/CustomerDashboard"));
const WorkerDashboard = lazy(() => import("./pages/dashboard/WorkerDashboard"));
const AdminDashboard = lazy(() => import("./pages/dashboard/AdminDashboard"));
const StaticPage = lazy(() => import("./pages/StaticPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">Loading…</div>}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route
          index
          element={
            <Lazy>
              <Home />
            </Lazy>
          }
        />
        <Route
          path="discover"
          element={
            <Lazy>
              <Discover />
            </Lazy>
          }
        />
        <Route
          path="workers/:id"
          element={
            <Lazy>
              <WorkerProfilePage />
            </Lazy>
          }
        />
        <Route
          path="login"
          element={
            <GuestOnly>
              <Lazy>
                <LoginPage />
              </Lazy>
            </GuestOnly>
          }
        />
        <Route
          path="register"
          element={
            <GuestOnly>
              <Lazy>
                <RegisterPage />
              </Lazy>
            </GuestOnly>
          }
        />
        <Route
          path="worker/onboarding"
          element={
            <RequireAuth roles={["worker"]}>
              <Lazy>
                <WorkerOnboarding />
              </Lazy>
            </RequireAuth>
          }
        />
        <Route path="account" element={<RedirectByRole />} />
        <Route
          path="account/customer"
          element={
            <RequireAuth roles={["customer"]}>
              <Lazy>
                <CustomerDashboard />
              </Lazy>
            </RequireAuth>
          }
        />
        <Route
          path="account/worker"
          element={
            <RequireAuth roles={["worker"]}>
              <Lazy>
                <WorkerDashboard />
              </Lazy>
            </RequireAuth>
          }
        />
        <Route
          path="account/admin"
          element={
            <RequireAuth roles={["admin"]}>
              <Lazy>
                <AdminDashboard />
              </Lazy>
            </RequireAuth>
          }
        />
        <Route
          path="about"
          element={
            <Lazy>
              <StaticPage title="About KAMLE AI" />
            </Lazy>
          }
        />
        <Route
          path="support"
          element={
            <Lazy>
              <StaticPage title="Customer Support" />
            </Lazy>
          }
        />
        <Route
          path="privacy"
          element={
            <Lazy>
              <StaticPage title="Privacy Policy" />
            </Lazy>
          }
        />
        <Route
          path="terms"
          element={
            <Lazy>
              <StaticPage title="Terms and Conditions" />
            </Lazy>
          }
        />
        <Route
          path="*"
          element={
            <Lazy>
              <NotFound />
            </Lazy>
          }
        />
      </Route>
    </Routes>
  );
}