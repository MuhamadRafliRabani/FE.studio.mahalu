<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ id?: string; disabled?: boolean }>();
const price = defineModel<number | null>({ default: null });
const displayValue = ref("");
const formatter = new Intl.NumberFormat("id-ID");

watch(
  price,
  (value) => {
    displayValue.value =
      value === null || value === undefined ? "" : formatter.format(value);
  },
  { immediate: true },
);

function onInput(event: Event) {
  const digits = (event.target as HTMLInputElement).value.replace(/\D/g, "");
  price.value = digits ? Number(digits) : null;
  displayValue.value = digits ? formatter.format(Number(digits)) : "";
}
</script>

<template>
  <div class="relative">
    <span
      class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
      >Rp</span
    >
    <input
      :id="props.id"
      :value="displayValue"
      :disabled="props.disabled"
      inputmode="numeric"
      type="text"
      class="h-9 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      placeholder="0"
      @input="onInput"
    />
  </div>
</template>
