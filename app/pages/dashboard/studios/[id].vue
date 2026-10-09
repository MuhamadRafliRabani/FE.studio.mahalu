<script setup lang="ts">
import { useMutation, useQuery } from "villus";

const route = useRoute();
const id = String(route.params.id);
const STUDIO_QUERY = `query ($id: ID!) { studio(id: $id) { id code name description capacity size_sqm slug thumbnail_url sort_order is_active photos { id url sort_order } } }`;
const UPDATE_STUDIO = `mutation ($id: ID!, $name: String!, $description: String, $capacity: Int, $sizeSqm: Float, $slug: String, $thumbnail: Upload, $photos: [Upload!], $isActive: Boolean!, $sortOrder: Int!) { updateStudio(id: $id, name: $name, description: $description, capacity: $capacity, size_sqm: $sizeSqm, slug: $slug, thumbnail: $thumbnail, photos: $photos, is_active: $isActive, sort_order: $sortOrder) { id } }`;
const DELETE_STUDIO = `mutation ($id: ID!) { deleteStudio(id: $id) { id } }`;
const {
  data,
  execute: loadStudio,
  isFetching: isLoading,
  error: loadError,
} = useQuery({ query: STUDIO_QUERY, variables: { id } });
const {
  execute: update,
  isFetching: isUpdating,
  error: updateError,
} = useMutation(UPDATE_STUDIO);
const {
  execute: remove,
  isFetching: isDeleting,
  error: deleteError,
} = useMutation(DELETE_STUDIO);

const name = ref("");
const description = ref("");
const capacity = ref<number | undefined>();
const sizeSqm = ref<number | undefined>();
const slug = ref("");
const sortOrder = ref(0);
const isActive = ref(true);
const thumbnail = ref<File>();
const photos = ref<File[]>([]);
const initialized = ref(false);

watch(
  () => data.value?.studio,
  (studio) => {
    if (studio && !initialized.value) {
      name.value = studio.name;
      description.value = studio.description ?? "";
      capacity.value = studio.capacity ?? undefined;
      sizeSqm.value = studio.size_sqm ?? undefined;
      slug.value = studio.slug;
      sortOrder.value = studio.sort_order;
      isActive.value = studio.is_active;
      initialized.value = true;
    }
  },
  { immediate: true },
);

function setThumbnail(event: Event) {
  thumbnail.value = (event.target as HTMLInputElement).files?.[0];
}

function setPhotos(event: Event) {
  photos.value = Array.from((event.target as HTMLInputElement).files ?? []);
}

async function submit() {
  const variables = {
    id,
    name: name.value,
    description: description.value || null,
    capacity: capacity.value ?? null,
    sizeSqm: sizeSqm.value ?? null,
    slug: slug.value,
    thumbnail: null,
    photos: null,
    isActive: isActive.value,
    sortOrder: sortOrder.value,
  };
  const result =
    thumbnail.value || photos.value.length
      ? await graphqlUpload(UPDATE_STUDIO, variables, {
          ...(thumbnail.value ? { thumbnail: thumbnail.value } : {}),
          ...(photos.value.length ? { photos: photos.value } : {}),
        })
      : await update(variables);
  if (!("error" in result) || !result.error) {
    if (!("errors" in result) || !result.errors?.length)
      await navigateTo("/studios");
  }
}

async function deletePhoto(photoId: string) {
  const { apiBaseUrl, csrfHeaders, ensureCsrfCookie } =
    await import("~/lib/sanctum");
  await ensureCsrfCookie();
  await $fetch(`${apiBaseUrl()}/graphql`, {
    method: "POST",
    credentials: "include",
    body: {
      query: `mutation ($id: ID!) { deleteStudioPhoto(id: $id) { id } }`,
      variables: { id: photoId },
    },
    headers: csrfHeaders(),
  });
  await loadStudio();
}

async function deleteStudio() {
  if (!window.confirm("Hapus studio ini?")) return;
  const result = await remove({ id });
  if (!result.error) await navigateTo("/studios");
}
</script>

<template>
  <div>
    <NuxtLink to="/studios">Kembali</NuxtLink>
    <h1>Edit Studio</h1>
    <p v-if="isLoading">Memuat...</p>
    <p v-if="loadError">Gagal memuat studio.</p>
    <form v-if="data?.studio" @submit.prevent="submit">
      <p>Kode: {{ data.studio.code }}</p>
      <label>Nama Studio <input v-model="name" required /></label>
      <label>Deskripsi <textarea v-model="description" /></label>
      <label
        >Kapasitas <input v-model.number="capacity" min="1" type="number"
      /></label>
      <label
        >Luas (m²)
        <input v-model.number="sizeSqm" min="0" step="0.01" type="number"
      /></label>
      <label>Slug <input v-model="slug" required /></label>
      <label
        >Urutan <input v-model.number="sortOrder" min="0" type="number"
      /></label>
      <label
        >Ganti thumbnail
        <input
          accept="image/jpeg,image/png,image/webp"
          type="file"
          @change="setThumbnail"
      /></label>
      <label
        >Tambah showcase
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          type="file"
          @change="setPhotos"
      /></label>
      <img
        v-if="data.studio.thumbnail_url"
        :src="data.studio.thumbnail_url"
        alt="Thumbnail studio"
        width="160"
      />
      <div v-for="photo in data.studio.photos" :key="photo.id">
        <img :src="photo.url" alt="Foto showcase studio" width="160" />
        <button type="button" @click="deletePhoto(photo.id)">Hapus foto</button>
      </div>
      <label><input v-model="isActive" type="checkbox" /> Aktif</label>
      <p v-if="updateError">{{ updateError.message }}</p>
      <p v-if="deleteError">{{ deleteError.message }}</p>
      <button :disabled="isUpdating" type="submit">
        {{ isUpdating ? "Menyimpan..." : "Simpan Perubahan" }}
      </button>
      <button :disabled="isDeleting" type="button" @click="deleteStudio">
        {{ isDeleting ? "Menghapus..." : "Hapus" }}
      </button>
    </form>
  </div>
</template>
