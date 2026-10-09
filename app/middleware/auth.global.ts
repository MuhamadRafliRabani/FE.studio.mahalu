import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();
  const authPath = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ];

  const user = await authStore.fetchSession();
  const isAuthPage = authPath.includes(to.path);

  console.info(to.path, user, isAuthPage);

  if (!user && !isAuthPage) {
    return navigateTo("/login", { replace: true });
  }

  if (user && isAuthPage) {
    return navigateTo("/dashboard", { replace: true });
  }
});
