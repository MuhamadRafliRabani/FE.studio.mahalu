// composables/useHoverIndicator.ts
import { reactive, ref } from "vue";

export function useHoverIndicator() {
  const containerRef = ref<HTMLElement | null>(null);

  const indicatorStyle = reactive({
    transform: "translateY(0px)",
    height: "0px",
    opacity: 0,
  });

  function moveIndicator(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el || !containerRef.value) return;

    const containerRect = containerRef.value.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();

    indicatorStyle.transform = `translateY(${itemRect.top - containerRect.top}px)`;
    indicatorStyle.height = `${itemRect.height}px`;
    indicatorStyle.opacity = 1;
  }

  function hideIndicator() {
    indicatorStyle.opacity = 0;
  }

  return { containerRef, indicatorStyle, moveIndicator, hideIndicator };
}
