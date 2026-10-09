<script setup lang="ts" generic="TData">
// components/data-table/DataTablePagination.vue
import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-vue";
import type { Table } from "@tanstack/vue-table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

withDefaults(
  defineProps<{
    table: Table<TData>;
    pageSizeOptions?: number[];
    /** Tampilkan info "n dari m baris dipilih" — matikan kalau row selection tidak dipakai */
    showSelectionCount?: boolean;
  }>(),
  {
    pageSizeOptions: () => [10, 20, 30, 40, 50],
    showSelectionCount: true,
  },
);
</script>

<template>
  <div class="flex items-center justify-between px-1">
    <div
      v-if="showSelectionCount"
      class="text-muted-foreground hidden flex-1 text-sm lg:flex"
    >
      {{ table.getFilteredSelectedRowModel().rows.length }} dari
      {{ table.getFilteredRowModel().rows.length }} baris dipilih.
    </div>
    <div class="flex w-full items-center gap-8 lg:w-fit">
      <div class="hidden items-center gap-2 lg:flex">
        <Label class="text-sm font-medium">Baris per halaman</Label>
        <Select
          :model-value="`${table.getState().pagination.pageSize}`"
          @update:model-value="(value) => table.setPageSize(Number(value))"
        >
          <SelectTrigger size="sm" class="w-20">
            <SelectValue
              :placeholder="`${table.getState().pagination.pageSize}`"
            />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem
              v-for="size in pageSizeOptions"
              :key="size"
              :value="`${size}`"
            >
              {{ size }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex w-fit items-center justify-center text-sm font-medium">
        Halaman {{ table.getState().pagination.pageIndex + 1 }} dari
        {{ Math.max(table.getPageCount(), 1) }}
      </div>
      <div class="ml-auto flex items-center gap-2 lg:ml-0">
        <Button
          variant="outline"
          size="icon"
          class="hidden h-8 w-8 lg:flex"
          :disabled="!table.getCanPreviousPage()"
          @click="table.setPageIndex(0)"
        >
          <span class="sr-only">Ke halaman pertama</span>
          <IconChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!table.getCanPreviousPage()"
          @click="table.previousPage()"
        >
          <span class="sr-only">Sebelumnya</span>
          <IconChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="size-8"
          :disabled="!table.getCanNextPage()"
          @click="table.nextPage()"
        >
          <span class="sr-only">Selanjutnya</span>
          <IconChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="hidden size-8 lg:flex"
          :disabled="!table.getCanNextPage()"
          @click="table.setPageIndex(table.getPageCount() - 1)"
        >
          <span class="sr-only">Ke halaman terakhir</span>
          <IconChevronsRight />
        </Button>
      </div>
    </div>
  </div>
</template>
