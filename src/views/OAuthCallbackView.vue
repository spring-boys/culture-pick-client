<script setup>
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

onMounted(() => {
  const token = route.query.token
  const error = route.query.error

  if (token) {
    authStore.setToken(token)
    router.replace('/')
  } else {
    router.replace({ path: '/login', query: { error: error || 'authentication_failed' } })
  }
})
</script>

<template>
  <div></div>
</template>
