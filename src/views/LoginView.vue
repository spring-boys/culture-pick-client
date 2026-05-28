<script setup>
import { reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import authImage from '@/assets/images/auth.png'
import googleSignIn from '@/assets/images/google-login.svg'
import { login } from '@/services/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: '',
})

const errors = reactive({
  general: route.query.error ? '소셜 로그인에 실패했습니다. 다시 시도해주세요.' : '',
})

async function handleLogin() {
  errors.general = ''
  try {
    const { data } = await login(form.email, form.password)
    authStore.setToken(data.accessToken)
    router.replace('/')
  } catch (err) {
    errors.general = err.response?.data?.message || '이메일 또는 비밀번호를 확인해주세요.'
  }
}

function loginWithGoogle() {
  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/oauth2/authorization/google`
}
</script>

<template>
  <div class="auth-layout">
    <div class="auth-image">
      <img :src="authImage" alt="auth" />
    </div>

    <div class="auth-form-wrapper">
      <form class="auth-form" @submit.prevent="handleLogin">
        <h1 class="auth-title">로그인</h1>

        <div class="field">
          <label for="email">이메일</label>
          <input id="email" v-model="form.email" type="email" placeholder="이메일을 입력하세요" />
        </div>

        <div class="field">
          <label for="password">비밀번호</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="비밀번호를 입력하세요"
          />
        </div>

        <p v-if="errors.general" class="error-message">{{ errors.general }}</p>

        <button type="submit" class="submit-btn">로그인</button>

        <div class="divider">
          <span>소셜 로그인</span>
        </div>

        <button type="button" class="google-btn" @click="loginWithGoogle">
          <img :src="googleSignIn" alt="Google로 로그인" />
        </button>

        <p class="signup-link">
          계정이 없으신가요? <RouterLink to="/signup">회원가입</RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  display: flex;
  height: calc(100vh - 64px);
}

.auth-image {
  flex: 1;
  overflow: hidden;
}

.auth-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.auth-form-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.auth-form {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.auth-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 8px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.field input {
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.field input:focus {
  border-color: var(--color-primary);
}

.submit-btn {
  height: 48px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
}

.submit-btn:hover {
  opacity: 0.85;
}

.signup-link {
  text-align: center;
  font-size: 14px;
  color: var(--color-muted);
}

.signup-link a {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
}

.error-message {
  font-size: 13px;
  color: #e53935;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-muted);
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-line);
}

.google-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
}

.google-btn img {
  height: 48px;
  width: 100%;
}
</style>
