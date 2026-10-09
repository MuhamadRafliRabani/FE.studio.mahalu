import { apiBaseUrl, csrfHeaders, ensureCsrfCookie } from "~/lib/sanctum";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const sessionChecked = ref(false);

  async function fetchSession(force = false): Promise<AuthUser | null> {
    if (sessionChecked.value && !force) return user.value;

    try {
      const response = await $fetch<{ user: AuthUser }>(
        `${apiBaseUrl()}/auth/session`,
        {
          credentials: "include",
          headers: import.meta.server
            ? useRequestHeaders(["cookie"])
            : undefined,
        },
      );
      user.value = response.user;
    } catch {
      // Keep an existing client-side login during a transient session check failure.
      if (!user.value) user.value = null;
    } finally {
      sessionChecked.value = true;
    }

    return user.value;
  }

  function setAuth(nextUser: AuthUser) {
    user.value = nextUser;
    sessionChecked.value = true;
  }

  async function logout() {
    await ensureCsrfCookie();
    await $fetch(`${apiBaseUrl()}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: csrfHeaders(),
    });
    user.value = null;
    sessionChecked.value = true;
    await navigateTo("/login", { replace: true });
  }

  function hasPermission(permission: string) {
    return (
      user.value?.roles.includes(permission) ||
      user.value?.roles.includes("admin") ||
      false
    );
  }

  return { user, sessionChecked, fetchSession, setAuth, logout, hasPermission };
});
