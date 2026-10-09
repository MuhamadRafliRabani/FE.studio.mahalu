import { apiBaseUrl, csrfHeaders, ensureCsrfCookie } from "~/lib/sanctum";

type GraphQLUploadResult<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function graphqlUpload<T>(
  query: string,
  variables: Record<string, unknown>,
  files: Record<string, File | File[]>,
): Promise<GraphQLUploadResult<T>> {
  await ensureCsrfCookie();
  const operations = JSON.stringify({ query, variables });
  const map: Record<string, string[]> = {};
  const form = new FormData();
  form.append("operations", operations);

  let index = 0;
  for (const [variablePath, value] of Object.entries(files)) {
    const values = Array.isArray(value) ? value : [value];
    for (const [fileIndex, file] of values.entries()) {
      map[String(index)] = [
        `variables.${variablePath}${Array.isArray(value) ? `.${fileIndex}` : ""}`,
      ];
      form.append(String(index), file);
      index += 1;
    }
  }
  form.append("map", JSON.stringify(map));

  const response = await $fetch<GraphQLUploadResult<T>>(
    `${apiBaseUrl()}/graphql`,
    {
      method: "POST",
      body: form,
      credentials: "include",
      headers: csrfHeaders(),
    },
  );

  return response;
}
