import api from './api';

export const obtenerCompras = async (params = {}) => {
  const response = await api.get('/compras', { params });
  return response.data;
};

export const obtenerCompraPorId = async (id) => {
  const response = await api.get(`/compras/${id}`);
  return response.data;
};

export const crearCompra = async (datos) => {
  const response = await api.post('/compras', datos);
  return response.data;
};

export const anularCompra = async (id, motivo_anulacion) => {
  const response = await api.patch(`/compras/${id}/anular`, {
    motivo_anulacion
  });
  return response.data;
};

export const obtenerProveedoresCompra = async () => {
  const response = await api.get('/proveedores', {
    params: { estado: 'Activo' }
  });
  return response.data;
};

export const obtenerProductosCompra = async () => {
  const response = await api.get('/productos', {
    params: { estado: 'Activo' }
  });
  return response.data;
};

export const obtenerSucursalesBodegasCompra = async () => {
  const response = await api.get(
    '/catalogos-productos/sucursales-bodegas'
  );
  return response.data;
};

export const obtenerIvaCompra = async () => {
  const response = await api.get('/compras/configuracion/iva');
  return response.data;
};