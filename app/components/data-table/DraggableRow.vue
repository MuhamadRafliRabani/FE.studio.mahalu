<script setup lang="ts" generic="TData">
// components/data-table/DraggableRow.vue
//
// Sengaja pakai native HTML5 Drag & Drop API (draggable="true" + events),
// BUKAN library seperti dnd-kit-vue.
//
// KENAPA: dnd-kit-vue (dan @dnd-kit/abstract) di source aslinya masih
// package yang sangat baru/niche untuk Vue — risiko maintenance & breaking
// change tinggi untuk komponen "standar" produksi. Native drag API browser
// sudah stabil, zero dependency tambahan, dan cukup untuk kebutuhan reorder
// baris tabel admin. Kalau nanti butuh animasi yang lebih halus (mis. drag
// antar list terpisah, touch-friendly di mobile), baru pertimbangkan ganti
// ke `vuedraggable` (wrapper SortableJS) — itu pilihan yang jauh lebih
// matang & banyak dipakai di ekosistem Vue dibanding dnd-kit-vue.

import { ref } from "vue";
import type { Row } from "@tanstack/vue-table";
import { FlexRender } from "@tanstack/vue-table";
import { TableCell, TableRow } from "@/components/ui/table";

const props = defineProps<{
  row: Row<TData>;
  isDragging?: boolean;
}>();

const emit = defineEmits<{
  (e: "dragstart", event: DragEvent): void;
  (e: "dragover", event: DragEvent): void;
  (e: "drop", event: DragEvent): void;
  (e: "dragend"): void;
  (e: "rowClick", row: TData): void;
}>();
</script>

<template>
  <TableRow
    draggable="true"
    :data-state="row.getIsSelected() ? 'selected' : undefined"
    :class="[isDragging && 'opacity-50', 'cursor-pointer']"
    @dragstart="emit('dragstart', $event)"
    @dragover.prevent="emit('dragover', $event)"
    @drop.prevent="emit('drop', $event)"
    @dragend="emit('dragend')"
    @click="emit('rowClick', row.original)"
  >
    <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
      <FlexRender
        :render="cell.column.columnDef.cell"
        :props="cell.getContext()"
      />
    </TableCell>
  </TableRow>
</template>
