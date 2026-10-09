<script setup lang="ts">
import type { Component } from "vue";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSlidingIndicator } from "@/composables/useSlidingIndicator";

interface NavItem {
  title: string;
  url: string;
  icon?: Component;
}

const props = withDefaults(
  defineProps<{
    items: NavItem[];
    groupId: string;
    label?: string;
  }>(),
  { label: "" },
);

const { hoveredKey, activeKey, setHovered, setActive, isRouteActive } =
  useSlidingIndicator();

function keyFor(title: string) {
  return `${props.groupId}:${title}`;
}
</script>

<template>
  <SidebarGroup class="px-2 group-data-[collapsible=icon]:hidden">
    <SidebarGroupLabel
      v-if="label"
      class="relative z-10 px-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50"
    >
      {{ label }}
    </SidebarGroupLabel>

    <SidebarMenu class="">
      <SidebarMenuItem
        v-for="item in items"
        :key="item.title"
        class="relative z-10"
        @mouseenter="setHovered(keyFor(item.title))"
      >
        <SidebarMenuButton
          as-child
          :data-nav-id="keyFor(item.title)"
          :class="[
            'h-9 rounded-lg px-2.5 transition-colors duration-150 hover:bg-transparent',
            isRouteActive(item.url)
              ? 'font-medium text-sidebar-foreground'
              : 'text-sidebar-foreground/70',
          ]"
          @click="setActive(keyFor(item.title))"
        >
          <a :href="item.url" class="flex items-center gap-2.5">
            <component
              :is="item.icon"
              v-if="item.icon"
              class="size-[18px] shrink-0"
              :class="
                isRouteActive(item.url)
                  ? 'text-primary'
                  : 'text-sidebar-foreground/50'
              "
            />
            <span class="truncate">{{ item.title }}</span>
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</template>
