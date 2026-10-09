<script setup lang="ts">
import { ref, watch } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";
import {
  IconDeviceFloppy,
  IconLoader2,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PriceInput from "@/components/PriceInput.vue";
import { appToast } from "@/lib/toast";
import { useMutation } from "villus";
import { formatDuration } from "@/utils/formatDuration";

type PricingTier = { id: string; duration_minutes: number; price: number };
const CREATE_PRICING_TIER = `mutation ($studioId: ID!, $durationMinutes: Int!, $price: Int!) { createPricingTier(studio_id: $studioId, duration_minutes: $durationMinutes, price: $price) { id duration_minutes price } }`;
const UPDATE_PRICING_TIER = `mutation ($id: ID!, $durationMinutes: Int!, $price: Int!) { updatePricingTier(id: $id, duration_minutes: $durationMinutes, price: $price) { id duration_minutes price } }`;
const DELETE_PRICING_TIER = `mutation ($id: ID!) { deletePricingTier(id: $id) { id } }`;

const props = defineProps<{
  studioId: string;
  studioName: string;
  pricingTiers: PricingTier[];
}>();
const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{ (event: "changed"): void }>();
const tiers = ref<PricingTier[]>([]);
const editingId = ref<string | null>(null);
const durationMinutes = ref(60);
const price = ref<number | null>(null);
const isSaving = ref(false);
const deletingId = ref<string | null>(null);
const { execute: createTier } = useMutation(CREATE_PRICING_TIER);
const { execute: updateTier } = useMutation(UPDATE_PRICING_TIER);
const { execute: deleteTier } = useMutation(DELETE_PRICING_TIER);

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
watch(
  () => [props.pricingTiers, open.value] as const,
  ([value, isOpen]) => {
    if (isOpen)
      tiers.value = [...value].sort(
        (a, b) => a.duration_minutes - b.duration_minutes,
      );
  },
  { immediate: true },
);

function resetForm() {
  editingId.value = null;
  durationMinutes.value = 60;
  price.value = null;
}
function startEdit(tier: PricingTier) {
  editingId.value = tier.id;
  durationMinutes.value = tier.duration_minutes;
  price.value = tier.price;
}
function requestClose(value: boolean) {
  if (!isSaving.value && !deletingId.value) open.value = value;
}

async function saveTier() {
  const duration = Math.trunc(Number(durationMinutes.value) || 0);
  const amount = Math.trunc(Number(price.value) || 0);
  if (duration < 1 || amount < 0) {
    appToast.error("Gagal memvalidasi harga studio", {
      description:
        "Pastikan durasi minimal satu jam dan harga tidak bernilai negatif.",
    });
    return;
  }
  isSaving.value = true;
  const isEditing = Boolean(editingId.value);
  const toastId = appToast.loading(
    isEditing ? "Menyimpan perubahan harga..." : "Menyimpan harga studio...",
    { description: "Data harga sedang diproses." },
  );
  try {
    const result = isEditing
      ? await updateTier({
          id: editingId.value,
          durationMinutes: duration,
          price: amount,
        })
      : await createTier({
          studioId: props.studioId,
          durationMinutes: duration,
          price: amount,
        });
    const saved = isEditing
      ? result.data?.updatePricingTier
      : result.data?.createPricingTier;
    if (result.error || !saved)
      throw new Error(result.error?.message ?? "Pricing tier gagal disimpan.");
    const nextTier = {
      id: saved.id,
      duration_minutes: saved.duration_minutes,
      price: saved.price,
    };
    tiers.value = isEditing
      ? tiers.value.map((tier) => (tier.id === nextTier.id ? nextTier : tier))
      : [...tiers.value, nextTier].sort(
          (a, b) => a.duration_minutes - b.duration_minutes,
        );
    appToast.success(
      isEditing
        ? "Harga studio berhasil diperbarui"
        : "Harga studio berhasil ditambahkan",
      {
        id: toastId,
        description: "Opsi durasi dan harga telah tersimpan pada studio.",
      },
    );
    resetForm();
    emit("changed");
  } catch (error) {
    appToast.error("Harga studio gagal disimpan", {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba simpan kembali.",
    });
  } finally {
    isSaving.value = false;
  }
}

async function removeTier(tier: PricingTier) {
  if (
    deletingId.value ||
    !window.confirm(`Hapus harga ${formatDuration(tier.duration_minutes)}?`)
  )
    return;
  deletingId.value = tier.id;
  const toastId = appToast.loading("Menghapus harga studio...", {
    description: "Opsi harga sedang dihapus.",
  });
  try {
    const result = await deleteTier({ id: tier.id });
    if (result.error || !result.data?.deletePricingTier?.id)
      throw new Error(result.error?.message ?? "Pricing tier gagal dihapus.");
    tiers.value = tiers.value.filter((item) => item.id !== tier.id);
    if (editingId.value === tier.id) resetForm();
    appToast.success("Harga studio berhasil dihapus", {
      id: toastId,
      description: "Opsi durasi dan harga telah dihapus dari studio.",
    });
    emit("changed");
  } catch (error) {
    appToast.error("Harga studio gagal dihapus", {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba hapus kembali.",
    });
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="requestClose">
    <DialogPortal to="body">
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 flex h-[calc(100dvh-2rem)] max-h-[48rem] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-background shadow-xl outline-none sm:max-w-lg"
      >
        <div
          class="flex items-start justify-between border-b px-4 py-4 sm:px-6"
        >
          <div>
            <DialogTitle class="text-lg font-semibold">Pricing tier</DialogTitle
            ><DialogDescription class="text-sm text-muted-foreground"
              >Atur harga {{ studioName }} berdasarkan
              durasi.</DialogDescription
            >
          </div>
          <DialogClose as-child
            ><button
              type="button"
              class="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              :disabled="isSaving || Boolean(deletingId)"
              aria-label="Tutup"
            >
              <IconX class="size-4" /></button
          ></DialogClose>
        </div>
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div class="rounded-lg border p-4">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-sm font-medium">
                {{ editingId ? "Edit harga" : "Tambah harga" }}
              </h3>
              <button
                v-if="editingId"
                type="button"
                class="text-xs text-muted-foreground hover:text-foreground"
                @click="resetForm"
              >
                Batal edit
              </button>
            </div>
            <div class="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <div class="grid gap-2">
                <Label for="tier-duration">Durasi (menit)</Label
                ><Input
                  id="tier-duration"
                  v-model.number="durationMinutes"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Contoh: 90"
                />
              </div>
              <div class="grid gap-2">
                <Label for="tier-price">Harga</Label
                ><PriceInput id="tier-price" v-model="price" />
              </div>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              Tampilan: {{ formatDuration(durationMinutes) }}
            </p>
            <Button
              class="mt-4 w-full"
              type="button"
              :disabled="isSaving"
              @click="saveTier"
              ><IconLoader2
                v-if="isSaving"
                class="size-4 animate-spin"
              /><IconDeviceFloppy
                v-else-if="editingId"
                class="size-4"
              /><IconPlus v-else class="size-4" />{{
                isSaving
                  ? "Menyimpan…"
                  : editingId
                    ? "Simpan perubahan"
                    : "Tambah harga"
              }}</Button
            >
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-medium">Daftar harga</h3>
            <div
              v-if="!tiers.length"
              class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"
            >
              Belum ada pricing tier.
            </div>
            <div
              v-for="tier in tiers"
              :key="tier.id"
              class="flex items-center justify-between gap-3 rounded-lg border px-3 py-3"
            >
              <div>
                <p class="text-sm font-medium">
                  {{ formatDuration(tier.duration_minutes) }}
                </p>
                <p class="text-sm text-muted-foreground">
                  {{ rupiah.format(tier.price) }}
                </p>
              </div>
              <div class="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  :disabled="Boolean(deletingId)"
                  @click="startEdit(tier)"
                  >Edit</Button
                ><Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  :disabled="Boolean(deletingId)"
                  @click="removeTier(tier)"
                  ><IconLoader2
                    v-if="deletingId === tier.id"
                    class="size-4 animate-spin"
                  /><IconTrash v-else class="size-4" /><span class="sr-only"
                    >Hapus</span
                  ></Button
                >
              </div>
            </div>
          </div>
        </div>
        <div class="flex justify-end border-t px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            :disabled="isSaving || Boolean(deletingId)"
            @click="requestClose(false)"
            >Tutup</Button
          >
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
