import {trazaNavegacion} from './trazaNavegacion';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('poswalvi_token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    trazaNavegacion('respuesta_HTTP',{http:error.response?.status,solicitud:error.config?.url,autenticado:Boolean(localStorage.getItem('poswalvi_token'))});
    if (error.response?.status === 401 && error.config?.headers?.Authorization === 'Bearer '+localStorage.getItem('poswalvi_token')) {
      localStorage.removeItem('poswalvi_token');
      localStorage.removeItem('poswalvi_usuario');
      window.dispatchEvent(new Event('poswalvi-sesion-invalida'));
    }

    if(error.response?.status===403 && !error.config?.url?.includes('/auth/permisos') && error.config?.headers?.Authorization === 'Bearer '+localStorage.getItem('poswalvi_token')) window.dispatchEvent(new Event('poswalvi-permisos-invalidos'));
    return Promise.reject(error);
  }
);

export default api;