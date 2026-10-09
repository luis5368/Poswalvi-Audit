import api from './api';

export const obtenerUsuarios = async (params = {}) => {
  const response = await api.get('/usuarios', { params });
  return response.data;
};

export const crearUsuario = async (data) => {
  const response = await api.post('/usuarios', data);
  return response.data;
};

export const actualizarUsuario = async (idUsuario, data) => {
  const response = await api.put(`/usuarios/${idUsuario}`, data);
  return response.data;
};

export const cambiarEstadoUsuario = async (idUsuario, data) => {
  const response = await api.patch(`/usuarios/${idUsuario}/estado`, data);
  return response.data;
};

export const restablecerPasswordUsuario = async (idUsuario, data) => {
  const response = await api.patch(
    `/usuarios/${idUsuario}/restablecer-password`,
    data
  );
  return response.data;
};

export const desbloquearUsuario = async (idUsuario) => {
  const response = await api.patch(`/usuarios/${idUsuario}/desbloquear`);
  return response.data;
};