import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import { DashboardSessionSchema } from "@trading-pod/shared";
import { API_URL } from "../api.js";

export interface AuthUser {
  subject: string;
  email: string;
  name: string;
  picture: string;
  expiresAt: number;
  idToken: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  signOut: () => {},
});
export const useAuth = () => useContext(AuthContext);

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? "";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  const signOut = useCallback(() => {
    requestGeneration.current++;
    setUser(null);
    const google = (window as any).google;
    google?.accounts?.id?.disableAutoSelect();
  }, []);

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    const generation = ++requestGeneration.current;
    setUser(null);
    setError(null);
    try {
      const result = await fetch(API_URL + "/dashboard/session", {
        headers: { Authorization: "Bearer " + response.credential },
        credentials: "omit",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!result.ok) throw new Error("Sign-in was not authorised by the server.");
      const session = DashboardSessionSchema.parse(await result.json());
      if (session.expiresAt <= Date.now())
        throw new Error("Sign-in has expired. Please try again.");
      if (generation === requestGeneration.current) {
        // Memory only. Never trust decoded claims, sessionStorage, or a browser allowlist.
        setUser({ ...session, idToken: response.credential });
      }
    } catch {
      if (generation === requestGeneration.current) {
        setError("Sign-in could not be verified. Check your access or try again.");
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const timeout = setTimeout(signOut, Math.max(0, user.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [user, signOut]);

  useEffect(() => {
    // Discard sessions from the old unverified client-side login.
    try {
      sessionStorage.removeItem("trading_pod_auth");
    } catch {
      /* unavailable */
    }
    if (!GOOGLE_CLIENT_ID) {
      setError("Dashboard sign-in is not configured.");
      setLoading(false);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        setError("Google Sign-In is unavailable.");
      } else {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
        });
      }
      setLoading(false);
    };
    script.onerror = () => {
      setError("Failed to load Google Sign-In.");
      setLoading(false);
    };
    document.head.appendChild(script);
    return () => {
      requestGeneration.current++;
      script.remove();
    };
  }, [handleCredentialResponse]);

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
