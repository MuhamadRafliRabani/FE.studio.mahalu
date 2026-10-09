<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { IconInfoCircle, IconLoader2, IconPlus } from "@tabler/icons-vue";
import { useMutation, useQuery } from "villus";
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
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SearchSelect from "@/components/Searchselect.vue";
import { appToast } from "@/lib/toast";

const ADDONS_QUERY = `query { addons { id name } }`;
const CREATE_RESOURCE = `mutation ($addonId: ID!, $name: String!, $isActive: Boolean!, $sortOrder: Int!) { createResource(addon_id: $addonId, name: $name, is_active: $isActive, sort_order: $sortOrder) { id } }`;
type Addon = { id: string; name: string };

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "created"): void }>();
const form = ref<HTMLFormElement>();

// SearchSelect butuh v-model berupa value polos (id addon), bukan objek
// addon utuh — beda dari Combobox reka-ui yang dipakai sebelumnya.
const selectedAddonId = ref<string | null>(null);
const addonTouched = ref(false);
const name = ref("");
const isActive = ref(true);

const {
  data: addonsResult,
  isFetching: isLoadingAddons,
  error: addonsError,
} = useQuery({ query: ADDONS_QUERY });
const { execute: createResource, isFetching: isSaving } =
  useMutation(CREATE_RESOURCE);

const addons = computed<Addon[]>(() => addonsResult.value?.addons ?? []);
// Dipetakan ke bentuk { value, label } yang dipahami SearchSelect — data
// addon dari server tidak diubah sama sekali.
const addonOptions = computed(() =>
  addons.value.map((addon) => ({ value: addon.id, label: addon.name })),
);

watch(open, (value) => {
  if (!value) {
    selectedAddonId.value = null;
    addonTouched.value = false;
    name.value = "";
    isActive.value = true;
  }
});

// Dialog dikontrol lewat :open + @update:open supaya percobaan menutup
// (tombol X bawaan, Escape, klik luar, tombol Batal) diabaikan selama
// isSaving — sebelumnya ini celah: DialogRoot lama langsung
// `open = $event` tanpa penjagaan.
function requestClose(nextOpen: boolean) {
  if (!isSaving.value) open.value = nextOpen;
}

async function submit() {
  addonTouched.value = true;
  if (!selectedAddonId.value) return;
  if (!form.value?.reportValidity() || isSaving.value) return;
  const resourceName = name.value.trim();
  const toastId = appToast.loading(`Menyimpan resource "${resourceName}"...`, {
    description: "Data resource sedang diproses.",
  });
  try {
    const result = await createResource({
      addonId: selectedAddonId.value,
      name: resourceName,
      isActive: isActive.value,
      sortOrder: 0,
    });
    if (result.error || !result.data?.createResource?.id)
      throw new Error(result.error?.message ?? "Resource gagal disimpan.");
    appToast.success(`Resource "${resourceName}" berhasil ditambahkan`, {
      id: toastId,
      description: "Resource telah tersimpan dan siap digunakan pada addon.",
    });
    open.value = false;
    emit("created");
  } catch (error) {
    appToast.error(`Resource "${resourceName}" gagal disimpan`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba simpan kembali.",
    });
  }
}
</script>

<template>
  <TooltipProvider>
    <Dialog :open="open" @update:open="requestClose">
      <DialogContent
        class="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[95vw] sm:max-w-lg"
      >
        <!-- Header -->
        <DialogHeader
          class="shrink-0 border-b px-4 py-4 pr-10 sm:px-6 sm:py-5 sm:pr-12"
        >
          <DialogTitle
            class="text-base font-semibold tracking-tight sm:text-lg"
          >
            Tambah resource
          </DialogTitle>
          <DialogDescription class="text-sm">
            Tambahkan resource yang dapat dipakai pada addon.
          </DialogDescription>
        </DialogHeader>

        <!-- Body -->
        <form
          ref="form"
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
          @submit.prevent="submit"
        >
          <div class="space-y-5">
            <div class="grid gap-2">
              <Label
                for="create-resource-addon"
                class="flex items-center gap-1.5"
              >
                Addon <span class="text-destructive">*</span>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      tabindex="-1"
                      class="text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Info resource"
                    >
                      <IconInfoCircle class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-64">
                    <p>
                      Resource adalah instans spesifik dari sebuah addon —
                      misalnya addon "Fotografer" bisa punya beberapa resource
                      seperti nama-nama fotografer yang tersedia.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <SearchSelect
                id="create-resource-addon"
                v-model="selectedAddonId"
                :options="addonOptions"
                :placeholder="isLoadingAddons ? 'Memuat addon…' : 'Pilih addon'"
                search-placeholder="Cari addon..."
                empty-text="Addon tidak ditemukan."
                :disabled="isLoadingAddons || isSaving"
              />
              <p
                v-if="addonTouched && !selectedAddonId"
                class="text-xs text-destructive"
              >
                Addon wajib dipilih.
              </p>
              <p v-if="addonsError" class="text-xs text-destructive">
                Gagal memuat addon. Muat ulang halaman lalu coba lagi.
              </p>
              <p
                v-else-if="!isLoadingAddons && !addons.length"
                class="text-xs text-muted-foreground"
              >
                Belum ada addon. Buat addon terlebih dahulu.
              </p>
            </div>

            <div class="grid gap-2">
              <Label for="create-resource-name">
                Nama resource <span class="text-destructive">*</span>
              </Label>
              <Input
                id="create-resource-name"
                v-model="name"
                required
                maxlength="120"
                placeholder="Contoh: Fotografer utama"
                :disabled="isSaving"
              />
            </div>

            <div
              class="flex items-start justify-between gap-3 rounded-lg border border-input px-3 py-3 sm:gap-4 sm:px-4"
            >
              <div class="min-w-0 space-y-0.5">
                <Label
                  for="create-resource-active"
                  class="text-sm font-medium text-foreground"
                >
                  Resource aktif
                </Label>
                <p class="text-xs text-muted-foreground">
                  Resource nonaktif tidak muncul sebagai pilihan saat booking.
                </p>
              </div>
              <Switch
                id="create-resource-active"
                v-model="isActive"
                :disabled="isSaving"
                class="mt-0.5 shrink-0"
              />
            </div>
          </div>
        </form>

        <!-- Footer -->
        <DialogFooter class="shrink-0 gap-2 border-t px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving"
            class="w-full sm:w-auto"
            @click="requestClose(false)"
          >
            Batal
          </Button>
          <Button
            type="button"
            :disabled="isSaving || isLoadingAddons || !addons.length"
            class="w-full sm:w-auto"
            @click="submit"
          >
            <IconLoader2 v-if="isSaving" class="size-4 animate-spin" />
            <IconPlus v-else class="size-4" />
            {{ isSaving ? "Menyimpan…" : "Simpan resource" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
