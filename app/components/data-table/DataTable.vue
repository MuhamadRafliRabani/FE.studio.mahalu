<script setup lang="ts" generic="TData, TValue">
// components/data-table/DataTable.vue

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Column, ColumnDef } from "@tanstack/vue-table";
import { FlexRender } from "@tanstack/vue-table";
import VueDraggable from "vuedraggable";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDataTable } from "@/composables/useDataTable";
import DataTableMobileCard from "./DataTableMobileCard.vue";
import DataTablePagination from "./DataTablePagination.vue";

type MobileMeta = { mobileLabel?: string; mobileHidden?: boolean };

const props = withDefaults(
  defineProps<{
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    loading?: boolean;
    emptyText?: string;
    enableRowReorder?: boolean;
    getRowId?: (row: TData, index: number) => string;
    pageSizeOptions?: number[];
    stickyHeader?: boolean;
    showSelectionCount?: boolean;
    manual?: {
      pagination?: boolean;
      sorting?: boolean;
      filtering?: boolean;
      pageCount?: number;
    };
  }>(),
  {
    loading: false,
    emptyText: "Tidak ada data.",
    enableRowReorder: false,
    pageSizeOptions: () => [10, 20, 30, 40, 50],
    stickyHeader: true,
    showSelectionCount: true,
  },
);

const emit = defineEmits<{
  (e: "reorder", newData: TData[]): void;
  (e: "rowClick", row: TData): void;
  (
    e: "paginationChange",
    pagination: { pageIndex: number; pageSize: number },
  ): void;
  (e: "sortingChange", sorting: unknown): void;
}>();

const { table } = useDataTable<TData>({
  data: () => props.data,
  columns: props.columns,
  getRowId: props.getRowId,
  initialPageSize: props.pageSizeOptions[0],
  manual: props.manual,
  onPaginationChange: (p) => emit("paginationChange", p),
  onSortingChange: (s) => emit("sortingChange", s),
});

// --- Mode mobile: tabel berubah jadi kartu di bawah 768px (breakpoint md) ---

const MOBILE_QUERY = "(max-width: 767px)";
const isMobile = ref(false);
let mediaQuery: MediaQueryList | null = null;

function syncIsMobile() {
  isMobile.value = mediaQuery?.matches ?? false;
}

onMounted(() => {
  mediaQuery = window.matchMedia(MOBILE_QUERY);
  syncIsMobile();
  mediaQuery.addEventListener("change", syncIsMobile);
});

onBeforeUnmount(() => {
  mediaQuery?.removeEventListener("change", syncIsMobile);
});

// Label kartu diambil otomatis dari judul header kolom. Bisa ditimpa per kolom
// lewat `meta: { mobileLabel: "..." }`, dan disembunyikan lewat `meta: { mobileHidden: true }`.
function resolveColumnLabel(column: Column<TData, unknown>): string {
  const meta = column.columnDef.meta as MobileMeta | undefined;
  if (meta?.mobileLabel) return meta.mobileLabel;

  const header = column.columnDef.header;
  if (typeof header === "string" && header) return header;

  if (typeof header === "function") {
    const headerItem = table
      .getFlatHeaders()
      .find((item) => item.column.id === column.id);
    if (headerItem) {
      try {
        const node = (header as (context: unknown) => unknown)(
          headerItem.getContext(),
        ) as { props?: { title?: unknown } } | null;
        if (typeof node?.props?.title === "string") return node.props.title;
      } catch {
        // abaikan, pakai id kolom sebagai cadangan
      }
    }
  }
  return column.id;
}

const mobileLabels = computed<Record<string, string>>(() => {
  const labels: Record<string, string> = {};
  for (const column of table.getAllLeafColumns()) {
    labels[column.id] = resolveColumnLabel(column);
  }
  return labels;
});

const hasSelectColumn = computed(() => Boolean(table.getColumn("select")));

const pageSelectedState = computed(
  () =>
    table.getIsAllPageRowsSelected() ||
    (table.getIsSomePageRowsSelected() && "indeterminate"),
);

// Urutkan lewat <select> bawaan: paling nyaman di layar sentuh.
const sortOptions = computed(() =>
  table
    .getAllLeafColumns()
    .filter((column) => column.getCanSort())
    .flatMap((column) => {
      const label = mobileLabels.value[column.id] ?? column.id;
      return [
        { value: `${column.id}:asc`, label: `${label} (naik)` },
        { value: `${column.id}:desc`, label: `${label} (turun)` },
      ];
    }),
);

const sortValue = computed(() => {
  const current = table.getState().sorting[0];
  return current ? `${current.id}:${current.desc ? "desc" : "asc"}` : "";
});

function onSortChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (!value) {
    table.setSorting([]);
    return;
  }
  const [id, direction] = value.split(":");
  if (!id) return;
  table.setSorting([{ id, desc: direction === "desc" }]);
}

// --- Row reorder (vuedraggable / SortableJS) ---

// Reorder cuma boleh aktif tanpa sorting, filter kolom, atau pencarian —
// kalau tidak, urutan drag pada subset data bisa menimpa urutan data asli.
const canReorder = computed(
  () =>
    props.enableRowReorder &&
    table.getState().sorting.length === 0 &&
    table.getState().columnFilters.length === 0 &&
    !table.getState().globalFilter?.trim(),
);

const localOrder = ref<string[]>([]);

watch(
  () => table.getRowModel().rows,
  (rows) => {
    localOrder.value = rows.map((r) => r.id);
  },
  { immediate: true },
);

function handleDragEnd() {
  // Susun ulang data asli (TData[]) sesuai urutan id terbaru,
  // lalu emit ke parent — parent yang urus persist ke backend.
  const reordered = localOrder.value
    .map((id) => table.getRow(id)?.original)
    .filter((item): item is TData => item !== undefined);

  emit("reorder", reordered);
}

defineExpose({ table });
</script>

<template>
  <div class="flex flex-col gap-4">
    <slot name="toolbar" :table="table" />

    <!-- ============ MOBILE: kartu per baris ============ -->
    <div v-if="isMobile" class="flex flex-col gap-3">
      <!-- Pilih semua + urutkan -->
      <div
        v-if="hasSelectColumn || sortOptions.length"
        class="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
      >
        <div v-if="hasSelectColumn" class="flex items-center gap-2">
          <Checkbox
            :model-value="pageSelectedState"
            aria-label="Pilih semua baris di halaman ini"
            @update:model-value="
              (value: boolean | 'indeterminate') =>
                table.toggleAllPageRowsSelected(value === true)
            "
          />
          <span class="text-sm text-muted-foreground">Pilih semua</span>
        </div>

        <select
          v-if="sortOptions.length"
          :value="sortValue"
          aria-label="Urutkan data"
          class="h-8 min-w-0 max-w-[60%] truncate rounded-md border bg-background px-2 text-sm"
          @change="onSortChange"
        >
          <option value="">Urutan default</option>
          <option
            v-for="option in sortOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </div>

      <!-- Loading skeleton -->
      <template v-if="loading">
        <div
          v-for="i in 3"
          :key="`mobile-skeleton-${i}`"
          class="space-y-3 rounded-xl border bg-card p-4"
        >
          <div class="h-10 w-2/3 animate-pulse rounded bg-muted" />
          <div class="h-4 w-full animate-pulse rounded bg-muted" />
          <div class="h-4 w-5/6 animate-pulse rounded bg-muted" />
          <div class="h-4 w-4/6 animate-pulse rounded bg-muted" />
        </div>
      </template>

      <!-- Drag-and-drop aktif: geser lewat handle di judul kartu -->
      <VueDraggable
        v-else-if="canReorder && table.getRowModel().rows.length"
        v-model="localOrder"
        tag="div"
        class="flex flex-col gap-3"
        :item-key="(id: string) => id"
        handle=".drag-handle"
        :animation="150"
        :delay="150"
        :delay-on-touch-only="true"
        :force-fallback="true"
        ghost-class="opacity-40"
        @end="handleDragEnd"
      >
        <template #item="{ element: rowId }">
          <DataTableMobileCard
            :row="table.getRow(rowId)"
            :labels="mobileLabels"
            show-drag
            @row-click="(item) => emit('rowClick', item)"
          />
        </template>
      </VueDraggable>

      <!-- Mode normal -->
      <template v-else-if="table.getRowModel().rows.length">
        <DataTableMobileCard
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :row="row"
          :labels="mobileLabels"
          @row-click="(item) => emit('rowClick', item)"
        />
      </template>

      <!-- Empty state -->
      <div
        v-else
        class="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
      >
        {{ emptyText }}
      </div>
    </div>

    <!-- ============ DESKTOP: tabel ============ -->
    <div v-else class="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader :class="['bg-muted', stickyHeader && 'sticky top-0 z-9']">
          <TableRow
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
          >
            <TableHead
              v-for="header in headerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan"
            >
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </TableHead>
          </TableRow>
        </TableHeader>

        <!-- Loading skeleton -->
        <TableBody v-if="loading">
          <TableRow v-for="i in 5" :key="`skeleton-${i}`">
            <TableCell v-for="col in table.getAllLeafColumns()" :key="col.id">
              <div class="h-4 w-full animate-pulse rounded bg-muted" />
            </TableCell>
          </TableRow>
        </TableBody>

        <!-- Mode drag-and-drop aktif -->
        <VueDraggable
          v-else-if="canReorder && table.getRowModel().rows.length"
          v-model="localOrder"
          tag="tbody"
          :item-key="(id: string) => id"
          handle=".drag-handle"
          :animation="150"
          :delay="150"
          :delay-on-touch-only="true"
          :force-fallback="true"
          ghost-class="opacity-40"
          @end="handleDragEnd"
        >
          <template #item="{ element: rowId }">
            <TableRow :key="rowId">
              <TableCell
                v-for="cell in table.getRow(rowId).getVisibleCells()"
                :key="cell.id"
              >
                <FlexRender
                  :render="cell.column.columnDef.cell"
                  :props="cell.getContext()"
                />
              </TableCell>
            </TableRow>
          </template>
        </VueDraggable>

        <!-- Mode normal (tanpa reorder, atau sedang di-sort/filter) -->
        <TableBody v-else-if="table.getRowModel().rows.length">
          <TableRow
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :data-state="row.getIsSelected() ? 'selected' : undefined"
            class="cursor-pointer"
            @click="emit('rowClick', row.original)"
          >
            <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender
                :render="cell.column.columnDef.cell"
                :props="cell.getContext()"
              />
            </TableCell>
          </TableRow>
        </TableBody>

        <!-- Empty state -->
        <TableBody v-else>
          <TableRow>
            <TableCell
              :colspan="table.getAllLeafColumns().length"
              class="h-24 text-center text-muted-foreground"
            >
              {{ emptyText }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <DataTablePagination
      :table="table"
      :page-size-options="pageSizeOptions"
      :show-selection-count="showSelectionCount"
    />
  </div>
</template>
