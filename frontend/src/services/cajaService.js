
import api from './api';

export const obtenerCajas = async (params = {}) => {
  const response = await api.get('/cajas', { params });
  return response.data;
};

export const obtenerTurnos = async (params = {}) => {
  const response = await api.get('/turnos-caja', { params });
  return response.data;
};

export const obtenerTurnoActivo = async (idCaja = null) => {
  const response = await api.get('/turnos-caja/activo', {
    params: idCaja ? { id_caja: idCaja } : {}
  });

  return response.data;
};

export const obtenerTurnoPorId = async (idTurno) => {
  const response = await api.get(`/turnos-caja/${idTurno}`);
  return response.data;
};

export const abrirTurno = async (datos) => {
  const response = await api.post(
    '/turnos-caja/aperturar',
    datos
  );

  return response.data;
};

export const cerrarTurno = async (idTurno, datos) => {
  const response = await api.patch(
    `/turnos-caja/${idTurno}/cerrar`,
    datos
  );

  return response.data;
};


export const crearCaja = async (datos) => {
  const response = await api.post('/cajas', datos);
  return response.data;
};

export const actualizarCaja = async (idCaja, datos) => {
  const response = await api.put(`/cajas/${idCaja}`, datos);
  return response.data;
};

export const cambiarEstadoCaja = async (idCaja, datos) => {
  const response = await api.patch(
    `/cajas/${idCaja}/estado`,
    datos
  );
  return response.data;
};

export const obtenerSucursalesCaja = async (params = {}) => {
  const response = await api.get('/sucursales', { params });
  return response.data;
};
