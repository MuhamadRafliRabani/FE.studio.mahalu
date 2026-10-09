<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMutation, useQuery } from "villus";
import {
  IconCalendar,
  IconDeviceFloppy,
  IconGift,
  IconLoader2,
  IconPlus,
  IconX,
} from "@tabler/icons-vue";
import { getLocalTimeZone, parseDate, type DateValue } from "@internationalized/date";
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
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RangeCalendar } from "@/components/ui/range-calendar";
import PriceInput from "@/components/PriceInput.vue";
import Searchselect from "@/components/Searchselect.vue";
import { appToast } from "@/lib/toast";
import { formatDuration } from "@/utils/formatDuration";

type PricingTier = {
  id: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};
type AddonPrice = { duration_minutes: number; price: number; is_active: boolean };
type Addon = {
  id: string;
  name: string;
  pricing_type: "flat" | "per_tier";
  flat_price: number | null;
  is_active: boolean;
  prices: AddonPrice[];
};
type Studio = {
  id: string;
  name: string;
  code: string;
  thumbnail_url: string | null;
  is_active: boolean;
  pricing_tiers: PricingTier[];
  addons: Addon[];
};
type BundleAddon = {
  id: string;
  duration_minutes: number | null;
  addon: Pick<Addon, "id" | "name">;
};
type Bundle = {
  id: string;
  name: string;
  description: string | null;
  studio: { id: string; name: string };
  pricing_tier: { id: string; duration_minutes: number; price: number };
  addons: BundleAddon[];
  bundle_price: number;
  valid_from: string | null;
  valid_until: string | null;
  quota_limit: number | null;
  quota_period: "total" | "monthly" | null;
  sort_order: number;
  is_active: boolean;
};
type PromoRange = { start: DateValue | undefined; end: DateValue | undefined };

const STUDIOS_QUERY = `query { studios { id name code thumbnail_url is_active pricing_tiers { id duration_minutes price is_active } addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } } } }`;
const CREATE_BUNDLE = `mutation ($input: BundleInput!) { createBundle(input: $input) { id } }`;
const UPDATE_BUNDLE = `mutation ($id: ID!, $input: BundleInput!) { updateBundle(id: $id, input: $input) { id } }`;

const props = defineProps<{ bundle: Bundle | null }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "saved"): void }>();
const form = ref<HTMLFormElement>();
const name = ref("");
const description = ref("");
const studioId = ref<string | null>(null);
const tierId = ref<string | null>(null);
const selectedAddonIds = ref<string[]>([]);
const addonDurations = ref<Record<string, number>>({});
const bundlePrice = ref<number | null>(null);
const validFrom = ref("");
const validUntil = ref("");
const promoOpen = ref(false);
const quotaLimit = ref("");
const quotaPeriod = ref<"total" | "monthly" | null>(null);
const sortOrder = ref(0);
const isActive = ref(true);
const isSaving = ref(false);

const { data: studiosResult, isFetching: isLoadingStudios } = useQuery({
  query: STUDIOS_QUERY,
});
const { execute: createBundle } = useMutation(CREATE_BUNDLE);
const { execute: updateBundle } = useMutation(UPDATE_BUNDLE);
const studios = computed<Studio[]>(() =>
  (studiosResult.value?.studios ?? []).filter((studio: Studio) => studio.is_active),
);
const studioOptions = computed(() =>
  studios.value.map((studio) => ({
    value: studio.id,
    label: studio.name,
    description: studio.code,
    imageUrl: studio.thumbnail_url,
  })),
);
const studio = computed(() => studios.value.find((item) => item.id === studioId.value));
const tiers = computed(() =>
  (studio.value?.pricing_tiers ?? [])
    .filter((tier) => tier.is_active)
    .sort((left, right) => left.duration_minutes - right.duration_minutes),
);
const tierOptions = computed(() =>
  tiers.value.map((tier) => ({
    value: tier.id,
    label: `${formatDuration(tier.duration_minutes)} · ${formatCurrency(tier.price)}`,
  })),
);
const tier = computed(() => tiers.value.find((item) => item.id === tierId.value));
const addons = computed(() =>
  (studio.value?.addons ?? []).filter((addon) => addon.is_active),
);
const normalPrice = computed(() => {
  if (!tier.value || selectedAddonIds.value.length === 0) return null;
  const selectedPrices = selectedAddonIds.value.map((addonId) => {
    const addon = addons.value.find((item) => item.id === addonId);
    if (!addon) return null;
    if (addon.pricing_type === "flat") return addon.flat_price ?? 0;
    return (
      addon.prices.find(
        (price) =>
          price.is_active &&
          price.duration_minutes === addonDurations.value[addonId],
      )?.price ?? null
    );
  });
  if (selectedPrices.some((price) => price === null)) return null;
  return tier.value.price + selectedPrices.reduce<number>((sum, price) => sum + (price ?? 0), 0);
});
const discountAmount = computed(() =>
  normalPrice.value === null || bundlePrice.value === null
    ? 0
    : Math.max(0, normalPrice.value - bundlePrice.value),
);
const discountPercent = computed(() =>
  normalPrice.value && discountAmount.value > 0
    ? Math.round((discountAmount.value / normalPrice.value) * 100)
    : 0,
);
const hasPriceError = computed(
  () =>
    normalPrice.value !== null &&
    bundlePrice.value !== null &&
    bundlePrice.value >= normalPrice.value,
);
const selectedAddons = computed(() =>
  selectedAddonIds.value
    .map((addonId) => addons.value.find((item) => item.id === addonId))
    .filter((addon): addon is Addon => Boolean(addon))
    .map((addon) => ({
      id: addon.id,
      name: addon.name,
      price: addonPriceOf(addon),
    })),
);
const quotaPeriodOptions = [
  { value: "total" as const, label: "Total" },
  { value: "monthly" as const, label: "Bulanan" },
];

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function toDateValue(value: string): DateValue | undefined {
  if (!value) return undefined;
  try {
    return parseDate(value);
  } catch {
    return undefined;
  }
}

function formatDateValue(value: DateValue | undefined): string {
  return value ? dateFormatter.format(value.toDate(getLocalTimeZone())) : "";
}

// Jembatan antara RangeCalendar (DateValue) dan state string YYYY-MM-DD yang sudah ada.
const promoRange = computed<PromoRange>({
  get: () => ({
    start: toDateValue(validFrom.value),
    end: toDateValue(validUntil.value),
  }),
  set: (range) => {
    validFrom.value = range?.start?.toString() ?? "";
    validUntil.value = range?.end?.toString() ?? "";
    if (range?.start && range?.end) promoOpen.value = false;
  },
});

const promoLabel = computed(() => {
  const start = formatDateValue(promoRange.value.start);
  const end = formatDateValue(promoRange.value.end);
  if (start && end) return `${start} – ${end}`;
  if (start) return `${start} – pilih tanggal akhir`;
  return "";
});

function clearPromoRange() {
  validFrom.value = "";
  validUntil.value = "";
}

function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("id-ID");
}

function priceOptions(addon: Addon): AddonPrice[] {
  return addon.prices
    .filter(
      (price) =>
        price.is_active &&
        price.duration_minutes <= (tier.value?.duration_minutes ?? 0),
    )
    .sort((left, right) => left.duration_minutes - right.duration_minutes);
}

// Harga satu add-on sesuai pilihan saat ini (null jika belum bisa dihitung).
function addonPriceOf(addon: Addon): number | null {
  if (addon.pricing_type === "flat") return addon.flat_price ?? 0;
  return (
    addon.prices.find(
      (price) =>
        price.is_active &&
        price.duration_minutes === addonDurations.value[addon.id],
    )?.price ?? null
  );
}

function toggleAddon(addon: Addon) {
  if (selectedAddonIds.value.includes(addon.id)) {
    selectedAddonIds.value = selectedAddonIds.value.filter((id) => id !== addon.id);
    const { [addon.id]: _removed, ...remainingDurations } = addonDurations.value;
    addonDurations.value = remainingDurations;
    return;
  }

  const firstPrice = priceOptions(addon)[0];
  if (addon.pricing_type === "per_tier" && !firstPrice) return;
  selectedAddonIds.value = [...selectedAddonIds.value, addon.id];
  if (firstPrice) addonDurations.value[addon.id] = firstPrice.duration_minutes;
}

function resetForm(bundle: Bundle | null = null) {
  name.value = bundle?.name ?? "";
  description.value = bundle?.description ?? "";
  studioId.value = bundle?.studio.id ?? null;
  tierId.value = bundle?.pricing_tier.id ?? null;
  selectedAddonIds.value = bundle?.addons.map((item) => item.addon.id) ?? [];
  addonDurations.value = Object.fromEntries(
    (bundle?.addons ?? [])
      .filter((item) => item.duration_minutes !== null)
      .map((item) => [item.addon.id, Number(item.duration_minutes)]),
  );
  bundlePrice.value = bundle?.bundle_price ?? null;
  validFrom.value = bundle?.valid_from?.slice(0, 10) ?? "";
  validUntil.value = bundle?.valid_until?.slice(0, 10) ?? "";
  promoOpen.value = false;
  quotaLimit.value = bundle?.quota_limit?.toString() ?? "";
  quotaPeriod.value = bundle?.quota_period ?? null;
  sortOrder.value = bundle?.sort_order ?? 0;
  isActive.value = bundle?.is_active ?? true;
}

watch(
  () => [open.value, props.bundle] as const,
  ([isOpen, bundle]) => {
    if (isOpen) resetForm(bundle);
  },
  { immediate: true },
);

function onStudioChange(nextStudioId: string | number | null) {
  if (nextStudioId === studioId.value) return;
  studioId.value = nextStudioId === null ? null : String(nextStudioId);
  tierId.value = null;
  selectedAddonIds.value = [];
  addonDurations.value = {};
}

function onTierChange(nextTierId: string | number | null) {
  if (nextTierId === tierId.value) return;
  tierId.value = nextTierId === null ? null : String(nextTierId);
  selectedAddonIds.value = [];
  addonDurations.value = {};
}

function requestClose(nextOpen: boolean) {
  if (!isSaving.value) open.value = nextOpen;
}

async function submit() {
  if (!form.value?.reportValidity() || isSaving.value) return;
  if (!studioId.value || !tierId.value || !selectedAddonIds.value.length) {
    appToast.error("Komposisi bundle belum lengkap", {
      description: "Pilih Studio, durasi, dan minimal satu add-on.",
    });
    return;
  }
  if (normalPrice.value === null || bundlePrice.value === null || bundlePrice.value >= normalPrice.value) {
    appToast.error("Harga bundle tidak valid", {
      description: "Harga paket harus lebih rendah dari total harga normal.",
    });
    return;
  }
  if (validFrom.value && validUntil.value && validUntil.value <= validFrom.value) {
    appToast.error("Periode promo tidak valid", {
      description: "Tanggal akhir promo harus setelah tanggal mulai.",
    });
    return;
  }
  if (quotaLimit.value && (!quotaPeriod.value || Number(quotaLimit.value) < 1)) {
    appToast.error("Pengaturan kuota belum lengkap", {
      description: "Isi batas kuota positif dan pilih periode kuota.",
    });
    return;
  }

  isSaving.value = true;
  const input = {
    name: name.value.trim(),
    description: description.value.trim() || null,
    studio_id: studioId.value,
    pricing_tier_id: tierId.value,
    bundle_price: Math.trunc(bundlePrice.value),
    valid_from: validFrom.value || null,
    valid_until: validUntil.value || null,
    quota_limit: quotaLimit.value ? Math.trunc(Number(quotaLimit.value)) : null,
    quota_period: quotaLimit.value ? quotaPeriod.value : null,
    sort_order: Math.max(0, Math.trunc(Number(sortOrder.value) || 0)),
    is_active: isActive.value,
    addons: selectedAddonIds.value.map((addonId) => ({
      addon_id: addonId,
      duration_minutes:
        addons.value.find((addon) => addon.id === addonId)?.pricing_type === "flat"
          ? null
          : addonDurations.value[addonId],
    })),
  };
  const isEditing = Boolean(props.bundle);
  const toastId = appToast.loading(isEditing ? "Menyimpan perubahan bundle…" : "Membuat bundle…");

  try {
    const result = isEditing
      ? await updateBundle({ id: props.bundle!.id, input })
      : await createBundle({ input });
    const saved = isEditing ? result.data?.updateBundle : result.data?.createBundle;
    if (result.error || !saved?.id) {
      throw new Error(result.error?.message ?? "Bundle gagal disimpan.");
    }
    appToast.success(isEditing ? "Bundle berhasil diperbarui" : "Bundle berhasil dibuat", {
      id: toastId,
      description: "Data bundle dan komposisinya tersimpan.",
    });
    emit("saved");
    open.value = false;
  } catch (error) {
    appToast.error("Bundle gagal disimpan", {
      id: toastId,
      description: error instanceof Error ? error.message : "Periksa data lalu coba lagi.",
    });
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="requestClose">
    <DialogContent class="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[95vw] sm:max-w-4xl">
      <DialogHeader class="shrink-0 space-y-1 border-b px-4 py-4 pr-12 sm:px-6">
        <DialogTitle class="text-lg">{{ bundle ? "Edit bundle" : "Bundle baru" }}</DialogTitle>
        <DialogDescription>
          Gabungkan durasi studio dan add-on menjadi satu paket dengan harga spesial.
        </DialogDescription>
      </DialogHeader>

      <form ref="form" class="min-h-0 flex-1 overflow-y-auto overscroll-contain" @submit.prevent="submit">
        <div class="grid gap-0 md:grid-cols-[minmax(0,1fr)_300px]">
          <!-- ============ KOLOM FORM ============ -->
          <div class="space-y-8 px-4 py-6 sm:px-6">
            <!-- Informasi bundle -->
            <section class="space-y-4">
              <div>
                <h3 class="text-sm font-semibold">Informasi bundle</h3>
                <p class="text-xs text-muted-foreground">Nama dan deskripsi yang dilihat pelanggan.</p>
              </div>
              <div class="grid gap-2">
                <Label for="bundle-name">Nama bundle</Label>
                <Input id="bundle-name" v-model="name" required maxlength="120" placeholder="Contoh: Paket Foto Produk + Lighting" :disabled="isSaving" />
              </div>
              <div class="grid gap-2">
                <Label for="bundle-description">
                  Deskripsi <span class="font-normal text-muted-foreground">(opsional)</span>
                </Label>
                <Textarea id="bundle-description" v-model="description" rows="3" maxlength="5000" placeholder="Jelaskan apa yang didapat pelanggan dari paket ini" class="min-h-20 resize-none" :disabled="isSaving" />
              </div>
            </section>

            <!-- Isi paket -->
            <section class="space-y-4 border-t pt-6">
              <div>
                <h3 class="text-sm font-semibold">Isi paket</h3>
                <p class="text-xs text-muted-foreground">Pilih studio dan durasi dulu, lalu centang add-on yang masuk paket.</p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-2">
                  <Label>Studio</Label>
                  <Searchselect :model-value="studioId" :options="studioOptions" placeholder="Pilih studio" search-placeholder="Cari nama atau kode studio…" :disabled="isLoadingStudios || isSaving" @update:model-value="onStudioChange">
                    <template #selected="{ option }">
                      <span class="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <img
                          v-if="option.imageUrl"
                          :src="option.imageUrl"
                          :alt="`Thumbnail ${option.label}`"
                          class="size-8 shrink-0 rounded object-cover"
                        />
                        <span
                          v-else
                          class="size-8 shrink-0 rounded bg-muted"
                          aria-hidden="true"
                        />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-medium text-foreground">{{ option.label }}</span>
                          <span class="block truncate text-xs text-muted-foreground">{{ option.description }}</span>
                        </span>
                      </span>
                    </template>
                    <template #item="{ option }">
                      <span class="flex min-w-0 flex-1 items-center gap-3">
                        <img
                          v-if="option.imageUrl"
                          :src="option.imageUrl"
                          :alt="`Thumbnail ${option.label}`"
                          class="size-10 shrink-0 rounded-md object-cover"
                        />
                        <span
                          v-else
                          class="size-10 shrink-0 rounded-md bg-muted"
                          aria-hidden="true"
                        />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-medium">{{ option.label }}</span>
                          <span class="block truncate text-xs text-muted-foreground">{{ option.description }}</span>
                        </span>
                      </span>
                    </template>
                  </Searchselect>
                </div>
                <div class="grid gap-2">
                  <Label>Durasi sewa</Label>
                  <Searchselect :model-value="tierId" :options="tierOptions" placeholder="Pilih durasi" search-placeholder="Cari durasi…" :disabled="!studioId || isSaving" @update:model-value="onTierChange" />
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <Label>Add-on dalam paket <span class="text-destructive">*</span></Label>
                  <span v-if="selectedAddonIds.length" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {{ selectedAddonIds.length }} dipilih
                  </span>
                </div>

                <p v-if="!studioId || !tierId" class="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  Pilih studio dan durasi untuk melihat add-on yang tersedia.
                </p>
                <p v-else-if="!addons.length" class="rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  Studio ini belum punya add-on aktif. Tambahkan add-on di pengaturan studio.
                </p>
                <ul v-else class="space-y-2">
                  <li
                    v-for="addon in addons"
                    :key="addon.id"
                    class="rounded-lg border p-3 transition-colors"
                    :class="
                      selectedAddonIds.includes(addon.id)
                        ? 'border-primary/50 bg-primary/5'
                        : 'bg-background hover:bg-muted/40'
                    "
                  >
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <input
                        :id="`bundle-addon-${addon.id}`"
                        type="checkbox"
                        :checked="selectedAddonIds.includes(addon.id)"
                        class="size-4 shrink-0 rounded border-input accent-primary"
                        :disabled="isSaving || (addon.pricing_type === 'per_tier' && !priceOptions(addon).length)"
                        @change="toggleAddon(addon)"
                      />
                      <label :for="`bundle-addon-${addon.id}`" class="min-w-0 flex-1 cursor-pointer">
                        <span class="block truncate text-sm font-medium">{{ addon.name }}</span>
                        <span class="block text-xs text-muted-foreground">
                          <template v-if="addon.pricing_type === 'flat'">Harga tetap Rp {{ formatCurrency(addon.flat_price) }}</template>
                          <template v-else-if="!priceOptions(addon).length">Tidak tersedia untuk durasi ini</template>
                          <template v-else>Harga mengikuti durasi add-on</template>
                        </span>
                      </label>

                      <Searchselect
                        v-if="selectedAddonIds.includes(addon.id) && addon.pricing_type === 'per_tier'"
                        :model-value="addonDurations[addon.id] ?? null"
                        :options="priceOptions(addon).map((price) => ({ value: price.duration_minutes, label: `${formatDuration(price.duration_minutes)} · ${formatCurrency(price.price)}` }))"
                        placeholder="Pilih durasi add-on"
                        :disabled="isSaving"
                        class="w-full sm:w-56"
                        @update:model-value="(value) => { if (value !== null) addonDurations[addon.id] = Number(value); }"
                      />
                    </div>
                  </li>
                </ul>
              </div>
            </section>

            <!-- Harga & urutan -->
            <section class="grid gap-4 border-t pt-6 sm:grid-cols-2">
              <div class="space-y-2">
                <div>
                  <h3 class="text-sm font-semibold">Harga paket</h3>
                  <p class="text-xs text-muted-foreground">Harga yang ditampilkan kepada pelanggan.</p>
                </div>
                <PriceInput id="bundle-price" v-model="bundlePrice" :disabled="isSaving" />
                <p v-if="hasPriceError" class="text-xs font-medium text-destructive">
                  Harga paket harus lebih rendah dari harga normal (Rp {{ formatCurrency(normalPrice) }}).
                </p>
              </div>
              <div class="space-y-2">
                <div>
                  <h3 class="text-sm font-semibold">Tampilan</h3>
                  <p class="text-xs text-muted-foreground">Atur urutan dan status bundle di daftar.</p>
                </div>
                <Input id="bundle-sort-order" v-model.number="sortOrder" type="number" min="0" step="1" :disabled="isSaving" />
              </div>
            </section>

            <!-- Promo & kuota -->
            <section class="space-y-4 border-t pt-6">
              <div>
                <h3 class="text-sm font-semibold">Promo dan kuota</h3>
                <p class="text-xs text-muted-foreground">Kosongkan jika bundle berlaku terus tanpa batas.</p>
              </div>

              <div class="grid gap-2">
                <Label for="bundle-promo-range">
                  Periode promo <span class="font-normal text-muted-foreground">(opsional)</span>
                </Label>
                <div class="flex items-center gap-2">
                  <Popover v-model:open="promoOpen">
                    <PopoverTrigger as-child>
                      <Button
                        id="bundle-promo-range"
                        type="button"
                        variant="outline"
                        class="h-10 min-w-0 flex-1 justify-start gap-2 px-3 text-left font-normal"
                        :class="!promoLabel && 'text-muted-foreground'"
                        :disabled="isSaving"
                      >
                        <IconCalendar class="size-4 shrink-0" />
                        <span class="truncate">{{ promoLabel || "Pilih tanggal mulai dan akhir" }}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent class="max-h-[70dvh] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-0" align="start">
                      <RangeCalendar
                        v-model="promoRange"
                        locale="id-ID"
                        :number-of-months="2"
                        initial-focus
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    v-if="validFrom || validUntil"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="size-10 shrink-0"
                    aria-label="Hapus periode promo"
                    :disabled="isSaving"
                    @click="clearPromoRange"
                  >
                    <IconX class="size-4" />
                  </Button>
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="grid gap-2">
                  <Label for="bundle-quota">
                    Batas kuota <span class="font-normal text-muted-foreground">(opsional)</span>
                  </Label>
                  <Input id="bundle-quota" v-model="quotaLimit" type="number" min="1" step="1" placeholder="Tanpa batas" :disabled="isSaving" />
                </div>
                <div class="grid gap-2">
                  <Label>Kuota dihitung</Label>
                  <Searchselect v-model="quotaPeriod" :options="quotaPeriodOptions" placeholder="Pilih periode" :disabled="!quotaLimit || isSaving" />
                </div>
              </div>
            </section>

            <!-- Status -->
            <section class="border-t pt-6">
              <label class="relative flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
                <span class="min-w-0">
                  <span class="block text-sm font-medium">Bundle aktif</span>
                  <span class="block text-xs text-muted-foreground">Bisa dipilih saat booking</span>
                </span>
                <input v-model="isActive" type="checkbox" class="peer sr-only" :disabled="isSaving" />
                <span
                  class="relative h-6 w-11 shrink-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-background after:shadow after:transition-transform after:content-[''] peer-checked:after:translate-x-5"
                  aria-hidden="true"
                />
              </label>
            </section>
          </div>

          <!-- ============ KOLOM RINGKASAN ============ -->
          <aside class="border-t bg-muted/30 px-4 py-6 sm:px-6 md:border-l md:border-t-0 md:px-5">
            <div class="space-y-5 md:sticky md:top-6">
              <h3 class="text-sm font-semibold">Ringkasan paket</h3>

              <div class="space-y-3">
                <div class="aspect-video w-full overflow-hidden rounded-lg border bg-muted">
                  <img
                    v-if="studio?.thumbnail_url"
                    :src="studio.thumbnail_url"
                    :alt="`Thumbnail ${studio.name}`"
                    class="size-full object-cover"
                  />
                  <div v-else class="flex size-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                    {{ studio ? "Studio ini belum punya thumbnail" : "Pilih studio untuk melihat thumbnail" }}
                  </div>
                </div>

                <div class="space-y-1">
                  <p class="truncate text-base font-semibold" :class="!name.trim() && 'text-muted-foreground'">
                    {{ name.trim() || "Belum diberi nama" }}
                  </p>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <template v-if="studio">
                      <span class="truncate">{{ studio.name }}</span>
                      <span class="rounded-md bg-background px-1.5 py-0.5 text-xs font-medium text-foreground ring-1 ring-border">{{ studio.code }}</span>
                      <span v-if="tier">{{ formatDuration(tier.duration_minutes) }}</span>
                    </template>
                    <span v-else>Studio belum dipilih</span>
                  </div>
                </div>
              </div>

              <div class="space-y-2 text-sm">
                <div v-if="tier" class="flex justify-between gap-3">
                  <span class="text-muted-foreground">Sewa {{ formatDuration(tier.duration_minutes) }}</span>
                  <span class="tabular-nums">Rp {{ formatCurrency(tier.price) }}</span>
                </div>
                <div v-for="item in selectedAddons" :key="item.id" class="flex justify-between gap-3">
                  <span class="min-w-0 truncate text-muted-foreground">{{ item.name }}</span>
                  <span class="shrink-0 tabular-nums">{{ item.price === null ? "-" : `Rp ${formatCurrency(item.price)}` }}</span>
                </div>
                <p v-if="!tier && !selectedAddons.length" class="text-muted-foreground">
                  Rincian harga muncul setelah kamu memilih isi paket.
                </p>
              </div>

              <div class="space-y-2 border-t pt-4 text-sm">
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">Harga normal</span>
                  <span
                    class="tabular-nums"
                    :class="bundlePrice !== null && normalPrice !== null && !hasPriceError ? 'text-muted-foreground line-through' : ''"
                  >
                    {{ normalPrice === null ? "-" : `Rp ${formatCurrency(normalPrice)}` }}
                  </span>
                </div>
                <div class="flex items-baseline justify-between gap-3">
                  <span class="font-medium">Harga paket</span>
                  <span class="text-xl font-semibold tabular-nums">
                    {{ bundlePrice === null ? "-" : `Rp ${formatCurrency(bundlePrice)}` }}
                  </span>
                </div>
                <div
                  v-if="discountAmount > 0 && !hasPriceError"
                  class="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <span class="flex items-center gap-2 text-sm font-medium"><IconGift class="size-4" /> Hemat {{ discountPercent }}%</span>
                  <span class="text-sm font-semibold tabular-nums">Rp {{ formatCurrency(discountAmount) }}</span>
                </div>
              </div>

              <dl v-if="promoLabel || quotaLimit" class="space-y-2 border-t pt-4 text-sm">
                <div v-if="promoLabel" class="flex justify-between gap-3">
                  <dt class="text-muted-foreground">Promo</dt>
                  <dd class="text-right">{{ promoLabel }}</dd>
                </div>
                <div v-if="quotaLimit" class="flex justify-between gap-3">
                  <dt class="text-muted-foreground">Kuota</dt>
                  <dd class="text-right">
                    {{ quotaLimit }}<template v-if="quotaPeriod">, {{ quotaPeriod === "monthly" ? "per bulan" : "total" }}</template>
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </form>

      <DialogFooter class="shrink-0 gap-2 border-t bg-background px-4 py-4 sm:px-6">
        <Button type="button" variant="outline" :disabled="isSaving" @click="requestClose(false)">Batal</Button>
        <Button type="button" :disabled="isSaving || isLoadingStudios" @click="submit">
          <IconLoader2 v-if="isSaving" class="size-4 animate-spin" />
          <IconDeviceFloppy v-else-if="bundle" class="size-4" />
          <IconPlus v-else class="size-4" />
          {{ isSaving ? "Menyimpan…" : bundle ? "Simpan perubahan" : "Buat bundle" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>