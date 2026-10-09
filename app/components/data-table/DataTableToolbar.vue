<script setup lang="ts" generic="TData">
// components/data-table/DataTableToolbar.vue
//
// Toolbar generik: search box + slot buat filter custom (status, tanggal,
// ruangan, dst — beda-beda tiap tabel) + tombol reset + view options kolom.
// Taruh komponen ini di dalam slot #toolbar milik <DataTable>.
//
// Tombol "Hapus" bulk muncul otomatis di sebelah tombol create begitu ada
// row yang di-select (pakai checkbox column yang sudah ada di tiap tabel).
// Komponen ini cuma tanggung jawab nampilin tombolnya & ngasih tau parent
// row mana aja yang dipilih lewat event `bulkDelete` — logic hapusnya
// (biasanya lewat composable useBulkDelete) jadi urusan parent, dioper
// balik ke sini lewat prop `deleting` supaya tombolnya bisa nunjukin
// status loading & gak bisa diklik dobel.

import { IconLoader2, IconTrash, IconX } from "@tabler/icons-vue";
import type { Table } from "@tanstack/vue-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DataTableViewOptions from "./DataTableViewOptions.vue";

const props = defineProps<{
  table: Table<TData>;
  searchPlaceholder?: string;
  columnLabels?: Record<string, string>;
  createLabel?: string;
  /** True selagi bulk delete sedang berjalan — tombol Hapus jadi disabled + spinner. */
  deleting?: boolean;
}>();

const emit = defineEmits<{
  (event: "create"): void;
  (event: "bulkDelete", rows: TData[]): void;
}>();

const isFiltered = () =>
  props.table.getState().columnFilters.length > 0 ||
  !!props.table.getState().globalFilter;

const selectedRows = () =>
  props.table.getFilteredSelectedRowModel().rows.map((row) => row.original);
const selectedCount = () =>
  props.table.getFilteredSelectedRowModel().rows.length;
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <Input
        :model-value="table.getState().globalFilter ?? ''"
        :placeholder="searchPlaceholder ?? 'Cari...'"
        class="h-8 w-[180px] lg:w-[250px]"
        @update:model-value="(v) => table.setGlobalFilter(v)"
      />

      <!-- Taruh <DataTableFacetFilter> atau filter custom lain di sini -->
      <slot name="filters" :table="table" />

      <Button
        v-if="isFiltered()"
        variant="ghost"
        size="sm"
        class="h-8 px-2 lg:px-3"
        @click="
          () => {
            table.resetColumnFilters();
            table.setGlobalFilter('');
          }
        "
      >
        Reset
        <IconX class="ml-2 h-4 w-4" />
      </Button>
    </div>

    <div class="flex items-center gap-2">
      <!-- Muncul cuma pas ada row terpilih, ditaruh persis di sebelah
           tombol create (dari DataTableViewOptions) biar aksesnya
           seamless begitu user selesai select. -->
      <Button
        v-if="selectedCount() > 0"
        variant="destructive"
        size="sm"
        class="h-8"
        :disabled="deleting"
        @click="emit('bulkDelete', selectedRows())"
      >
        <IconLoader2 v-if="deleting" class="mr-2 size-4 animate-spin" />
        <IconTrash v-else class="mr-2 size-4" />
        Hapus ({{ selectedCount() }})
      </Button>

      <slot name="actions" :table="table" />
      <DataTableViewOptions
        :table="table"
        :column-labels="columnLabels"
        :create-label="createLabel"
        @create="emit('create')"
      />
    </div>
  </div>
</template>
