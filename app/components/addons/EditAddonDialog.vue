<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  IconDeviceFloppy,
  IconInfoCircle,
  IconLoader2,
  IconPlus,
  IconTrash,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PriceInput from "@/components/PriceInput.vue";
import { appToast } from "@/lib/toast";
import { formatDuration } from "@/utils/formatDuration";
import {
  DEFAULT_ADDON_ICON,
  normalizeAddonIconName,
} from "@/utils/addonIcons";
import AddonIconSelect from "./AddonIconSelect.vue";
import Searchselect from "../Searchselect.vue";

type Studio = {
  id: string;
  name: string;
  code: string;
  thumbnail_url: string | null;
};
type AddonStudio = Pick<Studio, "id" | "name">;
type Addon = {
  id: string;
  name: string;
  icon: string | null;
  pricing_type: "per_tier" | "flat";
  flat_price: number | null;
  studios: AddonStudio[];
};
type AddonPrice = { id: string; duration_minutes: number; price: number };
type AddonWithPrices = Addon & { prices: AddonPrice[] };
const STUDIOS_QUERY = `query { studios { id name code thumbnail_url } }`;
const UPDATE_ADDON = `mutation ($id: ID!, $name: String!, $icon: String!, $pricingType: String!, $flatPrice: Int, $studioIds: [ID!]) { updateAddon(id: $id, name: $name, icon: $icon, pricing_type: $pricingType, flat_price: $flatPrice, studio_ids: $studioIds) { id } }`;
const UPSERT_ADDON_PRICE = `mutation ($addonId: ID!, $durationMinutes: Int!, $price: Int!) { upsertAddonPrice(addon_id: $addonId, duration_minutes: $durationMinutes, price: $price) { id } }`;
const DELETE_ADDON_PRICE = `mutation ($id: ID!) { deleteAddonPrice(id: $id) { id } }`;

// Opsi pola harga untuk SearchSelect — dipisah dari <select> native
// sebelumnya, tapi value-nya tetap persis "per_tier" | "flat" sehingga
// tidak menyentuh logika penyimpanan/validasi sama sekali.
const PRICING_TYPE_OPTIONS: { value: "per_tier" | "flat"; label: string }[] = [
  { value: "per_tier", label: "Berdasarkan durasi" },
  { value: "flat", label: "Flat per booking/hari" },
];

const props = defineProps<{ addon?: AddonWithPrices | null }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "saved"): void }>();
const form = ref<HTMLFormElement>();
const name = ref("");
const icon = ref(DEFAULT_ADDON_ICON);
const pricingType = ref<"per_tier" | "flat">("per_tier");
const flatPrice = ref<number | null>(null);
const studioIds = ref<string[]>([]);
const priceRows = ref<AddonPrice[]>([]);
const removedPriceIds = ref<string[]>([]);
const {
  data: studiosResult,
  isFetching: isLoadingStudios,
  error: studiosError,
} = useQuery({ query: STUDIOS_QUERY });
const { execute: updateAddon, isFetching: isUpdating } =
  useMutation(UPDATE_ADDON);
const { execute: upsertAddonPrice } = useMutation(UPSERT_ADDON_PRICE);
const { execute: deleteAddonPrice } = useMutation(DELETE_ADDON_PRICE);
const studios = computed<Studio[]>(() => {
  return studiosResult.value?.studios ?? [];
});
console.log("🚀 ~ studios:", studios);

const isSaving = computed(() => isUpdating.value);

watch(
  () => [props.addon, open.value] as const,
  ([addon, isOpen]) => {
    if (!isOpen) return;
    name.value = addon?.name ?? "";
    icon.value = normalizeAddonIconName(addon?.icon);
    pricingType.value = addon?.pricing_type ?? "per_tier";
    flatPrice.value = addon?.flat_price ?? null;
    studioIds.value = addon?.studios.map((studio) => studio.id) ?? [];
    priceRows.value = (addon?.prices ?? []).map((price) => ({ ...price }));
    removedPriceIds.value = [];
  },
  { immediate: true },
);

function addPriceRow() {
  priceRows.value.push({
    id: `new-${Date.now()}-${priceRows.value.length}`,
    duration_minutes: 60,
    price: 0,
  });
}

function removePriceRow(row: AddonPrice) {
  if (!row.id.startsWith("new-")) removedPriceIds.value.push(row.id);
  priceRows.value = priceRows.value.filter((item) => item.id !== row.id);
}

// Dialog dikontrol lewat :open + @update:open (bukan v-model:open) supaya
// percobaan menutup (tombol X bawaan, Escape, klik luar, tombol Batal)
// diabaikan selama isSaving — sebelumnya ini celah: DialogRoot lama
// langsung `open = $event` tanpa penjagaan.
function requestClose(nextOpen: boolean) {
  if (!isSaving.value) open.value = nextOpen;
}

async function submit() {
  if (!form.value?.reportValidity() || isSaving.value) return;
  if (pricingType.value === "per_tier") {
    const durations = new Set<number>();
    for (const row of priceRows.value) {
      const durationMinutes = Math.trunc(Number(row.duration_minutes) || 0);
      const price = Math.trunc(Number(row.price) || 0);
      if (durationMinutes < 1 || price < 0 || durations.has(durationMinutes)) {
        appToast.error("Gagal memvalidasi harga addon", {
          description:
            "Pastikan durasi minimal satu menit dan tidak ada durasi yang sama.",
        });
        return;
      }
      durations.add(durationMinutes);
    }
  }
  const addonName = name.value.trim();
  const toastId = appToast.loading(
    `Menyimpan perubahan addon "${addonName}"...`,
    {
      description: "Data addon dan konfigurasi harganya sedang diproses.",
    },
  );
  try {
    const variables = {
      name: addonName,
      icon: icon.value,
      pricingType: pricingType.value,
      flatPrice:
        pricingType.value === "flat"
          ? Math.trunc(Number(flatPrice.value) || 0)
          : null,
      studioIds: studioIds.value,
    };
    const result = await updateAddon({ id: props.addon!.id, ...variables });
    const saved = result.data?.updateAddon;
    if (result.error || !saved?.id)
      throw new Error(result.error?.message ?? "Addon gagal disimpan.");
    if (pricingType.value === "per_tier") {
      const durations = new Set<number>();
      for (const id of removedPriceIds.value) {
        const result = await deleteAddonPrice({ id });
        if (result.error) throw new Error(result.error.message);
      }
      for (const row of priceRows.value) {
        const durationMinutes = Math.trunc(Number(row.duration_minutes) || 0);
        const price = Math.trunc(Number(row.price) || 0);
        if (
          durationMinutes < 1 ||
          price < 0 ||
          durations.has(durationMinutes)
        ) {
          throw new Error("Durasi harga harus unik dan minimal 1 menit.");
        }
        durations.add(durationMinutes);
        const result = await upsertAddonPrice({
          addonId: saved.id,
          durationMinutes,
          price,
        });
        if (result.error) throw new Error(result.error.message);
      }
    }
    appToast.success(`Addon "${addonName}" berhasil diperbarui`, {
      id: toastId,
      description: "Konfigurasi addon dan studio yang berlaku telah tersimpan.",
    });
    open.value = false;
    emit("saved");
  } catch (error) {
    appToast.error(`Addon "${addonName}" gagal disimpan`, {
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
        class="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[95vw] sm:max-w-2xl"
      >
        <!-- Header -->
        <DialogHeader
          class="shrink-0 border-b px-4 py-4 pr-10 sm:px-6 sm:py-5 sm:pr-12"
        >
          <DialogTitle
            class="text-base font-semibold tracking-tight sm:text-lg"
          >
            Edit addon
          </DialogTitle>
          <DialogDescription class="text-sm">
            Atur layanan, pola harga, dan studio yang menyediakan addon ini.
          </DialogDescription>
        </DialogHeader>

        <!-- Body -->
        <form
          ref="form"
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6"
          @submit.prevent="submit"
        >
          <div class="space-y-6 sm:space-y-8">
            <!-- Informasi dasar -->
            <section class="space-y-4">
              <div class="grid gap-2">
                <Label for="addon-name">
                  Nama addon <span class="text-destructive">*</span>
                </Label>
                <Input
                  id="addon-name"
                  v-model="name"
                  required
                  maxlength="120"
                  placeholder="Contoh: Fotografer"
                  :disabled="isSaving"
                />
              </div>

              <AddonIconSelect v-model="icon" :disabled="isSaving" />

              <div class="grid gap-2">
                <Label
                  for="addon-pricing-type"
                  class="flex items-center gap-1.5"
                >
                  Pola harga
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button
                        type="button"
                        tabindex="-1"
                        class="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Info pola harga"
                      >
                        <IconInfoCircle class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-64">
                      <p>
                        <strong>Flat</strong>: harga tetap per booking/hari —
                        cocok untuk MUA atau Stylist.
                      </p>
                      <p class="mt-1">
                        <strong>Durasi</strong>: harga mengikuti tier durasi
                        booking — cocok untuk Fotografer atau Videografer.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Searchselect
                  id="addon-pricing-type"
                  v-model="pricingType"
                  :options="PRICING_TYPE_OPTIONS"
                  :disabled="isSaving"
                />
              </div>

              <div v-if="pricingType === 'flat'" class="grid gap-2">
                <Label for="addon-flat-price">Harga flat</Label>
                <PriceInput
                  id="addon-flat-price"
                  v-model="flatPrice"
                  :disabled="isSaving"
                />
              </div>
            </section>

            <!-- Daftar harga (khusus pola durasi) -->
            <section v-if="pricingType !== 'flat'" class="space-y-3">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="flex items-center gap-1.5">
                  <Label>Daftar harga</Label>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <button
                        type="button"
                        tabindex="-1"
                        class="text-muted-foreground transition-colors hover:text-foreground"
                        aria-label="Info daftar harga"
                      >
                        <IconInfoCircle class="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent class="max-w-64">
                      <p>
                        Masukkan durasi dalam menit — tampilan jam/menitnya
                        otomatis diformat di bawah kolom durasi. Tiap durasi
                        harus unik.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  :disabled="isSaving"
                  @click="addPriceRow"
                >
                  <IconPlus class="size-4" />
                  Tambah harga
                </Button>
              </div>

              <div
                v-if="!priceRows.length"
                class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground"
              >
                Belum ada harga. Tambahkan opsi durasi pertama.
              </div>
              <div v-else class="overflow-hidden rounded-md border">
                <div
                  class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"
                >
                  <span>Durasi (menit)</span>
                  <span>Harga</span>
                  <span class="sr-only">Aksi</span>
                </div>
                <div
                  v-for="row in priceRows"
                  :key="row.id"
                  class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <div class="grid gap-1">
                    <Input
                      v-model.number="row.duration_minutes"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="Contoh: 90"
                      :disabled="isSaving"
                    />
                    <span class="text-xs text-muted-foreground">
                      {{ formatDuration(row.duration_minutes) }}
                    </span>
                  </div>
                  <PriceInput
                    :id="`addon-price-${row.id}`"
                    v-model="row.price"
                    :disabled="isSaving"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="text-destructive hover:text-destructive"
                    :disabled="isSaving"
                    aria-label="Hapus harga"
                    @click="removePriceRow(row)"
                  >
                    <IconTrash class="size-4" />
                  </Button>
                </div>
              </div>
            </section>

            <!-- Studio -->
            <section class="space-y-2">
              <div class="flex items-center gap-1.5">
                <Label>Studio yang menyediakan addon</Label>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      tabindex="-1"
                      class="text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Info studio addon"
                    >
                      <IconInfoCircle class="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent class="max-w-64">
                    <p>
                      Addon hanya akan tampil pada studio yang dicentang di
                      sini.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div
                v-if="isLoadingStudios"
                class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
              >
                Memuat studio…
              </div>
              <div v-else-if="studiosError" class="text-sm text-destructive">
                Gagal memuat studio.
              </div>
              <div
                v-else-if="!studios.length"
                class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
              >
                Belum ada studio.
              </div>
              <div
                v-else
                class="space-y-1 rounded-md grid md:grid-cols-2 border p-2"
              >
                <label
                  v-for="studio in studios"
                  :key="studio.id"
                  class="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted/50"
                >
                  <input
                    v-model="studioIds"
                    type="checkbox"
                    :value="studio.id"
                    :disabled="isSaving"
                    class="size-4 rounded border-input"
                  />
                  <img
                    v-if="studio.thumbnail_url"
                    :src="studio.thumbnail_url"
                    :alt="`Thumbnail ${studio.name}`"
                    class="size-10 shrink-0 rounded-md object-cover"
                  />
                  <div
                    v-else
                    class="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground"
                  >
                    -
                  </div>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate font-medium">{{
                      studio.name
                    }}</span>
                    <span class="block truncate text-xs text-muted-foreground">
                      {{ studio.code }}
                    </span>
                  </span>
                </label>
              </div>
            </section>
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
            :disabled="isSaving || isLoadingStudios"
            class="w-full sm:w-auto"
            @click="submit"
          >
            <IconLoader2 v-if="isSaving" class="size-4 animate-spin" />
            <IconDeviceFloppy class="size-4" />
            {{ isSaving ? "Menyimpan…" : "Simpan perubahan" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
