import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { titleCase } from "../lib/utils";

const LOCATION_KEY = "kamle_ai_location";

const DEFAULT_LOCATION = "Kolhapur";

interface LocationContextValue {
  location: string;
  setLocation: (loc: string) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState(() => {
    try {
      return localStorage.getItem(LOCATION_KEY) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      if (location) localStorage.setItem(LOCATION_KEY, location);
    } catch {
      /* ignore */
    }
  }, [location]);

  const setLocation = useCallback((loc: string) => {
    setLocationState(loc ? titleCase(loc.trim()) : "");
  }, []);

  const value = useMemo(() => ({ location: location || DEFAULT_LOCATION, setLocation }), [location, setLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within LocationProvider");
  return ctx;
}