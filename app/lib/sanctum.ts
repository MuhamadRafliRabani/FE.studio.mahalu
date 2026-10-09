const API_BASE = "http://localhost:8000";
let csrfRequest: Promise<void> | null = null;

export function apiBaseUrl(): string {
  if (import.meta.server) {
    return (
      process.env.NUXT_INTERNAL_API_BASE ||
      useRuntimeConfig().public.apiBase ||
      API_BASE
    );
  }

  return useRuntimeConfig().public.apiBase || API_BASE;
}

export function csrfHeaders(): Record<string, string> {
  const csrfToken = useCookie<string | null>("XSRF-TOKEN").value;

  return csrfToken ? { "X-XSRF-TOKEN": decodeURIComponent(csrfToken) } : {};
}

export async function ensureCsrfCookie(): Promise<void> {
  if (!import.meta.client) return;

  csrfRequest ??= $fetch<void>(`${apiBaseUrl()}/sanctum/csrf-cookie`, {
    credentials: "include",
  }).catch((error) => {
    csrfRequest = null;
    throw error;
  });

  await csrfRequest;
}
