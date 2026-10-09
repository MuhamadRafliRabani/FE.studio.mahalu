<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import {
  createColumnHelper,
  type ColumnDef,
  type Row,
} from "@tanstack/vue-table";
import { useMutation, useQuery } from "villus";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconCurrencyDollar,
  IconEdit,
  IconGripVertical,
  IconPhoto,
  IconPower,
  IconTrash,
} from "@tabler/icons-vue";
import DataTable from "@/components/data-table/DataTable.vue";
import DataTableColumnHeader from "@/components/data-table/DataTableColumnHeader.vue";
import DataTableRowActions from "@/components/data-table/DataTableRowActions.vue";
import DataTableToolbar from "@/components/data-table/DataTableToolbar.vue";
import type { DataTableRowAction } from "@/components/data-table/types";
import { useBulkDelete } from "@/composables/useBulkDelete";
import EditStudioDialog from "~/components/studios/EditStudioDialog.vue";
import CreateStudioDialog from "~/components/studios/CreateStudioDialog.vue";
import PricingTierDialog from "~/components/studios/PricingTierDialog.vue";
import { appToast } from "@/lib/toast";

const STUDIOS_QUERY = `query { studios { id name code slug description capacity size_sqm thumbnail_url is_active sort_order cretime modtime photos { id url } pricing_tiers { id duration_minutes price } } }`;
const REORDER_STUDIOS = `mutation ($items: [ReorderInput!]!) { reorderStudios(items: $items) { id sort_order } }`;
const DELETE_STUDIO = `mutation ($id: ID!) { deleteStudio(id: $id) { id } }`;
const UPDATE_STUDIO_STATUS = `mutation ($id: ID!, $isActive: Boolean!) { updateStudio(id: $id, is_active: $isActive) { id is_active } }`;

type StudioPhoto = { id: string; url: string };
type PricingTier = { id: string; duration_minutes: number; price: number };
type StatusFilter = "all" | "active" | "inactive";

interface Studio {
  id: string;
  name: string;
  code: string;
  slug: string;
  description: string | null;
  capacity: number | null;
  size_sqm: number | null;
  thumbnail_url: string | null;
  photos: StudioPhoto[];
  pricing_tiers: PricingTier[];
  is_active: boolean;
  sort_order: number;
  cretime: string;
  modtime: string;
}

const data = ref<Studio[]>([]);
const statusFilter = ref<StatusFilter>("all");
const {
  data: studiosResult,
  execute: loadStudios,
  error: loadError,
  isFetching: loading,
} = useQuery({ query: STUDIOS_QUERY });
const { execute: persistReorder, isFetching: isReordering } =
  useMutation(REORDER_STUDIOS);
const { execute: executeDeleteStudio } = useMutation(DELETE_STUDIO);
const { execute: executeUpdateStudioStatus } =
  useMutation(UPDATE_STUDIO_STATUS);

watch(
  () => studiosResult.value?.studios,
  (studios) => {
    data.value = [...(studios ?? [])].sort(
      (a: Studio, b: Studio) => a.sort_order - b.sort_order,
    );
  },
  { immediate: true },
);

const formOpen = ref(false);
const editingStudio = ref<Studio | null>(null);
const pricingStudio = ref<Studio | null>(null);
const pricingOpen = ref(false);
const deletingStudioId = ref<string | null>(null);
// Ref ke <DataTable> — dipakai buat reset row selection lewat
// table.resetRowSelection() setelah bulk delete selesai (DataTable
// sudah defineExpose({ table })).
const dataTableRef = ref<{
  table: { resetRowSelection: () => void };
} | null>(null);

/* ---------------------------------- Helpers ---------------------------------- */

function formatCurrency(value: number): string {
  return value.toLocaleString("id-ID");
}

function cheapestTier(studio: Studio): PricingTier | null {
  if (!studio.pricing_tiers.length) return null;
  return studio.pricing_tiers.reduce((min, tier) =>
    tier.price < min.price ? tier : min,
  );
}

const RTF = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
function formatRelative(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (Math.abs(diffDays) < 1) return "Hari ini";
  if (Math.abs(diffDays) < 30) return RTF.format(diffDays, "day");
  const diffMonths = Math.round(diffDays / 30);
  return RTF.format(diffMonths, "month");
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ---------------------------------- Filter status ---------------------------------- */

const statusTabs = computed(() => [
  { value: "all" as const, label: "Semua", count: data.value.length },
  {
    value: "active" as const,
    label: "Aktif",
    count: data.value.filter((studio) => studio.is_active).length,
  },
  {
    value: "inactive" as const,
    label: "Nonaktif",
    count: data.value.filter((studio) => !studio.is_active).length,
  },
]);

const emptyText = computed(() =>
  data.value.length
    ? "Tidak ada studio yang cocok dengan filter."
    : "Belum ada studio. Tambah studio pertama kamu.",
);

function applyStatusFilter(
  table: {
    getColumn: (id: string) => { setFilterValue: (value: unknown) => void } | undefined;
  },
  value: StatusFilter,
) {
  statusFilter.value = value;
  table
    .getColumn("is_active")
    ?.setFilterValue(value === "all" ? undefined : value === "active");
}

/* ---------------------------------- Actions ---------------------------------- */

function openEdit(studio: Studio) {
  editingStudio.value = studio;
  formOpen.value = true;
}

function openCreate() {
  editingStudio.value = null;
  formOpen.value = true;
}

function openPricing(studio: Studio) {
  pricingStudio.value = studio;
  pricingOpen.value = true;
}

async function handleCreated() {
  await loadStudios();
}

async function handleUpdated() {
  await loadStudios();
}

async function toggleActive(studio: Studio) {
  const nextActive = !studio.is_active;
  const toastId = appToast.loading(
    `${nextActive ? "Mengaktifkan" : "Menonaktifkan"} studio "${studio.name}"...`,
    {
      description: "Status studio sedang diperbarui.",
    },
  );
  const result = await executeUpdateStudioStatus({
    id: studio.id,
    isActive: nextActive,
  });
  if (result.error) {
    appToast.error(`Status studio "${studio.name}" gagal diperbarui`, {
      id: toastId,
      description:
        result.error.message || "Periksa koneksi internet, lalu coba kembali.",
    });
    return;
  }
  appToast.success(
    `Studio "${studio.name}" berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}`,
    {
      id: toastId,
      description: `Studio kini ${nextActive ? "aktif" : "nonaktif"} dan statusnya telah diperbarui.`,
    },
  );
  await loadStudios();
}

async function removeStudio(studio: Studio) {
  if (
    deletingStudioId.value ||
    !window.confirm(`Hapus studio "${studio.name}"?`)
  )
    return;
  deletingStudioId.value = studio.id;
  const toastId = appToast.loading(`Menghapus studio "${studio.name}"...`, {
    description: "Data studio sedang dihapus dari sistem.",
  });
  try {
    const result = await executeDeleteStudio({ id: studio.id });
    if (result.error || !result.data?.deleteStudio?.id) {
      throw new Error(result.error?.message ?? "Studio gagal dihapus.");
    }
    appToast.success(`Studio "${studio.name}" berhasil dihapus`, {
      id: toastId,
      description: "Data studio dan konfigurasi terkait telah dihapus.",
    });
    await loadStudios();
  } catch (error) {
    appToast.error(`Studio "${studio.name}" gagal dihapus`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba hapus kembali.",
    });
  } finally {
    deletingStudioId.value = null;
  }
}

// Bulk delete — logic confirm/toast/loop/refresh sudah standar di
// useBulkDelete, di sini cukup didefinisikan cara hapus SATU studio.
const { isDeleting: isBulkDeleting, bulkDelete } = useBulkDelete<Studio>({
  entityName: "studio",
  getLabel: (studio) => studio.name,
  deleteOne: async (studio) => {
    const result = await executeDeleteStudio({ id: studio.id });
    if (result.error || !result.data?.deleteStudio?.id) {
      throw new Error(
        result.error?.message ?? `Studio "${studio.name}" gagal dihapus.`,
      );
    }
  },
  onSettled: async () => {
    await loadStudios();
  },
});

async function handleBulkDelete(studios: Studio[]) {
  await bulkDelete(studios, () =>
    dataTableRef.value?.table.resetRowSelection(),
  );
}

async function handleReorder(reordered: Studio[]) {
  if (isReordering.value) return;

  // Urutan hanya aman diubah saat semua studio terlihat.
  if (statusFilter.value !== "all") {
    appToast.error("Urutan tidak bisa diubah saat filter aktif", {
      description: "Pilih tab Semua dulu, lalu geser studio.",
    });
    await loadStudios();
    return;
  }

  const toastId = appToast.loading("Menyimpan urutan studio...", {
    description: "Urutan tampilan studio sedang diperbarui.",
  });
  const previous = data.value;
  const next = reordered.map((studio, index) => ({
    ...studio,
    sort_order: index,
  }));
  data.value = next;

  const result = await persistReorder({
    items: next.map(({ id, sort_order }) => ({ id, sort_order })),
  });
  if (result.error) {
    data.value = previous;
    appToast.error("Urutan studio gagal disimpan", {
      id: toastId,
      description:
        result.error.message || "Periksa koneksi internet, lalu coba kembali.",
    });
    return;
  }
  appToast.success("Urutan studio berhasil disimpan", {
    id: toastId,
    description: "Urutan tampilan studio telah diperbarui.",
  });
}

/* ---------------------------------- Kolom tabel ---------------------------------- */

// Pencarian di toolbar mencakup nama dan kode studio.
function searchStudio(row: Row<Studio>, _columnId: string, value: unknown) {
  const term = String(value ?? "").trim().toLocaleLowerCase("id-ID");
  if (!term) return true;
  const studio = row.original;
  return [studio.name, studio.code]
    .join(" ")
    .toLocaleLowerCase("id-ID")
    .includes(term);
}

// Pola semua sel: baris utama (jelas) + baris keterangan (redup).
const CELL = "space-y-0.5 pr-4";

const columnHelper = createColumnHelper<Studio>();
const columns: ColumnDef<Studio, any>[] = [
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
          title: "Geser untuk mengubah urutan tampil",
          "aria-label": "Geser studio",
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
        "onUpdate:modelValue": (v: boolean | "indeterminate") =>
          table.toggleAllPageRowsSelected(v === true),
        onClick: (e: Event) => e.stopPropagation(),
      }),
    cell: ({ row }) =>
      h(Checkbox as any, {
        modelValue: row.getIsSelected(),
        "onUpdate:modelValue": (v: boolean | "indeterminate") =>
          row.toggleSelected(v === true),
        onClick: (e: Event) => e.stopPropagation(),
      }),
    enableSorting: false,
    enableHiding: false,
  }),

  // Studio: thumbnail, nama, kode (deskripsi muncul saat nama di-hover)
  columnHelper.accessor("name", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Studio" }),
    cell: ({ row }) => {
      const studio = row.original;
      const thumbnail = studio.thumbnail_url
        ? h("img", {
            src: studio.thumbnail_url,
            alt: `Thumbnail ${studio.name}`,
            class: "size-12 shrink-0 rounded-lg border object-cover",
          })
        : h(
            "div",
            {
              class:
                "flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground",
              "aria-hidden": "true",
            },
            [h(IconPhoto, { class: "size-5 opacity-60" })],
          );

      return h(
        "div",
        {
          class: [
            "flex min-w-[160px] items-center gap-3 pr-4",
            !studio.is_active && "opacity-60",
          ],
        },
        [
          thumbnail,
          h("div", { class: "min-w-0 space-y-0.5" }, [
            h(
              "p",
              {
                class: "max-w-[190px] truncate text-sm font-semibold text-foreground",
                title: studio.description ?? studio.name,
              },
              studio.name,
            ),
            h("p", { class: "font-mono text-xs text-muted-foreground" }, studio.code),
          ]),
        ],
      );
    },
    filterFn: searchStudio,
  }),

  // Kapasitas: jumlah orang, lalu ukuran ruangan
  columnHelper.accessor((studio) => studio.capacity ?? 0, {
    id: "capacity",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Kapasitas" }),
    cell: ({ row }) => {
      const studio = row.original;
      const lines = [
        studio.capacity ? `${studio.capacity} orang` : null,
        studio.size_sqm ? `${studio.size_sqm} m²` : null,
      ].filter((line): line is string => Boolean(line));

      if (!lines.length) {
        return h("div", { class: `min-w-[120px] ${CELL}` }, [
          h("p", { class: "text-sm text-muted-foreground" }, "Belum diisi"),
        ]);
      }
      return h(
        "div",
        { class: [`min-w-[120px] flex items-center justify-start gap-2 ${CELL}`, !studio.is_active && "opacity-60"] },
        [
          h("p", { class: "text-sm text-foreground" }, lines[0]),
          lines[1]
            ? h("p", { class: "text-xs text-muted-foreground" }, lines[1])
            : null,
        ],
      );
    },
  }),

  // Harga: tarif termurah, lalu jumlah pilihan durasi
  columnHelper.accessor((studio) => cheapestTier(studio)?.price ?? 0, {
    id: "price",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Harga" }),
    cell: ({ row }) => {
      const studio = row.original;
      const cheapest = cheapestTier(studio);

      if (!cheapest) {
        return h("div", { class: `min-w-[150px] ${CELL}` }, [
          h(
            "p",
            { class: "text-sm font-medium text-amber-600 dark:text-amber-400" },
            "Belum ada harga",
          ),
          h("p", { class: "text-xs text-muted-foreground" }, "Atur lewat menu aksi"),
        ]);
      }
      return h(
        "div",
        { class: [`min-w-[150px] ${CELL}`, !studio.is_active && "opacity-60"] },
        [
          h("p", { class: "text-sm tabular-nums text-foreground" }, [
            h("span", { class: "text-muted-foreground" }, "Mulai "),
            h("span", { class: "font-semibold" }, `Rp ${formatCurrency(cheapest.price)}`),
          ]),
          h(
            "p",
            { class: "text-xs text-muted-foreground" },
            `${studio.pricing_tiers.length} pilihan durasi`,
          ),
        ],
      );
    },
  }),

  // Status
  columnHelper.accessor("is_active", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Status" }),
    cell: ({ getValue }) => {
      const active = getValue() as boolean;
      return h("div", { class: `min-w-[110px] ${CELL}` }, [
        h(
          "span",
          {
            class: `inline-flex items-center gap-1.5 text-sm font-medium ${
              active
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            }`,
          },
          [
            h("span", {
              class: `size-1.5 rounded-full ${
                active ? "bg-emerald-500" : "bg-muted-foreground/60"
              }`,
            }),
            active ? "Aktif" : "Nonaktif",
          ],
        ),
      ]);
    },
    filterFn: "equals",
  }),

  // Diperbarui: waktu relatif, lalu tanggal
  columnHelper.accessor("modtime", {
    id: "audit",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Diperbarui" }),
    cell: ({ row }) => {
      const studio = row.original;
      const tooltip = [
        `Dibuat ${formatFullDate(studio.cretime)}`,
        `Diperbarui ${formatFullDate(studio.modtime)}`,
      ].join("\n");
      return h("div", { class: `min-w-[120px] ${CELL}`, title: tooltip }, [
        h("p", { class: "text-sm text-foreground" }, formatRelative(studio.modtime)),
        h(
          "p",
          { class: "text-xs text-muted-foreground" },
          formatShortDate(studio.modtime),
        ),
      ]);
    },
  }),

  columnHelper.display({
    id: "actions",
    cell: ({ row }) => {
      const studio = row.original;
      const actions: DataTableRowAction<Studio>[] = [
        {
          label: "Edit Studio",
          icon: IconEdit,
          onSelect: (item) => openEdit(item),
        },
        {
          label: "Atur harga",
          icon: IconCurrencyDollar,
          onSelect: (item) => openPricing(item),
        },
        {
          label: studio.is_active ? "Nonaktifkan" : "Aktifkan",
          icon: IconPower,
          separator: true,
          onSelect: (item) => toggleActive(item),
        },
        {
          label: "Hapus",
          icon: IconTrash,
          destructive: true,
          onSelect: (item) => removeStudio(item),
        },
      ];
      return h(DataTableRowActions as any, { row: studio, actions });
    },
    enableHiding: false,
  }),
];

const columnLabels = {
  name: "Studio",
  capacity: "Kapasitas",
  price: "Harga",
  is_active: "Status",
  audit: "Diperbarui",
};
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Studio</h1>
      <p class="text-sm text-muted-foreground">
        Kelola studio, harga sewa, dan urutan tampil.
      </p>
    </div>

    <div
      v-if="loadError"
      class="rounded-md border border-destructive/40 p-4 text-sm text-destructive"
    >
      Gagal memuat data studio. Coba muat ulang halaman.
    </div>

    <DataTable
      ref="dataTableRef"
      :columns="columns"
      :data="data"
      :loading="loading"
      :get-row-id="(studio) => studio.id"
      enable-row-reorder
      :empty-text="emptyText"
      @reorder="handleReorder"
    >
      <template #toolbar="{ table }">
        <div class="space-y-4">
          <div
            role="tablist"
            aria-label="Filter status studio"
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
            search-placeholder="Cari nama atau kode studio..."
            :column-labels="columnLabels"
            create-label="Tambah studio"
            :deleting="isBulkDeleting"
            @create="openCreate"
            @bulk-delete="handleBulkDelete"
          />
        </div>
      </template>
    </DataTable>

    <CreateStudioDialog
      v-if="!editingStudio"
      v-model:open="formOpen"
      @created="handleCreated"
    />
    <EditStudioDialog
      v-else
      v-model:open="formOpen"
      :studio="editingStudio"
      @updated="handleUpdated"
    />
    <PricingTierDialog
      v-if="pricingStudio"
      v-model:open="pricingOpen"
      :studio-id="pricingStudio.id"
      :studio-name="pricingStudio.name"
      :pricing-tiers="pricingStudio.pricing_tiers"
      @changed="loadStudios"
    />
  </div>
</template>