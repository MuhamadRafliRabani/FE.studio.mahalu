<script setup lang="ts" generic="TData">
// components/data-table/DataTableRowActions.vue
//
// Dropdown aksi per-baris yang di-drive oleh config array, BUKAN hardcoded
// "Edit / Duplicate / Favorite / Delete" seperti contoh aslinya.
// Ini kuncinya supaya komponen ini reusable lintas tabel (booking, customer,
// invoice, dll) — setiap tabel tinggal kasih daftar actions-nya sendiri.
//
// Support submenu: isi `children` pada action, maka dirender sebagai
// DropdownMenuSub (muncul ke kanan saat hover, dengan caret).

import { IconDotsVertical } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DataTableRowAction } from "./types";

const props = defineProps<{
  row: TData;
  actions: DataTableRowAction<TData>[];
}>();

const isDisabled = (action: DataTableRowAction<TData>) =>
  action.disabled?.(props.row) ?? false;

// Submenu ikut disabled kalau parent-nya disabled atau semua child-nya disabled
const isSubDisabled = (action: DataTableRowAction<TData>) =>
  isDisabled(action) ||
  (action.children?.every((child) => isDisabled(child)) ?? false);
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="h-8 w-8 p-0" @click.stop>
        <span class="sr-only">Buka menu</span>
        <IconDotsVertical class="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44">
      <template v-for="(action, i) in actions" :key="i">
        <DropdownMenuSeparator v-if="action.separator" />

        <!-- Action dengan submenu -->
        <DropdownMenuSub v-if="action.children?.length">
          <DropdownMenuSubTrigger :disabled="isSubDisabled(action)">
            <component
              :is="action.icon"
              v-if="action.icon"
              class="mr-2 h-4 w-4"
            />
            {{ action.label }}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent class="w-44">
            <DropdownMenuItem
              v-for="(child, j) in action.children"
              :key="j"
              :disabled="isDisabled(child)"
              :class="
                child.destructive
                  ? 'text-destructive focus:text-destructive'
                  : undefined
              "
              @click="child.onSelect?.(row)"
            >
              <component
                :is="child.icon"
                v-if="child.icon"
                class="mr-2 h-4 w-4"
              />
              {{ child.label }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <!-- Action biasa -->
        <DropdownMenuItem
          v-else
          :disabled="isDisabled(action)"
          :class="
            action.destructive
              ? 'text-destructive focus:text-destructive'
              : undefined
          "
          @click="action.onSelect?.(row)"
        >
          <component
            :is="action.icon"
            v-if="action.icon"
            class="mr-2 h-4 w-4"
          />
          {{ action.label }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
