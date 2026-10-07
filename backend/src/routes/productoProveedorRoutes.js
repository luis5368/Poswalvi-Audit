const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerProductoProveedor,
  obtenerProductoProveedorPorId,
  crearProductoProveedor,
  actualizarProductoProveedor,
  cambiarEstadoProductoProveedor,
  marcarProveedorPrincipal
} = require('../controllers/productoProveedorController');

// Listar asignaciones
router.get(
  '/',
  verificarToken,
  verificarPermiso('ProductoProveedor', 'Consultar'),
  obtenerProductoProveedor
);

// Consultar asignación por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('ProductoProveedor', 'Consultar'),
  obtenerProductoProveedorPorId
);

// Crear asignación
router.post(
  '/',
  verificarToken,
  verificarPermiso('ProductoProveedor', 'Crear'),
  crearProductoProveedor
);

// Actualizar asignación
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('ProductoProveedor', 'Editar'),
  actualizarProductoProveedor
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('ProductoProveedor', 'Editar'),
  cambiarEstadoProductoProveedor
);

// Marcar principal
router.patch(
  '/:id/principal',
  verificarToken,
  verificarPermiso('ProductoProveedor', 'Editar'),
  marcarProveedorPrincipal
);

module.exports = router;