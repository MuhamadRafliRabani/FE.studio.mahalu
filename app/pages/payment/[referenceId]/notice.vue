<script setup lang="ts">
import { computed, onMounted } from "vue";
import { appToast } from "@/lib/toast";

const route = useRoute();
const router = useRouter();
const { resolveRedirectTarget, clear } = usePaymentReturn();

const referenceId = computed(() => String(route.params.referenceId));
const cancelled = computed(() => route.query.from === "cancel");
const paidSuccessfully = computed(
  () =>
    String(route.query.status ?? "").toLowerCase() === "berhasil" &&
    route.query.return === "true",
);

onMounted(() => {
  if (!paidSuccessfully.value) {
    return;
  }

  appToast.success("Pembayaran berhasil", {
    description: "Status booking telah diperbarui.",
  });

  clear();
  router.replace(resolveRedirectTarget(referenceId.value));
});
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-muted/30 p-6">
    <section
      class="w-full max-w-md rounded-xl border bg-background p-6 text-center shadow-sm"
    >
      <h1 class="text-xl font-semibold">
        {{
          cancelled
            ? "Pembayaran dibatalkan"
            : paidSuccessfully
              ? "Pembayaran berhasil"
              : "Menunggu pembayaran"
        }}
      </h1>
      <p class="mt-2 text-sm text-muted-foreground">
        {{
          cancelled
            ? "Booking belum dikonfirmasi. Anda dapat menutup halaman ini dan mencoba metode pembayaran lain."
            : paidSuccessfully
              ? "Anda akan diarahkan kembali ke halaman sebelumnya."
              : "Selesaikan pembayaran melalui iPaymu. Status booking akan diperbarui otomatis setelah callback diterima."
        }}
      </p>
      <p class="mt-4 rounded-md bg-muted p-3 font-mono text-xs">
        {{ referenceId }}
      </p>
      <NuxtLink
        to="/dashboard/bookings"
        class="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Kembali ke bookings
      </NuxtLink>
    </section>
  </main>
</template>
