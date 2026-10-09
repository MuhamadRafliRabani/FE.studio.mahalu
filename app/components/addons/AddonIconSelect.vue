<script setup lang="ts">
import { computed } from "vue";
import { Label } from "@/components/ui/label";
import Searchselect from "@/components/Searchselect.vue";
import {
  ADDON_ICON_OPTIONS,
  DEFAULT_ADDON_ICON,
  DEFAULT_ADDON_ICON_OPTION,
  type AddonIconName,
} from "@/utils/addonIcons";

const props = withDefaults(defineProps<{ disabled?: boolean }>(), {
  disabled: false,
});
const iconName = defineModel<AddonIconName>({ default: DEFAULT_ADDON_ICON });
const options = ADDON_ICON_OPTIONS.map(({ value, label }) => ({
  value,
  label,
  description: value,
}));
const selectedIcon = computed(
  () =>
    ADDON_ICON_OPTIONS.find((option) => option.value === iconName.value) ??
    DEFAULT_ADDON_ICON_OPTION,
);
</script>

<template>
  <div class="grid gap-2">
    <Label>Icon addon</Label>
    <Searchselect
      v-model="iconName"
      :options="options"
      placeholder="Pilih icon"
      search-placeholder="Cari icon..."
      :disabled="props.disabled"
    >
      <template #selected>
        <span class="flex min-w-0 flex-1 items-center gap-2 text-left">
          <component :is="selectedIcon.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span class="truncate">{{ selectedIcon.label }}</span>
        </span>
      </template>
      <template #item="{ option }">
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <component
            :is="ADDON_ICON_OPTIONS.find((item) => item.value === option.value)?.icon"
            class="size-4 shrink-0"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate">{{ option.label }}</span>
            <span class="block truncate text-xs text-muted-foreground">{{ option.description }}</span>
          </span>
        </span>
      </template>
    </Searchselect>
  </div>
</template>
