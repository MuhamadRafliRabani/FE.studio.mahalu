<script setup lang="ts">
// components/data-table/DragHandle.vue
import { IconGripVertical } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
</script>

<template>
  <Button
    variant="ghost"
    size="icon"
    class="size-7 cursor-grab text-muted-foreground hover:bg-transparent active:cursor-grabbing"
    @click.stop
  >
    <IconGripVertical class="size-3.5" />
    <span class="sr-only">Geser untuk mengurutkan ulang</span>
  </Button>
</template>
