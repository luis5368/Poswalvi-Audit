import api from './api';

export const obtenerClientes = async (params = {}) => {
  const response = await api.get('/clientes', { params });
  return response.data;
};

export const obtenerClientePorId = async (idCliente) => {
  const response = await api.get(`/clientes/${idCliente}`);
  return response.data;
};

export const obtenerClientePorNit = async (nit) => {
  const response = await api.get(`/clientes/nit/${nit}`);
  return response.data;
};

export const crearCliente = async (data) => {
  const response = await api.post('/clientes', data);
  return response.data;
};

export const actualizarCliente = async (idCliente, data) => {
  const response = await api.put(`/clientes/${idCliente}`, data);
  return response.data;
};

export const cambiarEstadoCliente = async (idCliente, estado) => {
  const response = await api.patch(`/clientes/${idCliente}/estado`, {
    estado
  });

  return response.data;
};