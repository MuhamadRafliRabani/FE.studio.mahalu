<script setup lang="ts">
import { computed, ref } from "vue";
import { useMutation, useQuery } from "villus";
import { IconArrowLeft, IconLoader2, IconPlus } from "@tabler/icons-vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appToast } from "@/lib/toast";

const ADDONS_QUERY = `query { addons { id name } }`;
const CREATE_RESOURCE = `mutation ($addonId: ID!, $name: String!) { createResource(addon_id: $addonId, name: $name) { id name is_active addon { id name } } }`;

type Addon = { id: string; name: string };
const form = ref<HTMLFormElement>();
const addonId = ref("");
const name = ref("");
const {
  data: addonsResult,
  isFetching: isLoadingAddons,
  error: addonsError,
} = useQuery({ query: ADDONS_QUERY });
const { execute: createResource, isFetching: isSaving } =
  useMutation(CREATE_RESOURCE);
const addons = computed<Addon[]>(() => addonsResult.value?.addons ?? []);

async function submit() {
  if (!form.value?.reportValidity() || isSaving.value) return;
  const resourceName = name.value.trim();
  const toastId = appToast.loading(`Menyimpan resource "${resourceName}"...`, {
    description: "Data resource sedang diproses.",
  });

  try {
    const result = await createResource({
      addonId: addonId.value,
      name: resourceName,
    });
    if (result.error || !result.data?.createResource?.id) {
      throw new Error(result.error?.message ?? "Resource gagal disimpan.");
    }

    appToast.success(`Resource "${resourceName}" berhasil ditambahkan`, {
      id: toastId,
      description: "Resource telah tersimpan dan siap digunakan pada addon.",
    });
    await navigateTo("/dashboard/resources");
  } catch (error) {
    appToast.error(`Resource "${resourceName}" gagal disimpan`, {
      id: toastId,
      description:
        error instanceof Error
          ? error.message
          : "Periksa koneksi internet, lalu coba simpan kembali.",
    });
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-2xl space-y-6 p-6 md:p-10">
    <div class="flex items-start gap-3">
      <Button
        as="a"
        href="/dashboard/resources"
        variant="ghost"
        size="icon"
        aria-label="Kembali"
      >
        <IconArrowLeft class="size-4" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Tambah resource</h1>
        <p class="text-sm text-muted-foreground">
          Tambahkan resource yang dapat digunakan pada addon.
        </p>
      </div>
    </div>

    <form
      ref="form"
      class="space-y-6 rounded-lg border bg-background p-6"
      @submit.prevent="submit"
    >
      <div class="grid gap-2">
        <Label for="resource-addon"
          >Addon <span class="text-destructive">*</span></Label
        >
        <select
          id="resource-addon"
          v-model="addonId"
          required
          :disabled="isLoadingAddons || isSaving"
          class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled>
            {{ isLoadingAddons ? "Memuat addon…" : "Pilih addon" }}
          </option>
          <option v-for="addon in addons" :key="addon.id" :value="addon.id">
            {{ addon.name }}
          </option>
        </select>
        <p v-if="addonsError" class="text-xs text-destructive">
          Gagal memuat addon. Muat ulang halaman lalu coba lagi.
        </p>
        <p
          v-else-if="!isLoadingAddons && !addons.length"
          class="text-xs text-muted-foreground"
        >
          Belum ada addon. Buat addon terlebih dahulu.
        </p>
      </div>

      <div class="grid gap-2">
        <Label for="resource-name"
          >Nama resource <span class="text-destructive">*</span></Label
        >
        <Input
          id="resource-name"
          v-model="name"
          required
          maxlength="120"
          placeholder="Contoh: Fotografer utama"
          :disabled="isSaving"
        />
      </div>

      <div class="flex justify-end gap-2 border-t pt-5">
        <Button
          as="a"
          href="/dashboard/resources"
          variant="outline"
          type="button"
          :disabled="isSaving"
        >
          Batal
        </Button>
        <Button
          type="submit"
          :disabled="isSaving || isLoadingAddons || !addons.length"
        >
          <IconLoader2 v-if="isSaving" class="size-4 animate-spin" />
          <IconPlus v-else class="size-4" />
          {{ isSaving ? "Menyimpan…" : "Simpan resource" }}
        </Button>
      </div>
    </form>
  </div>
</template>
