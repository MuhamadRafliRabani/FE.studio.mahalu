<script setup lang="ts">
import RegisterForm from "~/components/auth/components/RegisterForm.vue";

definePageMeta({
  layout: false,
});
</script>

<template>
  <div class="grid min-h-screen w-full place-items-center bg-background">
    <div class="w-full max-w-sm md:max-w-lg">
      <RegisterForm />
    </div>
  </div>
</template>
