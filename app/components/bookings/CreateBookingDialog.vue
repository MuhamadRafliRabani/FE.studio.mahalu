<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMutation, useQuery } from "villus";
import {
  getLocalTimeZone,
  parseDate,
  today,
  type DateValue,
} from "@internationalized/date";
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconCreditCard,
  IconGift,
  IconLoader2,
  IconPhoto,
  IconSearch,
  IconTicket,
  IconX,
} from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appToast } from "@/lib/toast";
import BundleCard from "@/components/bundles/BundleCard.vue";

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "created"): void }>();
const CATALOG_QUERY = `query { studios { id name code thumbnail_url is_active pricing_tiers { id duration_minutes price is_active } addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } }`;
const AVAILABILITY_QUERY = `query ($studioId: ID!, $date: String!, $duration: Int!) { bookingAvailability(studio_id: $studioId, date: $date, duration_minutes: $duration) { start_time end_time available } }`;
const BUNDLES_QUERY = `query { sellableBundles { id code name description studio { id name is_active addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } pricing_tier { id duration_minutes price } addons { id duration_minutes addon { id name } } bundle_price normal_price discount_amount valid_from valid_until quota_limit quota_period quota_remaining } }`;
const BUNDLE_AVAILABILITY_QUERY = `query ($bundleId: ID!, $date: String!) { bundleAvailability(bundle_id: $bundleId, date: $date) { start_time end_time available reason } }`;
const ADDON_AVAILABILITY_QUERY = `query ($studioId: ID!, $start: String!, $duration: Int!) { bookingAddonAvailability(studio_id: $studioId, start_time: $start, duration_minutes: $duration) { addon_id available resource_name next_available_at reason } }`;
const CREATE_BOOKING = `mutation ($studioId: ID, $tierId: ID, $bundleId: ID, $name: String!, $wa: String!, $start: String!, $payment: String!, $addons: [BookingAddonInput!]) { createManualBooking(studio_id: $studioId, pricing_tier_id: $tierId, bundle_id: $bundleId, customer_name: $name, customer_wa: $wa, start_time: $start, payment_method: $payment, addons: $addons) { id code payment_url } }`;

type Tier = {
  id: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
};
type Addon = {
  id: string;
  name: string;
  pricing_type: "flat" | "per_tier";
  flat_price: number | null;
  is_active: boolean;
  prices: { duration_minutes: number; price: number; is_active: boolean }[];
  resources: { id: string; is_active: boolean }[];
};
type Studio = {
  id: string;
  name: string;
  code: string;
  thumbnail_url: string | null;
  is_active: boolean;
  pricing_tiers: Tier[];
  addons: Addon[];
};
type Bundle = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  studio: {
    id: string;
    name: string;
    is_active: boolean;
    addons: Addon[];
  };
  pricing_tier: Tier;
  addons: { id: string; duration_minutes: number | null; addon: { id: string; name: string } }[];
  bundle_price: number;
  normal_price: number;
  discount_amount: number;
  valid_from: string | null;
  valid_until: string | null;
  quota_limit: number | null;
  quota_remaining: number | null;
};
type SelectedAddon = { addon: Addon; duration: number };
type BookingSlot = {
  start_time: string;
  end_time: string;
  available: boolean;
};
type AddonAvailability = {
  addon_id: string;
  available: boolean;
  resource_name?: string;
  next_available_at?: string;
  reason?: string;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash / lunas di tempat", icon: IconCash },
  { value: "gateway", label: "Payment gateway", icon: IconCreditCard },
] as const;

const STEP_META = [
  {
    title: "Studio & customer",
    description: "Pilih studio, isi data customer, dan durasi sewa.",
  },
  {
    title: "Tanggal & jam",
    description: "Pilih tanggal dan jam mulai booking.",
  },
  {
    title: "Konfirmasi booking",
    description: "Periksa ringkasan sebelum menyimpan booking.",
  },
] as const;

const { data: catalogResult, isFetching: isLoadingCatalog } = useQuery({
  query: CATALOG_QUERY,
});
const { data: bundlesResult, isFetching: isLoadingBundles, execute: loadBundles } = useQuery({
  query: BUNDLES_QUERY,
});
const { execute: createBooking, isFetching: isSaving } =
  useMutation(CREATE_BOOKING);

const currentStep = ref(1);
const activeTab = ref("studio");
const studioId = ref("");
const tierId = ref("");
const customerName = ref("");
const customerWa = ref("");
const bookingDate = ref("");
const startTime = ref("");
const paymentMethod = ref<"cash" | "gateway">("cash");
const selectedAddons = ref<SelectedAddon[]>([]);
const selectedBundle = ref<Bundle | null>(null);
const addonSearch = ref("");
const form = ref<HTMLFormElement>();

// Durasi (dalam menit) yang terakhir dipilih user secara eksplisit —
// bukan tier id, karena tier id cuma valid untuk satu studio tertentu.
// Dipakai buat mempertahankan pilihan durasi user saat mereka ganti
// studio: cari tier dengan duration_minutes yang sama di studio baru.
const desiredDuration = ref<number | null>(null);

const studios = computed<Studio[]>(() =>
  (catalogResult.value?.studios ?? []).filter(
    (studio: Studio) => studio.is_active,
  ),
);
const studio = computed(() =>
  studios.value.find((item) => item.id === studioId.value),
);
const bundleOptions = computed<Bundle[]>(() => bundlesResult.value?.sellableBundles ?? []);
const effectiveStudioId = computed(() => selectedBundle.value?.studio.id ?? studioId.value);
const effectiveStudio = computed(() => selectedBundle.value?.studio ?? studio.value);
const tiers = computed(
  () =>
    studio.value?.pricing_tiers
      .filter((tier) => tier.is_active)
      .sort((a, b) => a.duration_minutes - b.duration_minutes) ?? [],
);
const tier = computed(() =>
  tiers.value.find((item) => item.id === tierId.value),
);
const effectiveTier = computed(() => selectedBundle.value?.pricing_tier ?? tier.value);
const addons = computed(
  () => {
    const includedIds = new Set((selectedBundle.value?.addons ?? []).map((item) => item.addon.id));
    return (effectiveStudio.value?.addons ?? []).filter(
      (addon) => addon.is_active && !includedIds.has(addon.id),
    );
  },
);
const filteredAddons = computed(() =>
  addons.value.filter((addon) =>
    addon.name.toLowerCase().includes(addonSearch.value.trim().toLowerCase()),
  ),
);

// Lookup O(1) buat addon terpilih — dipakai bareng oleh isAddonSelected,
// selectedAddonDuration, dan setAddonDuration, gantiin 3 linear-scan
// terpisah ke array yang sama. Item di Map ini merujuk object yang sama
// persis dengan yang ada di selectedAddons.value (bukan clone), jadi
// mutasi item.duration tetap reaktif normal.
const selectedAddonMap = computed(
  () => new Map(selectedAddons.value.map((item) => [item.addon.id, item])),
);

const todayDate = today(getLocalTimeZone());
const calendarValue = computed<DateValue | undefined>({
  get: () => (bookingDate.value ? parseDate(bookingDate.value) : undefined),
  set: (value) => {
    bookingDate.value = value ? value.toString() : "";
  },
});

const availabilityDocument = computed(() =>
  selectedBundle.value && bookingDate.value
    ? BUNDLE_AVAILABILITY_QUERY
    : studioId.value && bookingDate.value && tier.value
      ? AVAILABILITY_QUERY
      : "query { __typename }",
);
const availabilityVariables = computed(() => selectedBundle.value
  ? { bundleId: selectedBundle.value.id, date: bookingDate.value }
  : { studioId: studioId.value, date: bookingDate.value, duration: tier.value?.duration_minutes ?? 0 });
const { data: availabilityResult, isFetching: isLoadingSlots } = useQuery({
  query: availabilityDocument,
  variables: availabilityVariables,
});
const addonAvailabilityDocument = computed(() =>
  effectiveStudioId.value && startTime.value && effectiveTier.value
    ? ADDON_AVAILABILITY_QUERY
    : "query { __typename }",
);
const addonAvailabilityVariables = computed(() => ({
  studioId: effectiveStudioId.value,
  start: startTime.value,
  duration: effectiveTier.value?.duration_minutes ?? 0,
}));
const { data: addonAvailabilityResult } = useQuery({
  query: addonAvailabilityDocument,
  variables: addonAvailabilityVariables,
});

const slots = computed<BookingSlot[]>(() => selectedBundle.value
  ? availabilityResult.value?.bundleAvailability ?? []
  : availabilityResult.value?.bookingAvailability ?? []);
const addonAvailability = computed<Map<string, AddonAvailability>>(
  () =>
    new Map<string, AddonAvailability>(
      (addonAvailabilityResult.value?.bookingAddonAvailability ?? []).map(
        (item: AddonAvailability) => [item.addon_id, item],
      ),
    ),
);

// Harga satuan satu addon terpilih, sesuai durasi yang dipilih user.
// Dipakai di computed `addonsTotal` dan di recap — biar gak ada dua
// tempat yang punya logic "cari harga addon" sendiri-sendiri.
function addonUnitPrice(item: SelectedAddon): number {
  if (item.addon.pricing_type === "flat") return item.addon.flat_price ?? 0;
  return (
    item.addon.prices.find((price) => price.duration_minutes === item.duration)
      ?.price ?? 0
  );
}
const addonsTotal = computed(() =>
  selectedAddons.value.reduce((sum, item) => sum + addonUnitPrice(item), 0),
);
const total = computed(() => (tier.value?.price ?? 0) + addonsTotal.value);
const normalBundleTotal = computed(() => (selectedBundle.value?.bundle_price ?? 0) + addonsTotal.value);
const totalWithBundle = computed(() => selectedBundle.value ? normalBundleTotal.value : total.value);

const selectedSlot = computed(() =>
  slots.value.find((slot) => slot.start_time === startTime.value),
);
const isSelectedSlotAvailable = computed(() =>
  Boolean(
    startTime.value &&
    slots.value.some(
      (slot) => slot.start_time === startTime.value && slot.available,
    ),
  ),
);
const currentPaymentMethod = computed(
  () =>
    PAYMENT_METHODS.find((method) => method.value === paymentMethod.value) ??
    PAYMENT_METHODS[0],
);
const currentStepMeta = computed(
  () => STEP_META[currentStep.value - 1] ?? STEP_META[0],
);

const canProceedStep1 = computed(() =>
  Boolean(
    customerName.value.trim() &&
    customerWa.value.trim() &&
    (selectedBundle.value || (studioId.value && tierId.value)),
  ),
);
const canProceedStep2 = computed(() =>
  Boolean(bookingDate.value && isSelectedSlotAvailable.value),
);

// Ganti studio TIDAK otomatis berarti user mau ganti durasi — jadi kita
// coba pertahankan durasi (desiredDuration) dengan mencari tier yang
// duration_minutes-nya sama persis di studio baru:
// - Ketemu -> tier baru itu dipakai, tanggal & jam booking TETAP
//   dipertahankan (slot availability studio baru otomatis di-refetch
//   lewat availabilityVariables yang reaktif terhadap studioId; kalau
//   jam yang dipilih ternyata bentrok di studio baru, watch(slots) di
//   bawah yang akan membersihkannya).
// - Gak ketemu -> memang gak ada cara mempertahankan durasi ini di
//   studio baru, jadi durasi + tanggal + jam direset supaya user pilih
//   ulang.
// Addon yang sudah dipilih difilter (bukan dihapus semua): addon yang
// masih ada & aktif di studio baru tetap kepilih, yang gak ada di studio
// baru otomatis hilang dari pilihan.
watch(studioId, (newId, oldId) => {
  if (newId === oldId) return;

  if (!newId) {
    tierId.value = "";
    bookingDate.value = "";
    startTime.value = "";
    selectedAddons.value = [];
    desiredDuration.value = null;
    return;
  }

  const matchingTier =
    desiredDuration.value !== null
      ? tiers.value.find((t) => t.duration_minutes === desiredDuration.value)
      : undefined;

  if (matchingTier) {
    tierId.value = matchingTier.id;
  } else {
    tierId.value = "";
    bookingDate.value = "";
    startTime.value = "";
    desiredDuration.value = null;
  }

  selectedAddons.value = selectedAddons.value.filter((item) =>
    addons.value.some((a) => a.id === item.addon.id),
  );
});
watch(bookingDate, () => {
  startTime.value = "";
});
watch(
  slots,
  (nextSlots) => {
    if (!startTime.value) return;

    const selectedSlotStillAvailable = nextSlots.some(
      (slot) => slot.start_time === startTime.value && slot.available,
    );

    if (!selectedSlotStillAvailable) {
      startTime.value = "";
    }
  },
  { deep: true },
);

watch(open, (isOpen) => {
  if (!isOpen) reset();
});

function reset() {
  currentStep.value = 1;
  activeTab.value = "studio";
  studioId.value = "";
  tierId.value = "";
  customerName.value = "";
  customerWa.value = "";
  bookingDate.value = "";
  startTime.value = "";
  paymentMethod.value = "cash";
  selectedAddons.value = [];
  selectedBundle.value = null;
  addonSearch.value = "";
  desiredDuration.value = null;
}

function requestClose(nextOpen: boolean) {
  if (!isSaving.value) open.value = nextOpen;
}

function goToStep(step: 1 | 2 | 3) {
  currentStep.value = step;
}

function togglePaymentMethod() {
  paymentMethod.value = paymentMethod.value === "cash" ? "gateway" : "cash";
}

function selectSlot(slot: BookingSlot) {
  if (!slot.available) return;
  startTime.value = slot.start_time;
}

function selectStudio(item: Studio) {
  selectedBundle.value = null;
  studioId.value = item.id;
}

function selectBundle(bundle: Bundle) {
  if (selectedBundle.value?.id === bundle.id) return;
  selectedBundle.value = bundle;
  studioId.value = "";
  tierId.value = "";
  bookingDate.value = "";
  startTime.value = "";
  selectedAddons.value = [];
  desiredDuration.value = null;
}

// Satu-satunya tempat user MEMILIH durasi secara eksplisit (klik tombol
// durasi di step 1). Ini beda dari studioId watcher di atas, yang
// menyetel tierId secara programatik demi mempertahankan durasi —
// makanya reset tanggal/jam/addon di sini, bukan digeneralisir lewat
// watch(tierId, ...), supaya reset cuma terjadi kalau user memang niat
// ganti durasi.
function selectTier(item: Tier) {
  const isRealChange = tierId.value !== item.id;
  tierId.value = item.id;
  desiredDuration.value = item.duration_minutes;
  if (isRealChange) {
    bookingDate.value = "";
    startTime.value = "";
    selectedAddons.value = [];
  }
}

function formatCurrency(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("id-ID");
}
function formatTime(datetime: string): string {
  // Backend selalu kirim wall-clock time Asia/Jakarta tanpa offset
  // (mis. "2026-09-19 10:00:00" atau "...T10:00:00"), jadi ambil
  // digit HH:mm-nya langsung tanpa parsing timezone. Kalau string-nya
  // punya penanda zona (Z / +07:00), baru itu genuinely UTC dan perlu
  // dikonversi lewat Date + timeZone Asia/Jakarta.
  const hasTimezone = /[Zz]|[+-]\d{2}:\d{2}$/.test(datetime);
  if (!hasTimezone) return datetime.match(/\d{2}:\d{2}/)?.[0] ?? "-";
  return new Date(datetime).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return "-";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

function toggleAddon(addon: Addon) {
  const index = selectedAddons.value.findIndex(
    (item) => item.addon.id === addon.id,
  );
  if (index >= 0) {
    selectedAddons.value.splice(index, 1);
    return;
  }
  selectedAddons.value.push({
    addon,
    duration:
      addon.pricing_type === "flat"
        ? (tier.value?.duration_minutes ?? 0)
        : (addon.prices
            .filter(
              (price) =>
                price.is_active &&
                price.duration_minutes <= (tier.value?.duration_minutes ?? 0),
            )
            .sort((a, b) => a.duration_minutes - b.duration_minutes)[0]
            ?.duration_minutes ?? 0),
  });
}
// Ketiga fungsi ini baca dari selectedAddonMap (O(1)) alih-alih masing-
// masing melakukan .find()/.some() linear-scan sendiri ke array
// selectedAddons yang sama.
function isAddonSelected(addon: Addon) {
  return selectedAddonMap.value.has(addon.id);
}
function selectedAddonDuration(addon: Addon) {
  return selectedAddonMap.value.get(addon.id)?.duration;
}
function setAddonDuration(addon: Addon, duration: number) {
  const item = selectedAddonMap.value.get(addon.id);
  if (item) item.duration = duration;
}
function availableAddon(addon: Addon): AddonAvailability | undefined {
  return addonAvailability.value.get(addon.id);
}
function nextAvailableLabel(addon: Addon): string {
  const next = availableAddon(addon)?.next_available_at;
  return next ? ` Tersedia ${formatTime(next)}` : "";
}
function addonPriceOptions(addon: Addon) {
  return addon.prices
    .filter(
      (price) =>
        price.is_active &&
        price.duration_minutes <= (tier.value?.duration_minutes ?? 0),
    )
    .sort((a, b) => a.duration_minutes - b.duration_minutes);
}
function addonDisplayPrice(addon: Addon) {
  if (addon.pricing_type === "flat") return formatCurrency(addon.flat_price);
  const options = addonPriceOptions(addon);
  if (!options.length) return "Tidak tersedia untuk durasi ini";
  return `Mulai ${formatCurrency(options.at(0)?.price)}`;
}
function addonDurationLabel(addon: Addon): string {
  if (addon.pricing_type === "flat") return "1x booking";
  const options = addonPriceOptions(addon);
  if (!options.length) return "-";
  const durations = options.map((option) => option.duration_minutes);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  return min === max
    ? formatDuration(min)
    : `${formatDuration(min)} – ${formatDuration(max)}`;
}

async function submit() {
  if (
    !form.value?.reportValidity() ||
    (!selectedBundle.value && !tier.value) ||
    !startTime.value ||
    !isSelectedSlotAvailable.value ||
    isSaving.value
  ) {
    appToast.error("Jam booking tidak valid", {
      description: "Silakan pilih jam yang tersedia untuk studio ini.",
    });
    startTime.value = "";
    return;
  }

  const toastId = appToast.loading("Menyimpan booking...", {
    description: "Memeriksa slot studio dan resource.",
  });
  try {
    const result = await createBooking({
      studioId: studioId.value,
      tierId: tier.value?.id ?? null,
      bundleId: selectedBundle.value?.id ?? null,
      name: customerName.value.trim(),
      wa: customerWa.value.trim(),
      start: startTime.value,
      payment: paymentMethod.value,
      addons: selectedAddons.value.map((item) => ({
        addon_id: item.addon.id,
        duration_minutes:
          item.addon.pricing_type === "flat" ? null : item.duration,
      })),
    });
    if (result.error || !result.data?.createManualBooking?.id)
      throw new Error(result.error?.message ?? "Booking gagal disimpan.");
    const paymentUrl = result.data.createManualBooking.payment_url;
    appToast.success("Booking berhasil dibuat", {
      id: toastId,
      description: result.data.createManualBooking.code,
    });

    emit("created");
    if (paymentMethod.value === "gateway" && paymentUrl) {
      const { rememberCurrentPage } = usePaymentReturn();
      rememberCurrentPage();
      window.location.assign(paymentUrl);
      return;
    }
    open.value = false;
    reset();
  } catch (error) {
    await loadBundles();
    appToast.error("Booking gagal dibuat", {
      id: toastId,
      description:
        error instanceof Error ? error.message : "Periksa slot lalu coba lagi.",
    });
  }
}
</script>

<template>
  <TooltipProvider>
    <Dialog :open="open" @update:open="requestClose">
      <DialogContent
        class="grid h-[92dvh] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-[92vw]"
      >
        <DialogHeader class="shrink-0 gap-3 border-b px-4 py-4 sm:px-6">
          <div class="flex items-center gap-1.5">
            <span
              v-for="step in 3"
              :key="step"
              class="h-1.5 flex-1 rounded-full transition-colors"
              :class="step <= currentStep ? 'bg-primary' : 'bg-muted'"
            />
          </div>
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <IconCalendarEvent class="size-4.5" />
              </span>
              <div>
                <p class="text-xs font-medium text-muted-foreground">
                  Step {{ currentStep }} dari 3
                </p>
                <DialogTitle
                  class="text-base font-semibold tracking-tight sm:text-lg"
                >
                  {{ currentStepMeta.title }}
                </DialogTitle>
                <DialogDescription class="text-sm">
                  {{ currentStepMeta.description }}
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="isSaving"
              aria-label="Tutup"
              @click="requestClose(false)"
            >
              <IconX class="size-4" />
            </button>
          </div>
        </DialogHeader>

        <form
          ref="form"
          class="min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6"
          @submit.prevent="submit"
        >
          <div class="grid h-full grid-cols-1 gap-6 sm:grid-cols-[1.5fr_1fr]">
            <div class="h-full">
              <Tabs v-model="activeTab" class="w-full gap-4">
                <TabsList class="grid w-full grid-cols-3">
                  <TabsTrigger value="studio">Studio</TabsTrigger>
                  <TabsTrigger value="promo">Bundle Promo</TabsTrigger>
                  <TabsTrigger value="addon">
                    Add On
                    <span
                      v-if="selectedAddons.length"
                      class="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary"
                    >
                      {{ selectedAddons.length }}
                    </span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="studio" class="space-y-5">
                  <div class="grid gap-3">
                    <Label
                      >Pilih studio
                      <span class="text-destructive">*</span></Label
                    >
                    <div v-if="isLoadingCatalog" class="space-y-2">
                      <div class="h-11 animate-pulse rounded-lg bg-muted" />
                      <div class="h-11 animate-pulse rounded-lg bg-muted" />
                    </div>
                    <div
                      v-else-if="!studios.length"
                      class="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground"
                    >
                      Belum ada studio aktif.
                    </div>
                    <div v-else class="grid grid-cols-2 gap-3">
                      <button
                        v-for="item in studios"
                        :key="item.id"
                        type="button"
                        class="overflow-hidden rounded-xl border text-left transition-all"
                        :class="
                          studioId === item.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary'
                            : 'border-input hover:border-primary/50 hover:bg-muted/30'
                        "
                        @click="selectStudio(item)"
                      >
                        <span class="flex items-center gap-2 p-3">
                          <img
                            v-if="item.thumbnail_url"
                            :src="item.thumbnail_url"
                            :alt="`Thumbnail ${item.name}`"
                            class="size-12 shrink-0 rounded-md object-cover"
                          />
                          <span
                            v-else
                            class="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                          >
                            <IconPhoto class="size-5" />
                          </span>
                          <span class="min-w-0">
                            <span class="block truncate text-sm font-semibold">
                              {{ item.name }}
                            </span>
                            <span class="block text-xs text-muted-foreground">
                              Kode: {{ item.code }}
                            </span>
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="promo">
                  <div v-if="isLoadingBundles" class="py-8 text-center text-sm text-muted-foreground">Memuat bundle…</div>
                  <div v-else-if="!bundleOptions.length" class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada bundle yang bisa dijual saat ini.</div>
                  <div v-else class="grid gap-3 sm:grid-cols-2">
                    <BundleCard
                      v-for="bundle in bundleOptions"
                      :key="bundle.id"
                      :bundle="bundle"
                      :selected="selectedBundle?.id === bundle.id"
                      @select="selectBundle"
                    />
                  </div>
                </TabsContent>

                <!-- TAB: Add On -->
                <TabsContent value="addon" class="space-y-3">
                  <div
                    v-if="!effectiveStudioId"
                    class="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                  >
                    <IconAlertCircle class="size-4 shrink-0" />
                    Pilih Studio atau bundle dulu untuk melihat add-on tambahan.
                  </div>
                  <div
                    v-else-if="!addons.length"
                    class="text-sm text-muted-foreground"
                  >
                    Studio ini belum punya jasa tambahan.
                  </div>
                  <template v-else>
                    <div v-if="addons.length > 5" class="relative">
                      <IconSearch
                        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      />
                      <Input
                        v-model="addonSearch"
                        placeholder="Cari jasa tambahan..."
                        class="pl-9"
                      />
                    </div>
                    <p
                      v-if="addonSearch && !filteredAddons.length"
                      class="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground"
                    >
                      Tidak ada jasa tambahan yang cocok dengan "{{
                        addonSearch
                      }}".
                    </p>
                    <div v-else class="grid grid-cols-2 gap-2">
                      <div
                        v-for="addon in filteredAddons"
                        :key="addon.id"
                        class="flex flex-col gap-2"
                      >
                        <button
                          type="button"
                          class="flex h-full flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          :disabled="
                            availableAddon(addon)?.available === false ||
                            !addon.resources.length
                          "
                          :class="
                            isAddonSelected(addon)
                              ? 'border-primary bg-primary/5'
                              : 'border-input hover:bg-muted/50'
                          "
                          @click="toggleAddon(addon)"
                        >
                          <span
                            class="flex w-full items-start justify-between gap-1"
                          >
                            <span class="font-medium">{{ addon.name }}</span>
                            <IconCheck
                              v-if="isAddonSelected(addon)"
                              class="mt-0.5 size-4 shrink-0 text-primary"
                            />
                          </span>
                          <span
                            class="flex items-center gap-1 text-xs text-muted-foreground"
                          >
                            <IconClock class="size-3.5" />
                            {{ addonDurationLabel(addon) }}
                          </span>
                          <span class="mt-auto pt-1 text-xs font-semibold">
                            {{ addonDisplayPrice(addon) }}
                          </span>
                          <span
                            v-if="availableAddon(addon)?.available === false"
                            class="text-xs text-destructive"
                          >
                            {{ availableAddon(addon)?.reason
                            }}{{ nextAvailableLabel(addon) }}
                          </span>
                        </button>

                        <div
                          v-if="
                            isAddonSelected(addon) &&
                            addon.pricing_type !== 'flat'
                          "
                          class="flex flex-wrap gap-1.5"
                        >
                          <button
                            v-for="price in addonPriceOptions(addon)"
                            :key="price.duration_minutes"
                            type="button"
                            class="rounded-md border px-2 py-1 text-xs transition-colors"
                            :class="
                              selectedAddonDuration(addon) ===
                              price.duration_minutes
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input hover:bg-muted/50'
                            "
                            @click="
                              setAddonDuration(addon, price.duration_minutes)
                            "
                          >
                            {{ formatDuration(price.duration_minutes) }} ·
                            {{ formatCurrency(price.price) }}
                          </button>
                        </div>
                      </div>
                    </div>
                  </template>
                </TabsContent>
              </Tabs>

              <div
                v-if="selectedAddons.length && currentStep < 3"
                class="mt-4 space-y-1.5 border-t pt-4"
              >
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Add on dipilih
                </p>
                <ul class="space-y-1 text-xs text-muted-foreground">
                  <li v-for="item in selectedAddons" :key="item.addon.id">
                    {{ item.addon.name }}
                  </li>
                </ul>
              </div>
            </div>

            <div class="h-full space-y-6 md:border-l md:pl-6">
              <template v-if="currentStep === 1">
                <div class="space-y-3">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Customer
                  </p>
                  <div class="grid gap-2">
                    <Label for="booking-name" class="sr-only"
                      >Nama customer</Label
                    >
                    <Input
                      id="booking-name"
                      v-model="customerName"
                      required
                      placeholder="Nama lengkap *"
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label for="booking-wa" class="sr-only"
                      >Nomor WhatsApp</Label
                    >
                    <Input
                      id="booking-wa"
                      v-model="customerWa"
                      required
                      inputmode="tel"
                      placeholder="Nomor WhatsApp *"
                    />
                  </div>
                </div>
                <div
                  v-if="selectedBundle"
                  class="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-4"
                >
                  <p class="text-sm font-semibold">{{ selectedBundle.name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ selectedBundle.studio.name }} ·
                    {{ formatDuration(selectedBundle.pricing_tier.duration_minutes) }}
                  </p>
                  <p class="text-sm font-semibold">
                    Rp {{ formatCurrency(selectedBundle.bundle_price) }}
                  </p>
                </div>
                <div v-else class="grid gap-3">
                  <Label
                    >Durasi sewa <span class="text-destructive">*</span></Label
                  >
                  <div
                    v-if="!studioId"
                    class="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                  >
                    <IconClock class="size-4 shrink-0" />
                    Pilih studio dulu untuk melihat durasi yang tersedia.
                  </div>
                  <div
                    v-else-if="!tiers.length"
                    class="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                  >
                    <IconAlertCircle class="size-4 shrink-0" />
                    Studio ini belum punya durasi sewa yang aktif.
                  </div>
                  <div v-else class="grid grid-cols-2 gap-2">
                    <button
                      v-for="item in tiers"
                      :key="item.id"
                      type="button"
                      class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
                      :class="
                        tierId === item.id
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-muted/50'
                      "
                      @click="selectTier(item)"
                    >
                      <span class="block font-medium">
                        {{ formatDuration(item.duration_minutes) }}
                      </span>
                      <span
                        class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        <IconClock class="size-3.5" />
                        {{ formatCurrency(item.price) }}
                      </span>
                    </button>
                  </div>
                </div>
              </template>

              <template v-else-if="currentStep === 2">
                <div class="grid gap-2">
                  <Label
                    >Tanggal booking
                    <span class="text-destructive">*</span></Label
                  >
                  <div class="flex justify-center">
                    <Calendar
                      v-model="calendarValue"
                      :min-value="todayDate"
                      class="w-full rounded-md border p-2"
                    />
                  </div>
                </div>

                <div class="grid gap-2">
                  <Label
                    >Jam mulai <span class="text-destructive">*</span></Label
                  >
                  <div
                    v-if="isLoadingSlots"
                    class="text-sm text-muted-foreground"
                  >
                    Memuat slot…
                  </div>
                  <div
                    v-else-if="!slots.length"
                    class="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                  >
                    Tidak ada slot tersedia untuk tanggal ini.
                  </div>

                  <div v-else class="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    <button
                      v-for="slot in slots"
                      :key="slot.start_time"
                      type="button"
                      :disabled="!slot.available"
                      class="rounded-md border px-2 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      :class="
                        startTime === slot.start_time && slot.available
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : slot.available
                            ? 'border-input bg-background text-foreground hover:border-primary/60 hover:bg-muted/50'
                            : 'border-input bg-muted text-muted-foreground line-through'
                      "
                      @click="selectSlot(slot)"
                    >
                      {{ formatTime(slot.start_time) }}
                    </button>
                  </div>
                </div>
              </template>

              <template v-else>
                <div class="space-y-1.5">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Ringkasan booking
                  </p>
                  <div class="divide-y rounded-lg border text-sm">
                    <div class="flex items-center justify-between gap-3 p-3">
                      <span class="text-muted-foreground">Studio</span>
                      <span class="font-medium">{{ effectiveStudio?.name ?? "-" }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3 p-3">
                      <span class="text-muted-foreground">Customer</span>
                      <span class="text-right font-medium">
                        {{ customerName || "-" }}
                        <span class="block text-xs text-muted-foreground">
                          {{ customerWa }}
                        </span>
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3 p-3">
                      <span class="text-muted-foreground">Tanggal</span>
                      <span class="font-medium">{{ bookingDate || "-" }}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3 p-3">
                      <span class="text-muted-foreground">Jam</span>
                      <span class="font-medium">
                        <template v-if="startTime && selectedSlot">
                          {{ formatTime(startTime) }} –
                          {{ formatTime(selectedSlot.end_time) }}
                        </template>
                        <template v-else>-</template>
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3 p-3">
                      <span class="text-muted-foreground">Durasi</span>
                      <span class="font-medium">
                        {{ formatDuration(effectiveTier?.duration_minutes) }}
                      </span>
                    </div>
                  </div>
                </div>

                <div v-if="selectedBundle" class="space-y-1.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Isi bundle</p>
                  <ul class="divide-y rounded-lg border text-sm">
                    <li v-for="item in selectedBundle.addons" :key="item.id" class="flex items-center justify-between gap-3 p-3">
                      <span>{{ item.addon.name }}<span v-if="item.duration_minutes" class="text-muted-foreground"> · {{ formatDuration(item.duration_minutes) }}</span></span>
                      <span class="text-xs text-muted-foreground">Termasuk</span>
                    </li>
                  </ul>
                </div>

                <div v-if="selectedAddons.length" class="space-y-1.5">
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {{ selectedBundle ? "Add-on ekstra" : "Add-on" }}
                  </p>
                  <ul class="divide-y rounded-lg border text-sm">
                    <li
                      v-for="item in selectedAddons"
                      :key="item.addon.id"
                      class="flex items-center justify-between gap-3 p-3"
                    >
                      <span>
                        {{ item.addon.name }}
                        <span
                          v-if="item.addon.pricing_type !== 'flat'"
                          class="text-muted-foreground"
                        >
                          · {{ formatDuration(item.duration) }}
                        </span>
                      </span>
                      <span class="font-medium">
                        {{ formatCurrency(addonUnitPrice(item)) }}
                      </span>
                    </li>
                  </ul>
                </div>

                <button
                  v-if="!selectedBundle"
                  type="button"
                  disabled
                  class="flex w-full items-center justify-between rounded-lg border border-dashed p-3 text-sm text-muted-foreground disabled:cursor-not-allowed"
                >
                  <span class="flex items-center gap-2">
                    <IconTicket class="size-4" />
                    Pakai kode voucher
                  </span>
                  <span class="text-xs">Segera hadir</span>
                </button>

                <div class="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div
                    class="flex items-center justify-between text-muted-foreground"
                  >
                    <span>{{ selectedBundle ? "Harga normal paket" : "Harga studio" }}</span>
                    <span>{{ formatCurrency(selectedBundle ? selectedBundle.normal_price : tier?.price) }}</span>
                  </div>
                  <div v-if="selectedBundle" class="mt-1 flex items-center justify-between font-medium text-emerald-700">
                    <span>Hemat bundle</span>
                    <span>−{{ formatCurrency(selectedBundle.discount_amount) }}</span>
                  </div>
                  <div
                    v-if="selectedAddons.length"
                    class="mt-1 flex items-center justify-between text-muted-foreground"
                  >
                    <span>Add on</span>
                    <span>{{ formatCurrency(addonsTotal) }}</span>
                  </div>
                  <div
                    class="mt-2 flex items-center justify-between border-t pt-2 font-semibold"
                  >
                    <span>Total</span>
                    <span>{{ formatCurrency(totalWithBundle) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </form>

        <DialogFooter
          class="shrink-0 flex-row items-center gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <Button
            type="button"
            variant="outline"
            class="flex-1"
            :disabled="isSaving"
            @click="
              currentStep === 1
                ? requestClose(false)
                : goToStep((currentStep - 1) as 1 | 2)
            "
          >
            {{ currentStep === 1 ? "Batal" : "Kembali" }}
          </Button>

          <Button
            v-if="currentStep < 3"
            type="button"
            class="flex-1"
            :disabled="currentStep === 1 ? !canProceedStep1 : !canProceedStep2"
            @click="goToStep((currentStep + 1) as 2 | 3)"
          >
            Selanjutnya
          </Button>

          <template v-else>
            <Button
              type="button"
              class="flex-1"
              :disabled="isSaving || !startTime"
              @click="submit"
            >
              <IconLoader2 v-if="isSaving" class="size-4 animate-spin" />
              <IconCheck v-else class="size-4" />
              {{ isSaving ? "Menyimpan..." : "Konfirmasi booking" }}
            </Button>
            <Tooltip>
              <TooltipTrigger as-child>
                <button
                  type="button"
                  class="flex shrink-0 items-center gap-0.5 rounded-md border px-2.5 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  :aria-label="`Metode pembayaran: ${currentPaymentMethod.label}. Klik untuk ganti.`"
                  @click="togglePaymentMethod"
                >
                  <component :is="currentPaymentMethod.icon" class="size-4" />
                  <IconChevronDown class="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {{ currentPaymentMethod.label }} · klik untuk ganti
              </TooltipContent>
            </Tooltip>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
