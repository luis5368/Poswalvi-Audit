const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerCajas,
  obtenerCajaPorId,
  crearCaja,
  actualizarCaja,
  cambiarEstadoCaja
} = require('../controllers/cajasController');

// Consultar cajas
router.get(
  '/',
  verificarToken,
  verificarPermiso('Cajas', 'Consultar'),
  obtenerCajas
);

// Consultar caja por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Cajas', 'Consultar'),
  obtenerCajaPorId
);

// Crear caja
router.post(
  '/',
  verificarToken,
  verificarPermiso('Cajas', 'Crear'),
  crearCaja
);

// Actualizar caja
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('Cajas', 'Editar'),
  actualizarCaja
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('Cajas', 'Editar'),
  cambiarEstadoCaja
);

module.exports = router;