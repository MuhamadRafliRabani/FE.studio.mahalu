<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import {
  createColumnHelper,
  type ColumnDef,
  type Row,
} from "@tanstack/vue-table";
import { useMutation, useQuery } from "villus";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  IconEdit,
  IconGripVertical,
  IconPhoto,
  IconPower,
  IconSelector,
  IconTrash,
  IconUsers,
} from "@tabler/icons-vue";
import DataTable from "@/components/data-table/DataTable.vue";
import DataTableColumnHeader from "@/components/data-table/DataTableColumnHeader.vue";
import DataTableRowActions from "@/components/data-table/DataTableRowActions.vue";
import DataTableToolbar from "@/components/data-table/DataTableToolbar.vue";
import type { DataTableRowAction } from "@/components/data-table/types";
import { useBulkDelete } from "@/composables/useBulkDelete";
import CreateResourceDialog from "~/components/resources/CreateResourceDialog.vue";
import EditResourceDialog from "~/components/resources/EditResourceDialog.vue";
import { appToast } from "@/lib/toast";

type Studio = {
  id: string;
  name: string;
  code: string;
  thumbnail_url: string | null;
};
type Resource = {
  id: string;
  code: string;
  name: string;
  addon: { id: string; name: string; studios: Studio[] };
  is_active: boolean;
  sort_order: number;
  cretime: string;
  modtime: string;
};
type StatusFilter = "all" | "active" | "inactive";
type ResourceTable = {
  getColumn: (
    id: string,
  ) =>
    | {
        setFilterValue: (value: unknown) => void;
        getFilterValue: () => unknown;
      }
    | undefined;
};

const RESOURCES_QUERY = `query { resources { id code name is_active sort_order cretime modtime addon { id name studios { id name code thumbnail_url } } } }`;
const REORDER_RESOURCES = `mutation ($items: [ReorderInput!]!) { reorderResources(items: $items) { id sort_order } }`;
const DELETE_RESOURCE = `mutation ($id: ID!) { deleteResource(id: $id) { id } }`;
const UPDATE_RESOURCE_STATUS = `mutation ($id: ID!, $isActive: Boolean!) { updateResource(id: $id, is_active: $isActive) { id is_active } }`;

const data = ref<Resource[]>([]);
const {
  data: resourcesResult,
  execute: loadResources,
  error: loadError,
  isFetching: loading,
} = useQuery({ query: RESOURCES_QUERY });
const { execute: persistReorder, isFetching: isReordering } =
  useMutation(REORDER_RESOURCES);
const { execute: executeDeleteResource } = useMutation(DELETE_RESOURCE);
const { execute: executeUpdateResourceStatus } = useMutation(
  UPDATE_RESOURCE_STATUS,
);
watch(
  () => resourcesResult.value?.resources,
  (resources) => {
    data.value = [...(resources ?? [])].sort(
      (a: Resource, b: Resource) => a.sort_order - b.sort_order,
    );
  },
  { immediate: true },
);

const formOpen = ref(false);
const editingResource = ref<Resource | null>(null);
const deletingResourceId = ref<string | null>(null);

/* ---------------------------------- Helpers ---------------------------------- */

const RTF = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
function formatRelative(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (Math.abs(days) < 1) return "Hari ini";
  if (Math.abs(days) < 30) return RTF.format(days, "day");
  return RTF.format(Math.round(days / 30), "month");
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
    count: data.value.filter((resource) => resource.is_active).length,
  },
  {
    value: "inactive" as const,
    label: "Nonaktif",
    count: data.value.filter((resource) => !resource.is_active).length,
  },
]);

const addonFilterOptions = computed(() => {
  const addons = new Map<
    string,
    { id: string; name: string; resourceCount: number }
  >();

  for (const resource of data.value) {
    const addon = addons.get(resource.addon.id);
    if (addon) {
      addon.resourceCount += 1;
    } else {
      addons.set(resource.addon.id, {
        id: resource.addon.id,
        name: resource.addon.name,
        resourceCount: 1,
      });
    }
  }

  return [...addons.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "id"),
  );
});

const studioFilterOptions = computed(() => {
  const studios = new Map<
    string,
    { id: string; name: string; code: string; resourceCount: number }
  >();

  for (const resource of data.value) {
    for (const studio of resource.addon.studios) {
      const existing = studios.get(studio.id);
      if (existing) {
        existing.resourceCount += 1;
      } else {
        studios.set(studio.id, {
          id: studio.id,
          name: studio.name,
          code: studio.code,
          resourceCount: 1,
        });
      }
    }
  }

  return [...studios.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "id"),
  );
});

const emptyText = computed(() =>
  data.value.length
    ? "Tidak ada resource yang cocok dengan filter."
    : "Belum ada resource. Tambah resource pertama kamu.",
);

function applyStatusFilter(
  table: ResourceTable,
  value: StatusFilter,
) {
  table
    .getColumn("is_active")
    ?.setFilterValue(value === "all" ? undefined : value === "active");
}

function isStatusFilterSelected(table: ResourceTable, value: StatusFilter) {
  const filterValue = table.getColumn("is_active")?.getFilterValue();
  if (value === "all") return filterValue === undefined;
  return filterValue === (value === "active");
}

function applyAddonFilter(table: ResourceTable, event: Event) {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;

  table.getColumn("addon")?.setFilterValue(select.value || undefined);
}

function selectedStudioIds(table: ResourceTable): string[] {
  const value = table.getColumn("studios")?.getFilterValue();
  return Array.isArray(value) ? value.map(String) : [];
}

function toggleStudioFilter(
  table: ResourceTable,
  studioId: string,
  selected: boolean | "indeterminate",
) {
  const studioIds = new Set(selectedStudioIds(table));
  if (selected === true) {
    studioIds.add(studioId);
  } else {
    studioIds.delete(studioId);
  }

  const next = [...studioIds];
  table.getColumn("studios")?.setFilterValue(next.length ? next : undefined);
}

/* ---------------------------------- Actions ---------------------------------- */

function openCreate() {
  editingResource.value = null;
  formOpen.value = true;
}
function openEdit(resource: Resource) {
  editingResource.value = resource;
  formOpen.value = true;
}
async function refresh() {
  await loadResources();
}

async function toggleActive(resource: Resource) {
  const nextActive = !resource.is_active;
  const toastId = appToast.loading(
    `${nextActive ? "Mengaktifkan" : "Menonaktifkan"} resource "${resource.name}"...`,
    {
      description: "Status resource sedang diperbarui.",
    },
  );
  const result = await executeUpdateResourceStatus({
    id: resource.id,
    isActive: nextActive,
  });
  if (result.error) {
    appToast.error(`Status resource "${resource.name}" gagal diperbarui`, {
      id: toastId,
      description:
        result.error.message || "Periksa koneksi internet, lalu coba kembali.",
    });
    return;
  }
  appToast.success(
    `Resource "${resource.name}" berhasil ${nextActive ? "diaktifkan" : "dinonaktifkan"}`,
    {
      id: toastId,
      description: `Resource kini ${nextActive ? "aktif" : "nonaktif"} dan statusnya telah diperbarui.`,
    },
  );
  await refresh();
}

async function removeResource(resource: Resource) {
  if (
    deletingResourceId.value ||
    !window.confirm(`Hapus resource "${resource.name}"?`)
  )
    return;
  deletingResourceId.value = resource.id;
  const toastId = appToast.loading(`Menghapus resource "${resource.name}"...`, {
    description: "Data resource sedang dihapus dari sistem.",
  });
  try {
    const result = await executeDeleteResource({ id: resource.id });
    if (result.error || !result.data?.deleteResource?.id)
      throw new Error(result.error?.message ?? "Resource gagal dihapus.");
    appToast.success(`Resource "${resource.name}" berhasil dihapus`, {
      id: toastId,
      description: "Data resource telah dihapus permanen dari sistem.",
    });
    await refresh();
  } catch (error) {
    appToast.error(`Resource "${resource.name}" gagal dihapus`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba hapus kembali.",
    });
  } finally {
    deletingResourceId.value = null;
  }
}

const { isDeleting: isBulkDeleting, bulkDelete } = useBulkDelete<Resource>({
  entityName: "resource",
  getLabel: (resource) => resource.name,
  deleteOne: async (resource) => {
    const result = await executeDeleteResource({ id: resource.id });
    if (result.error || !result.data?.deleteResource?.id) {
      throw new Error(
        result.error?.message ?? `Resource "${resource.name}" gagal dihapus.`,
      );
    }
  },
  onSettled: async () => {
    await refresh();
  },
});

async function handleBulkDelete(
  resources: Resource[],
  table?: {
    resetRowSelection?: () => void;
  },
) {
  await bulkDelete(resources, () => table?.resetRowSelection?.());
}

async function handleReorder(reordered: Resource[]) {
  if (isReordering.value) return;

  const previous = data.value;
  const next = reordered.map((resource, index) => ({
    ...resource,
    sort_order: index,
  }));
  data.value = next;
  const toastId = appToast.loading("Menyimpan urutan resource...", {
    description: "Urutan tampilan resource sedang diperbarui.",
  });
  const result = await persistReorder({
    items: next.map(({ id, sort_order }) => ({ id, sort_order })),
  });
  if (result.error) {
    data.value = previous;
    appToast.error("Urutan resource gagal disimpan", {
      id: toastId,
      description:
        result.error.message || "Periksa koneksi internet, lalu coba kembali.",
    });
    return;
  }
  appToast.success("Urutan resource berhasil disimpan", {
    id: toastId,
    description: "Urutan tampilan resource telah diperbarui.",
  });
}

/* ---------------------------------- Kolom tabel ---------------------------------- */

// Pencarian di toolbar mencakup resource, kode, addon, serta nama dan kode studio.
function searchResource(row: Row<Resource>, _columnId: string, value: unknown) {
  const term = String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID");
  if (!term) return true;
  const resource = row.original;
  return [
    resource.name,
    resource.code,
    resource.addon.name,
    ...resource.addon.studios.flatMap((studio) => [studio.name, studio.code]),
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
        {
          class:
            "max-w-[150px] truncate text-sm font-medium leading-tight text-foreground",
        },
        studio.name,
      ),
      h("p", { class: "font-mono text-xs text-muted-foreground" }, studio.code),
    ]),
  ]);
}

const columnHelper = createColumnHelper<Resource>();
const columns: ColumnDef<Resource, any>[] = [
  columnHelper.display({
    id: "drag",
    header: "",
    cell: () =>
      h(
        "button",
        {
          type: "button",
          class:
            "drag-handle cursor-grab touch-none p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground active:cursor-grabbing",
          title: "Geser untuk mengubah urutan tampil",
          "aria-label": "Geser resource",
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

  // Resource: ikon, nama, kode
  columnHelper.accessor("name", {
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Resource" }),
    cell: ({ row }) => {
      const resource = row.original;
      return h(
        "div",
        {
          class: [
            "flex min-w-[210px] items-center gap-3 pr-4",
            !resource.is_active && "opacity-60",
          ],
        },
        [
          h(
            "div",
            {
              class:
                "flex size-12 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400",
              "aria-hidden": "true",
            },
            [h(IconUsers, { class: "size-5" })],
          ),
          h("div", { class: "min-w-0 space-y-0.5" }, [
            h(
              "p",
              {
                class:
                  "max-w-[170px] truncate text-sm font-semibold text-foreground",
              },
              resource.name,
            ),
            h(
              "p",
              { class: "font-mono text-xs text-muted-foreground" },
              resource.code,
            ),
          ]),
        ],
      );
    },
    filterFn: searchResource,
  }),

  // Addon: nama addon, lalu jumlah studio yang memakainya
  columnHelper.accessor((resource) => resource.addon.name, {
    id: "addon",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Addon" }),
    cell: ({ row }) => {
      const resource = row.original;
      const total = resource.addon.studios.length;
      return h(
        "div",
        {
          class: [`min-w-[150px] ${CELL}`, !resource.is_active && "opacity-60"],
        },
        [
          h(
            "p",
            { class: "truncate text-sm font-medium text-foreground" },
            resource.addon.name,
          ),
          h(
            "p",
            { class: "text-xs text-muted-foreground" },
            total ? `Dipakai di ${total} studio` : "Belum dipakai studio",
          ),
        ],
      );
    },
    filterFn: (row, _columnId, filterValue) =>
      row.original.addon.id === String(filterValue),
  }),

  // Studio berlaku: thumbnail + nama + kode (maks 2, sisanya diringkas)
  columnHelper.accessor((resource) => resource.addon.studios.length, {
    id: "studios",
    header: ({ column }) =>
      h(DataTableColumnHeader as any, { column, title: "Studio berlaku" }),
    cell: ({ row }) => {
      const resource = row.original;
      const studios = resource.addon.studios;
      if (!studios.length) {
        return h("div", { class: `min-w-[200px] ${CELL}` }, [
          h(
            "p",
            { class: "text-sm font-medium text-amber-600 dark:text-amber-400" },
            "Belum ada studio",
          ),
          h(
            "p",
            { class: "text-xs text-muted-foreground" },
            "Atur lewat addon terkait",
          ),
        ]);
      }
      const visible = studios.slice(0, 2);
      const extra = studios.length - visible.length;
      return h(
        "div",
        {
          class: [
            "min-w-[200px] space-y-2 pr-4",
            !resource.is_active && "opacity-60",
          ],
          title: studios
            .map((studio) => `${studio.name} (${studio.code})`)
            .join("\n"),
        },
        [
          ...visible.map(studioItem),
          extra > 0
            ? h(
                "p",
                { class: "text-xs text-muted-foreground" },
                `+${extra} studio lainnya`,
              )
            : null,
        ],
      );
    },
    filterFn: (row, _columnId, filterValue) => {
      if (!Array.isArray(filterValue) || !filterValue.length) return true;
      const selectedIds = filterValue.map(String);
      return row.original.addon.studios.some((studio) =>
        selectedIds.includes(studio.id),
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
      const resource = row.original;
      return h(
        "div",
        {
          class: `min-w-[120px] ${CELL}`,
          title: `Dibuat ${formatFullDate(resource.cretime)}\nDiperbarui ${formatFullDate(resource.modtime)}`,
        },
        [
          h(
            "p",
            { class: "text-sm text-foreground" },
            formatRelative(resource.modtime),
          ),
          h(
            "p",
            { class: "text-xs text-muted-foreground" },
            formatShortDate(resource.modtime),
          ),
        ],
      );
    },
  }),

  columnHelper.display({
    id: "actions",
    cell: ({ row }) => {
      const resource = row.original;
      const actions: DataTableRowAction<Resource>[] = [
        { label: "Edit resource", icon: IconEdit, onSelect: openEdit },
        {
          label: resource.is_active ? "Nonaktifkan" : "Aktifkan",
          icon: IconPower,
          separator: true,
          onSelect: toggleActive,
        },
        {
          label: "Hapus",
          icon: IconTrash,
          destructive: true,
          onSelect: removeResource,
        },
      ];
      return h(DataTableRowActions as any, { row: resource, actions });
    },
    enableHiding: false,
  }),
];

const columnLabels = {
  name: "Resource",
  addon: "Addon",
  studios: "Studio berlaku",
  is_active: "Status",
  audit: "Diperbarui",
};
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-6 p-6 md:p-10">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Resources</h1>
      <p class="text-sm text-muted-foreground">
        Kelola tim dan sumber daya untuk setiap addon, serta urutan tampilnya.
      </p>
    </div>

    <div
      v-if="loadError"
      class="rounded-md border border-destructive/40 p-4 text-sm text-destructive"
    >
      Gagal memuat resource. Coba muat ulang halaman.
    </div>

    <DataTable
      :columns="columns"
      :data="data"
      :loading="loading"
      :get-row-id="(resource) => resource.id"
      enable-row-reorder
      :empty-text="emptyText"
      @reorder="handleReorder"
    >
      <template #toolbar="{ table }">
        <div class="space-y-4">
          <div
            role="tablist"
            aria-label="Filter status resource"
            class="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1"
          >
            <button
              v-for="tab in statusTabs"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="isStatusFilterSelected(table, tab.value)"
              class="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :class="
                isStatusFilterSelected(table, tab.value)
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
            search-placeholder="Cari resource, addon, atau studio..."
            :column-labels="columnLabels"
            create-label="Tambah resource"
            @create="openCreate"
            @bulk-delete="(rows) => handleBulkDelete(rows, table)"
          >
            <template #filters="{ table: filterTable }">
              <div class="flex flex-wrap items-center gap-2">
                <select
                  :value="filterTable.getColumn('addon')?.getFilterValue() ?? ''"
                  aria-label="Filter resource berdasarkan addon"
                  class="h-8 w-[180px] rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  @change="applyAddonFilter(filterTable, $event)"
                >
                  <option value="">Semua addon</option>
                  <option
                    v-for="addon in addonFilterOptions"
                    :key="addon.id"
                    :value="addon.id"
                  >
                    {{ addon.name }} ({{ addon.resourceCount }})
                  </option>
                </select>

                <Popover>
                  <PopoverTrigger as-child>
                    <Button
                      type="button"
                      variant="outline"
                      class="h-8 w-[180px] justify-between font-normal"
                      aria-label="Filter resource berdasarkan studio"
                    >
                      <span class="truncate">
                        {{
                          selectedStudioIds(filterTable).length
                            ? `${selectedStudioIds(filterTable).length} studio dipilih`
                            : "Semua studio"
                        }}
                      </span>
                      <IconSelector class="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" class="w-64 p-3">
                    <div class="mb-2">
                      <p class="text-sm font-medium">Filter studio</p>
                      <p class="text-xs text-muted-foreground">
                        Tampilkan resource yang tersedia di studio mana pun yang dipilih.
                      </p>
                    </div>
                    <div
                      v-if="studioFilterOptions.length"
                      class="max-h-60 space-y-1 overflow-y-auto"
                    >
                      <label
                        v-for="studio in studioFilterOptions"
                        :key="studio.id"
                        class="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                      >
                        <Checkbox
                          :model-value="
                            selectedStudioIds(filterTable).includes(studio.id)
                          "
                          class="mt-0.5"
                          @update:model-value="
                            toggleStudioFilter(filterTable, studio.id, $event)
                          "
                        />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm">{{ studio.name }}</span>
                          <span class="text-xs text-muted-foreground">
                            {{ studio.code }} · {{ studio.resourceCount }} resource
                          </span>
                        </span>
                      </label>
                    </div>
                    <p v-else class="py-4 text-center text-sm text-muted-foreground">
                      Belum ada studio yang terkait dengan resource.
                    </p>
                    <Button
                      v-if="selectedStudioIds(filterTable).length"
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="mt-2 h-8 w-full"
                      @click="filterTable.getColumn('studios')?.setFilterValue(undefined)"
                    >
                      Hapus pilihan studio
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
            </template>
          </DataTableToolbar>
        </div>
      </template>
    </DataTable>

    <CreateResourceDialog
      v-if="!editingResource"
      v-model:open="formOpen"
      @created="refresh"
    />
    <EditResourceDialog
      v-else
      v-model:open="formOpen"
      :resource="editingResource"
      @updated="refresh"
    />
  </div>
</template>
