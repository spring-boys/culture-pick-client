import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(null)
  const checked = ref(false)
  const isLoggedIn = computed(() => !!accessToken.value)

  function setToken(token) {
    accessToken.value = token
  }

  function clearToken() {
    accessToken.value = null
  }

  function setChecked() {
    checked.value = true
  }

  return { accessToken, checked, isLoggedIn, setToken, clearToken, setChecked }
})
