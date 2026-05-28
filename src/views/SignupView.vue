<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import authImage from '@/assets/images/auth.png'
import googleSignUp from '@/assets/images/google-signup.svg'
import { sendCode, verifyCode, signup } from '@/services/auth'

const router = useRouter()

const form = reactive({
  email: '',
  password: '',
  nickname: '',
  code: '',
})

const ui = reactive({
  codeSent: false,
  emailVerified: false,
  sendingCode: false,
  submitting: false,
})

const errors = reactive({
  email: '',
  code: '',
  password: '',
  nickname: '',
  general: '',
})

function validate() {
  errors.password = ''
  errors.nickname = ''

  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).+$/
  if (!form.password) {
    errors.password = '비밀번호를 입력해주세요.'
  } else if (form.password.length < 8 || form.password.length > 20) {
    errors.password = '비밀번호는 8자 이상 20자 이하로 입력해주세요.'
  } else if (!passwordRegex.test(form.password)) {
    errors.password = '비밀번호는 영문과 숫자를 포함해야 합니다.'
  }

  if (!form.nickname) {
    errors.nickname = '닉네임을 입력해주세요.'
  } else if (form.nickname.length < 2 || form.nickname.length > 15) {
    errors.nickname = '닉네임은 2자 이상 15자 이하로 입력해주세요.'
  }

  return !errors.password && !errors.nickname
}

async function handleSendCode() {
  errors.email = ''
  ui.sendingCode = true
  try {
    await sendCode(form.email)
    ui.codeSent = true
  } catch (err) {
    errors.email = err.response?.data?.message || '인증 코드 발송에 실패했습니다.'
  } finally {
    ui.sendingCode = false
  }
}

async function handleVerifyCode() {
  errors.code = ''
  try {
    await verifyCode(form.email, form.code)
    ui.emailVerified = true
  } catch (err) {
    errors.code = err.response?.data?.message || '인증 코드가 올바르지 않습니다.'
  }
}

async function handleSignup() {
  if (!ui.emailVerified) return
  if (!validate()) return
  errors.general = ''
  ui.submitting = true
  try {
    await signup(form.email, form.password, form.nickname)
    router.replace('/login')
  } catch (err) {
    const field = err.response?.data?.field
    const message = err.response?.data?.message || '회원가입에 실패했습니다.'
    if (field === 'password') errors.password = message
    else if (field === 'nickname') errors.nickname = message
    else errors.general = message
  } finally {
    ui.submitting = false
  }
}

function signupWithGoogle() {
  window.location.href = `${import.meta.env.VITE_API_BASE_URL}/oauth2/authorization/google`
}
</script>

<template>
  <div class="auth-layout">
    <div class="auth-image">
      <img :src="authImage" alt="auth" />
    </div>

    <div class="auth-form-wrapper">
      <form class="auth-form" @submit.prevent="handleSignup">
        <h1 class="auth-title">회원가입</h1>

        <div class="field">
          <label for="email">이메일</label>
          <div class="email-row">
            <input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="이메일을 입력하세요"
              :disabled="ui.emailVerified"
            />
            <button
              type="button"
              class="verify-btn"
              :disabled="ui.emailVerified || ui.sendingCode"
              @click="handleSendCode"
            >
              {{ ui.sendingCode ? '발송 중...' : ui.codeSent ? '재발송' : '인증하기' }}
            </button>
          </div>
          <p v-if="errors.email" class="error-message">{{ errors.email }}</p>
        </div>

        <div v-if="ui.codeSent && !ui.emailVerified" class="field">
          <div class="email-row">
            <input v-model="form.code" type="text" maxlength="6" placeholder="인증 코드 6자리" />
            <button type="button" class="verify-btn" @click="handleVerifyCode">인증확인</button>
          </div>
          <p v-if="errors.code" class="error-message">{{ errors.code }}</p>
        </div>

        <p v-if="ui.emailVerified" class="success-message">이메일 인증이 완료되었습니다.</p>

        <div class="field">
          <label for="password">비밀번호</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="비밀번호를 입력하세요"
          />
          <p v-if="errors.password" class="error-message">{{ errors.password }}</p>
        </div>

        <div class="field">
          <label for="nickname">닉네임</label>
          <input id="nickname" v-model="form.nickname" type="text" placeholder="닉네임을 입력하세요" />
          <p v-if="errors.nickname" class="error-message">{{ errors.nickname }}</p>
        </div>

        <p v-if="errors.general" class="error-message">{{ errors.general }}</p>

        <button type="submit" class="submit-btn" :disabled="!ui.emailVerified || ui.submitting">
          {{ ui.submitting ? '가입 중...' : '회원가입' }}
        </button>

        <div class="divider">
          <span>소셜 로그인</span>
        </div>

        <button type="button" class="google-btn" @click="signupWithGoogle">
          <img :src="googleSignUp" alt="Google로 시작하기" />
        </button>

        <p class="login-link">
          이미 계정이 있으신가요? <RouterLink to="/login">로그인</RouterLink>
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

.email-row {
  display: flex;
  gap: 8px;
}

.email-row input {
  flex: 1;
}

.verify-btn {
  height: 48px;
  padding: 0 16px;
  border: 1px solid var(--color-primary);
  border-radius: 10px;
  background: #fff;
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    color 0.15s;
}

.verify-btn:hover {
  background: var(--color-primary);
  color: #fff;
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

.login-link {
  text-align: center;
  font-size: 14px;
  color: var(--color-muted);
}

.login-link a {
  color: var(--color-primary);
  font-weight: 500;
  text-decoration: none;
}

.error-message {
  font-size: 13px;
  color: #e53935;
}

.success-message {
  font-size: 13px;
  color: var(--color-primary);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.verify-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.field input:disabled {
  background: var(--color-bg, #f6f7fb);
  cursor: not-allowed;
}
</style>
