import api from './api';

export const obtenerInventarioSaldos = async (params = {}) => {
  const response = await api.get('/inventario-saldos', { params });
  return response.data;
};

export const obtenerInventarioCritico = async () => {
  const response = await api.get('/inventario-saldos/criticos');
  return response.data;
};

export const obtenerInventarioSaldoPorId = async (idSaldo) => {
  const response = await api.get(`/inventario-saldos/${idSaldo}`);
  return response.data;
};

export const ajustarInventarioSaldo = async (idSaldo, data) => {
  const response = await api.patch(`/inventario-saldos/${idSaldo}/ajustar`, data);
  return response.data;
};