import axios from 'axios'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  const authStore = useAuthStore()
  if (authStore.accessToken) {
    config.headers.Authorization = `Bearer ${authStore.accessToken}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,

  async (err) => {
    if (!err.response) return Promise.reject(err)

    const config = err.config
    const { status, data } = err.response

    if (status === 401) {
      if (config.url?.endsWith('/api/v1/auth/login') || config.url?.endsWith('/api/v1/auth/regenerate')) {
        return Promise.reject(err)
      }

      const authStore = useAuthStore()

      const forceLogout = () => {
        authStore.clearToken()
        router.replace('/login')
      }

      if (data?.code === 'AUTH_003' || config._retried) {
        forceLogout()
        return Promise.reject(err)
      }

      try {
        const { data: tokenData } = await axios.post(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/regenerate`,
          null,
          { withCredentials: true },
        )
        authStore.setToken(tokenData.accessToken)

        config._retried = true
        config.headers.Authorization = `Bearer ${tokenData.accessToken}`
        return http(config)
      } catch {
        forceLogout()
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  },
)

export default http
