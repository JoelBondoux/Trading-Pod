// Public configuration only. No shared secret or broker credential belongs in Vite.
export const API_URL = ((import.meta as any).env?.VITE_API_URL ?? "/api").replace(/\/$/, "");
