import api from './api';

export const obtenerResumenAuditoria = async () => {
  const response = await api.get('/auditoria/dashboard/resumen');
  return response.data;
};

export const ejecutarMotorAuditoria = async () => {
  const response = await api.post('/auditoria/ejecutar/todas');
  return response.data;
};

export const obtenerDetalleHallazgo = async (idHallazgo) => {
  const response = await api.get(`/auditoria/hallazgos/${idHallazgo}/detalle`);
  return response.data;
};