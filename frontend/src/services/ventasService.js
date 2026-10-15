import api from './api';

export const obtenerVentas = async (params = {}) => {
  const response = await api.get('/ventas', { params });
  return response.data;
};

export const obtenerVentaPorId = async (idVenta) => {
  const response = await api.get(`/ventas/${idVenta}`);
  return response.data;
};

export const crearVenta = async (data) => {
  const response = await api.post('/ventas', data);
  return response.data;
};

export const anularVenta = async (idVenta, data) => {
  const response = await api.patch(`/ventas/${idVenta}/anular`, data);
  return response.data;
};

export const obtenerClientesVenta = async (params = {}) => {
  const response = await api.get('/clientes', { params });
  return response.data;
};

export const obtenerProductosVenta = async (params = {}) => {
  const response = await api.get('/productos', { params });
  return response.data;
};

export const obtenerMetodosPago = async () => {
  const response = await api.get('/metodos-pago');
  return response.data;
};

export const obtenerTurnoActivoCaja = async (idCaja = 1) => {
  const response = await api.get('/turnos-caja/activo', {
    params: {
      id_caja: idCaja
    }
  });

  return response.data;
};