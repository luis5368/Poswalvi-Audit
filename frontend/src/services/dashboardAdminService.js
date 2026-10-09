import api from './api';

export const obtenerResumenDashboardAdmin = async () => {
  const response = await api.get('/dashboard-admin/resumen');
  return response.data;
};