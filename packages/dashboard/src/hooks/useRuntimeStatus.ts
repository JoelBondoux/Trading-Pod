import { useEffect } from "react";
import { RuntimeStatusSchema } from "@trading-pod/shared";
import { useAuth } from "../auth/AuthContext.js";
import { API_URL } from "../api.js";
import { usePodStore } from "../store/index.js";

/** Poll the authenticated read-only status API; no shared tokens or order controls. */
export function useRuntimeStatus() {
  const { user, signOut } = useAuth();
  const connected = usePodStore((state) => state.connected);
  const setRuntimeStatus = usePodStore((state) => state.setRuntimeStatus);

  useEffect(() => {
    setRuntimeStatus(null);
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const poll = async () => {
      controller = new AbortController();
      const deadline = setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch(API_URL + "/dashboard/status", {
          headers: { Authorization: "Bearer " + user.idToken },
          credentials: "omit",
          cache: "no-store",
          signal: controller.signal,
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          signOut();
          return;
        }
        if (!response.ok) throw new Error("Status unavailable");
        const status = RuntimeStatusSchema.parse(await response.json());
        if (!cancelled) setRuntimeStatus(status);
      } catch {
        if (!cancelled) setRuntimeStatus(null);
      } finally {
        clearTimeout(deadline);
        if (!cancelled) timer = setTimeout(poll, 30_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller?.abort();
      setRuntimeStatus(null);
    };
  }, [user, signOut, setRuntimeStatus]);
  return { connected };
}
