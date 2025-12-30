import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken } = response.data.data;
          localStorage.setItem('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// ============================================
// AUTH
// ============================================
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ============================================
// JOURNÉES
// ============================================
export const journeesAPI = {
  getToday: () => api.get('/journees/today'),
  list: () => api.get('/journees'),
  get: (id) => api.get(`/journees/${id}`),
  terminer: (id) => api.post(`/journees/${id}/terminer`),
};

// ============================================
// STATS
// ============================================
export const statsAPI = {
  dashboard: (date) => api.get('/stats/dashboard', { params: { date } }),
  dashboardST: (date) => api.get('/stats/dashboard/st', { params: { date } }),
  avancement: (date) => api.get('/stats/avancement', { params: { date } }),
};

// ============================================
// SOUS-TRAITANTS
// ============================================
export const sousTraitantsAPI = {
  list: () => api.get('/sous-traitants'),
  get: (id) => api.get(`/sous-traitants/${id}`),
  create: (data) => api.post('/sous-traitants', data),
  update: (id, data) => api.put(`/sous-traitants/${id}`, data),
  delete: (id) => api.delete(`/sous-traitants/${id}`),
  stats: (id) => api.get(`/sous-traitants/${id}/stats`),
};

// ============================================
// CHAUFFEURS
// ============================================
export const chauffeursAPI = {
  list: () => api.get('/chauffeurs'),
  get: (id) => api.get(`/chauffeurs/${id}`),
  create: (data) => api.post('/chauffeurs', data),
  update: (id, data) => api.put(`/chauffeurs/${id}`, data),
  delete: (id) => api.delete(`/chauffeurs/${id}`),
};

// ============================================
// IMPORTS
// ============================================
export const importsAPI = {
  list: (date) => api.get('/imports', { params: { date } }),
  uploadGofo: (file, date) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);
    return api.post('/imports/gofo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadCainiao: (file, date) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);
    return api.post('/imports/cainiao', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadSpoke: (file, date) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);
    return api.post('/imports/spoke', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  delete: (id) => api.delete(`/imports/${id}`),
};

// ============================================
// TOURNÉES
// ============================================
export const tourneesAPI = {
  list: (date) => api.get('/tournees', { params: { date } }),
  get: (id) => api.get(`/tournees/${id}`),
  export: (id) => api.get(`/tournees/${id}/export`, { responseType: 'blob' }),
};

// ============================================
// COLIS
// ============================================
export const colisAPI = {
  list: (params) => api.get('/colis', { params }),
  getByTracking: (tracking) => api.get(`/colis/${tracking}`),
  getInconnus: () => api.get('/colis/inconnus'),
};

// ============================================
// USERS
// ============================================
export const usersAPI = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export default api;