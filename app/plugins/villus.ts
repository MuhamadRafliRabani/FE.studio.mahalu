import { createClient, fetch as fetchPlugin } from "villus";
import { apiBaseUrl, csrfHeaders, ensureCsrfCookie } from "~/lib/sanctum";

export default defineNuxtPlugin((nuxtApp) => {
  const client = createClient({
    url: `${apiBaseUrl()}/graphql`,
    use: [
      async ({ opContext }) => {
        await ensureCsrfCookie();
        opContext.credentials = "include";
        opContext.headers = {
          ...opContext.headers,
          ...csrfHeaders(),
          ...(import.meta.server ? useRequestHeaders(["cookie"]) : {}),
        };
      },
      fetchPlugin(),
    ],
  });

  nuxtApp.vueApp.use(client);
});
