import axios from 'axios'

// Same pattern as Botanica: token in localStorage, attached as a Bearer header,
// auto-bounce to /login on 401.
const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
    }
    return Promise.reject(err)
  },
)

// Normalise an error into a thrown Error with the server's friendly message.
export function apiError(err) {
  const data = err?.response?.data
  return new Error(data?.message || data?.error || err.message || 'Something went wrong')
}

export default api
