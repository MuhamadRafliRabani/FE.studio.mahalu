<script setup lang="ts" generic="TData">
// components/data-table/DataTableViewOptions.vue
import type { Table } from "@tanstack/vue-table";
import {
  IconChevronDown,
  IconLayoutColumns,
  IconPlus,
} from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const props = defineProps<{
  table: Table<TData>;
  /** Map opsional id kolom -> label yang enak dibaca, mis. { created_at: 'Tanggal Booking' } */
  columnLabels?: Record<string, string>;
  createLabel?: string;
}>();

const emit = defineEmits<{
  (event: "create"): void;
}>();

function labelFor(id: string) {
  return props.columnLabels?.[id] ?? id;
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="sm">
        <IconLayoutColumns />
        <span class="hidden lg:inline">Kolom</span>
        <IconChevronDown />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <DropdownMenuLabel>Tampilkan kolom</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        v-for="column in table.getAllColumns().filter((c) => c.getCanHide())"
        :key="column.id"
        :model-value="column.getIsVisible()"
        @update:model-value="(value) => column.toggleVisibility(!!value)"
      >
        {{ labelFor(column.id) }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
  <Button
    v-if="createLabel"
    variant="default"
    size="sm"
    @click="emit('create')"
  >
    <IconPlus />
    <span>{{ createLabel }}</span>
  </Button>
</template>
