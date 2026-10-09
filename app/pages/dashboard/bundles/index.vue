<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import { useMutation, useQuery } from "villus";
import {
  createColumnHelper,
  type ColumnDef,
  type Row,
} from "@tanstack/vue-table";
import { IconEdit, IconTrash } from "@tabler/icons-vue";
import { Checkbox } from "@/components/ui/checkbox";
import DataTable from "@/components/data-table/DataTable.vue";
import DataTableColumnHeader from "@/components/data-table/DataTableColumnHeader.vue";
import DataTableRowActions from "@/components/data-table/DataTableRowActions.vue";
import DataTableToolbar from "@/components/data-table/DataTableToolbar.vue";
import type { DataTableRowAction } from "@/components/data-table/types";
import BundleFormDialog from "@/components/bundles/BundleFormDialog.vue";
import { useBulkDelete } from "@/composables/useBulkDelete";
import { appToast } from "@/lib/toast";
import { formatDuration } from "@/utils/formatDuration";

type Bundle = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  studio: { id: string; name: string; code: string; thumbnail_url: string | null };
  pricing_tier: { id: string; duration_minutes: number; price: number };
  addons: Array<{
    id: string;
    duration_minutes: number | null;
    addon: { id: string; name: string };
  }>;
  bundle_price: number;
  normal_price: number;
  discount_amount: number;
  valid_from: string | null;
  valid_until: string | null;
  quota_limit: number | null;
  quota_period: "total" | "monthly" | null;
  quota_remaining: number | null;
  is_active: boolean;
  is_sellable: boolean;
  sort_order: number;
};
type BundleStatus = "sellable" | "unavailable" | "inactive";
type StatusFilter = "all" | BundleStatus;

const BUNDLES_QUERY = `query { bundles { id code name description studio { id name code thumbnail_url } pricing_tier { id duration_minutes price } addons { id duration_minutes addon { id name } } bundle_price normal_price discount_amount valid_from valid_until quota_limit quota_period quota_remaining is_active is_sellable sort_order } }`;
const DELETE_BUNDLE = `mutation ($id: ID!) { deleteBundle(id: $id) { id } }`;

const data = ref<Bundle[]>([]);
const formOpen = ref(false);
const editingBundle = ref<Bundle | null>(null);
const statusFilter = ref<StatusFilter>("all");

const {
  data: bundlesResult,
  execute: loadBundles,
  isFetching: isLoading,
  error: loadError,
} = useQuery({ query: BUNDLES_QUERY });
const { execute: deleteBundle } = useMutation(DELETE_BUNDLE);

watch(
  () => bundlesResult.value?.bundles,
  (bundles) => {
    data.value = [...(bundles ?? [])].sort(
      (left: Bundle, right: Bundle) => left.sort_order - right.sort_order,
    );
  },
  { immediate: true },
);

/* ---------------------------------- Format & helper ---------------------------------- */

const WIB_TIMEZONE = "Asia/Jakarta";

function formatCurrency(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("id-ID");
}

function formatDate(value: string, withYear = true): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

function getWibTodayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Selisih hari antara dua tanggal berformat YYYY-MM-DD (to - from).
function dayDiff(fromKey: string, toKey: string): number {
  const parse = (key: string) => {
    const [year = 0, month = 1, day = 1] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(toKey) - parse(fromKey)) / 86_400_000);
}

// Contoh: "1 Okt – 31 Des 2026" (tahun hanya ditulis sekali jika sama)
function periodLabel(bundle: Bundle): string {
  const from = bundle.valid_from?.slice(0, 10) ?? null;
  const until = bundle.valid_until?.slice(0, 10) ?? null;
  if (from && until) {
    const sameYear = from.slice(0, 4) === until.slice(0, 4);
    return `${formatDate(from, !sameYear)} – ${formatDate(until)}`;
  }
  if (from) return `Mulai ${formatDate(from)}`;
  if (until) return `Sampai ${formatDate(until)}`;
  return "Tanpa batas waktu";
}

// Keterangan kedua di kolom Periode: sisa waktu, bukan sekadar "Berlangsung".
function periodNote(bundle: Bundle): { text: string; className: string } | null {
  const today = getWibTodayKey();
  const from = bundle.valid_from?.slice(0, 10) ?? null;
  const until = bundle.valid_until?.slice(0, 10) ?? null;
  if (!from && !until) return null;

  if (until && today > until) {
    return { text: "Sudah berakhir", className: "text-muted-foreground" };
  }
  if (from && today < from) {
    const days = dayDiff(today, from);
    return {
      text: days === 1 ? "Mulai besok" : `Mulai ${days} hari lagi`,
      className: "text-sky-600 dark:text-sky-400",
    };
  }
  if (until) {
    const left = dayDiff(today, until);
    if (left === 0) {
      return { text: "Berakhir hari ini", className: "text-amber-600 dark:text-amber-400" };
    }
    return {
      text: `Sisa ${left} hari`,
      className:
        left <= 7 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
    };
  }
  return { text: "Sedang berlangsung", className: "text-muted-foreground" };
}

function statusOf(bundle: Bundle): BundleStatus {
  if (!bundle.is_active) return "inactive";
  return bundle.is_sellable ? "sellable" : "unavailable";
}

function unavailableReason(bundle: Bundle): string {
  const today = getWibTodayKey();
  const from = bundle.valid_from?.slice(0, 10) ?? null;
  const until = bundle.valid_until?.slice(0, 10) ?? null;
  if (until && today > until) return "Promo sudah berakhir";
  if (from && today < from) return "Promo belum dimulai";
  if (bundle.quota_limit !== null && (bundle.quota_remaining ?? 0) <= 0) {
    return "Kuota habis";
  }
  return "Belum bisa dipesan";
}

const STATUS_CONFIG: Record<
  BundleStatus,
  { label: string; dot: string; text: string }
> = {
  sellable: {
    label: "Siap dijual",
    dot: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  unavailable: {
    label: "Tidak tersedia",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  inactive: {
    label: "Nonaktif",
    dot: "bg-muted-foreground/60",
    text: "text-muted-foreground",
  },
};

/* ---------------------------------- Filter status ---------------------------------- */

const statusTabs = computed(() => {
  const count = (status: BundleStatus) =>
    data.value.filter((bundle) => statusOf(bundle) === status).length;
  return [
    { value: "all" as const, label: "Semua", count: data.value.length },
    { value: "sellable" as const, label: "Siap dijual", count: count("sellable") },
    { value: "unavailable" as const, label: "Tidak tersedia", count: count("unavailable") },
    { value: "inactive" as const, label: "Nonaktif", count: count("inactive") },
  ];
});

const emptyText = computed(() =>
  data.value.length
    ? "Tidak ada bundle yang cocok dengan filter."
    : "Belum ada bundle. Klik Tambah bundle untuk membuat paket pertama.",
);

function applyStatusFilter(
  table: { getColumn: (id: string) => { setFilterValue: (value: unknown) => void } | undefined },
  value: StatusFilter,
) {
  statusFilter.value = value;
  table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
}

/* ---------------------------------- Actions ---------------------------------- */

function openCreate() {
  editingBundle.value = null;
  formOpen.value = true;
}

function openEdit(bundle: Bundle) {
  editingBundle.value = bundle;
  formOpen.value = true;
}

async function refresh() {
  await loadBundles();
}

async function removeBundle(bundle: Bundle) {
  if (!window.confirm(`Hapus bundle "${bundle.name}"?`)) return;

  const toastId = appToast.loading(`Menghapus bundle "${bundle.name}"…`, {
    description: "Data bundle sedang dihapus dari sistem.",
  });

  try {
    const result = await deleteBundle({ id: bundle.id });
    if (result.error || !result.data?.deleteBundle?.id) {
      throw new Error(result.error?.message ?? "Bundle gagal dihapus.");
    }
    appToast.success(`Bundle "${bundle.name}" berhasil dihapus`, {
      id: toastId,
      description: "Bundle dan komposisinya telah dihapus.",
    });
    await refresh();
  } catch (error) {
    appToast.error(`Bundle "${bundle.name}" gagal dihapus`, {
      id: toastId,
      description: error instanceof Error ? error.message : "Coba kembali.",
    });
  }
}

const { isDeleting: isBulkDeleting, bulkDelete } = useBulkDelete<Bundle>({
  entityName: "bundle",
  getLabel: (bundle) => bundle.name,
  deleteOne: async (bundle) => {
    const result = await deleteBundle({ id: bundle.id });
    if (result.error || !result.data?.deleteBundle?.id) {
      throw new Error(
        result.error?.message ?? `Bundle "${bundle.name}" gagal dihapus.`,
      );
    }
  },
  onSettled: async () => {
    await refresh();
  },
});

async function handleBulkDelete(
  bundles: Bundle[],
  table?: { resetRowSelection?: () => void },
) {
  await bulkDelete(bundles, () => table?.resetRowSelection?.());
}

/* ---------------------------------- Kolom tabel ---------------------------------- */

// Pencarian di toolbar mencakup nama, kode, studio, dan nama add-on.
function searchBundle(row: Row<Bundle>, _columnId: string, value: unknown) {
  const term = String(value ?? "").trim().toLocaleLowerCase("id-ID");
  if (!term) return true;
  const bundle = row.original;
  return [
    bundle.name,
    bundle.code,
    bundle.studio.name,
    bundle.studio.code,
    ...bundle.addons.map((item) => item.addon.name),
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID")
    .includes(term);
}

// Pola semua sel: baris utama (jelas) + baris keterangan (redup).
const CELL = "space-y-0.5 pr-4";

const columnHelper = createColumnHelper<Bundle>();
const columns: ColumnDef<Bundle, any>[] = [
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

  // Bundle: thumbnail, nama, kode (deskripsi muncul saat nama di-hover)
  columnHelper.accessor("name", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Bundle" }),
    cell: ({ row }) => {
      const bundle = row.original;
      const thumbnail = bundle.studio.thumbnail_url
        ? h("img", {
            src: bundle.studio.thumbnail_url,
            alt: `Thumbnail ${bundle.studio.name}`,
            class: "size-12 shrink-0 rounded-lg border object-cover",
          })
        : h("div", {
            class: "size-12 shrink-0 rounded-lg border bg-muted",
            "aria-hidden": "true",
          });

      return h(
        "div",
        {
          class: [
            "flex min-w-[230px] items-center gap-3 pr-4",
            !bundle.is_active && "opacity-60",
          ],
        },
        [
          thumbnail,
          h("div", { class: "min-w-0 space-y-0.5" }, [
            h(
              "p",
              {
                class: "max-w-[190px] truncate text-sm font-semibold text-foreground",
                title: bundle.description ?? bundle.name,
              },
              bundle.name,
            ),
            h("p", { class: "font-mono text-xs text-muted-foreground" }, bundle.code),
          ]),
        ],
      );
    },
    filterFn: searchBundle,
  }),

  // Isi paket: studio + durasi, lalu add-on
  columnHelper.accessor((bundle) => bundle.studio.name, {
    id: "studio",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Isi paket" }),
    cell: ({ row }) => {
      const bundle = row.original;
      const names = bundle.addons.map((item) => item.addon.name);
      const extra = names.length - 2;
      const addonText = names.length
        ? `${names.slice(0, 2).join(", ")}${extra > 0 ? ` +${extra} lainnya` : ""}`
        : "Tanpa add-on";
      const fullTitle = [
        `${bundle.studio.name} (${bundle.studio.code})`,
        ...bundle.addons.map((item) =>
          item.duration_minutes
            ? `• ${item.addon.name} (${formatDuration(item.duration_minutes)})`
            : `• ${item.addon.name}`,
        ),
      ].join("\n");

      return h(
        "div",
        {
          class: [`min-w-[200px] max-w-[270px] ${CELL}`, !bundle.is_active && "opacity-60"],
          title: fullTitle,
        },
        [
          h("p", { class: "truncate text-sm font-medium text-foreground" }, [
            bundle.studio.name,
            h(
              "span",
              { class: "font-normal text-muted-foreground" },
              ` · ${formatDuration(bundle.pricing_tier.duration_minutes)}`,
            ),
          ]),
          h("p", { class: "truncate text-xs text-muted-foreground" }, addonText),
        ],
      );
    },
    filterFn: searchBundle,
  }),

  // Harga: harga paket, lalu harga normal + persen hemat
  columnHelper.accessor("bundle_price", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Harga" }),
    cell: ({ row }) => {
      const bundle = row.original;
      const percent =
        bundle.normal_price > 0
          ? Math.round((bundle.discount_amount / bundle.normal_price) * 100)
          : 0;
      return h(
        "div",
        {
          class: `min-w-[150px] ${CELL}`,
          title:
            bundle.discount_amount > 0
              ? `Hemat Rp ${formatCurrency(bundle.discount_amount)}`
              : undefined,
        },
        [
          h(
            "p",
            { class: "text-sm font-semibold tabular-nums text-foreground" },
            `Rp ${formatCurrency(bundle.bundle_price)}`,
          ),
          h("p", { class: "text-xs tabular-nums text-muted-foreground" }, [
            h("span", { class: "line-through" }, `Rp ${formatCurrency(bundle.normal_price)}`),
            bundle.discount_amount > 0
              ? h(
                  "span",
                  { class: "ml-2 font-medium text-emerald-600 dark:text-emerald-400" },
                  `Hemat ${percent}%`,
                )
              : null,
          ]),
        ],
      );
    },
  }),

  // Periode promo + sisa waktu
  columnHelper.accessor((bundle) => bundle.valid_from ?? "", {
    id: "period",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Periode" }),
    cell: ({ row }) => {
      const bundle = row.original;
      const note = periodNote(bundle);
      return h("div", { class: `min-w-[150px] ${CELL}` }, [
        h("p", { class: "text-sm text-foreground" }, periodLabel(bundle)),
        note ? h("p", { class: `text-xs ${note.className}` }, note.text) : null,
      ]);
    },
  }),

  // Kuota: sisa / total + periode kuota. Warna berubah saat menipis.
  columnHelper.accessor((bundle) => bundle.quota_remaining ?? Number.POSITIVE_INFINITY, {
    id: "quota",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Kuota" }),
    cell: ({ row }) => {
      const bundle = row.original;
      if (bundle.quota_limit === null) {
        return h("div", { class: `min-w-[110px] ${CELL}` }, [
          h("p", { class: "text-sm text-foreground" }, "Tanpa batas"),
        ]);
      }
      const remaining = Math.max(0, bundle.quota_remaining ?? 0);
      const ratio = bundle.quota_limit > 0 ? remaining / bundle.quota_limit : 0;
      const tone =
        remaining === 0
          ? "text-rose-600 dark:text-rose-400"
          : ratio <= 0.2
            ? "text-amber-600 dark:text-amber-400"
            : "text-foreground";
      return h("div", { class: `min-w-[110px] ${CELL}` }, [
        h("p", { class: `text-sm tabular-nums ${tone}` }, [
          h("span", { class: "font-medium" }, `${remaining} / ${bundle.quota_limit}`),
          h("span", { class: "text-muted-foreground" }, " tersisa"),
        ]),
        h(
          "p",
          { class: "text-xs text-muted-foreground" },
          bundle.quota_period === "monthly" ? "Reset tiap bulan" : "Selama promo",
        ),
      ]);
    },
  }),

  // Status
  columnHelper.accessor((bundle) => statusOf(bundle), {
    id: "status",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Status" }),
    cell: ({ row }) => {
      const bundle = row.original;
      const status = statusOf(bundle);
      const config = STATUS_CONFIG[status];
      return h("div", { class: `min-w-[130px] ${CELL}` }, [
        h(
          "span",
          {
            class: `inline-flex items-center gap-1.5 text-sm font-medium ${config.text}`,
          },
          [h("span", { class: `size-1.5 rounded-full ${config.dot}` }), config.label],
        ),
        status === "unavailable"
          ? h("p", { class: "text-xs text-muted-foreground" }, unavailableReason(bundle))
          : null,
      ]);
    },
    filterFn: "equals",
  }),

  columnHelper.display({
    id: "actions",
    cell: ({ row }) => {
      const bundle = row.original;
      const actions: DataTableRowAction<Bundle>[] = [
        {
          label: "Edit bundle",
          icon: IconEdit,
          onSelect: (item) => openEdit(item),
        },
        {
          label: "Hapus",
          icon: IconTrash,
          separator: true,
          destructive: true,
          onSelect: (item) => removeBundle(item),
        },
      ];
      return h(DataTableRowActions as any, { row: bundle, actions });
    },
    enableHiding: false,
  }),
];

const columnLabels = {
  name: "Bundle",
  studio: "Isi paket",
  bundle_price: "Harga",
  period: "Periode",
  quota: "Kuota",
  status: "Status",
};
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Bundle Promo</h1>
      <p class="text-sm text-muted-foreground">
        Kelola paket studio dan add-on dengan harga khusus.
      </p>
    </div>

    <div
      v-if="loadError"
      class="rounded-md border border-destructive/40 p-4 text-sm text-destructive"
    >
      Gagal memuat bundle. Periksa koneksi lalu coba lagi.
    </div>

    <DataTable
      :columns="columns"
      :data="data"
      :loading="isLoading"
      :get-row-id="(bundle) => bundle.id"
      :empty-text="emptyText"
    >
      <template #toolbar="{ table }">
        <div class="space-y-4">
          <div
            role="tablist"
            aria-label="Filter status bundle"
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
              <span class="text-xs tabular-nums text-muted-foreground">{{ tab.count }}</span>
            </button>
          </div>

          <DataTableToolbar
            :table="table"
            :deleting="isBulkDeleting"
            search-placeholder="Cari bundle, studio, atau add-on..."
            :column-labels="columnLabels"
            create-label="Tambah bundle"
            @create="openCreate"
            @bulk-delete="(rows) => handleBulkDelete(rows, table)"
          />
        </div>
      </template>
    </DataTable>

    <BundleFormDialog v-model:open="formOpen" :bundle="editingBundle" @saved="refresh" />
  </div>
</template>