const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerProveedores,
  obtenerProveedorPorId,
  obtenerProveedorPorNit,
  crearProveedor,
  actualizarProveedor,
  cambiarEstadoProveedor
} = require('../controllers/proveedoresController');

// Listar proveedores
router.get(
  '/',
  verificarToken,
  verificarPermiso('Proveedores', 'Consultar'),
  obtenerProveedores
);

// Buscar proveedor por NIT
router.get(
  '/nit/:nit',
  verificarToken,
  verificarPermiso('Proveedores', 'Consultar'),
  obtenerProveedorPorNit
);

// Consultar proveedor por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Proveedores', 'Consultar'),
  obtenerProveedorPorId
);

// Crear proveedor
router.post(
  '/',
  verificarToken,
  verificarPermiso('Proveedores', 'Crear'),
  crearProveedor
);

// Actualizar proveedor
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('Proveedores', 'Editar'),
  actualizarProveedor
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('Proveedores', 'Editar'),
  cambiarEstadoProveedor
);

module.exports = router;