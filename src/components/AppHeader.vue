<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { logout as logoutApi } from '@/services/auth'

const router = useRouter()
const authStore = useAuthStore()

async function logout() {
  try {
    await logoutApi()
  } finally {
    authStore.clearToken()
    router.replace('/login')
  }
}
</script>

<template>
  <header class="app-header">
    <RouterLink class="brand" to="/">CulturePick</RouterLink>

    <nav class="nav-right">
      <RouterLink class="nav-link" to="/" exact-active-class="active">홈</RouterLink>
      <RouterLink class="nav-link" to="/mypage">마이페이지</RouterLink>
      <template v-if="authStore.checked">
        <template v-if="authStore.isLoggedIn">
          <button class="nav-link" type="button" @click="logout">로그아웃</button>
        </template>
        <template v-else>
          <RouterLink class="nav-link" to="/login">로그인</RouterLink>
          <RouterLink class="nav-link" to="/signup">회원가입</RouterLink>
        </template>
      </template>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  height: 64px;
  padding: 0 32px;
  background: var(--color-card);
  border-bottom: 1px solid var(--color-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}

.brand {
  font-size: 22px;
  font-weight: 900;
  color: var(--color-primary);
  letter-spacing: -0.8px;
  text-decoration: none;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  border: 1px solid var(--color-line);
  background: var(--color-card);
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  color: #333;
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;
}

.nav-link:hover,
.nav-link.active,
.nav-link.router-link-active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-soft);
}
</style>
