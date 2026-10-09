const PAYMENT_RETURN_KEY = "studio-booking:payment-return";

export function usePaymentReturn() {
  const rememberCurrentPage = () => {
    if (typeof window === "undefined") {
      return;
    }

    const path = `${window.location.pathname}${window.location.search}`;
    sessionStorage.setItem(PAYMENT_RETURN_KEY, path || "/dashboard/bookings");
  };

  const resolveRedirectTarget = (referenceId?: string) => {
    if (typeof window === "undefined") {
      return "/dashboard/bookings";
    }

    const fallback = "/dashboard/bookings";
    const savedPath = sessionStorage.getItem(PAYMENT_RETURN_KEY) || fallback;
    const targetUrl = new URL(savedPath, window.location.origin);
    const params = new URLSearchParams(targetUrl.search);

    params.set("payment_status", "success");
    if (referenceId) {
      params.set("payment_reference", referenceId);
    }

    targetUrl.search = params.toString();
    return `${targetUrl.pathname}${targetUrl.search}`;
  };

  const clear = () => {
    if (typeof window === "undefined") {
      return;
    }

    sessionStorage.removeItem(PAYMENT_RETURN_KEY);
  };

  return {
    rememberCurrentPage,
    resolveRedirectTarget,
    clear,
  };
}
