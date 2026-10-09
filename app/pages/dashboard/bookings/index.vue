<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import { useMutation, useQuery } from "villus";
import {
  createColumnHelper,
  type ColumnDef,
  type Row,
} from "@tanstack/vue-table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconBan,
  IconCash,
  IconCircleCheck,
  IconCreditCard,
  IconEdit,
  IconGripVertical,
  IconReceipt,
  IconTrash,
  IconWallet,
} from "@tabler/icons-vue";
import DataTable from "@/components/data-table/DataTable.vue";
import DataTableColumnHeader from "@/components/data-table/DataTableColumnHeader.vue";
import DataTableRowActions from "@/components/data-table/DataTableRowActions.vue";
import DataTableToolbar from "@/components/data-table/DataTableToolbar.vue";
import CreateBookingDialog from "@/components/bookings/CreateBookingDialog.vue";
import EditBookingDialog from "@/components/bookings/EditBookingDialog.vue";
import type { DataTableRowAction } from "@/components/data-table/types";
import { useBulkDelete } from "@/composables/useBulkDelete";
import { appToast } from "@/lib/toast";
import { apiBaseUrl } from "@/lib/sanctum";
import { formatDuration } from "@/utils/formatDuration";

type BookingStatus =
  "pending" | "confirmed" | "cancelled" | "completed" | "expired";
type StatusFilter = "all" | BookingStatus;

interface Booking {
  id: string;
  code: string;
  customerName: string;
  customer_name: string;
  customer_wa: string;
  room: string;
  studioName: string;
  studioCode: string;
  studioThumbnail: string | null;
  date: string;
  startTime: string;
  endTime: string;
  startTimeIso: string;
  studioId: string;
  pricingTierId: string;
  duration: string;
  addOns: string[];
  addonsMeta: Array<{ addonId: string; durationMinutes: number | null }>;
  status: BookingStatus;
  paymentStatus: "unpaid" | "paid";
  total: number;
  normalTotal: number | null;
  isBundleBooking: boolean;
}

const route = useRoute();

const BOOKINGS_QUERY = `query { bookings { id code customer_name customer_wa start_time end_time duration_minutes status payment_status grand_total studio_price_at_booking bundle_name_at_booking bundle { id name } studio { id name code thumbnail_url } pricing_tier { id duration_minutes price } addons { duration_minutes price_at_booking is_bundle_item addon { id name } } } }`;
const DELETE_BOOKING = `mutation ($id: ID!) { deleteBooking(id: $id) { id } }`;
const CANCEL_BOOKING = `mutation ($id: ID!) { cancelBooking(id: $id) { id status } }`;
const UPDATE_BOOKING = `mutation ($id: ID!, $studioId: ID!, $tierId: ID!, $name: String!, $wa: String!, $start: String!, $payment: String!, $addons: [BookingAddonInput!]) { updateManualBooking(id: $id, studio_id: $studioId, pricing_tier_id: $tierId, customer_name: $name, customer_wa: $wa, start_time: $start, payment_method: $payment, addons: $addons) { id code payment_url } }`;
const {
  data: bookingsResult,
  isFetching: loading,
  execute: reloadBookings,
} = useQuery({
  query: BOOKINGS_QUERY,
});
const { execute: deleteBooking } = useMutation(DELETE_BOOKING);
const { execute: executeCancelBooking } = useMutation(CANCEL_BOOKING);
const { execute: updateBooking } = useMutation(UPDATE_BOOKING);
const data = ref<Booking[]>([]);
const statusFilter = ref<StatusFilter>("all");
const cancellingBookingId = ref<string | null>(null);
function handleBookingCreated() {
  reloadBookings();
}
watch(
  () => bookingsResult.value?.bookings,
  (bookings) => {
    data.value = (bookings ?? []).map((booking: any) => {
      const isBundleBooking = Boolean(
        booking.bundle_name_at_booking || booking.bundle,
      );

      return {
        id: booking.id,
        code: booking.code,
        customer_name: booking.customer_name,
        customerName: booking.customer_name,
        customer_wa: booking.customer_wa,
        room:
          booking.bundle_name_at_booking ||
          booking.bundle?.name ||
          booking.studio?.name ||
          "",
        studioName: booking.studio?.name ?? "",
        studioCode: booking.studio?.code ?? "",
        studioThumbnail: booking.studio?.thumbnail_url ?? null,
        date: toJakartaDateKey(booking.start_time),
        startTime: toJakartaTimeString(booking.start_time),
        endTime: toJakartaTimeString(booking.end_time),
        startTimeIso: booking.start_time,
        studioId: booking.studio?.id ?? "",
        pricingTierId: booking.pricing_tier?.id ?? "",
        duration: `${booking.duration_minutes} menit`,
        addOns: (booking.addons ?? []).map(
          (item: any) => item.addon?.name ?? "",
        ),
        addonsMeta: (booking.addons ?? []).map((item: any) => ({
          addonId: item.addon?.id ?? "",
          durationMinutes: item.duration_minutes ?? null,
        })),
        status: booking.status,
        paymentStatus: booking.payment_status,
        total: Number(booking.grand_total ?? 0),
        normalTotal: isBundleBooking
          ? Number(booking.studio_price_at_booking ?? 0) +
            (booking.addons ?? []).reduce(
              (sum: number, item: any) =>
                sum + Number(item.price_at_booking ?? 0),
              0,
            )
          : null,
        isBundleBooking,
      };
    });
  },
  { immediate: true },
);

watch(
  () => route.query.payment_status,
  (status) => {
    if (status === "success") {
      reloadBookings();
    }
  },
  { immediate: true },
);

const isCreateBookingOpen = ref(false);
const editingBookingId = ref<string | null>(null);
const isEditBookingOpen = ref(false);

/* ---------------------------------- Format & helper ---------------------------------- */

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatRupiah(value: number) {
  return rupiahFormatter.format(value);
}

function formatBookingCode(id: string) {
  return id.replace("bk_", "BK-").toUpperCase();
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// Warna avatar memakai transparansi agar nyaman di tema terang maupun gelap.
const AVATAR_PALETTE = [
  { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400" },
  { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400" },
  { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400" },
  { bg: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-400" },
  { bg: "bg-rose-500/15", text: "text-rose-600 dark:text-rose-400" },
  { bg: "bg-cyan-500/15", text: "text-cyan-600 dark:text-cyan-400" },
];

function paletteFor(name: string) {
  const hash = Array.from(name).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return (
    AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? {
      bg: "bg-slate-500/15",
      text: "text-slate-600 dark:text-slate-400",
    }
  );
}

const WIB_TIMEZONE = "Asia/Jakarta";

function toJakartaDateKey(isoUtc: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(isoUtc));
}

function toJakartaTimeString(isoUtc: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: WIB_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(isoUtc));
}

function diffDaysByDateKey(currentKey: string, targetKey: string) {
  const parseDateKey = (value: string) => {
    const parts = value.split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    ) {
      return null;
    }

    return { year, month, day };
  };

  const current = parseDateKey(currentKey);
  const target = parseDateKey(targetKey);

  if (!current || !target) {
    return 0;
  }

  const currentMs = Date.UTC(current.year, current.month - 1, current.day);
  const targetMs = Date.UTC(target.year, target.month - 1, target.day);

  return Math.round((currentMs - targetMs) / 86_400_000);
}

function getWibTodayKey() {
  return toJakartaDateKey(new Date().toISOString());
}

// Status: titik berwarna + teks (sama seperti halaman Bundle Promo).
const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; dot: string; text: string }
> = {
  pending: {
    label: "Menunggu",
    dot: "bg-amber-500 animate-pulse",
    text: "text-amber-600 dark:text-amber-400",
  },
  confirmed: {
    label: "Dikonfirmasi",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  completed: {
    label: "Selesai",
    dot: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-400",
  },
  cancelled: {
    label: "Dibatalkan",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
  },
  expired: {
    label: "Kedaluwarsa",
    dot: "bg-muted-foreground/60",
    text: "text-muted-foreground",
  },
};

function formatSchedule(booking: Booking) {
  const todayKey = getWibTodayKey();
  const diffDays = diffDaysByDateKey(booking.date, todayKey);

  const dateLabel = new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: WIB_TIMEZONE,
  }).format(new Date(`${booking.date}T00:00:00Z`));

  const relative =
    diffDays === 0
      ? "Hari ini"
      : diffDays === 1
        ? "Besok"
        : diffDays === -1
          ? "Kemarin"
          : null;

  return {
    dateLabel,
    relative,
    timeRange: `${booking.startTime}–${booking.endTime}`,
  };
}

/* ---------------------------------- Ringkasan & filter ---------------------------------- */

const todayCount = computed(() => {
  const todayStr = getWibTodayKey();
  return data.value.filter((booking) => booking.date === todayStr).length;
});

const pendingCount = computed(
  () => data.value.filter((booking) => booking.status === "pending").length,
);

const monthRevenue = computed(() => {
  const todayKey = getWibTodayKey();
  const now = new Date(`${todayKey}T00:00:00Z`);

  return data.value
    .filter((booking) => {
      if (booking.status === "cancelled") return false;
      const bookingDate = new Date(`${booking.date}T00:00:00Z`);
      return (
        bookingDate.getUTCMonth() === now.getUTCMonth() &&
        bookingDate.getUTCFullYear() === now.getUTCFullYear()
      );
    })
    .reduce((sum, booking) => sum + booking.total, 0);
});

const statusTabs = computed(() => {
  const count = (status: BookingStatus) =>
    data.value.filter((booking) => booking.status === status).length;
  return [
    { value: "all" as const, label: "Semua", count: data.value.length },
    { value: "pending" as const, label: "Menunggu", count: count("pending") },
    {
      value: "confirmed" as const,
      label: "Dikonfirmasi",
      count: count("confirmed"),
    },
    {
      value: "completed" as const,
      label: "Selesai",
      count: count("completed"),
    },
    {
      value: "cancelled" as const,
      label: "Dibatalkan",
      count: count("cancelled"),
    },
    {
      value: "expired" as const,
      label: "Kedaluwarsa",
      count: count("expired"),
    },
  ];
});

const emptyText = computed(() =>
  data.value.length
    ? "Tidak ada booking yang cocok dengan filter."
    : "Belum ada booking.",
);

function applyStatusFilter(
  table: {
    getColumn: (
      id: string,
    ) => { setFilterValue: (value: unknown) => void } | undefined;
  },
  value: StatusFilter,
) {
  statusFilter.value = value;
  table
    .getColumn("status")
    ?.setFilterValue(value === "all" ? undefined : value);
}

/* ---------------------------------- Actions ---------------------------------- */

function updateStatus(booking: Booking, status: Booking["status"]) {
  const target = data.value.find((item) => item.id === booking.id);
  if (target) target.status = status;
}

async function cancelBooking(booking: Booking) {
  if (!["pending", "confirmed"].includes(booking.status)) return;

  const paymentWarning =
    booking.paymentStatus === "paid"
      ? " Pembayaran yang sudah diterima tidak otomatis direfund."
      : "";
  if (
    !window.confirm(
      `Batalkan booking "${booking.customerName}"?${paymentWarning}`,
    )
  ) {
    return;
  }

  cancellingBookingId.value = booking.id;
  const toastId = appToast.loading(`Membatalkan booking "${booking.customerName}"...`, {
    description: "Status booking sedang diperbarui.",
  });

  try {
    const result = await executeCancelBooking({ id: booking.id });
    if (result.error || !result.data?.cancelBooking?.id) {
      throw new Error(result.error?.message ?? "Booking gagal dibatalkan.");
    }

    await reloadBookings();
    appToast.success(`Booking "${booking.customerName}" berhasil dibatalkan`, {
      id: toastId,
      description:
        booking.paymentStatus === "paid"
          ? "Jadwal sudah dilepas. Proses refund pembayaran, bila diperlukan, dilakukan terpisah."
          : "Jadwal sudah dilepas dan tidak lagi menahan slot.",
    });
  } catch (error) {
    appToast.error(`Booking "${booking.customerName}" gagal dibatalkan`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba kembali.",
    });
  } finally {
    cancellingBookingId.value = null;
  }
}

async function removeBooking(booking: Booking) {
  if (!window.confirm(`Hapus booking "${booking.customerName}"?`)) return;

  const toastId = appToast.loading(
    `Menghapus booking "${booking.customerName}"...`,
    {
      description: "Data booking sedang dihapus dari sistem.",
    },
  );

  try {
    const result = await deleteBooking({ id: booking.id });
    if (result.error || !result.data?.deleteBooking?.id) {
      throw new Error(result.error?.message ?? "Booking gagal dihapus.");
    }

    appToast.success(`Booking "${booking.customerName}" berhasil dihapus`, {
      id: toastId,
      description: "Booking dan data terkait telah dihapus.",
    });

    await reloadBookings();
  } catch (error) {
    appToast.error(`Booking "${booking.customerName}" gagal dihapus`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba hapus kembali.",
    });
  }
}

const { isDeleting: isBulkDeleting, bulkDelete } = useBulkDelete<Booking>({
  entityName: "booking",
  getLabel: (booking) => booking.customerName,
  deleteOne: async (booking) => {
    const result = await deleteBooking({ id: booking.id });
    if (result.error || !result.data?.deleteBooking?.id) {
      throw new Error(
        result.error?.message ??
          `Booking "${booking.customerName}" gagal dihapus.`,
      );
    }
  },
  onSettled: async () => {
    await reloadBookings();
  },
});

async function handleBulkDelete(
  bookings: Booking[],
  table?: {
    resetRowSelection?: () => void;
  },
) {
  await bulkDelete(bookings, () => table?.resetRowSelection?.());
}

function handleReorder(reorderedBookings: Booking[]) {
  data.value = reorderedBookings;
}

const handlePayment = async (booking: Booking, method: "gateway" | "cash") => {
  if (!booking.studioId || !booking.pricingTierId || !booking.startTimeIso) {
    appToast.error("Data booking tidak lengkap", {
      description: "Tidak dapat memproses pembayaran untuk booking ini.",
    });
    return;
  }

  const toastId = appToast.loading(
    method === "gateway"
      ? "Membuat link pembayaran..."
      : "Memproses pembayaran cash...",
    {
      description:
        method === "gateway"
          ? "Sedang menyiapkan payment link iPaymu."
          : "Booking akan ditandai sebagai lunas tunai.",
    },
  );

  try {
    const result = await updateBooking({
      id: booking.id,
      studioId: booking.studioId,
      tierId: booking.pricingTierId,
      name: booking.customer_name,
      wa: booking.customer_wa,
      start: booking.startTimeIso,
      payment: method,
      addons: booking.addonsMeta.map((item) => ({
        addon_id: item.addonId,
        duration_minutes: item.durationMinutes,
      })),
    });

    if (result.error || !result.data?.updateManualBooking?.id) {
      throw new Error(
        result.error?.message ?? "Gagal memproses pembayaran booking.",
      );
    }

    const paymentUrl = result.data.updateManualBooking.payment_url;

    appToast.success(
      method === "gateway"
        ? "Link pembayaran berhasil dibuat"
        : "Pembayaran cash berhasil diproses",
      {
        id: toastId,
        description:
          method === "gateway"
            ? result.data.updateManualBooking.code
            : "Status booking telah diperbarui menjadi lunas.",
      },
    );

    await reloadBookings();

    if (method === "gateway" && paymentUrl) {
      const { rememberCurrentPage } = usePaymentReturn();
      rememberCurrentPage();
      window.location.assign(paymentUrl);
      return;
    }
  } catch (error) {
    appToast.error(
      method === "gateway"
        ? "Link pembayaran gagal dibuat"
        : "Pembayaran cash gagal diproses",
      {
        id: toastId,
        description:
          error instanceof Error
            ? error.message
            : "Coba ulang beberapa saat lagi.",
      },
    );
  }
};

/* ---------------------------------- Kolom tabel ---------------------------------- */

// Pencarian mencakup customer, kode booking, studio/bundle, dan nomor WA.
function searchBooking(row: Row<Booking>, _columnId: string, value: unknown) {
  const term = String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");
  if (!term) return true;
  const booking = row.original;
  return [
    booking.customerName,
    booking.code,
    booking.customer_wa,
    booking.room,
    booking.studioName,
    booking.studioCode,
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID")
    .includes(term);
}

// Pola semua sel: baris utama (jelas) + baris keterangan (redup).
const CELL = "space-y-0.5 pr-4";

const columnHelper = createColumnHelper<Booking>();
const columns: ColumnDef<Booking, any>[] = [
  columnHelper.display({
    id: "drag",
    header: "",
    cell: () =>
      h(
        "button",
        {
          type: "button",
          class:
            "drag-handle text-muted-foreground/60 hover:text-muted-foreground cursor-grab touch-none p-1 transition-colors active:cursor-grabbing",
          title: "Geser untuk mengubah urutan",
          "aria-label": "Geser booking",
        },
        [h(IconGripVertical, { class: "size-4" })],
      ),
    enableSorting: false,
    enableHiding: false,
  }),
  columnHelper.display({
    id: "select",
    header: ({ table }) =>
      h(Checkbox as any, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate"),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(value === true),
        onClick: (event: Event) => event.stopPropagation(),
      }),
    cell: ({ row }) =>
      h(Checkbox as any, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (value: boolean | "indeterminate") =>
          row.toggleSelected(value === true),
        onClick: (event: Event) => event.stopPropagation(),
      }),
    enableSorting: false,
    enableHiding: false,
  }),

  // Customer: avatar inisial, nama, kode booking
  columnHelper.accessor("customerName", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Customer" }),
    cell: ({ row }) => {
      const booking = row.original;
      const palette = paletteFor(booking.customerName);
      const dimmed =
        booking.status === "cancelled" || booking.status === "expired";
      return h(
        "div",
        {
          class: [
            "flex min-w-[200px] items-center gap-3 pr-4",
            dimmed && "opacity-60",
          ],
        },
        [
          h(
            "div",
            {
              class: `flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${palette.bg} ${palette.text}`,
            },
            getInitials(booking.customerName),
          ),
          h("div", { class: "min-w-0 space-y-0.5" }, [
            h(
              "p",
              {
                class:
                  "max-w-[170px] truncate text-sm font-semibold text-foreground",
                title: booking.customer_wa || booking.customerName,
              },
              booking.customerName,
            ),
            h(
              "p",
              { class: "font-mono text-xs text-muted-foreground" },
              formatBookingCode(booking.code),
            ),
          ]),
        ],
      );
    },
    filterFn: searchBooking,
  }),

  // Studio atau nama bundle promo, dengan kode studio sebagai keterangan.
  columnHelper.accessor("room", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Studio / Bundle" }),
    cell: ({ row }) => {
      const booking = row.original;
      const dimmed =
        booking.status === "cancelled" || booking.status === "expired";
      const thumbnail = booking.studioThumbnail
        ? h("img", {
            src: booking.studioThumbnail,
            alt: `Thumbnail ${booking.studioName}`,
            class: "size-10 shrink-0 rounded-lg border object-cover",
          })
        : h("div", {
            class: "size-10 shrink-0 rounded-lg border bg-muted",
            "aria-hidden": "true",
          });

      return h(
        "div",
        {
          class: [
            "flex min-w-[190px] items-center gap-3 pr-4",
            dimmed && "opacity-60",
          ],
        },
        [
          thumbnail,
          h("div", { class: "min-w-0 space-y-0.5" }, [
            h(
              "p",
              {
                class:
                  "max-w-[150px] truncate text-sm font-medium text-foreground",
              },
              booking.room,
            ),
            h(
              "p",
              { class: "font-mono text-xs text-muted-foreground" },
              booking.studioCode || "–",
            ),
          ]),
        ],
      );
    },
    filterFn: searchBooking,
  }),

  // Jadwal: tanggal (+ Hari ini/Besok), lalu jam dan durasi
  columnHelper.accessor("date", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Jadwal" }),
    cell: ({ row }) => {
      const schedule = formatSchedule(row.original);
      return h("div", { class: `min-w-[160px] ${CELL}` }, [
        h("p", { class: "text-sm font-medium text-foreground" }, [
          schedule.dateLabel,
          schedule.relative
            ? h(
                "span",
                { class: "ml-2 text-xs font-medium text-primary" },
                schedule.relative,
              )
            : null,
        ]),
        h(
          "p",
          { class: "text-xs tabular-nums text-muted-foreground" },
          `${schedule.timeRange} · ${formatDuration(Number(row.original.duration.split(" ")[0]))}`,
        ),
      ]);
    },
  }),

  // Add-on: dua nama pertama, sisanya diringkas
  columnHelper.accessor("addOns", {
    header: "Add-on",
    cell: ({ getValue }) => {
      const list = getValue() as string[];
      if (!list.length) {
        return h("div", { class: `min-w-[140px] ${CELL}` }, [
          h("p", { class: "text-sm text-muted-foreground" }, "Tanpa add-on"),
        ]);
      }
      const extra = list.length - 2;
      return h(
        "div",
        {
          class: `min-w-[150px] max-w-[220px] ${CELL}`,
          title: list.join(", "),
        },
        [
          h(
            "p",
            { class: "truncate text-sm text-foreground" },
            list.slice(0, 2).join(", "),
          ),
          extra > 0
            ? h(
                "p",
                { class: "text-xs text-muted-foreground" },
                `+${extra} lainnya`,
              )
            : null,
        ],
      );
    },
    enableSorting: false,
  }),

  // Status
  columnHelper.accessor("status", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Status" }),
    cell: ({ getValue }) => {
      const status = getValue() as Booking["status"];
      const config = STATUS_CONFIG[status];
      return h("div", { class: `min-w-[120px] ${CELL}` }, [
        h(
          "span",
          {
            class: `inline-flex items-center gap-1.5 text-sm font-medium ${config.text}`,
          },
          [
            h("span", { class: `size-1.5 rounded-full ${config.dot}` }),
            config.label,
          ],
        ),
      ]);
    },
    filterFn: "equals",
  }),

  // Total
  columnHelper.accessor("total", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Total" }),
    cell: ({ row }) => {
      const cancelled = row.original.status === "cancelled";
      return h("div", { class: `min-w-[120px] ${CELL}` }, [
        row.original.normalTotal !== null &&
        row.original.normalTotal !== row.original.total
          ? h(
              "p",
              {
                class: "text-xs tabular-nums text-muted-foreground line-through",
              },
              formatRupiah(row.original.normalTotal),
            )
          : null,
        h(
          "p",
          {
            class: cancelled
              ? "text-sm tabular-nums text-muted-foreground line-through"
              : "text-sm font-semibold tabular-nums text-foreground",
          },
          formatRupiah(row.original.total),
        ),
      ]);
    },
  }),

  columnHelper.display({
    id: "actions",
    cell: ({ row }) => {
      const booking = row.original;
      const actions: DataTableRowAction<Booking>[] = [
        {
          label: "Lihat kuitansi",
          icon: IconReceipt,
          onSelect: (item) => {
            window.open(
              `${apiBaseUrl()}/bookings/${encodeURIComponent(item.id)}/receipt`,
              "_blank",
              "noopener",
            );
          },
        },
        {
          label: "Edit Booking",
          icon: IconEdit,
          onSelect: (item) => {
            editingBookingId.value = item.id;
            isEditBookingOpen.value = true;
          },
        },
        {
          label: "Konfirmasi",
          icon: IconCircleCheck,
          disabled: (item) => item.status !== "pending",
          onSelect: (item) => updateStatus(item, "confirmed"),
        },
        ...(booking.status === "pending"
          ? [
              {
                label: "Payment",
                icon: IconWallet,
                children: [
                  {
                    label: "Payment Online",
                    icon: IconCreditCard,
                    onSelect: (item: Booking) => handlePayment(item, "gateway"),
                  },
                  {
                    label: "Payment Cash",
                    icon: IconCash,
                    onSelect: (item: Booking) => handlePayment(item, "cash"),
                  },
                ],
              } satisfies DataTableRowAction<Booking>,
            ]
          : []),
        {
          label: "Batalkan",
          icon: IconBan,
          separator: true,
          destructive: true,
          disabled: (item) =>
            !["pending", "confirmed"].includes(item.status) ||
            cancellingBookingId.value === item.id,
          onSelect: cancelBooking,
        },
        {
          label: "Hapus",
          icon: IconTrash,
          destructive: true,
          onSelect: (item) => removeBooking(item),
        },
      ];
      return h(DataTableRowActions as any, { row: booking, actions });
    },
    enableHiding: false,
  }),
];

const columnLabels = {
  customerName: "Customer",
  room: "Studio / Bundle",
  date: "Jadwal",
  addOns: "Add-on",
  status: "Status",
  total: "Total",
};
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Booking</h1>
      <p class="text-sm text-muted-foreground">
        Pantau dan kelola jadwal booking Studio A &amp; Studio B.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">Booking hari ini</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {{ todayCount }}
        </p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">Menunggu konfirmasi</p>
        <p
          class="mt-1 text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400"
        >
          {{ pendingCount }}
        </p>
      </div>
      <div class="rounded-lg border bg-card p-4">
        <p class="text-xs text-muted-foreground">Pendapatan bulan ini</p>
        <p class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          {{ formatRupiah(monthRevenue) }}
        </p>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :get-row-id="(booking) => booking.id"
      enable-row-reorder
      :empty-text="emptyText"
      @reorder="handleReorder"
    >
      <template #toolbar="{ table }">
        <div class="space-y-4">
          <div
            role="tablist"
            aria-label="Filter status booking"
            class="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
          >
            <button
              v-for="tab in statusTabs"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="statusFilter === tab.value"
              class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="
                statusFilter === tab.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="applyStatusFilter(table, tab.value)"
            >
              {{ tab.label }}
              <span class="text-xs tabular-nums text-muted-foreground">{{
                tab.count
              }}</span>
            </button>
          </div>

          <DataTableToolbar
            :table="table"
            :deleting="isBulkDeleting"
            search-placeholder="Cari customer, kode, studio, atau bundle..."
            :column-labels="columnLabels"
            create-label="Tambah booking"
            @create="isCreateBookingOpen = true"
            @bulk-delete="(rows) => handleBulkDelete(rows, table)"
          />
        </div>
      </template>
    </DataTable>

    <CreateBookingDialog
      v-model:open="isCreateBookingOpen"
      @created="handleBookingCreated"
    />
    <EditBookingDialog
      v-if="editingBookingId"
      :booking-id="editingBookingId"
      v-model:open="isEditBookingOpen"
      @updated="handleBookingCreated"
    />
  </div>
</template>
