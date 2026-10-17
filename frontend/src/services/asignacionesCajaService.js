
import api from './api';

const BASE = '/turnos-caja/asignaciones';

export const obtenerCajerosDisponibles = async (idCaja) => {
  const response = await api.get(`${BASE}/cajeros`, {
    params: { id_caja: idCaja }
  });

  return response.data;
};

export const obtenerMisAsignaciones = async () => {
  const response = await api.get(`${BASE}/mias`);
  return response.data;
};

export const obtenerAsignacionesPendientes = async () => {
  const response = await api.get(BASE);
  return response.data;
};

export const crearAsignacionCaja = async (datos) => {
  const response = await api.post(BASE, datos);
  return response.data;
};

export const responderAsignacionCaja = async (id, accion) => {
  const response = await api.post(
    `${BASE}/${id}/responder`,
    { accion }
  );

  return response.data;
};

export const cancelarAsignacionCaja = async (id) => {
  const response = await api.post(`${BASE}/${id}/cancelar`);
  return response.data;
};
