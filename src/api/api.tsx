import axios from "axios";

const API = axios.create({
  //baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000"
  baseURL: "https://api.impulsaepos.com"
});

// Interceptor para inyectar Token y Tenant ID automáticamente a todas las llamadas
API.interceptors.request.use((config) => {
  // Verificamos primero si hay token de admin SaaS y sino el token normal de terminal
  const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de respuesta: si el backend devuelve 401 (token expirado o inválido)
// limpiamos la sesión y redirigimos al login en lugar de mostrar la pantalla de caja.
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Evitar bucle infinito si ya estamos en /login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminRole');
        localStorage.removeItem('token');
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default API;
