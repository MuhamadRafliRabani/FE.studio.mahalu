import { reactive, ref, shallowRef } from "vue";
import { useRoute } from "vue-router";

const containerEl = shallowRef<HTMLElement | null>(null);
const pillEl = shallowRef<HTMLElement | null>(null);
const hoveredKey = ref<string>("");
const activeKey = ref<string>("");
const isPillReady = ref(false);
let resizeObserver: ResizeObserver | null = null;
let rafLoopId = 0;

export function useSlidingIndicator() {
  const route = useRoute();

  function setContainer(el: unknown) {
    containerEl.value = (el as HTMLElement) ?? null;
  }
  function setPill(el: unknown) {
    pillEl.value = (el as HTMLElement) ?? null;
  }

  function updatePillPosition() {
    const container = containerEl.value;
    const pill = pillEl.value;
    if (!container || !pill) return;

    const target = container.querySelector<HTMLElement>(
      `[data-nav-id="${hoveredKey.value}"]`,
    );

    if (!target) {
      pill.style.opacity = "0";
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    if (targetRect.width === 0 && targetRect.height === 0) {
      pill.style.opacity = "0";
      return;
    }

    const x = targetRect.left - containerRect.left;
    const y = targetRect.top - containerRect.top;

    pill.style.opacity = "1";
    pill.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    pill.style.width = `${targetRect.width}px`;
    pill.style.height = `${targetRect.height}px`;
  }

  function setHovered(key: string) {
    hoveredKey.value = key;
    updatePillPosition();
  }

  // Hanya terima key yang valid — cegah section lain yang route-nya
  // gak match nge-reset activeKey jadi kosong ("hilang").
  function setActive(key: string) {
    if (!key) return;
    activeKey.value = key;
    hoveredKey.value = key;
  }

  // Kalau memang butuh dikosongkan secara sengaja (mis. gak ada halaman
  // yang match sama sekali di seluruh sidebar), panggil ini eksplisit.
  function clearActive() {
    activeKey.value = "";
    hoveredKey.value = "";
    updatePillPosition();
  }

  function revertToActive() {
    hoveredKey.value = activeKey.value;
    updatePillPosition();
  }

  function isRouteActive(url: string) {
    if (!url || url === "#") return false;
    return route.path === url || route.path.startsWith(url + "/");
  }

  function runPillLoop(duration = 500) {
    cancelAnimationFrame(rafLoopId);
    const start = performance.now();
    const loop = (time: number) => {
      updatePillPosition();
      if (time - start < duration) {
        rafLoopId = requestAnimationFrame(loop);
      }
    };
    rafLoopId = requestAnimationFrame(loop);
  }

  function primeAfterMount() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isPillReady.value = true;
        updatePillPosition();
      });
    });
  }

  function observeResize() {
    if (resizeObserver || !containerEl.value) return;
    resizeObserver = new ResizeObserver(() => updatePillPosition());
    resizeObserver.observe(containerEl.value);
  }

  return {
    hoveredKey,
    activeKey,
    isPillReady,
    setContainer,
    setPill,
    setHovered,
    setActive,
    clearActive,
    revertToActive,
    isRouteActive,
    updatePillPosition,
    runPillLoop,
    primeAfterMount,
    observeResize,
  };
}
