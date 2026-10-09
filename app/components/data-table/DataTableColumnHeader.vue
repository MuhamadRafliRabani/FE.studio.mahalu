<script setup lang="ts" generic="TData">
// components/data-table/DataTableColumnHeader.vue
//
// Header kolom dengan tombol sort (asc/desc) + opsi hide, mengikuti pola
// resmi shadcn-vue data-table. Dipakai di setiap kolom yang bisa di-sort.

import type { Column } from "@tanstack/vue-table";
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsUpDown,
  IconEyeOff,
} from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

defineProps<{
  column: Column<TData, unknown>;
  title: string;
}>();
</script>

<template>
  <div v-if="!column.getCanSort()" class="text-sm font-medium">
    {{ title }}
  </div>
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="-ml-3 h-8 data-[state=open]:bg-accent"
      >
        <span>{{ title }}</span>
        <IconArrowDown
          v-if="column.getIsSorted() === 'desc'"
          class="ml-2 h-4 w-4"
        />
        <IconArrowUp
          v-else-if="column.getIsSorted() === 'asc'"
          class="ml-2 h-4 w-4"
        />
        <IconArrowsUpDown
          v-else
          class="ml-2 h-4 w-4 text-muted-foreground/70"
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuItem @click="column.toggleSorting(false)">
        <IconArrowUp class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
        Urutkan Naik
      </DropdownMenuItem>
      <DropdownMenuItem @click="column.toggleSorting(true)">
        <IconArrowDown class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
        Urutkan Turun
      </DropdownMenuItem>
      <DropdownMenuSeparator v-if="column.getCanHide()" />
      <DropdownMenuItem
        v-if="column.getCanHide()"
        @click="column.toggleVisibility(false)"
      >
        <IconEyeOff class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
        Sembunyikan
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
