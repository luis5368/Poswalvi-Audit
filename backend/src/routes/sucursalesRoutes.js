const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerSucursales,
  obtenerSucursalPorId,
  crearSucursal,
  actualizarSucursal,
  cambiarEstadoSucursal
} = require('../controllers/sucursalesController');

// Consultar sucursales
router.get(
  '/',
  verificarToken,
  verificarPermiso('Sucursales', 'Consultar'),
  obtenerSucursales
);

// Consultar sucursal por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Sucursales', 'Consultar'),
  obtenerSucursalPorId
);

// Crear sucursal
router.post(
  '/',
  verificarToken,
  verificarPermiso('Sucursales', 'Crear'),
  crearSucursal
);

// Actualizar sucursal
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('Sucursales', 'Editar'),
  actualizarSucursal
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('Sucursales', 'Editar'),
  cambiarEstadoSucursal
);

module.exports = router;