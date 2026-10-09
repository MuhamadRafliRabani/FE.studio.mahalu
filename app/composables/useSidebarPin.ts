// composables/useSidebarPin.ts
import { ref, watch } from "vue";

const STORAGE_KEY = "mahalu-sidebar-pinned";

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const isPinned = ref(readInitial());

watch(isPinned, (val) => {
  try {
    localStorage.setItem(STORAGE_KEY, val ? "1" : "0");
  } catch {
    // localStorage bisa gak tersedia (mis. private mode) — abaikan aja
  }
});

export function useSidebarPin() {
  function togglePin() {
    isPinned.value = !isPinned.value;
  }
  return { isPinned, togglePin };
}
