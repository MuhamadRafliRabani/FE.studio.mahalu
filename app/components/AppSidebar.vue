<script setup lang="ts">
import { nextTick, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute } from "vue-router";
import {
  IconAsset,
  IconBrandBooking,
  IconChevronDown,
  IconCheck,
  IconDashboard,
  IconDatabase,
  IconExternalLink,
  IconFileDescription,
  IconGift,
  IconHelp,
  IconInnerShadowTop,
  IconNoiseReduction,
  IconPackage,
  IconPin,
  IconPinFilled,
  IconReport,
  IconSearch,
  IconSettings,
} from "@tabler/icons-vue";

import NavSection from "@/components/NavSection.vue";
import NavUser from "@/components/NavUser.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSlidingIndicator } from "@/composables/useSlidingIndicator";
import { useSidebarPin } from "@/composables/useSidebarPin";

const { isPinned, togglePin } = useSidebarPin();

const data = {
  navMain: [
    { title: "Dashboard", url: "/dashboard", icon: IconDashboard },
    { title: "Bookings", url: "/dashboard/bookings", icon: IconBrandBooking },
  ],
  masters: [
    { title: "Studios", url: "/dashboard/studios", icon: IconNoiseReduction },
    { title: "Addons", url: "/dashboard/addons", icon: IconPackage },
    { title: "Resources", url: "/dashboard/resources", icon: IconAsset },
    { title: "Bundles", url: "/dashboard/bundles", icon: IconGift },
  ],
  navSecondary: [
    { title: "Settings", url: "#", icon: IconSettings },
    { title: "Get Help", url: "#", icon: IconHelp },
    { title: "Search", url: "#", icon: IconSearch },
  ],
};

const systems = [
  { title: "Mahalu Studio", current: true, url: null },
  {
    title: "Mahalu Spa",
    current: false,
    url: "https://dashboard.lattinapictura.com/dashboard",
  },
];

const route = useRoute();
const {
  isPillReady,
  setContainer,
  setPill,
  setActive,
  revertToActive,
  runPillLoop,
  primeAfterMount,
  observeResize,
} = useSlidingIndicator();

watch(
  () => route.path,
  async () => {
    await nextTick();
    runPillLoop(400);
  },
);

onMounted(async () => {
  await nextTick();
  primeAfterMount();
  observeResize();
});

let rafToCancel = 0;
onBeforeUnmount(() => cancelAnimationFrame(rafToCancel));
</script>

<template>
  <Sidebar :collapsible="isPinned ? 'none' : 'offcanvas'">
    <SidebarHeader class="border-b border-sidebar-border/60 pb-3">
      <SidebarMenu>
        <SidebarMenuItem class="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                class="h-11 flex-1 rounded-lg px-2 data-[state=open]:bg-sidebar-accent"
              >
                <span
                  class="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
                >
                  <IconInnerShadowTop class="!size-4" />
                </span>
                <span class="flex flex-col items-start leading-tight">
                  <span class="text-sm font-semibold tracking-tight">
                    Mahalu Studio
                  </span>
                  <span class="text-[11px] text-sidebar-foreground/50">
                    Ganti sistem
                  </span>
                </span>
                <IconChevronDown
                  class="ml-auto size-4 text-sidebar-foreground/50"
                />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-64 rounded-lg" align="start">
              <DropdownMenuItem
                v-for="system in systems"
                :key="system.title"
                as-child
              >
                <a
                  v-if="system.url"
                  :href="system.url"
                  class="flex items-center gap-2"
                >
                  <span class="flex-1">{{ system.title }}</span>
                  <IconExternalLink
                    class="size-3.5 text-sidebar-foreground/40"
                  />
                </a>
                <div v-else class="flex items-center gap-2">
                  <span class="flex-1 font-medium">{{ system.title }}</span>
                  <IconCheck class="size-4 text-primary" />
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            :title="isPinned ? 'Lepas pin sidebar' : 'Pin sidebar'"
            :aria-pressed="isPinned"
            class="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            @click="togglePin"
          >
            <component
              :is="isPinned ? IconPinFilled : IconPin"
              class="size-4"
            />
          </button>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent class="gap-0">
      <div
        :ref="(el) => setContainer(el as HTMLElement)"
        class="relative flex flex-1 flex-col gap-4 py-1"
        @mouseleave="revertToActive"
      >
        <div
          :ref="(el) => setPill(el as HTMLElement)"
          :class="[
            'pointer-events-none absolute -left-1 right-2 z-0 rounded-lg -translate-y-1 border-l-2 border-primary bg-sidebar-accent',
            isPillReady &&
              'transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1)]',
          ]"
          style="opacity: 0"
        />

        <NavSection group-id="main" :items="data.navMain" />
        <NavSection group-id="masters" label="Masters" :items="data.masters" />

        <NavSection
          group-id="secondary"
          class="mt-auto"
          :items="data.navSecondary"
        />
      </div>
    </SidebarContent>

    <SidebarFooter class="border-t border-sidebar-border/60 pt-3">
      <NavUser />
    </SidebarFooter>
  </Sidebar>
</template>
