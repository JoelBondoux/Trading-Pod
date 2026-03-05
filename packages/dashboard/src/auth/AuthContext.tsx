// ============================================================================
// Google OAuth Authentication — Context + Provider
// ============================================================================
// Uses Google Identity Services (GIS) for Sign In With Google.
// The ID token (JWT) is verified client-side and the user's email
// is checked against a configurable allowlist.
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";

export interface AuthUser {
  email: string;
  name: string;
  picture: string;
  /** Raw Google ID token JWT */
  idToken: string;
}

export interface AuthContextType {
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

// ---------------------------------------------------------------------------
// Environment config
// ---------------------------------------------------------------------------

/** Google OAuth Client ID — set in .env as VITE_GOOGLE_CLIENT_ID */
const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? "";

/**
 * Comma-separated allowlist of email addresses.
 * Set in .env as VITE_ALLOWED_EMAILS.
 * If empty, all authenticated Google users are allowed.
 */
const ALLOWED_EMAILS: string[] = ((import.meta as any).env?.VITE_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

// ---------------------------------------------------------------------------
// JWT Decode (minimal — no verification needed, GIS already verified)
// ---------------------------------------------------------------------------

interface GoogleJwtPayload {
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
  exp: number;
}

function decodeJwtPayload(token: string): GoogleJwtPayload {
  const base64 = token.split(".")[1];
  const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "trading_pod_auth";

function saveSession(user: AuthUser): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // sessionStorage may be unavailable
  }
}

function loadSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const user: AuthUser = JSON.parse(raw);
    // Check expiry
    const payload = decodeJwtPayload(user.idToken);
    if (payload.exp * 1000 < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCredentialResponse = useCallback(
    (response: { credential: string }) => {
      try {
        const payload = decodeJwtPayload(response.credential);

        if (!payload.email_verified) {
          setError("Email not verified by Google.");
          return;
        }

        // Check allowlist
        if (
          ALLOWED_EMAILS.length > 0 &&
          !ALLOWED_EMAILS.includes(payload.email.toLowerCase())
        ) {
          setError(`Access denied. ${payload.email} is not in the allowlist.`);
          return;
        }

        const authUser: AuthUser = {
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          idToken: response.credential,
        };

        setUser(authUser);
        setError(null);
        saveSession(authUser);
      } catch (err) {
        setError("Failed to process Google sign-in.");
        console.error("Auth error:", err);
      }
    },
    [],
  );

  const signOut = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
    // Revoke Google session
    const google = (window as any).google;
    if (google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    const savedUser = loadSession();
    if (savedUser) {
      setUser(savedUser);
      setLoading(false);
      return;
    }

    if (!GOOGLE_CLIENT_ID) {
      // No client ID configured — skip auth (development mode)
      setLoading(false);
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        setLoading(false);
        return;
      }

      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: true,
      });

      // Render the button (will be picked up by LoginPage)
      setLoading(false);
    };
    script.onerror = () => {
      setError("Failed to load Google Sign-In.");
      setLoading(false);
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [handleCredentialResponse]);

  return (
    <AuthContext.Provider value={{ user, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
