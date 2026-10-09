<script setup lang="ts" generic="TData">
import { computed } from "vue";
import { FlexRender, type Row } from "@tanstack/vue-table";

type MobileMeta = { mobileLabel?: string; mobileHidden?: boolean };

const props = defineProps<{
  row: Row<TData>;
  // id kolom -> label yang tampil di sisi kiri
  labels: Record<string, string>;
  // tampilkan handle drag (hanya saat reorder aktif)
  showDrag?: boolean;
}>();

const emit = defineEmits<{ (e: "rowClick", row: TData): void }>();

// Kolom sistem punya posisi tetap di kartu, bukan baris label-nilai.
const SYSTEM_COLUMNS = new Set(["drag", "select", "actions"]);

const parts = computed(() => {
  const cells = props.row.getVisibleCells();
  const byId = (id: string) => cells.find((cell) => cell.column.id === id);
  const content = cells.filter(
    (cell) =>
      !SYSTEM_COLUMNS.has(cell.column.id) &&
      !(cell.column.columnDef.meta as MobileMeta | undefined)?.mobileHidden,
  );

  return {
    drag: props.showDrag ? byId("drag") : undefined,
    select: byId("select"),
    actions: byId("actions"),
    // Kolom pertama jadi judul kartu, sisanya jadi baris label-nilai.
    primary: content[0],
    rest: content.slice(1),
  };
});
</script>

<template>
  <article
    class="overflow-hidden rounded-xl border bg-card shadow-sm transition-colors"
    :class="row.getIsSelected() && 'border-primary/50 bg-primary/5'"
    :data-state="row.getIsSelected() ? 'selected' : undefined"
    @click="emit('rowClick', row.original)"
  >
    <!-- Judul kartu: drag, checkbox, isi utama, menu aksi -->
    <header
      class="flex items-start gap-3 px-4 py-3"
      :class="parts.rest.length && 'border-b'"
    >
      <div v-if="parts.drag" class="-ml-1 shrink-0 pt-0.5">
        <FlexRender
          :render="parts.drag.column.columnDef.cell"
          :props="parts.drag.getContext()"
        />
      </div>

      <div v-if="parts.select" class="shrink-0 pt-1">
        <FlexRender
          :render="parts.select.column.columnDef.cell"
          :props="parts.select.getContext()"
        />
      </div>

      <div
        v-if="parts.primary"
        class="min-w-0 flex-1 [&>*]:min-w-0! [&>*]:pr-0!"
      >
        <FlexRender
          :render="parts.primary.column.columnDef.cell"
          :props="parts.primary.getContext()"
        />
      </div>

      <div v-if="parts.actions" class="-mr-2 shrink-0">
        <FlexRender
          :render="parts.actions.column.columnDef.cell"
          :props="parts.actions.getContext()"
        />
      </div>
    </header>

    <!-- Baris label (kiri) dan nilai (kanan) -->
    <dl v-if="parts.rest.length" class="divide-y">
      <div
        v-for="cell in parts.rest"
        :key="cell.id"
        class="flex items-start justify-between gap-4 px-4 py-3"
      >
        <dt
          class="w-24 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {{ labels[cell.column.id] ?? cell.column.id }}
        </dt>
        <dd
          class="min-w-0 flex-1 text-right text-sm [&>*]:min-w-0! [&>*]:max-w-full! [&>*]:pr-0! [&_.flex]:justify-end"
        >
          <FlexRender
            :render="cell.column.columnDef.cell"
            :props="cell.getContext()"
          />
        </dd>
      </div>
    </dl>
  </article>
</template>
