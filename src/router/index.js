import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/views/SignupView.vue'),
    },
    {
      path: '/oauth/callback',
      component: () => import('@/views/OAuthCallbackView.vue'),
    },
    {
      path: '/chat-rooms/:chatRoomId',
      name: 'chat-room',
      component: () => import('@/views/ChatRoomView.vue'),
      meta: { requiresAuth: true },
    }
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return

  const authStore = useAuthStore()

  if (!authStore.checked) {
    await new Promise((resolve) => {
      const stop = watch(
        () => authStore.checked,
        (val) => {
          if (val) {
            stop()
            resolve()
          }
        },
      )
    })
  }

  if (!authStore.isLoggedIn) return '/login'
})

export default router
