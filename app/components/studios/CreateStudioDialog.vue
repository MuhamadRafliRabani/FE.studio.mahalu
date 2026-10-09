<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  IconLoader2,
  IconPencil,
  IconPhoto,
  IconPlus,
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

const CREATE_STUDIO = `
  mutation ($name: String!, $description: String, $capacity: Int, $sizeSqm: Float, $slug: String, $thumbnail: Upload, $photos: [Upload!], $isActive: Boolean!, $sortOrder: Int!) {
    createStudio(name: $name, description: $description, capacity: $capacity, size_sqm: $sizeSqm, slug: $slug, thumbnail: $thumbnail, photos: $photos, is_active: $isActive, sort_order: $sortOrder) {
      id
    }
  }
`;

const MAX_PHOTOS = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ImageItem = { file: File; url: string; id: string };

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{
  (event: "created", studioId: string): void;
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

const thumbnail = ref<ImageItem | null>(null);
const thumbnailError = ref("");
const isDraggingThumbnail = ref(false);

const photos = ref<ImageItem[]>([]);
const photosError = ref("");
const isDraggingPhotos = ref(false);

const isSubmitting = ref(false);

const descriptionCount = computed(() => description.value.length);

watch(open, (isOpen) => {
  if (!isOpen && !isSubmitting.value) resetForm();
});

watch(name, (value) => {
  if (!slugEdited.value) slug.value = slugify(value);
});

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
}

function removeThumbnail() {
  if (thumbnail.value) URL.revokeObjectURL(thumbnail.value.url);
  thumbnail.value = null;
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
  const room = MAX_PHOTOS - photos.value.length;

  if (room <= 0) {
    photosError.value = `Maksimal ${MAX_PHOTOS} foto showcase.`;
    return;
  }

  const existingIds = new Set(photos.value.map((p) => p.id));
  let invalidCount = 0;

  for (const file of incoming.slice(0, room)) {
    if (!isValidImage(file)) {
      invalidCount += 1;
      continue;
    }
    const id = `${file.name}-${file.size}-${file.lastModified}`;
    if (existingIds.has(id)) continue;
    photos.value.push({ file, url: URL.createObjectURL(file), id });
    existingIds.add(id);
  }

  if (invalidCount > 0) {
    photosError.value =
      "Beberapa file dilewati: gunakan JPG, PNG, atau WEBP maksimal 5MB.";
  } else if (incoming.length > room) {
    photosError.value = `Maksimal ${MAX_PHOTOS} foto showcase.`;
  }
}

function removePhoto(id: string) {
  const index = photos.value.findIndex((p) => p.id === id);
  if (index === -1) return;
  const photo = photos.value[index];
  if (!photo) return;
  URL.revokeObjectURL(photo.url);
  photos.value.splice(index, 1);
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
  photos.value.forEach((p) => URL.revokeObjectURL(p.url));
}

function resetForm() {
  form.value?.reset();
  revokeAllUrls();
  name.value = "";
  slug.value = "";
  slugEdited.value = false;
  description.value = "";
  capacity.value = undefined;
  sizeSqm.value = undefined;
  sortOrder.value = 0;
  isActive.value = true;
  thumbnail.value = null;
  thumbnailError.value = "";
  photos.value = [];
  photosError.value = "";
}

// Dialog dikontrol lewat :open + @update:open, bukan v-model:open.
// Ini satu-satunya gerbang untuk menutup dialog — dipakai baik oleh
// tombol X bawaan, tombol Escape, klik di luar, maupun tombol Batal.
// Selama isSubmitting=true, semua percobaan menutup diabaikan.
function requestClose(nextOpen: boolean) {
  if (!isSubmitting.value) open.value = nextOpen;
}

async function submit() {
  if (!form.value?.reportValidity() || isSubmitting.value) return;

  isSubmitting.value = true;

  const studioName = name.value.trim();
  const photoCount = photos.value.length + (thumbnail.value ? 1 : 0);

  const toastId = appToast.loading(`Menyimpan studio "${studioName}"...`, {
    description:
      photoCount > 0
        ? `Mengunggah ${photoCount} foto dan menyimpan detail studio.`
        : "Detail studio sedang disimpan.",
  });

  try {
    const compressedThumbnail = thumbnail.value
      ? await compressImage(thumbnail.value.file)
      : undefined;
    const compressedPhotos = await compressImages(
      photos.value.map((photo) => photo.file),
    );
    const normalizedSortOrder = Math.max(
      0,
      Math.trunc(Number(sortOrder.value) || 0),
    );
    const result = await graphqlUpload<{ createStudio: { id: string } }>(
      CREATE_STUDIO,
      {
        name: studioName,
        description: description.value.trim() || null,
        capacity: capacity.value ?? null,
        sizeSqm: sizeSqm.value ?? null,
        slug: slug.value.trim() || null,
        thumbnail: null,
        photos: null,
        isActive: isActive.value,
        sortOrder: normalizedSortOrder,
      },
      {
        ...(compressedThumbnail ? { thumbnail: compressedThumbnail } : {}),
        ...(compressedPhotos.length ? { photos: compressedPhotos } : {}),
      },
    );

    if (result.errors?.length || !result.data?.createStudio?.id) {
      appToast.error(`Studio "${studioName}" gagal disimpan`, {
        id: toastId,
        description:
          result.errors?.[0]?.message ??
          "Terjadi kesalahan di server; periksa isian lalu coba lagi.",
      });
      return;
    }

    appToast.success(`Studio "${studioName}" berhasil ditambahkan`, {
      id: toastId,
      description:
        photoCount > 0
          ? `${photoCount} foto tersimpan dan studio siap ditampilkan di halaman booking.`
          : "Studio telah tersimpan dan siap ditampilkan di halaman booking.",
    });

    emit("created", result.data.createStudio.id);
    resetForm();
    open.value = false;
  } catch (error) {
    appToast.error(`Studio "${studioName}" gagal disimpan`, {
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
          Studio baru
        </DialogTitle>
        <DialogDescription class="text-sm">
          Lengkapi detail ruang studio. Field bertanda * wajib diisi.
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
              <template v-if="thumbnail">
                <img
                  :src="thumbnail.url"
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

            <div class="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div class="grid min-w-0 gap-2">
                <Label for="studio-name">
                  Nama studio <span class="text-destructive">*</span>
                </Label>
                <Input
                  id="studio-name"
                  v-model="name"
                  required
                  maxlength="120"
                  autocomplete="organization"
                />
              </div>

              <div class="grid min-w-0 gap-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <Label for="studio-slug">Slug</Label>
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
                  class="flex min-w-0 items-center rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
                  :class="!slugEdited ? 'bg-muted/40' : 'bg-background'"
                >
                  <span class="shrink-0 pl-3 text-sm text-muted-foreground">
                    /studio/
                  </span>
                  <input
                    id="studio-slug"
                    v-model="slug"
                    :readonly="!slugEdited"
                    type="text"
                    placeholder="mh-studio-01"
                    maxlength="120"
                    class="min-w-0 w-full bg-transparent px-1 py-2 font-mono text-sm outline-none"
                    @blur="slug = slugify(slug)"
                  />
                </div>
                <p class="text-xs text-muted-foreground">
                  {{
                    slugEdited
                      ? "Slug tidak akan berubah otomatis lagi."
                      : "Dibuat otomatis dari nama studio."
                  }}
                </p>
              </div>
            </div>

            <div class="grid gap-2">
              <Label for="studio-description">Deskripsi</Label>
              <textarea
                id="studio-description"
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
                <Label for="studio-capacity">Kapasitas</Label>
                <div class="relative">
                  <Input
                    id="studio-capacity"
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
                <Label for="studio-size">Luas ruang</Label>
                <div class="relative">
                  <Input
                    id="studio-size"
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
                >{{ photos.length }}/{{ MAX_PHOTOS }} foto</span
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
                  v-for="photo in photos"
                  :key="photo.id"
                  class="group relative aspect-square overflow-hidden rounded-md"
                >
                  <img :src="photo.url" alt="" class="size-full object-cover" />
                  <button
                    type="button"
                    class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    aria-label="Hapus foto"
                    @click="removePhoto(photo.id)"
                  >
                    <IconTrash class="size-4 text-white" />
                  </button>
                </div>
                <button
                  v-if="photos.length < MAX_PHOTOS"
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
              Drag beberapa foto sekaligus, atau klik "Tambah".
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
              <Label for="studio-sort-order">Urutan tampilan</Label>
              <Input
                id="studio-sort-order"
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
          <IconPlus v-else class="size-4" />
          {{ isSubmitting ? "Menyimpan…" : "Simpan studio" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
