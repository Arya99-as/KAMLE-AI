import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMe, login as apiLogin, register as apiRegister } from "../services/api";
import { tokenStore } from "../lib/api";
import type { User, WorkerProfile } from "../types";

interface AuthContextValue {
  user: User | null;
  workerProfile: WorkerProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: { name: string; phone: string; email?: string; password: string; role: "customer" | "worker"; location?: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  setWorkerProfile: (p: WorkerProfile) => void;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [workerProfile, setWorkerProfileState] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe();
      setUserState(data.user);
      setWorkerProfileState(data.workerProfile);
    } catch {
      tokenStore.clear();
      setUserState(null);
      setWorkerProfileState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiLogin({ identifier, password });
    tokenStore.set(data.token);
    setUserState(data.user);
  }, []);

  const register = useCallback(async (data: { name: string; phone: string; email?: string; password: string; role: "customer" | "worker"; location?: string }) => {
    const result = await apiRegister(data);
    tokenStore.set(result.token);
    setUserState(result.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUserState(null);
    setWorkerProfileState(null);
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);
  const setWorkerProfile = useCallback((p: WorkerProfile) => setWorkerProfileState(p), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      workerProfile,
      loading,
      login,
      register,
      logout,
      setUser,
      setWorkerProfile,
      refresh,
      isAuthenticated: Boolean(user),
    }),
    [user, workerProfile, loading, login, register, logout, setUser, setWorkerProfile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}