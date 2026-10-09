<script setup lang="ts">
import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconMoon,
  IconNotification,
  IconSun,
  IconUserCircle,
} from "@tabler/icons-vue";
import { computed } from "vue";
import { useColorMode } from "@vueuse/core";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { appToast } from "@/lib/toast";
import Button from "./ui/button/Button.vue";

const { isMobile } = useSidebar();
const authStore = useAuthStore();
const user = computed(() => authStore.user);
const displayName = computed(() => user.value?.name ?? "Memuat profil...");
const displayEmail = computed(() => user.value?.email ?? "");
const initials = computed(() => {
  const name = user.value?.name.trim();
  if (!name) return "?";

  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
});
const colorMode = useColorMode({
  attribute: "class",
  storageKey: "mahalu-theme",
});
const isDark = computed(() => colorMode.value === "dark");

async function logout() {
  try {
    await authStore.logout();
  } catch (error) {
    appToast.error("Gagal keluar", {
      description:
        error instanceof Error ? error.message : "Silakan coba lagi.",
    });
  }
}

function toggleTheme() {
  colorMode.value = isDark.value ? "light" : "dark";
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg grayscale">
              <AvatarFallback class="rounded-lg">
                {{ initials }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ displayName }}</span>
              <span class="text-muted-foreground truncate text-xs">
                {{ displayEmail }}
              </span>
            </div>

            <IconDotsVertical class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-(--reka-dropdown-menu-trigger-width) min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          :side-offset="4"
          align="end"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarFallback class="rounded-lg">
                  {{ initials }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{{ displayName }}</span>
                <span class="text-muted-foreground truncate text-xs">
                  {{ displayEmail }}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                class="ml-auto h-8 w-8 data-[state=open]:bg-transparent data-[state=open]:text-sidebar-accent-foreground"
                type="button"
                :aria-label="
                  isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap'
                "
                :title="isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap'"
                @click="toggleTheme"
              >
                <span class="relative flex size-4 items-center justify-center">
                  <IconSun
                    class="absolute size-4 transition-all duration-300 ease-in-out"
                    :class="
                      isDark
                        ? 'scale-0 -rotate-90 opacity-0'
                        : 'scale-100 rotate-0 opacity-100'
                    "
                  />
                  <IconMoon
                    class="absolute size-4 transition-all duration-300 ease-in-out"
                    :class="
                      isDark
                        ? 'scale-100 rotate-0 opacity-100'
                        : 'scale-0 rotate-90 opacity-0'
                    "
                  />
                </span>
              </Button>
            </div>
          </DropdownMenuLabel>
          <!-- <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem>
              <IconUserCircle />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem>
              <IconCreditCard />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem>
              <IconNotification />
              Notifications
            </DropdownMenuItem>
          </DropdownMenuGroup> -->
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="logout">
            <IconLogout />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
