// composables/useDataTable.ts
//
// Inti dari sistem DataTable. Semua state (sorting, filter, pagination, dst)
// dikelola di sini, di luar komponen — jadi bisa diakses dari luar
// (misal: baca `table.pagination` untuk sinkron ke URL query params),
// dan komponen DataTable.vue tinggal "bodoh" (dumb), hanya merender.
//
// Kenapa begini? Best practice-nya, logic table dipisah dari markup table,
// supaya:
// 1. Bisa dites tanpa mount komponen Vue.
// 2. Bisa dipakai ulang di tempat yang butuh tabelnya tapi UI beda (mis. versi mobile).
// 3. Gampang di-extend (tinggal tambah opsi baru di sini, semua DataTable dapat manfaatnya).

import { ref, type Ref } from "vue";
import {
  useVueTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type PaginationState,
} from "@tanstack/vue-table";

export interface UseDataTableOptions<TData> {
  /** Data mentah. Boleh Ref<TData[]> atau getter function (untuk computed). */
  data: Ref<TData[]> | (() => TData[]);
  columns: ColumnDef<TData, any>[];
  getRowId?: (row: TData, index: number) => string;

  initialPageSize?: number;
  initialSorting?: SortingState;

  /**
   * Set true kalau sorting/filter/pagination dikerjakan di BACKEND
   * (misal query ke Laravel API dengan ?page=&sort=&search=).
   * Kalau true, table TIDAK akan memotong/mengurutkan data sendiri —
   * dia percaya data yang kamu kasih sudah benar untuk halaman saat ini.
   */
  manual?: {
    pagination?: boolean;
    sorting?: boolean;
    filtering?: boolean;
    /** Wajib diisi kalau manual.pagination = true */
    pageCount?: Ref<number> | number;
  };

  // Callback opsional — berguna untuk manual/server-side mode, supaya kamu
  // tahu kapan harus fetch ulang data dari API.
  onPaginationChange?: (pagination: PaginationState) => void;
  onSortingChange?: (sorting: SortingState) => void;
  onGlobalFilterChange?: (value: string) => void;
}

export function useDataTable<TData>(options: UseDataTableOptions<TData>) {
  const sorting = ref<SortingState>(options.initialSorting ?? []);
  const columnFilters = ref<ColumnFiltersState>([]);
  const columnVisibility = ref<VisibilityState>({});
  const rowSelection = ref<RowSelectionState>({});
  const globalFilter = ref("");
  const pagination = ref<PaginationState>({
    pageIndex: 0,
    pageSize: options.initialPageSize ?? 10,
  });

  const manualPagination = options.manual?.pagination ?? false;
  const manualSorting = options.manual?.sorting ?? false;
  const manualFiltering = options.manual?.filtering ?? false;

  const table = useVueTable({
    get data() {
      return typeof options.data === "function"
        ? options.data()
        : options.data.value;
    },
    columns: options.columns,
    getRowId: options.getRowId,

    state: {
      get sorting() {
        return sorting.value;
      },
      get columnFilters() {
        return columnFilters.value;
      },
      get columnVisibility() {
        return columnVisibility.value;
      },
      get rowSelection() {
        return rowSelection.value;
      },
      get globalFilter() {
        return globalFilter.value;
      },
      get pagination() {
        return pagination.value;
      },
    },

    manualPagination,
    manualSorting,
    manualFiltering,
    pageCount: manualPagination
      ? ((typeof options.manual?.pageCount === "number"
          ? options.manual.pageCount
          : options.manual?.pageCount?.value) ?? -1)
      : undefined,

    onSortingChange: (updater) => {
      sorting.value =
        typeof updater === "function" ? updater(sorting.value) : updater;
      options.onSortingChange?.(sorting.value);
    },
    onColumnFiltersChange: (updater) => {
      columnFilters.value =
        typeof updater === "function" ? updater(columnFilters.value) : updater;
    },
    onColumnVisibilityChange: (updater) => {
      columnVisibility.value =
        typeof updater === "function"
          ? updater(columnVisibility.value)
          : updater;
    },
    onRowSelectionChange: (updater) => {
      rowSelection.value =
        typeof updater === "function" ? updater(rowSelection.value) : updater;
    },
    onGlobalFilterChange: (updater) => {
      globalFilter.value =
        typeof updater === "function" ? updater(globalFilter.value) : updater;
      options.onGlobalFilterChange?.(globalFilter.value);
    },
    onPaginationChange: (updater) => {
      pagination.value =
        typeof updater === "function" ? updater(pagination.value) : updater;
      options.onPaginationChange?.(pagination.value);
    },

    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination
      ? undefined
      : getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return {
    table,
    // di-expose kalau kamu butuh baca/tulis state langsung dari luar
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection,
    globalFilter,
    pagination,
  };
}
