<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import {
  createColumnHelper,
  type ColumnDef,
  type Row,
} from "@tanstack/vue-table";
import { useMutation, useQuery } from "villus";
import { Checkbox } from "@/components/ui/checkbox";
import { IconEdit, IconPhoto, IconTrash } from "@tabler/icons-vue";
import DataTable from "@/components/data-table/DataTable.vue";
import DataTableColumnHeader from "@/components/data-table/DataTableColumnHeader.vue";
import DataTableRowActions from "@/components/data-table/DataTableRowActions.vue";
import DataTableToolbar from "@/components/data-table/DataTableToolbar.vue";
import type { DataTableRowAction } from "@/components/data-table/types";
import { useBulkDelete } from "@/composables/useBulkDelete";
import CreateAddonDialog from "~/components/addons/CreateAddonDialog.vue";
import EditAddonDialog from "~/components/addons/EditAddonDialog.vue";
import { appToast } from "@/lib/toast";
import { formatDuration } from "@/utils/formatDuration";
import { resolveAddonIcon } from "@/utils/addonIcons";

type Studio = {
  id: string;
  name: string;
  code: string;
  thumbnail_url: string | null;
};
type AddonPrice = { id: string; duration_minutes: number; price: number };
type Addon = {
  id: string;
  name: string;
  icon: string | null;
  pricing_type: "per_tier" | "flat";
  flat_price: number | null;
  studios: Studio[];
  resources: { id: string }[];
  prices: AddonPrice[];
};
type AddonStatus = "ready" | "incomplete";
type StatusFilter = "all" | AddonStatus;

const ADDONS_QUERY = `query { addons { id name icon pricing_type flat_price studios { id name code thumbnail_url } resources { id } prices { id duration_minutes price } } }`;
const DELETE_ADDON = `mutation ($id: ID!) { deleteAddon(id: $id) { id } }`;
const {
  data: addonsResult,
  execute: loadAddons,
  error: loadError,
  isFetching: loading,
} = useQuery({ query: ADDONS_QUERY });
const { execute: deleteAddon } = useMutation(DELETE_ADDON);
const data = ref<Addon[]>([]);
const statusFilter = ref<StatusFilter>("all");
watch(
  () => addonsResult.value?.addons,
  (addons) => {
    data.value = [...(addons ?? [])];
  },
  { immediate: true },
);

const formOpen = ref(false);
const editingAddon = ref<Addon | null>(null);
const deletingId = ref<string | null>(null);
function openCreate() {
  editingAddon.value = null;
  formOpen.value = true;
}
function openEdit(addon: Addon) {
  editingAddon.value = addon;
  formOpen.value = true;
}
async function refresh() {
  await loadAddons();
}

/* ---------------------------------- Helpers ---------------------------------- */

function formatCurrency(value: number): string {
  return value.toLocaleString("id-ID");
}

// Harga dianggap siap jika flat punya nominal, atau per durasi punya minimal satu tarif.
function statusOf(addon: Addon): AddonStatus {
  if (addon.pricing_type === "flat") {
    return addon.flat_price !== null ? "ready" : "incomplete";
  }
  return addon.prices.length > 0 ? "ready" : "incomplete";
}

function cheapestPrice(addon: Addon): number | null {
  if (!addon.prices.length) return null;
  return Math.min(...addon.prices.map((price) => price.price));
}

function priceTooltip(addon: Addon): string | undefined {
  if (addon.pricing_type !== "per_tier" || !addon.prices.length) return undefined;
  return [...addon.prices]
    .sort((left, right) => left.duration_minutes - right.duration_minutes)
    .map(
      (price) =>
        `${formatDuration(price.duration_minutes)}: Rp ${formatCurrency(price.price)}`,
    )
    .join("\n");
}

/* ---------------------------------- Filter status ---------------------------------- */

const statusTabs = computed(() => {
  const count = (status: AddonStatus) =>
    data.value.filter((addon) => statusOf(addon) === status).length;
  return [
    { value: "all" as const, label: "Semua", count: data.value.length },
    { value: "ready" as const, label: "Siap", count: count("ready") },
    { value: "incomplete" as const, label: "Perlu diatur", count: count("incomplete") },
  ];
});

const emptyText = computed(() =>
  data.value.length
    ? "Tidak ada addon yang cocok dengan filter."
    : "Belum ada addon. Tambah addon pertama kamu.",
);

function applyStatusFilter(
  table: {
    getColumn: (id: string) => { setFilterValue: (value: unknown) => void } | undefined;
  },
  value: StatusFilter,
) {
  statusFilter.value = value;
  table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
}

/* ---------------------------------- Actions ---------------------------------- */

async function removeAddon(addon: Addon) {
  if (deletingId.value || !window.confirm(`Hapus addon "${addon.name}"?`))
    return;
  deletingId.value = addon.id;
  const toastId = appToast.loading(`Menghapus addon "${addon.name}"...`, {
    description: "Data addon sedang dihapus dari sistem.",
  });
  try {
    const result = await deleteAddon({ id: addon.id });
    if (result.error || !result.data?.deleteAddon?.id)
      throw new Error(result.error?.message ?? "Addon gagal dihapus.");
    appToast.success(`Addon "${addon.name}" berhasil dihapus`, {
      id: toastId,
      description: "Data addon dan konfigurasi terkait telah dihapus.",
    });
    await refresh();
  } catch (error) {
    appToast.error(`Addon "${addon.name}" gagal dihapus`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba hapus kembali.",
    });
  } finally {
    deletingId.value = null;
  }
}

const { isDeleting: isBulkDeleting, bulkDelete } = useBulkDelete<Addon>({
  entityName: "addon",
  getLabel: (addon) => addon.name,
  deleteOne: async (addon) => {
    const result = await deleteAddon({ id: addon.id });
    if (result.error || !result.data?.deleteAddon?.id) {
      throw new Error(
        result.error?.message ?? `Addon "${addon.name}" gagal dihapus.`,
      );
    }
  },
  onSettled: async () => {
    await refresh();
  },
});

async function handleBulkDelete(
  addons: Addon[],
  table?: {
    resetRowSelection?: () => void;
  },
) {
  await bulkDelete(addons, () => table?.resetRowSelection?.());
}

/* ---------------------------------- Kolom tabel ---------------------------------- */

// Pencarian di toolbar mencakup nama addon, serta nama dan kode studio.
function searchAddon(row: Row<Addon>, _columnId: string, value: unknown) {
  const term = String(value ?? "").trim().toLocaleLowerCase("id-ID");
  if (!term) return true;
  const addon = row.original;
  return [
    addon.name,
    ...addon.studios.flatMap((studio) => [studio.name, studio.code]),
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID")
    .includes(term);
}

// Pola semua sel: baris utama (jelas) + baris keterangan (redup).
const CELL = "space-y-0.5 pr-4";

function studioItem(studio: Studio) {
  const thumbnail = studio.thumbnail_url
    ? h("img", {
        src: studio.thumbnail_url,
        alt: `Thumbnail ${studio.name}`,
        class: "size-9 shrink-0 rounded-md border object-cover",
      })
    : h(
        "div",
        {
          class:
            "flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground",
          "aria-hidden": "true",
        },
        [h(IconPhoto, { class: "size-4 opacity-60" })],
      );

  return h("div", { key: studio.id, class: "flex items-center gap-2.5" }, [
    thumbnail,
    h("div", { class: "min-w-0" }, [
      h(
        "p",
        { class: "max-w-[150px] truncate text-sm font-medium leading-tight text-foreground" },
        studio.name,
      ),
      h("p", { class: "font-mono text-xs text-muted-foreground" }, studio.code),
    ]),
  ]);
}

const columnHelper = createColumnHelper<Addon>();
const columns: ColumnDef<Addon, any>[] = [
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

  // Addon: inisial, nama, tipe harga
  columnHelper.accessor("name", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Addon" }),
    cell: ({ row }) => {
      const addon = row.original;
      return h("div", { class: "flex min-w-[210px] items-center gap-3 pr-4" }, [
        h(
          "div",
          {
            class:
              "flex size-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400",
            "aria-hidden": true,
          },
          [h(resolveAddonIcon(addon.icon), { class: "size-6" })],
        ),
        h("div", { class: "min-w-0 space-y-0.5" }, [
          h(
            "p",
            { class: "max-w-[170px] truncate text-sm font-semibold text-foreground" },
            addon.name,
          ),
          h(
            "p",
            { class: "text-xs text-muted-foreground" },
            addon.pricing_type === "flat" ? "Harga tetap" : "Harga per durasi",
          ),
        ]),
      ]);
    },
    filterFn: searchAddon,
  }),

  // Studio berlaku: thumbnail + nama + kode (maks 2, sisanya diringkas)
  columnHelper.accessor((addon) => addon.studios.length, {
    id: "studios",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Studio berlaku" }),
    cell: ({ row }) => {
      const addon = row.original;
      if (!addon.studios.length) {
        return h("div", { class: `min-w-[200px] ${CELL}` }, [
          h(
            "p",
            { class: "text-sm font-medium text-amber-600 dark:text-amber-400" },
            "Belum dipilih",
          ),
          h("p", { class: "text-xs text-muted-foreground" }, "Atur lewat menu edit"),
        ]);
      }
      const visible = addon.studios.slice(0, 2);
      const extra = addon.studios.length - visible.length;
      return h(
        "div",
        {
          class: "min-w-[200px] space-y-2 pr-4",
          title: addon.studios
            .map((studio) => `${studio.name} (${studio.code})`)
            .join("\n"),
        },
        [
          ...visible.map(studioItem),
          extra > 0
            ? h("p", { class: "text-xs text-muted-foreground" }, `+${extra} studio lainnya`)
            : null,
        ],
      );
    },
    filterFn: searchAddon,
  }),

  // Harga: nominal (flat) atau tarif termurah (per durasi)
  columnHelper.accessor(
    (addon) =>
      addon.pricing_type === "flat" ? (addon.flat_price ?? 0) : (cheapestPrice(addon) ?? 0),
    {
      id: "price",
      header: ({ column }) =>
        h(DataTableColumnHeader as any, { column, title: "Harga" }),
      cell: ({ row }) => {
        const addon = row.original;

        if (addon.pricing_type === "flat") {
          if (addon.flat_price === null) {
            return h("div", { class: `min-w-[150px] ${CELL}` }, [
              h(
                "p",
                { class: "text-sm font-medium text-amber-600 dark:text-amber-400" },
                "Belum diatur",
              ),
              h("p", { class: "text-xs text-muted-foreground" }, "Isi harga di menu edit"),
            ]);
          }
          return h("div", { class: `min-w-[150px] ${CELL}` }, [
            h(
              "p",
              { class: "text-sm font-semibold tabular-nums text-foreground" },
              `Rp ${formatCurrency(addon.flat_price)}`,
            ),
          ]);
        }

        const cheapest = cheapestPrice(addon);
        if (cheapest === null) {
          return h("div", { class: `min-w-[150px] ${CELL}` }, [
            h(
              "p",
              { class: "text-sm font-medium text-amber-600 dark:text-amber-400" },
              "Belum diatur",
            ),
            h("p", { class: "text-xs text-muted-foreground" }, "Tambah tarif di menu edit"),
          ]);
        }
        return h("div", { class: `min-w-[150px] ${CELL}`, title: priceTooltip(addon) }, [
          h("p", { class: "text-sm tabular-nums text-foreground" }, [
            h("span", { class: "text-muted-foreground" }, "Mulai "),
            h("span", { class: "font-semibold" }, `Rp ${formatCurrency(cheapest)}`),
          ]),
          h(
            "p",
            { class: "text-xs text-muted-foreground" },
            `${addon.prices.length} pilihan durasi`,
          ),
        ]);
      },
    },
  ),

  // Resource
  columnHelper.accessor((addon) => addon.resources.length, {
    id: "resources",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Resource" }),
    cell: ({ row }) => {
      const total = row.original.resources.length;
      return h("div", { class: `min-w-[100px] ${CELL}` }, [
        h(
          "p",
          {
            class: total
              ? "text-sm text-foreground"
              : "text-sm text-muted-foreground",
          },
          total ? `${total} orang` : "Tanpa resource",
        ),
      ]);
    },
  }),

  // Konfigurasi harga
  columnHelper.accessor((addon) => statusOf(addon), {
    id: "status",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Konfigurasi" }),
    cell: ({ row }) => {
      const ready = statusOf(row.original) === "ready";
      return h("div", { class: `min-w-[140px] ${CELL}` }, [
        h(
          "span",
          {
            class: `inline-flex items-center gap-1.5 text-sm font-medium ${
              ready
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`,
          },
          [
            h("span", {
              class: `size-1.5 rounded-full ${ready ? "bg-emerald-500" : "bg-amber-500"}`,
            }),
            ready ? "Siap" : "Harga belum diatur",
          ],
        ),
      ]);
    },
    filterFn: "equals",
  }),

  columnHelper.display({
    id: "actions",
    cell: ({ row }) => {
      const addon = row.original;
      const actions: DataTableRowAction<Addon>[] = [
        { label: "Edit addon", icon: IconEdit, onSelect: openEdit },
        {
          label: "Hapus",
          icon: IconTrash,
          separator: true,
          destructive: true,
          onSelect: removeAddon,
        },
      ];
      return h(DataTableRowActions as any, { row: addon, actions });
    },
    enableHiding: false,
  }),
];

const columnLabels = {
  name: "Addon",
  studios: "Studio berlaku",
  price: "Harga",
  resources: "Resource",
  status: "Konfigurasi",
};
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Addon</h1>
      <p class="text-sm text-muted-foreground">
        Kelola layanan tambahan, harga, dan studio yang memakainya.
      </p>
    </div>

    <div
      v-if="loadError"
      class="rounded-md border border-destructive/40 p-4 text-sm text-destructive"
    >
      Gagal memuat addon. Coba muat ulang halaman.
    </div>

    <DataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :get-row-id="(addon) => addon.id"
      :empty-text="emptyText"
    >
      <template #toolbar="{ table }">
        <div class="space-y-4">
          <div
            role="tablist"
            aria-label="Filter konfigurasi addon"
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
            search-placeholder="Cari addon, studio, atau kode..."
            :column-labels="columnLabels"
            create-label="Tambah addon"
            @create="openCreate"
            @bulk-delete="(rows) => handleBulkDelete(rows, table)"
          />
        </div>
      </template>
    </DataTable>

    <CreateAddonDialog
      v-if="!editingAddon"
      v-model:open="formOpen"
      @saved="refresh"
    />
    <EditAddonDialog
      v-else
      v-model:open="formOpen"
      :addon="editingAddon"
      @saved="refresh"
    />
  </div>
</template>