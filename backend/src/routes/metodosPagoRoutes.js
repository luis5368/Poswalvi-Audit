const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerMetodosPago,
  obtenerMetodoPagoPorId,
  crearMetodoPago,
  actualizarMetodoPago,
  cambiarEstadoMetodoPago
} = require('../controllers/metodosPagoController');

// Consultar métodos de pago
router.get(
  '/',
  verificarToken,
  verificarPermiso('MetodosPago', 'Consultar'),
  obtenerMetodosPago
);

// Consultar método de pago por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('MetodosPago', 'Consultar'),
  obtenerMetodoPagoPorId
);

// Crear método de pago
router.post(
  '/',
  verificarToken,
  verificarPermiso('MetodosPago', 'Crear'),
  crearMetodoPago
);

// Actualizar método de pago
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('MetodosPago', 'Editar'),
  actualizarMetodoPago
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('MetodosPago', 'Editar'),
  cambiarEstadoMetodoPago
);

module.exports = router;