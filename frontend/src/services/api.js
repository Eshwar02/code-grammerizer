import axios from 'axios'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  stats: () => api.get('/auth/stats'),
  updateAvatar: (data) => api.put('/auth/profile', data),
}

export const projectsApi = {
  list: () => api.get('/projects/'),
  submitSnippet: (data) => api.post('/projects/snippet', data),
  submitFile: (formData) => api.post('/projects/file', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id) => api.delete(`/projects/${id}`),
}

export const reviewsApi = {
  trigger: (projectId) => api.post(`/reviews/${projectId}`),
  getForProject: (projectId) => api.get(`/reviews/project/${projectId}`),
  getById: (id) => api.get(`/reviews/${id}`),
  delete: (id) => api.delete(`/reviews/${id}`),
  all: (search = '', minScore = 0, maxScore = 100) => api.get(`/reviews/all/me?search=${search}&min_score=${minScore}&max_score=${maxScore}`),
  rerun: (reviewId, code) => api.post(`/reviews/${reviewId}/rerun`, { code }),
}

export const reportsApi = {
  pdf: (reviewId) => api.get(`/reports/${reviewId}/pdf`, { responseType: 'blob' }),
  markdown: (reviewId) => api.get(`/reports/${reviewId}/markdown`),
  pdfExecutive: (reviewId) => api.get(`/reports/${reviewId}/pdf/executive`, { responseType: 'blob' }),
  pdfSecurity: (reviewId) => api.get(`/reports/${reviewId}/pdf/security`, { responseType: 'blob' }),
  pdfComplexity: (reviewId) => api.get(`/reports/${reviewId}/pdf/complexity`, { responseType: 'blob' }),
  html: (reviewId) => api.get(`/reports/${reviewId}/html`),
}

export const lintApi = {
  live: (code, language) => api.post('/lint/live', { code, language }),
}

export const suggestApi = {
  code: (code, language, focus = '') => api.post('/suggest/code', { code, language, focus }),
}

export default api
