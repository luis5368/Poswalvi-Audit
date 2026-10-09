import api from './api';

export const loginRequest = async ({ usuario, password }) => {
  const response = await api.post('/auth/login', {
    usuario,
    password
  });

  return response.data;
};

export const cambiarPasswordRequest = async ({
  password_actual,
  password_nueva,
  confirmar_password
}) => {
  const response = await api.patch('/auth/cambiar-password', {
    password_actual,
    password_nueva,
    confirmar_password
  });

  return response.data;
};

export const obtenerPerfilRequest = async () => {
  const response = await api.get('/auth/perfil');
  return response.data;
};

export const logoutRequest = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};