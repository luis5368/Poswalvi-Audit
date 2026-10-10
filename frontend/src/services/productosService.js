import api from './api';

export const obtenerProductos = async (params = {}) => {
  const response = await api.get('/productos', { params });
  return response.data;
};

export const obtenerProductoPorId = async (idProducto) => {
  const response = await api.get(`/productos/${idProducto}`);
  return response.data;
};

export const crearProducto = async (data) => {
  const response = await api.post('/productos', data);
  return response.data;
};

export const actualizarProducto = async (idProducto, data) => {
  const response = await api.put(`/productos/${idProducto}`, data);
  return response.data;
};

export const cambiarEstadoProducto = async (idProducto, estado) => {
  const response = await api.patch(`/productos/${idProducto}/estado`, {
    estado
  });

  return response.data;
};

export const obtenerCategoriasProducto = async () => {
  const response = await api.get('/catalogos-productos/categorias');
  return response.data;
};

export const obtenerSubcategoriasProducto = async (idCategoria = null) => {
  const response = await api.get('/catalogos-productos/subcategorias', {
    params: idCategoria ? { id_categoria: idCategoria } : {}
  });

  return response.data;
};

export const obtenerMarcasProducto = async () => {
  const response = await api.get('/catalogos-productos/marcas');
  return response.data;
};

export const obtenerUnidadesMedidaProducto = async () => {
  const response = await api.get('/catalogos-productos/unidades-medida');
  return response.data;
};

export const obtenerSucursalesBodegasProducto = async () => {
  const response = await api.get('/catalogos-productos/sucursales-bodegas');
  return response.data;
};