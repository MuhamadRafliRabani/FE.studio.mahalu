<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconPencil,
  IconPhoto,
  IconTrash,
  IconUpload,
} from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { graphqlUpload } from "@/composables/useGraphQLUpload";
import {
  compressImage,
  compressImages,
} from "@/composables/useImageCompression";
import { appToast } from "@/lib/toast";

/**
 * NOTE (Clau):
 * `Studio` type versi edit yang lama cuma punya 8 field — nggak ada
 * `thumbnail_url` atau `photos`. Aku tambahin di sini karena tanpa itu
 * dialog edit nggak bisa nampilin foto sampul/galeri yang udah ada.
 * Konsekuensinya: query yang fetch data studio buat dialog ini (di
 * StudiosTable atau di mana pun `editingStudio` di-set) HARUS ikut minta
 * `thumbnail_url` dan `photos { id url }`, kalau nggak, dialog edit akan
 * kebuka seolah-olah studio itu belum ada foto sama sekali — padahal
 * di server ada. Nggak ada data yang rusak/kehapus, tapi UI-nya bakal
 * nyesatin.
 */
type StudioPhoto = { id: string; url: string };
type Studio = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  capacity: number | null;
  size_sqm: number | null;
  thumbnail_url: string | null;
  photos: StudioPhoto[];
  is_active: boolean;
  sort_order: number;
};

const UPDATE_STUDIO = `
  mutation ($id: ID!, $name: String!, $description: String, $capacity: Int, $sizeSqm: Float, $slug: String, $thumbnail: Upload, $photos: [Upload!], $isActive: Boolean!, $sortOrder: Int!) {
    updateStudio(id: $id, name: $name, description: $description, capacity: $capacity, size_sqm: $sizeSqm, slug: $slug, thumbnail: $thumbnail, photos: $photos, is_active: $isActive, sort_order: $sortOrder) {
      id
    }
  }
`;

// Dipisah dari UPDATE_STUDIO karena skema kamu expose ini sebagai mutation
// sendiri (`deleteStudioPhoto`) — foto lama nggak bisa dihapus lewat
// updateStudio.
const DELETE_STUDIO_PHOTO = `
  mutation ($id: ID!) {
    deleteStudioPhoto(id: $id) {
      id
    }
  }
`;

const MAX_PHOTOS = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ImageItem = { file: File; url: string; id: string };

const props = defineProps<{ studio: Studio | null }>();
console.log("🚀 ~ props:", props);
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{
  (event: "updated", studio: Partial<Studio> & { id: string }): void;
}>();

const form = ref<HTMLFormElement>();
const thumbnailInput = ref<HTMLInputElement>();
const photosInput = ref<HTMLInputElement>();

const name = ref("");
const slug = ref("");
const slugEdited = ref(false);
const description = ref("");
const capacity = ref<number>();
const sizeSqm = ref<number>();
const sortOrder = ref(0);
const isActive = ref(true);

// Foto sampul: bisa berupa foto lama (string url) atau file baru yang
// belum diupload (ImageItem). `thumbnailRemoved` nandain user sengaja
// hapus foto lama tanpa ganti yang baru.
const existingThumbnailUrl = ref<string | null>(null);
const thumbnail = ref<ImageItem | null>(null);
const thumbnailRemoved = ref(false);
const thumbnailError = ref("");
const isDraggingThumbnail = ref(false);
const thumbnailPreview = computed(
  () =>
    thumbnail.value?.url ??
    (!thumbnailRemoved.value ? existingThumbnailUrl.value : null),
);

// Galeri: foto lama (dari server, punya id) dipisah dari foto baru (belum
// punya id sampai upload berhasil), supaya remove foto lama bisa manggil
// deleteStudioPhoto, sementara remove foto baru cukup dibuang dari state lokal.
const existingPhotos = ref<StudioPhoto[]>([]);
const removedPhotoIds = ref<string[]>([]);
const newPhotos = ref<ImageItem[]>([]);
const photosError = ref("");
const isDraggingPhotos = ref(false);
const visibleExistingPhotos = computed(() =>
  existingPhotos.value.filter((p) => !removedPhotoIds.value.includes(p.id)),
);
const totalPhotoCount = computed(
  () => visibleExistingPhotos.value.length + newPhotos.value.length,
);

const isSubmitting = ref(false);
const descriptionCount = computed(() => description.value.length);

function slugify(value: string) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function toggleSlugEdit() {
  if (slugEdited.value) {
    slugEdited.value = false;
    slug.value = slugify(name.value);
  } else {
    slugEdited.value = true;
  }
}

watch(name, (value) => {
  if (!slugEdited.value) slug.value = slugify(value);
});

// Isi form ulang tiap kali studio yang di-edit berubah (atau dialog dibuka
// untuk studio lain), bukan cuma sekali di awal.
watch(
  () => [props.studio, open.value] as const,
  ([studio, isOpen]) => {
    if (!studio || !isOpen) return;
    name.value = studio.name;
    slug.value = studio.slug;
    // Slug lama dianggap "sudah diedit manual" — nama diubah tidak akan
    // diam-diam nimpa slug yang sudah dipakai/dibagikan.
    slugEdited.value = true;
    description.value = studio.description ?? "";
    capacity.value = studio.capacity ?? undefined;
    sizeSqm.value = studio.size_sqm ?? undefined;
    sortOrder.value = studio.sort_order;
    isActive.value = studio.is_active;

    existingThumbnailUrl.value = studio.thumbnail_url;
    thumbnail.value = null;
    thumbnailRemoved.value = false;
    thumbnailError.value = "";

    existingPhotos.value = studio.photos ?? [];
    removedPhotoIds.value = [];
    newPhotos.value = [];
    photosError.value = "";
  },
  { immediate: true },
);

function isValidImage(file: File) {
  return ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_IMAGE_BYTES;
}

function setThumbnailFile(file: File | undefined) {
  thumbnailError.value = "";
  if (!file) return;
  if (!isValidImage(file)) {
    thumbnailError.value = "Gunakan file JPG, PNG, atau WEBP maksimal 5MB.";
    return;
  }
  if (thumbnail.value) URL.revokeObjectURL(thumbnail.value.url);
  thumbnail.value = {
    file,
    url: URL.createObjectURL(file),
    id: `${file.name}-${file.size}`,
  };
  thumbnailRemoved.value = false;
}

function removeThumbnail() {
  if (thumbnail.value) URL.revokeObjectURL(thumbnail.value.url);
  thumbnail.value = null;
  thumbnailRemoved.value = true;
}

function onThumbnailInputChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  setThumbnailFile(file);
  (event.target as HTMLInputElement).value = "";
}

function onThumbnailDrop(event: DragEvent) {
  isDraggingThumbnail.value = false;
  setThumbnailFile(event.dataTransfer?.files?.[0]);
}

function addPhotoFiles(fileList: FileList | File[]) {
  photosError.value = "";
  const incoming = Array.from(fileList);
  const room = MAX_PHOTOS - totalPhotoCount.value;

  if (room <= 0) {
    photosError.value = `Maksimal ${MAX_PHOTOS} foto showcase.`;
    return;
  }

  const existingIds = new Set(newPhotos.value.map((p) => p.id));
  let invalidCount = 0;

  for (const file of incoming.slice(0, room)) {
    if (!isValidImage(file)) {
      invalidCount += 1;
      continue;
    }
    const id = `${file.name}-${file.size}-${file.lastModified}`;
    if (existingIds.has(id)) continue;
    newPhotos.value.push({ file, url: URL.createObjectURL(file), id });
    existingIds.add(id);
  }

  if (invalidCount > 0) {
    photosError.value =
      "Beberapa file dilewati: gunakan JPG, PNG, atau WEBP maksimal 5MB.";
  } else if (incoming.length > room) {
    photosError.value = `Maksimal ${MAX_PHOTOS} foto showcase.`;
  }
}

function removeExistingPhoto(id: string) {
  removedPhotoIds.value.push(id);
}

function removeNewPhoto(id: string) {
  const index = newPhotos.value.findIndex((p) => p.id === id);
  if (index === -1) return;
  const photo = newPhotos.value[index];
  if (!photo) return;
  URL.revokeObjectURL(photo.url);
  newPhotos.value.splice(index, 1);
}

function onPhotosInputChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files?.length) addPhotoFiles(files);
  (event.target as HTMLInputElement).value = "";
}

function onPhotosDrop(event: DragEvent) {
  isDraggingPhotos.value = false;
  if (event.dataTransfer?.files?.length)
    addPhotoFiles(event.dataTransfer.files);
}

function revokeAllUrls() {
  if (thumbnail.value) URL.revokeObjectURL(thumbnail.value.url);
  newPhotos.value.forEach((p) => URL.revokeObjectURL(p.url));
}

function requestClose(nextOpen: boolean) {
  if (!isSubmitting.value) open.value = nextOpen;
}

async function submit() {
  if (!props.studio || !form.value?.reportValidity() || isSubmitting.value)
    return;

  isSubmitting.value = true;

  const studio = props.studio;
  const studioName = name.value.trim();
  const newPhotoCount = newPhotos.value.length;
  const removedCount = removedPhotoIds.value.length;

  const toastId = appToast.loading(
    `Menyimpan perubahan studio "${studioName}"...`,
    {
      description:
        newPhotoCount > 0 || removedCount > 0
          ? `${newPhotoCount ? `+${newPhotoCount} foto baru` : ""}${
              newPhotoCount && removedCount ? ", " : ""
            }${removedCount ? `-${removedCount} foto dihapus` : ""}`.trim()
          : "Perubahan detail studio sedang disimpan.",
    },
  );

  try {
    // Hapus foto lama dulu, baru simpan sisanya — supaya kalau ini gagal,
    // studio belum kepatri dengan state "berhasil" yang salah.
    if (removedPhotoIds.value.length) {
      await Promise.all(
        removedPhotoIds.value.map((id) =>
          graphqlUpload(DELETE_STUDIO_PHOTO, { id }, {}),
        ),
      );
    }

    const variables = {
      id: studio.id,
      name: studioName,
      description: description.value.trim() || null,
      capacity: capacity.value ?? null,
      sizeSqm: sizeSqm.value ?? null,
      slug: slug.value.trim() || null,
      thumbnail: null,
      photos: null,
      isActive: isActive.value,
      sortOrder: Math.max(0, Math.trunc(Number(sortOrder.value) || 0)),
    };

    const compressedThumbnail = thumbnail.value
      ? await compressImage(thumbnail.value.file)
      : undefined;
    const compressedPhotos = await compressImages(
      newPhotos.value.map((photo) => photo.file),
    );

    const result = await graphqlUpload<{ updateStudio: { id: string } }>(
      UPDATE_STUDIO,
      variables,
      {
        ...(compressedThumbnail ? { thumbnail: compressedThumbnail } : {}),
        ...(compressedPhotos.length ? { photos: compressedPhotos } : {}),
      },
    );

    if (result.errors?.length || !result.data?.updateStudio?.id) {
      appToast.error(`Perubahan studio "${studioName}" gagal disimpan`, {
        id: toastId,
        description:
          result.errors?.[0]?.message ??
          "Terjadi kesalahan di server; periksa isian lalu coba lagi.",
      });
      return;
    }

    appToast.success(`Studio "${studioName}" berhasil diperbarui`, {
      id: toastId,
      description: "Perubahan detail studio telah tersimpan pada sistem.",
    });

    emit("updated", {
      id: studio.id,
      name: studioName,
      description: variables.description,
      capacity: variables.capacity,
      size_sqm: variables.sizeSqm,
      slug: variables.slug ?? "",
      is_active: variables.isActive,
      sort_order: variables.sortOrder,
    });
    open.value = false;
  } catch (error) {
    appToast.error(`Perubahan studio "${studioName}" gagal disimpan`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba simpan kembali.",
    });
  } finally {
    isSubmitting.value = false;
  }
}

onBeforeUnmount(revokeAllUrls);
</script>

<template>
  <Dialog :open="open" @update:open="requestClose">
    <DialogContent
      class="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[95vw] sm:max-w-2xl"
    >
      <!-- Header -->
      <DialogHeader
        class="shrink-0 border-b px-4 py-4 pr-10 sm:px-6 sm:py-5 sm:pr-12"
      >
        <DialogTitle class="text-base font-semibold tracking-tight sm:text-lg">
          Edit studio
        </DialogTitle>
        <DialogDescription class="text-sm">
          Perbarui detail ruang studio. Field bertanda * wajib diisi.
        </DialogDescription>
      </DialogHeader>

      <!-- Body -->
      <form
        ref="form"
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
        @submit.prevent="submit"
      >
        <div class="space-y-6 sm:space-y-8">
          <!-- Foto sampul -->
          <section class="space-y-2">
            <h3 class="text-sm font-medium text-foreground">Foto sampul</h3>
            <div
              class="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors"
              :class="
                isDraggingThumbnail
                  ? 'border-primary bg-primary/5'
                  : 'border-input bg-muted/30 hover:bg-muted/50'
              "
              @dragover.prevent="isDraggingThumbnail = true"
              @dragleave.prevent="isDraggingThumbnail = false"
              @drop.prevent="onThumbnailDrop"
            >
              <template v-if="thumbnailPreview">
                <img
                  :src="thumbnailPreview"
                  alt=""
                  class="size-full object-cover"
                />
                <div
                  class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  <button
                    type="button"
                    class="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-background"
                    @click="thumbnailInput?.click()"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    class="rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-background"
                    @click="removeThumbnail"
                  >
                    Hapus
                  </button>
                </div>
              </template>
              <button
                v-else
                type="button"
                class="flex flex-col items-center gap-2 px-6 py-8 text-center"
                @click="thumbnailInput?.click()"
              >
                <IconPhoto class="size-6 text-muted-foreground" />
                <span class="text-sm font-medium text-foreground"
                  >Seret foto ke sini atau klik untuk memilih</span
                >
                <span class="text-xs text-muted-foreground"
                  >JPG, PNG, atau WEBP, maksimal 5MB</span
                >
              </button>
              <input
                ref="thumbnailInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="onThumbnailInputChange"
              />
            </div>
            <p v-if="thumbnailError" class="text-xs text-destructive">
              {{ thumbnailError }}
            </p>
          </section>

          <!-- Informasi dasar -->
          <section class="space-y-4">
            <h3 class="text-sm font-medium text-foreground">Informasi dasar</h3>

            <div class="grid gap-2">
              <Label for="edit-studio-name"
                >Nama studio <span class="text-destructive">*</span></Label
              >
              <Input
                id="edit-studio-name"
                v-model="name"
                required
                maxlength="120"
                autocomplete="organization"
              />
            </div>

            <div class="grid gap-2">
              <div class="flex items-center justify-between">
                <Label for="edit-studio-slug">Slug</Label>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  @click="toggleSlugEdit"
                >
                  <IconPencil class="size-3" />
                  {{ slugEdited ? "Gunakan otomatis" : "Ubah manual" }}
                </button>
              </div>
              <div
                class="flex items-center rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
                :class="!slugEdited ? 'bg-muted/40' : 'bg-background'"
              >
                <span class="pl-3 text-sm text-muted-foreground">/studio/</span>
                <input
                  id="edit-studio-slug"
                  v-model="slug"
                  :readonly="!slugEdited"
                  type="text"
                  placeholder="mh-studio-01"
                  maxlength="120"
                  class="w-full bg-transparent px-1 py-2 font-mono text-sm outline-none"
                  @blur="slug = slugify(slug)"
                />
              </div>
              <p class="text-xs text-muted-foreground">
                {{
                  slugEdited
                    ? "Hati-hati: mengubah slug bisa merusak link yang sudah dibagikan ke customer."
                    : "Dibuat otomatis dari nama studio."
                }}
              </p>
            </div>

            <div class="grid gap-2">
              <Label for="edit-studio-description">Deskripsi</Label>
              <textarea
                id="edit-studio-description"
                v-model="description"
                rows="6"
                maxlength="1000"
                placeholder="Ceritakan suasana, pencahayaan, atau kelebihan ruang ini…"
                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p class="text-right text-xs text-muted-foreground">
                {{ descriptionCount }}/1000
              </p>
            </div>
          </section>

          <!-- Detail ruang -->
          <section class="space-y-4">
            <h3 class="text-sm font-medium text-foreground">Detail ruang</h3>
            <div class="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2">
              <div class="grid gap-2">
                <Label for="edit-studio-capacity">Kapasitas</Label>
                <div class="relative">
                  <Input
                    id="edit-studio-capacity"
                    v-model.number="capacity"
                    type="number"
                    min="1"
                    step="1"
                    class="pr-14"
                  />
                  <span
                    class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                  >
                    orang
                  </span>
                </div>
              </div>
              <div class="grid gap-2">
                <Label for="edit-studio-size">Luas ruang</Label>
                <div class="relative">
                  <Input
                    id="edit-studio-size"
                    v-model.number="sizeSqm"
                    type="number"
                    min="0"
                    step="0.01"
                    class="pr-10"
                  />
                  <span
                    class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                  >
                    m²
                  </span>
                </div>
              </div>
            </div>
          </section>

          <!-- Galeri foto -->
          <section class="space-y-2">
            <div class="flex items-baseline justify-between">
              <h3 class="text-sm font-medium text-foreground">Galeri foto</h3>
              <span class="text-xs text-muted-foreground"
                >{{ totalPhotoCount }}/{{ MAX_PHOTOS }} foto</span
              >
            </div>
            <div
              class="rounded-lg border border-dashed p-3 transition-colors"
              :class="
                isDraggingPhotos
                  ? 'border-primary bg-primary/5'
                  : 'border-input'
              "
              @dragover.prevent="isDraggingPhotos = true"
              @dragleave.prevent="isDraggingPhotos = false"
              @drop.prevent="onPhotosDrop"
            >
              <div class="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4">
                <div
                  v-for="photo in visibleExistingPhotos"
                  :key="`existing-${photo.id}`"
                  class="group relative aspect-square overflow-hidden rounded-md"
                >
                  <img :src="photo.url" alt="" class="size-full object-cover" />
                  <button
                    type="button"
                    class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    aria-label="Hapus foto"
                    @click="removeExistingPhoto(photo.id)"
                  >
                    <IconTrash class="size-4 text-white" />
                  </button>
                </div>
                <div
                  v-for="photo in newPhotos"
                  :key="`new-${photo.id}`"
                  class="group relative aspect-square overflow-hidden rounded-md ring-2 ring-primary/40"
                >
                  <img :src="photo.url" alt="" class="size-full object-cover" />
                  <span
                    class="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground"
                    >Baru</span
                  >
                  <button
                    type="button"
                    class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    aria-label="Batal tambah foto"
                    @click="removeNewPhoto(photo.id)"
                  >
                    <IconTrash class="size-4 text-white" />
                  </button>
                </div>
                <button
                  v-if="totalPhotoCount < MAX_PHOTOS"
                  type="button"
                  class="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-muted-foreground transition-colors hover:bg-muted/50"
                  @click="photosInput?.click()"
                >
                  <IconUpload class="size-4" />
                  <span class="text-[11px] font-medium">Tambah</span>
                </button>
              </div>
              <input
                ref="photosInput"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                class="hidden"
                @change="onPhotosInputChange"
              />
            </div>
            <p v-if="photosError" class="text-xs text-destructive">
              {{ photosError }}
            </p>
            <p v-else class="text-xs text-muted-foreground">
              Drag beberapa foto sekaligus, atau klik "Tambah". Foto lama yang
              dihapus baru benar-benar hilang setelah kamu simpan.
            </p>
          </section>

          <!-- Pengaturan -->
          <section class="space-y-4">
            <h3 class="text-sm font-medium text-foreground">Pengaturan</h3>

            <div
              class="flex items-start justify-between gap-3 rounded-lg border border-input px-3 py-3 sm:gap-4 sm:px-4"
            >
              <div class="min-w-0 space-y-0.5">
                <p class="text-sm font-medium text-foreground">Studio aktif</p>
                <p class="text-xs text-muted-foreground">
                  Studio nonaktif tidak muncul di halaman booking pelanggan.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="isActive"
                class="mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                :class="isActive ? 'bg-primary' : 'bg-input'"
                @click="isActive = !isActive"
              >
                <span
                  class="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform"
                  :class="isActive ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
            </div>

            <div class="grid gap-2 sm:max-w-40">
              <Label for="edit-studio-sort-order">Urutan tampilan</Label>
              <Input
                id="edit-studio-sort-order"
                v-model.number="sortOrder"
                type="number"
                min="0"
                step="1"
              />
              <p class="text-xs text-muted-foreground">
                Angka lebih kecil tampil lebih dulu.
              </p>
            </div>
          </section>
        </div>
      </form>

      <!-- Footer -->
      <DialogFooter class="shrink-0 gap-2 border-t px-4 py-4 sm:px-6">
        <Button
          type="button"
          variant="outline"
          :disabled="isSubmitting"
          class="w-full sm:w-auto"
          @click="requestClose(false)"
        >
          Batal
        </Button>
        <Button
          type="button"
          :disabled="isSubmitting"
          class="w-full sm:w-auto"
          @click="submit"
        >
          <IconLoader2 v-if="isSubmitting" class="size-4 animate-spin" />
          <IconDeviceFloppy v-else class="size-4" />
          {{ isSubmitting ? "Menyimpan…" : "Simpan perubahan" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
