// ============================================================================
// Login Page — Google Sign-In gate
// ============================================================================

import { useEffect, useRef } from "react";
import { useAuth } from "./AuthContext.js";

const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ?? "";

export function LoginPage() {
  const { loading, error } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading || !buttonRef.current) return;

    const google = (window as any).google;
    if (google?.accounts?.id && GOOGLE_CLIENT_ID) {
      google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280,
      });
    }
  }, [loading]);

  return (
    <div className="flex h-screen items-center justify-center bg-pod-bg">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-4xl">🤖</div>
        <h1 className="text-2xl font-bold text-white">Trading Pod</h1>
        <p className="text-gray-400 text-sm">
          Sign in with your Google account to access the dashboard.
        </p>

        {loading && (
          <p className="text-gray-500 text-sm animate-pulse">Loading...</p>
        )}

        {error && (
          <div className="bg-pod-red/10 border border-pod-red/30 rounded-md px-4 py-3">
            <p className="text-pod-red text-sm">{error}</p>
          </div>
        )}

        {!GOOGLE_CLIENT_ID && !loading && (
          <div className="bg-pod-accent/10 border border-pod-accent/30 rounded-md px-4 py-3">
            <p className="text-pod-accent text-sm">
              Google OAuth not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in your
              environment to enable authentication.
            </p>
          </div>
        )}

        {/* Google renders its button here */}
        <div ref={buttonRef} className="flex justify-center" />

        <p className="text-gray-600 text-xs mt-8">
          Access is restricted to approved email addresses.
        </p>
      </div>
    </div>
  );
}
