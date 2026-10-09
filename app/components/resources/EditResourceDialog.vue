<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  IconDeviceFloppy,
  IconInfoCircle,
  IconLoader2,
} from "@tabler/icons-vue";
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

type Addon = { id: string; name: string };
type Resource = {
  id: string;
  name: string;
  addon: { id: string; name: string };
  is_active: boolean;
  sort_order: number;
};
const ADDONS_QUERY = `query { addons { id name } }`;
const UPDATE_RESOURCE = `mutation ($id: ID!, $addonId: ID!, $name: String!, $isActive: Boolean!, $sortOrder: Int!) { updateResource(id: $id, addon_id: $addonId, name: $name, is_active: $isActive, sort_order: $sortOrder) { id } }`;
const props = defineProps<{ resource: Resource | null }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "updated"): void }>();
const form = ref<HTMLFormElement>();
const addonId = ref("");
const name = ref("");
const isActive = ref(true);
const sortOrder = ref(0);
const {
  data: addonsResult,
  isFetching: isLoadingAddons,
  error: addonsError,
} = useQuery({ query: ADDONS_QUERY });
const { execute: updateResource, isFetching: isSaving } =
  useMutation(UPDATE_RESOURCE);
const addons = computed<Addon[]>(() => addonsResult.value?.addons ?? []);
// Dipetakan ke bentuk { value, label } yang dipahami SearchSelect — data
// addon dari server tidak diubah sama sekali.
const addonOptions = computed(() =>
  addons.value.map((addon) => ({ value: addon.id, label: addon.name })),
);

watch(
  () => [props.resource, open.value] as const,
  ([resource, isOpen]) => {
    if (!resource || !isOpen) return;
    addonId.value = resource.addon.id;
    name.value = resource.name;
    isActive.value = resource.is_active;
    sortOrder.value = resource.sort_order;
  },
  { immediate: true },
);

// Dialog dikontrol lewat :open + @update:open supaya percobaan menutup
// (tombol X bawaan, Escape, klik luar, tombol Batal) diabaikan selama
// isSaving — sebelumnya ini celah: DialogRoot lama langsung
// `open = $event` tanpa penjagaan.
function requestClose(nextOpen: boolean) {
  if (!isSaving.value) open.value = nextOpen;
}

async function submit() {
  if (!props.resource || !form.value?.reportValidity() || isSaving.value)
    return;
  const resourceName = name.value.trim();
  const toastId = appToast.loading(
    `Menyimpan perubahan resource "${resourceName}"...`,
    {
      description: "Perubahan data resource sedang diproses.",
    },
  );
  try {
    const result = await updateResource({
      id: props.resource.id,
      addonId: addonId.value,
      name: resourceName,
      isActive: isActive.value,
      sortOrder: sortOrder.value,
    });
    if (result.error || !result.data?.updateResource?.id)
      throw new Error(result.error?.message ?? "Resource gagal diperbarui.");
    appToast.success(`Resource "${resourceName}" berhasil diperbarui`, {
      id: toastId,
      description: "Perubahan resource telah tersimpan pada sistem.",
    });
    open.value = false;
    emit("updated");
  } catch (error) {
    appToast.error(`Resource "${resourceName}" gagal diperbarui`, {
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
            Edit resource
          </DialogTitle>
          <DialogDescription class="text-sm">
            Perbarui addon, nama, dan status resource.
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
                for="edit-resource-addon"
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
                      memindahkan resource ke addon lain akan mengubah pola
                      harga yang berlaku untuknya.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <SearchSelect
                id="edit-resource-addon"
                v-model="addonId"
                :options="addonOptions"
                :placeholder="isLoadingAddons ? 'Memuat addon…' : 'Pilih addon'"
                search-placeholder="Cari addon..."
                empty-text="Addon tidak ditemukan."
                :disabled="isLoadingAddons || isSaving"
              />
              <p v-if="addonsError" class="text-xs text-destructive">
                Gagal memuat addon. Muat ulang halaman lalu coba lagi.
              </p>
            </div>

            <div class="grid gap-2">
              <Label for="edit-resource-name">
                Nama resource <span class="text-destructive">*</span>
              </Label>
              <Input
                id="edit-resource-name"
                v-model="name"
                required
                maxlength="120"
                :disabled="isSaving"
              />
            </div>

            <div
              class="flex items-start justify-between gap-3 rounded-lg border border-input px-3 py-3 sm:gap-4 sm:px-4"
            >
              <div class="min-w-0 space-y-0.5">
                <Label
                  for="edit-resource-active"
                  class="text-sm font-medium text-foreground"
                >
                  Resource aktif
                </Label>
                <p class="text-xs text-muted-foreground">
                  Resource nonaktif tidak muncul sebagai pilihan saat booking.
                </p>
              </div>
              <Switch
                id="edit-resource-active"
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
            :disabled="isSaving || isLoadingAddons"
            class="w-full sm:w-auto"
            @click="submit"
          >
            <IconLoader2 v-if="isSaving" class="size-4 animate-spin" />
            <IconDeviceFloppy v-else class="size-4" />
            {{ isSaving ? "Menyimpan…" : "Simpan perubahan" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
