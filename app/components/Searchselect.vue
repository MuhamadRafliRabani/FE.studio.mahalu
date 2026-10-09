<script setup lang="ts" generic="TValue extends string | number = string">
import { computed } from "vue";
import { IconCheck, IconSelector, IconX } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
  ComboboxViewport,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

/**
 * SearchSelect
 * ------------
 * Dropdown select dengan pencarian, dibangun di atas primitive `Combobox`
 * shadcn-vue. Dipakai persis seperti `<select>` biasa lewat v-model —
 * bedanya v-model di sini adalah `value` polos (string/number), bukan
 * objek opsi, supaya gampang dipasang ke form field mana pun tanpa perlu
 * mapping manual di tiap tempat pakai.
 *
 * Semua opsi dirender sekaligus (tidak dipaging/di-lazy-load) dan
 * discroll lewat ComboboxViewport — cukup untuk daftar opsi berukuran
 * wajar (puluhan-ratusan item). Untuk ribuan item, pertimbangkan
 * ComboboxVirtualizer dari reka-ui terpisah.
 *
 * Contoh pakai:
 * <SearchSelect
 *   v-model="form.cityId"
 *   :options="cities"
 *   placeholder="Pilih kota..."
 *   search-placeholder="Cari kota..."
 * />
 */

export interface SearchSelectOption<T extends string | number = string> {
  value: T;
  label: string;
  description?: string;
  imageUrl?: string | null;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    options: SearchSelectOption<TValue>[];
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    /** Tampilkan tombol kecil untuk mengosongkan pilihan. */
    clearable?: boolean;
    /** Class tambahan untuk tombol trigger (mis. lebar custom). */
    class?: string;
  }>(),
  {
    placeholder: "Pilih opsi...",
    searchPlaceholder: "Cari...",
    emptyText: "Tidak ada hasil ditemukan.",
    disabled: false,
    clearable: false,
  },
);

const modelValue = defineModel<TValue | null>({ default: null });

// Combobox reka-ui membandingkan & menyimpan objek utuh (via prop `by`),
// bukan primitive. computed dua arah ini yang menjembatani supaya
// modelValue yang diekspos ke pemakai tetap sesederhana `TValue | null`.
const selectedOption = computed<SearchSelectOption<TValue> | undefined>({
  get: () => props.options.find((option) => option.value === modelValue.value),
  set: (option) => {
    modelValue.value = option ? option.value : null;
  },
});

function clearSelection(event: Event) {
  // Cegah klik "x" ikut membuka/menutup combobox lewat tombol trigger.
  event.stopPropagation();
  modelValue.value = null;
}
</script>

<template>
  <Combobox v-model="selectedOption" by="value" :disabled="disabled">
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          :disabled="disabled"
          :class="
            cn(
              'w-full justify-between font-normal',
              !selectedOption && 'text-muted-foreground',
              props.class,
            )
          "
        >
          <slot v-if="selectedOption" name="selected" :option="selectedOption">
            <span class="truncate">{{ selectedOption.label }}</span>
          </slot>
          <span v-else class="truncate">{{ placeholder }}</span>
          <span class="ml-2 flex shrink-0 items-center gap-1">
            <IconX
              v-if="clearable && selectedOption"
              class="size-4 text-muted-foreground transition-opacity hover:opacity-100"
              @click="clearSelection"
            />
            <IconSelector class="size-4 opacity-50" />
          </span>
        </Button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxList class="w-[var(--reka-combobox-trigger-width)] min-w-40 p-0">
      <ComboboxInput :placeholder="searchPlaceholder" />
      <ComboboxEmpty>{{ emptyText }}</ComboboxEmpty>
      <ComboboxViewport class="max-h-64">
        <ComboboxGroup>
          <ComboboxItem
            v-for="option in options"
            :key="option.value"
            :value="option"
            :disabled="option.disabled"
          >
            <slot name="item" :option="option">
              <span class="flex min-w-0 flex-1 items-center gap-3">
                <img
                  v-if="option.imageUrl"
                  :src="option.imageUrl"
                  :alt="`Thumbnail ${option.label}`"
                  class="size-10 shrink-0 rounded-md object-cover"
                />
                <span
                  v-else-if="option.description"
                  class="size-10 shrink-0 rounded-md bg-muted"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{{ option.label }}</span>
                  <span
                    v-if="option.description"
                    class="block truncate text-xs text-muted-foreground"
                  >
                    {{ option.description }}
                  </span>
                </span>
              </span>
            </slot>
            <ComboboxItemIndicator>
              <IconCheck class="size-4" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxGroup>
      </ComboboxViewport>
    </ComboboxList>
  </Combobox>
</template>
