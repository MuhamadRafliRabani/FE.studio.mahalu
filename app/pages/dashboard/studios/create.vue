<script setup lang="ts">
const CREATE_STUDIO = `
  mutation ($name: String!, $description: String, $capacity: Int, $sizeSqm: Float, $slug: String, $thumbnail: Upload, $photos: [Upload!], $isActive: Boolean!, $sortOrder: Int!) {
    createStudio(name: $name, description: $description, capacity: $capacity, size_sqm: $sizeSqm, slug: $slug, thumbnail: $thumbnail, photos: $photos, is_active: $isActive, sort_order: $sortOrder) {
      id
    }
  }
`;

const name = ref("");
const description = ref("");
const capacity = ref<number | undefined>();
const sizeSqm = ref<number | undefined>();
const slug = ref("");
const sortOrder = ref(0);
const isActive = ref(true);
const thumbnail = ref<File>();
const photos = ref<File[]>([]);
const isFetching = ref(false);
const error = ref<{ message: string }>();

function setThumbnail(event: Event) {
  thumbnail.value = (event.target as HTMLInputElement).files?.[0];
}

function setPhotos(event: Event) {
  photos.value = Array.from((event.target as HTMLInputElement).files ?? []);
}

async function submit() {
  isFetching.value = true;
  error.value = undefined;
  const result = await graphqlUpload(
    CREATE_STUDIO,
    {
      name: name.value,
      description: description.value || null,
      capacity: capacity.value ?? null,
      sizeSqm: sizeSqm.value ?? null,
      slug: slug.value || null,
      thumbnail: null,
      photos: null,
      isActive: isActive.value,
      sortOrder: sortOrder.value,
    },
    {
      ...(thumbnail.value ? { thumbnail: thumbnail.value } : {}),
      ...(photos.value.length ? { photos: photos.value } : {}),
    },
  );
  isFetching.value = false;
  if (!result.errors?.length) {
    await navigateTo("/studios");
  } else {
    error.value = result.errors[0];
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <label>Nama Studio <input v-model="name" required /></label>
    <label>Deskripsi <textarea v-model="description" /></label>
    <label
      >Kapasitas <input v-model.number="capacity" min="1" type="number"
    /></label>
    <label
      >Luas (m²)
      <input v-model.number="sizeSqm" min="0" step="0.01" type="number"
    /></label>
    <label>Slug <input v-model="slug" placeholder="mh-studio-01" /></label>
    <label
      >Urutan <input v-model.number="sortOrder" min="0" type="number"
    /></label>
    <label
      >Thumbnail
      <input
        accept="image/jpeg,image/png,image/webp"
        type="file"
        @change="setThumbnail"
    /></label>
    <label
      >Showcase
      <input
        accept="image/jpeg,image/png,image/webp"
        multiple
        type="file"
        @change="setPhotos"
    /></label>
    <label> <input v-model="isActive" type="checkbox" /> Aktif </label>
    <p v-if="error">{{ error.message }}</p>
    <button :disabled="isFetching" type="submit">Simpan</button>
  </form>
</template>
