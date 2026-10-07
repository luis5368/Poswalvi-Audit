const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto
} = require('../controllers/productosController');

// Listar productos
router.get(
  '/',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerProductos
);

// Consultar producto por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerProductoPorId
);

// Crear producto
router.post(
  '/',
  verificarToken,
  verificarPermiso('Productos', 'Crear'),
  crearProducto
);

// Actualizar producto
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('Productos', 'Editar'),
  actualizarProducto
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('Productos', 'Editar'),
  cambiarEstadoProducto
);

module.exports = router;