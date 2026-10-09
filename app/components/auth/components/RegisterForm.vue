<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { useMutation } from "villus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const CREATE_USER_MUTATION = `
  mutation CreateUser($name: String!, $email: String!, $password: String!) {
    createUser(name: $name, email: $email, password: $password) {
      id
      name
      email
    }
  }
`;

const name = ref("");
const email = ref("");
const password = ref("");
const passwordConfirmation = ref("");
const submitError = ref("");
const submitSuccess = ref(false);

const { execute, isFetching } = useMutation(CREATE_USER_MUTATION);

async function submit() {
  if (isFetching.value) return;

  submitError.value = "";
  submitSuccess.value = false;

  if (password.value !== passwordConfirmation.value) {
    submitError.value = "Konfirmasi password tidak cocok.";
    return;
  }

  try {
    const result = await execute({
      name: name.value.trim(),
      email: email.value.trim().toLowerCase(),
      password: password.value,
    });

    if (result.error || !result.data?.createUser) {
      submitError.value =
        "Gagal membuat akun. Periksa kembali data yang diisi.";
      return;
    }

    submitSuccess.value = true;
    name.value = "";
    email.value = "";
    password.value = "";
    passwordConfirmation.value = "";
    await navigateTo("/dashboard");
  } catch {
    submitError.value = "Gagal membuat akun. Coba lagi.";
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card class="overflow-hidden p-0 bg-transparent!">
      <CardContent class="">
        <form class="p-6 md:p-8" autocomplete="off" @submit.prevent="submit">
          <FieldGroup>
            <div class="flex flex-col items-center gap-2 text-center">
              <h1 class="text-2xl font-bold">Tambah Akun</h1>
              <p class="text-muted-foreground text-balance">
                Buat akun staff baru
              </p>
            </div>

            <Field>
              <FieldLabel for="name">Nama</FieldLabel>
              <Input id="name" v-model="name" type="text" required />
            </Field>

            <Field>
              <FieldLabel for="email">Email</FieldLabel>
              <Input
                id="email"
                v-model="email"
                type="email"
                autocomplete="off"
                required
              />
            </Field>

            <Field>
              <FieldLabel for="password">Password</FieldLabel>
              <Input
                id="password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
              />
            </Field>

            <Field>
              <FieldLabel for="password_confirmation"
                >Konfirmasi Password</FieldLabel
              >
              <Input
                id="password_confirmation"
                v-model="passwordConfirmation"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
              />
            </Field>

            <FieldDescription
              v-if="submitError"
              class="text-destructive text-center"
              aria-live="polite"
            >
              {{ submitError }}
            </FieldDescription>

            <FieldDescription
              v-if="submitSuccess"
              class="text-center text-green-600"
              aria-live="polite"
            >
              Akun berhasil dibuat.
            </FieldDescription>

            <Field>
              <Button type="submit" :disabled="isFetching">
                {{ isFetching ? "Menyimpan..." : "Buat Akun" }}
              </Button>
            </Field>

            <FieldDescription class="text-center">
              <NuxtLink
                to="/settings/users"
                class="underline-offset-2 hover:underline"
              >
                Kembali ke daftar akun
              </NuxtLink>
            </FieldDescription>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
