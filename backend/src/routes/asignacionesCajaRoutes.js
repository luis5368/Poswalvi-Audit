
const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerCajerosDisponibles,
  crearAsignacion,
  obtenerMisAsignaciones,
  obtenerAsignacionesPendientes,
  responderAsignacion,
  cancelarAsignacion
} = require('../controllers/asignacionesCajaController');

// Apertura supervisada: requiere permiso administrativo.
router.get(
  '/cajeros',
  verificarToken,
  verificarPermiso('Cajas', 'Crear'),
  obtenerCajerosDisponibles
);

router.get(
  '/mias',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Consultar'),
  obtenerMisAsignaciones
);

router.get(
  '/',
  verificarToken,
  verificarPermiso('Cajas', 'Crear'),
  obtenerAsignacionesPendientes
);

router.post(
  '/',
  verificarToken,
  verificarPermiso('Cajas', 'Crear'),
  crearAsignacion
);

// Solo el cajero seleccionado puede responder.
router.post(
  '/:id/responder',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Aperturar'),
  responderAsignacion
);

router.post(
  '/:id/cancelar',
  verificarToken,
  verificarPermiso('Cajas', 'Crear'),
  cancelarAsignacion
);

module.exports = router;
