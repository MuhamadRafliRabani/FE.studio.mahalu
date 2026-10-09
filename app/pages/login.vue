<script setup lang="ts">
import LoginForm from "~/components/auth/components/LoginForm.vue";

definePageMeta({
  layout: false,
});
</script>

<template>
  <div class="grid min-h-screen w-full place-items-center bg-background">
    <div class="w-full max-w-sm md:max-w-lg">
      <LoginForm />
    </div>
  </div>
</template>
