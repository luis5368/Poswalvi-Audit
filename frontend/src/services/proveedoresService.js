import api from './api';

export const obtenerProveedores = async (params = {}) => {
  const response = await api.get('/proveedores', { params });
  return response.data;
};

export const obtenerProveedorPorId = async (idProveedor) => {
  const response = await api.get(`/proveedores/${idProveedor}`);
  return response.data;
};

export const obtenerProveedorPorNit = async (nit) => {
  const response = await api.get(`/proveedores/nit/${nit}`);
  return response.data;
};

export const crearProveedor = async (data) => {
  const response = await api.post('/proveedores', data);
  return response.data;
};

export const actualizarProveedor = async (idProveedor, data) => {
  const response = await api.put(`/proveedores/${idProveedor}`, data);
  return response.data;
};

export const cambiarEstadoProveedor = async (idProveedor, estado) => {
  const response = await api.patch(`/proveedores/${idProveedor}/estado`, {
    estado
  });

  return response.data;
};