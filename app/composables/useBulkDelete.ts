// composables/useBulkDelete.ts
//
// Alur standar untuk bulk-delete di semua DataTable: konfirmasi user →
// loading toast → hapus item satu-satu (biar error di satu item gak
// menggagalkan yang lain) → toast hasil (semua sukses / sebagian gagal /
// semua gagal) → refresh data → reset selection di tabel.
//
// Pakai ini di tiap page yang punya bulk delete, bukan menulis ulang pola
// confirm+toast+loop-nya di tiap page.

import { ref } from "vue";
import { appToast } from "@/lib/toast";

interface UseBulkDeleteOptions<TItem> {
  /** Nama entitas bentuk tunggal, huruf kecil — dipakai di pesan toast. Contoh: "studio". */
  entityName: string;
  /** Ambil label yang enak dibaca dari satu item, buat daftar item yang gagal. Contoh: (s) => s.name */
  getLabel: (item: TItem) => string;
  /** Hapus SATU item. Lempar Error kalau gagal — jangan return boolean. */
  deleteOne: (item: TItem) => Promise<void>;
  /** Dipanggil sekali setelah semua percobaan hapus selesai (biasanya refetch query list). */
  onSettled?: () => Promise<void> | void;
  /** Override pesan konfirmasi. Default: `Hapus {n} {entityName}?` */
  confirmMessage?: (items: TItem[]) => string;
}

export function useBulkDelete<TItem>(options: UseBulkDeleteOptions<TItem>) {
  const isDeleting = ref(false);

  async function bulkDelete(items: TItem[], resetSelection?: () => void) {
    if (isDeleting.value || !items.length) return;

    const confirmMessage =
      options.confirmMessage?.(items) ??
      `Hapus ${items.length} ${options.entityName}${items.length > 1 ? "" : ""}?`;
    if (!window.confirm(confirmMessage)) return;

    isDeleting.value = true;
    const toastId = appToast.loading(
      `Menghapus ${items.length} ${options.entityName}...`,
      { description: "Data sedang dihapus dari sistem." },
    );

    const failedLabels: string[] = [];
    for (const item of items) {
      try {
        await options.deleteOne(item);
      } catch {
        failedLabels.push(options.getLabel(item));
      }
    }
    isDeleting.value = false;

    const successCount = items.length - failedLabels.length;
    if (failedLabels.length === 0) {
      appToast.success(
        `${successCount} ${options.entityName} berhasil dihapus`,
        {
          id: toastId,
          description: "Data dan konfigurasi terkait telah dihapus.",
        },
      );
    } else if (successCount === 0) {
      appToast.error(`Gagal menghapus ${options.entityName}`, {
        id: toastId,
        description: `Semua item gagal dihapus: ${failedLabels.join(", ")}.`,
      });
    } else {
      appToast.error(`Sebagian ${options.entityName} gagal dihapus`, {
        id: toastId,
        description: `${successCount} berhasil, gagal: ${failedLabels.join(", ")}.`,
      });
    }

    // Reset selection + refresh selalu jalan di akhir, apa pun hasilnya —
    // item yang berhasil dihapus tetap harus hilang dari tabel & seleksi.
    resetSelection?.();
    await options.onSettled?.();
  }

  return { isDeleting, bulkDelete };
}
