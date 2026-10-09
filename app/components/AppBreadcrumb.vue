<script setup lang="ts">
import { computed } from "vue";
import { IconHome } from "@tabler/icons-vue";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Crumb = { label: string; to: string };

const ROOT_SEGMENT = "dashboard";

// Samakan dengan nama menu di sidebar. Segmen yang tidak ada di sini
// otomatis dirapikan dari URL-nya (misalnya "data-library" jadi "Data Library").
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  bookings: "Bookings",
  studios: "Studios",
  addons: "Addons",
  resources: "Resources",
  bundles: "Bundles",
  "data-library": "Data Library",
  reports: "Reports",
  "word-assistant": "Word Assistant",
  settings: "Settings",
};

// Id numerik atau UUID di URL ditampilkan sebagai "Detail", bukan angka mentah.
const DYNAMIC_SEGMENT = /^(\d+|[0-9a-f]{8}-[0-9a-f-]{27,})$/i;

const route = useRoute();

function prettify(segment: string): string {
  return decodeURIComponent(segment)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const crumbs = computed<Crumb[]>(() => {
  const segments = route.path.split("/").filter(Boolean);
  if (segments[0] !== ROOT_SEGMENT) return [];

  const items = segments.map((segment, index) => ({
    label: DYNAMIC_SEGMENT.test(segment)
      ? "Detail"
      : (SEGMENT_LABELS[segment] ?? prettify(segment)),
    to: `/${segments.slice(0, index + 1).join("/")}`,
  }));

  // Halaman bisa menimpa label terakhir lewat definePageMeta({ breadcrumb: "..." }).
  const override = route.meta.breadcrumb;
  const last = items.at(-1);
  if (last && typeof override === "string" && override) {
    last.label = override;
  }

  return items;
});

// Lebih dari 3 level: tampilkan yang pertama dan terakhir, sisanya masuk menu "...".
const MAX_VISIBLE = 3;
const collapsed = computed(() => crumbs.value.length > MAX_VISIBLE);
const first = computed(() => crumbs.value[0]);
const hiddenItems = computed(() =>
  collapsed.value ? crumbs.value.slice(1, -1) : [],
);
const rest = computed(() =>
  collapsed.value ? crumbs.value.slice(-1) : crumbs.value.slice(1),
);
</script>

<template>
  <Breadcrumb v-if="first" class="min-w-0">
    <BreadcrumbList class="flex-nowrap">
      <!-- Level pertama: ikon rumah di layar kecil, teks di layar lebar -->
      <BreadcrumbItem>
        <BreadcrumbPage
          v-if="crumbs.length === 1"
          class="flex items-center gap-1.5"
        >
          <IconHome class="size-4 sm:hidden" aria-hidden="true" />
          <span class="sr-only sm:not-sr-only">{{ first.label }}</span>
        </BreadcrumbPage>
        <BreadcrumbLink v-else as-child>
          <NuxtLink :to="first.to" class="flex items-center gap-1.5">
            <IconHome class="size-4 sm:hidden" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{{ first.label }}</span>
          </NuxtLink>
        </BreadcrumbLink>
      </BreadcrumbItem>

      <!-- Level tengah yang diringkas -->
      <template v-if="hiddenItems.length">
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              class="flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Tampilkan halaman lainnya"
            >
              <BreadcrumbEllipsis class="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                v-for="item in hiddenItems"
                :key="item.to"
                as-child
              >
                <NuxtLink :to="item.to">{{ item.label }}</NuxtLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>
      </template>

      <!-- Level berikutnya; yang terakhir adalah halaman aktif -->
      <template v-for="(crumb, index) in rest" :key="crumb.to">
        <BreadcrumbSeparator />
        <BreadcrumbItem class="min-w-0">
          <BreadcrumbPage
            v-if="index === rest.length - 1"
            class="block max-w-[10rem] truncate sm:max-w-xs"
          >
            {{ crumb.label }}
          </BreadcrumbPage>
          <BreadcrumbLink v-else as-child>
            <NuxtLink
              :to="crumb.to"
              class="block max-w-[8rem] truncate sm:max-w-xs"
            >
              {{ crumb.label }}
            </NuxtLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
      </template>
    </BreadcrumbList>
  </Breadcrumb>
</template>
