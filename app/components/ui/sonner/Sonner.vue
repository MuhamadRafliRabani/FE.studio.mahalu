<script lang="ts" setup>
import "vue-sonner/style.css";
import type { ToasterProps } from "vue-sonner";
import {
  IconCircleCheck,
  IconInfoCircle,
  IconLoader2,
  IconOctagonOff,
  IconAlertTriangle,
  IconX,
} from "@tabler/icons-vue";
import { Toaster as Sonner } from "vue-sonner";
import { cn } from "@/lib/utils";

const props = defineProps<ToasterProps>();
</script>

<template>
  <Sonner
    v-bind="props"
    :class="cn('toaster group', props.class)"
    :position="props.position ?? 'top-right'"
    :close-button="true"
    :close-button-position="props.closeButtonPosition ?? 'top-right'"
    :toast-options="{
      closeButton: true,
      closeButtonAriaLabel: 'Tutup notifikasi',
      classes: {
        toast:
          'rounded-2xl border-2 border-border shadow-2xl shadow-black/30 px-4 py-4 pr-10 gap-2 bg-card text-card-foreground',
        content: 'flex flex-col gap-1',
        icon: 'self-start mt-0.5',
        title: 'font-semibold text-sm leading-tight',
        description: 'text-sm !text-foreground/60 leading-snug',
        actionButton:
          '!bg-transparent !text-primary !shadow-none !p-0 !h-auto text-sm font-medium hover:underline mr-4',
        cancelButton:
          '!bg-transparent !text-muted-foreground !shadow-none !p-0 !h-auto text-sm font-medium hover:underline',
        closeButton:
          '!absolute !right-2 !top-2 !z-10 !flex !size-5 !items-center !justify-center !rounded-full !border !border-border !bg-background !p-0 !text-muted-foreground !opacity-100 transition-colors hover:!bg-muted hover:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      },
    }"
    :style="{
      '--normal-bg': 'var(--card)',
      '--normal-text': 'var(--card-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': '1rem',
    }"
  >
    <template #success-icon>
      <IconCircleCheck class="size-5 text-primary" />
    </template>
    <template #info-icon>
      <IconInfoCircle class="size-5 text-blue-500" />
    </template>
    <template #warning-icon>
      <IconAlertTriangle class="size-5 text-amber-500" />
    </template>
    <template #error-icon>
      <IconOctagonOff class="size-5 text-destructive" />
    </template>
    <template #loading-icon>
      <IconLoader2 class="size-5 animate-spin text-muted-foreground" />
    </template>
    <template #close-icon>
      <IconX class="size-4" />
    </template>
  </Sonner>
</template>
