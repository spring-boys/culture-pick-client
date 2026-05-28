<script setup>
import { onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { regenerate } from '@/services/auth'

const authStore = useAuthStore()

onMounted(async () => {
  if (!authStore.accessToken) {
    try {
      const { data } = await regenerate()
      authStore.setToken(data.accessToken)
    } catch {
      // RT 없거나 만료 → 비로그인 상태 유지
    }
  }
  authStore.setChecked()
})
</script>

<template>
  <AppHeader />
  <router-view />
</template>
