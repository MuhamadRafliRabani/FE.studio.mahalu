<script setup lang="ts">
import { IconCheck, IconClock, IconTicket } from "@tabler/icons-vue";
import { formatDuration } from "@/utils/formatDuration";

type Bundle = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  studio: {
    id: string;
    name: string;
    is_active: boolean;
    addons: Array<{
      id: string;
      name: string;
      pricing_type: "flat" | "per_tier";
      flat_price: number | null;
      is_active: boolean;
      prices: Array<{ duration_minutes: number; price: number; is_active: boolean }>;
      resources: Array<{ id: string; is_active: boolean }>;
    }>;
  };
  pricing_tier: {
    id: string;
    duration_minutes: number;
    price: number;
    is_active: boolean;
  };
  addons: Array<{
    id: string;
    duration_minutes: number | null;
    addon: { id: string; name: string };
  }>;
  bundle_price: number;
  normal_price: number;
  discount_amount: number;
  valid_from: string | null;
  valid_until: string | null;
  quota_limit: number | null;
  quota_remaining: number | null;
};

defineProps<{ bundle: Bundle; selected?: boolean }>();
defineEmits<{ (event: "select", bundle: Bundle): void }>();

function formatCurrency(value: number): string {
  return value.toLocaleString("id-ID");
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}
</script>

<template>
  <button
    type="button"
    class="flex h-full w-full flex-col gap-3 rounded-md border p-4 text-left transition-colors"
    :class="selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-input hover:border-primary/50 hover:bg-muted/30'"
    :aria-pressed="selected"
    @click="$emit('select', bundle)"
  >
    <span class="flex w-full items-start justify-between gap-3">
      <span class="min-w-0">
        <span class="block truncate text-sm font-semibold">{{ bundle.name }}</span>
        <span class="mt-1 block text-xs text-muted-foreground">{{ bundle.studio.name }} · {{ formatDuration(bundle.pricing_tier.duration_minutes) }}</span>
      </span>
      <IconCheck v-if="selected" class="size-4 shrink-0 text-primary" />
    </span>

    <span v-if="bundle.description" class="line-clamp-2 text-xs text-muted-foreground">{{ bundle.description }}</span>
    <span class="block w-full border-t pt-2">
      <span class="mb-1 block text-xs font-medium text-muted-foreground">Isi paket</span>
      <span class="flex flex-col gap-1 text-xs text-muted-foreground">
        <span v-for="item in bundle.addons" :key="item.id" class="flex items-center justify-between gap-2">
          <span class="truncate">{{ item.addon.name }}</span>
          <span v-if="item.duration_minutes" class="shrink-0">{{ formatDuration(item.duration_minutes) }}</span>
        </span>
      </span>
    </span>
    <span class="mt-auto flex w-full items-end justify-between gap-3 border-t pt-3">
      <span class="flex flex-col">
        <span class="text-xs text-muted-foreground line-through">Rp {{ formatCurrency(bundle.normal_price) }}</span>
        <span class="text-base font-bold">Rp {{ formatCurrency(bundle.bundle_price) }}</span>
      </span>
      <span class="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
        <IconTicket class="size-3.5" />Hemat Rp {{ formatCurrency(bundle.discount_amount) }}
      </span>
    </span>
    <span v-if="bundle.valid_from || bundle.valid_until || bundle.quota_limit !== null" class="flex w-full flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span v-if="bundle.valid_from || bundle.valid_until" class="flex items-center gap-1"><IconClock class="size-3" />{{ formatDate(bundle.valid_from) ?? "Mulai" }} – {{ formatDate(bundle.valid_until) ?? "Tanpa batas" }}</span>
      <span v-if="bundle.quota_limit !== null">Sisa kuota {{ bundle.quota_remaining }} / {{ bundle.quota_limit }}</span>
    </span>
  </button>
</template>