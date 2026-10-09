<!-- components/bookings/EditBookingDialog.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
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

const props = defineProps<{ bookingId: string | null }>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "updated"): void }>();

const CATALOG_QUERY = `query { studios { id name code thumbnail_url is_active pricing_tiers { id duration_minutes price is_active } addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } }`;
const BUNDLES_QUERY = `query { sellableBundles { id code name description studio { id name is_active addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } pricing_tier { id duration_minutes price is_active } addons { id duration_minutes addon { id name } } bundle_price normal_price discount_amount valid_from valid_until quota_limit quota_period quota_remaining } }`;
const BOOKING_QUERY = `query { bookings { id code customer_name customer_wa start_time end_time duration_minutes payment_method payment_status status studio_price_at_booking bundle_name_at_booking bundle_price_at_booking discount_total studio { id name code thumbnail_url is_active pricing_tiers { id duration_minutes price is_active } addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } pricing_tier { id duration_minutes price is_active } bundle { id code name description studio { id name is_active addons { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } pricing_tier { id duration_minutes price is_active } addons { id duration_minutes addon { id name } } bundle_price normal_price discount_amount valid_from valid_until quota_limit quota_period quota_remaining } addons { id duration_minutes price_at_booking is_bundle_item addon { id name pricing_type flat_price is_active prices { duration_minutes price is_active } resources { id is_active } } } } }`;
const AVAILABILITY_QUERY = `query ($studioId: ID!, $date: String!, $duration: Int!) { bookingAvailability(studio_id: $studioId, date: $date, duration_minutes: $duration) { start_time end_time available } }`;
const BUNDLE_AVAILABILITY_QUERY = `query ($bundleId: ID!, $date: String!, $bookingId: ID) { bundleAvailability(bundle_id: $bundleId, date: $date, exclude_booking_id: $bookingId) { start_time end_time available reason } }`;
const ADDON_AVAILABILITY_QUERY = `query ($studioId: ID!, $start: String!, $duration: Int!) { bookingAddonAvailability(studio_id: $studioId, start_time: $start, duration_minutes: $duration) { addon_id available resource_name next_available_at reason } }`;
const UPDATE_BOOKING = `mutation ($id: ID!, $studioId: ID, $tierId: ID, $bundleId: ID, $name: String!, $wa: String!, $start: String!, $addons: [BookingAddonInput!]) { updateManualBooking(id: $id, studio_id: $studioId, pricing_tier_id: $tierId, bundle_id: $bundleId, customer_name: $name, customer_wa: $wa, start_time: $start, addons: $addons) { id code payment_url } }`;

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
  studio: { id: string; name: string; is_active: boolean; addons: Addon[] };
  pricing_tier: Tier;
  addons: {
    id: string;
    duration_minutes: number | null;
    addon: { id: string; name: string };
  }[];
  bundle_price: number;
  normal_price: number;
  discount_amount: number;
  valid_from: string | null;
  valid_until: string | null;
  quota_limit: number | null;
  quota_remaining: number | null;
};
type BookingRecord = {
  id: string;
  bundle?: Bundle | null;
  bundle_name_at_booking?: string | null;
  bundle_price_at_booking?: number | null;
  discount_total?: number | null;
  studio_price_at_booking?: number | null;
  addons: Array<{
    id: string;
    duration_minutes: number | null;
    price_at_booking: number;
    is_bundle_item: boolean;
    addon: {
      id: string;
      name: string;
      pricing_type: "flat" | "per_tier";
      flat_price: number | null;
      is_active: boolean;
      prices: Addon["prices"];
      resources: Addon["resources"];
    };
  }>;
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
    description: "Ubah studio, data customer, atau durasi sewa.",
  },
  {
    title: "Tanggal & jam",
    description: "Ubah tanggal dan jam mulai booking.",
  },
  {
    title: "Konfirmasi perubahan",
    description: "Periksa ringkasan sebelum menyimpan perubahan.",
  },
] as const;

const { data: catalogResult, isFetching: isLoadingCatalog } = useQuery({
  query: CATALOG_QUERY,
});
const {
  data: bundlesResult,
  isFetching: isLoadingBundles,
  execute: loadBundles,
} = useQuery({ query: BUNDLES_QUERY });

// Query booking hanya jalan kalau drawer terbuka dan ada bookingId —
// menghindari fetch percuma tiap kali komponen ini ke-mount di parent.
const bookingDocument = computed(() =>
  open.value && props.bookingId ? BOOKING_QUERY : "query { __typename }",
);
const {
  data: bookingResult,
  isFetching: isLoadingBooking,
  execute: refetchBooking,
} = useQuery({ query: bookingDocument });

const { execute: updateBooking, isFetching: isSaving } =
  useMutation(UPDATE_BOOKING);

const currentStep = ref(1);
const activeTab = ref("studio");
const studioId = ref("");
const tierId = ref("");
const customerName = ref("");
const customerWa = ref("");
const bookingDate = ref("");
const startTime = ref("");
const originalStartTime = ref("");
const paymentMethod = ref<"cash" | "gateway">("cash");
const selectedAddons = ref<SelectedAddon[]>([]);
const selectedBundle = ref<Bundle | null>(null);
const addonSearch = ref("");
const form = ref<HTMLFormElement>();

// Sama seperti di CreateBookingDialog: dipakai buat mempertahankan
// pilihan durasi user saat ganti studio.
const desiredDuration = ref<number | null>(null);

// Ketika true, watcher studioId/bookingDate/slots yang biasanya
// nge-reset field TIDAK dijalankan — dipakai selama proses prefill
// data booking existing, supaya prefill nggak langsung ke-reset
// sama watcher yang sama yang dipakai di mode create.
const isHydrating = ref(false);

const studios = computed<Studio[]>(() =>
  (catalogResult.value?.studios ?? []).filter(
    (studio: Studio) => studio.is_active,
  ),
);
const studio = computed(() =>
  studios.value.find((item) => item.id === studioId.value),
);
const bundleOptions = computed<Bundle[]>(
  () => bundlesResult.value?.sellableBundles ?? [],
);
const effectiveStudioId = computed(
  () => selectedBundle.value?.studio.id ?? studioId.value,
);
const effectiveStudio = computed(
  () => selectedBundle.value?.studio ?? studio.value,
);
const tiers = computed(
  () =>
    studio.value?.pricing_tiers
      .filter((tier) => tier.is_active)
      .sort((a, b) => a.duration_minutes - b.duration_minutes) ?? [],
);
const tier = computed(() =>
  tiers.value.find((item) => item.id === tierId.value),
);
const effectiveTier = computed(
  () => selectedBundle.value?.pricing_tier ?? tier.value,
);
const addons = computed(() => {
  const includedIds = new Set(
    (selectedBundle.value?.addons ?? []).map((item) => item.addon.id),
  );
  return (effectiveStudio.value?.addons ?? []).filter(
    (addon) => addon.is_active && !includedIds.has(addon.id),
  );
});
const filteredAddons = computed(() =>
  addons.value.filter((addon) =>
    addon.name.toLowerCase().includes(addonSearch.value.trim().toLowerCase()),
  ),
);

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
const availabilityVariables = computed(() => ({
  ...(selectedBundle.value
    ? { bundleId: selectedBundle.value.id, bookingId: props.bookingId }
    : {
        studioId: studioId.value,
        duration: tier.value?.duration_minutes ?? 0,
      }),
  date: bookingDate.value,
}));
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

const slots = computed<BookingSlot[]>(() =>
  selectedBundle.value
    ? (availabilityResult.value?.bundleAvailability ?? [])
    : (availabilityResult.value?.bookingAvailability ?? []),
);
const addonAvailability = computed<Map<string, AddonAvailability>>(
  () =>
    new Map<string, AddonAvailability>(
      (addonAvailabilityResult.value?.bookingAddonAvailability ?? []).map(
        (item: AddonAvailability) => [item.addon_id, item],
      ),
    ),
);

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
const totalWithBundle = computed(
  () => (selectedBundle.value?.bundle_price ?? 0) + addonsTotal.value,
);

const selectedSlot = computed(() => {
  const slot = slots.value.find((item) => item.start_time === startTime.value);
  if (slot) return slot;
  if (startTime.value && startTime.value === originalStartTime.value) {
    return {
      start_time: startTime.value,
      end_time: startTime.value,
      available: true,
    } as BookingSlot;
  }
  return undefined;
});
const isSelectedSlotAvailable = computed(() => {
  if (!startTime.value) return false;
  if (startTime.value === originalStartTime.value) return true;
  return slots.value.some(
    (slot) => slot.start_time === startTime.value && slot.available,
  );
});
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

watch(studioId, (newId, oldId) => {
  if (isHydrating.value || newId === oldId) return;

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
  if (isHydrating.value) return;
  startTime.value = "";
});
watch(
  slots,
  (nextSlots) => {
    if (isHydrating.value || !startTime.value) return;

    if (startTime.value === originalStartTime.value) return;

    const selectedSlotStillAvailable = nextSlots.some(
      (slot) => slot.start_time === startTime.value && slot.available,
    );

    if (!selectedSlotStillAvailable) {
      startTime.value = "";
    }
  },
  { deep: true },
);

// Prefill form begitu data booking & katalog studio sudah sama-sama
// siap. Dijalankan tiap drawer dibuka dengan bookingId baru.
watch(
  () => [open.value, props.bookingId, bookingResult.value, catalogResult.value],
  async () => {
    if (!open.value || !props.bookingId) return;
    const booking = (bookingResult.value?.bookings ?? []).find(
      (item: { id: string }) => item.id === props.bookingId,
    );
    if (!booking || !catalogResult.value?.studios) return;

    isHydrating.value = true;

    customerName.value = booking.customer_name ?? "";
    customerWa.value = booking.customer_wa ?? "";
    studioId.value = booking.bundle ? "" : (booking.studio?.id ?? "");
    bookingDate.value =
      booking.start_time?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
    originalStartTime.value = booking.start_time ?? "";
    startTime.value = booking.start_time ?? "";
    paymentMethod.value =
      booking.payment_method === "gateway" ? "gateway" : "cash";

    const bundledItems = (booking.addons ?? []).filter(
      (entry: { is_bundle_item?: boolean }) => entry.is_bundle_item,
    );
    selectedBundle.value = booking.bundle
      ? {
          ...booking.bundle,
          name: booking.bundle_name_at_booking ?? booking.bundle.name,
          bundle_price: Number(
            booking.bundle_price_at_booking ?? booking.bundle.bundle_price,
          ),
          normal_price:
            Number(booking.studio_price_at_booking ?? 0) +
            bundledItems.reduce(
              (sum: number, item: { price_at_booking: number }) =>
                sum + Number(item.price_at_booking),
              0,
            ),
          discount_amount: Number(booking.discount_total ?? 0),
        }
      : null;

    // Ambil state asli yang sudah dipilih saat booking dibuat agar user
    // langsung melihat value sebelumnya di form. Prioritaskan data booking
    // yang ter-embed di query, lalu fallback ke katalog agar semua field
    // harga/durasi/resource tetap lengkap.
    const bookingStudio = booking.bundle?.studio ?? booking.studio;
    const bookingTier = booking.bundle?.pricing_tier ?? booking.pricing_tier;
    const matchedStudio =
      bookingStudio && bookingStudio.id
        ? (studios.value.find((item) => item.id === bookingStudio.id) ?? {
            ...bookingStudio,
            is_active: true,
            pricing_tiers: bookingStudio.pricing_tiers ?? [],
            addons: bookingStudio.addons ?? [],
          })
        : (studios.value.find((item) => item.id === bookingStudio?.id) ?? null);

    const matchedTier =
      (matchedStudio?.pricing_tiers ?? []).find(
        (item: { id: string }) => item.id === bookingTier?.id,
      ) ??
      (bookingTier
        ? {
            id: bookingTier.id,
            duration_minutes: bookingTier.duration_minutes,
            price: bookingTier.price ?? 0,
            is_active: bookingTier.is_active ?? true,
          }
        : null);

    tierId.value = booking.bundle ? "" : (matchedTier?.id ?? "");
    desiredDuration.value = matchedTier?.duration_minutes ?? null;

    selectedAddons.value = (booking.addons ?? []).flatMap((entry: any) => {
      if (entry.is_bundle_item) return [];
      const addonRef = entry.addon ?? entry.addon_data;
      const fullAddon =
        matchedStudio?.addons.find(
          (a: { id: string }) => a.id === addonRef?.id,
        ) ??
        (addonRef
          ? {
              id: addonRef.id,
              name: addonRef.name,
              pricing_type: addonRef.pricing_type ?? "flat",
              flat_price: addonRef.flat_price ?? null,
              is_active: addonRef.is_active ?? true,
              prices: addonRef.prices ?? [],
              resources: addonRef.resources ?? [],
            }
          : null);

      return fullAddon
        ? [
            {
              addon: fullAddon,
              duration:
                entry.duration_minutes ?? matchedTier?.duration_minutes ?? 0,
            },
          ]
        : [];
    });

    currentStep.value = 1;
    activeTab.value = booking.bundle ? "promo" : "studio";

    await nextTick();
    isHydrating.value = false;
  },
  { immediate: true },
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
  originalStartTime.value = "";
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
  originalStartTime.value = "";
  selectedAddons.value = [];
  desiredDuration.value = null;
}

function selectTier(item: Tier) {
  const isRealChange = tierId.value !== item.id;
  tierId.value = item.id;
  desiredDuration.value = item.duration_minutes;
  if (isRealChange && !isHydrating.value) {
    bookingDate.value = "";
    startTime.value = "";
    selectedAddons.value = [];
  }
}

function formatCurrency(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("id-ID");
}
function formatTime(datetime: string): string {
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
        ? (effectiveTier.value?.duration_minutes ?? 0)
        : (addon.prices
            .filter(
              (price) =>
                price.is_active &&
                price.duration_minutes <=
                  (effectiveTier.value?.duration_minutes ?? 0),
            )
            .sort((a, b) => a.duration_minutes - b.duration_minutes)[0]
            ?.duration_minutes ?? 0),
  });
}
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
        price.duration_minutes <= (effectiveTier.value?.duration_minutes ?? 0),
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
    !props.bookingId ||
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

  const toastId = appToast.loading("Menyimpan perubahan...", {
    description: "Memeriksa slot studio dan resource.",
  });
  try {
    const result = await updateBooking({
      id: props.bookingId,
      studioId: selectedBundle.value ? null : studioId.value,
      tierId: selectedBundle.value ? null : (tier.value?.id ?? null),
      bundleId: selectedBundle.value?.id ?? null,
      name: customerName.value.trim(),
      wa: customerWa.value.trim(),
      start: startTime.value,
      addons: selectedAddons.value.map((item) => ({
        addon_id: item.addon.id,
        duration_minutes:
          item.addon.pricing_type === "flat" ? null : item.duration,
      })),
    });
    if (result.error || !result.data?.updateManualBooking?.id)
      throw new Error(result.error?.message ?? "Booking gagal diperbarui.");

    appToast.success("Booking berhasil diperbarui", {
      id: toastId,
      description: result.data.updateManualBooking.code,
    });

    emit("updated");
    open.value = false;
    reset();
  } catch (error) {
    await loadBundles();
    appToast.error("Booking gagal diperbarui", {
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

        <div
          v-if="isLoadingBooking || isLoadingCatalog"
          class="min-h-0 flex items-center justify-center overflow-y-auto py-16 text-sm text-muted-foreground"
        >
          <IconLoader2 class="mr-2 size-4 animate-spin" />
          Memuat data booking…
        </div>

        <form
          v-else
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
                    <div
                      v-if="!studios.length"
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
                  <div
                    v-if="
                      selectedBundle &&
                      !bundleOptions.some(
                        (item) => item.id === selectedBundle?.id,
                      )
                    "
                    class="mb-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground"
                  >
                    Bundle pada booking ini sudah tidak dijual. Harga dan isi
                    tetap mengikuti snapshot booking.
                  </div>
                  <div
                    v-if="isLoadingBundles"
                    class="py-8 text-center text-sm text-muted-foreground"
                  >
                    Memuat bundle…
                  </div>
                  <div
                    v-else-if="!bundleOptions.length && !selectedBundle"
                    class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground"
                  >
                    Belum ada bundle yang bisa dijual saat ini.
                  </div>
                  <div v-else class="grid gap-3 sm:grid-cols-2">
                    <BundleCard
                      v-for="bundle in bundleOptions"
                      :key="bundle.id"
                      :bundle="bundle"
                      :selected="selectedBundle?.id === bundle.id"
                      @select="selectBundle"
                    />
                    <BundleCard
                      v-if="
                        selectedBundle &&
                        !bundleOptions.some(
                          (item) => item.id === selectedBundle?.id,
                        )
                      "
                      :bundle="selectedBundle"
                      :selected="true"
                    />
                  </div>
                </TabsContent>

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
                    <Label for="edit-booking-name" class="sr-only"
                      >Nama customer</Label
                    >
                    <Input
                      id="edit-booking-name"
                      v-model="customerName"
                      required
                      placeholder="Nama lengkap *"
                    />
                  </div>
                  <div class="grid gap-2">
                    <Label for="edit-booking-wa" class="sr-only"
                      >Nomor WhatsApp</Label
                    >
                    <Input
                      id="edit-booking-wa"
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
                    {{
                      formatDuration(
                        selectedBundle.pricing_tier.duration_minutes,
                      )
                    }}
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
                    Ringkasan perubahan
                  </p>
                  <div class="divide-y rounded-lg border text-sm">
                    <div class="flex items-center justify-between gap-3 p-3">
                      <span class="text-muted-foreground">Studio</span>
                      <span class="font-medium">{{
                        effectiveStudio?.name ?? "-"
                      }}</span>
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
                  <p
                    class="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Isi bundle
                  </p>
                  <ul class="divide-y rounded-lg border text-sm">
                    <li
                      v-for="item in selectedBundle.addons"
                      :key="item.id"
                      class="flex items-center justify-between gap-3 p-3"
                    >
                      <span
                        >{{ item.addon.name
                        }}<span
                          v-if="item.duration_minutes"
                          class="text-muted-foreground"
                        >
                          · {{ formatDuration(item.duration_minutes) }}</span
                        ></span
                      >
                      <span class="text-xs text-muted-foreground"
                        >Termasuk</span
                      >
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
                    <span>{{
                      selectedBundle ? "Harga normal paket" : "Harga studio"
                    }}</span>
                    <span>{{
                      formatCurrency(
                        selectedBundle
                          ? selectedBundle.normal_price
                          : tier?.price,
                      )
                    }}</span>
                  </div>
                  <div
                    v-if="selectedBundle"
                    class="mt-1 flex items-center justify-between font-medium text-emerald-700"
                  >
                    <span>Hemat bundle</span>
                    <span
                      >−{{
                        formatCurrency(selectedBundle.discount_amount)
                      }}</span
                    >
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
              {{ isSaving ? "Menyimpan..." : "Simpan perubahan" }}
            </Button>
          </template>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </TooltipProvider>
</template>
