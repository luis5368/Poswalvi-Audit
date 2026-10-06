const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerTurnosCaja,
  obtenerTurnoActivo,
  obtenerTurnoPorId,
  aperturarTurnoCaja,
  cerrarTurnoCaja
} = require('../controllers/turnosCajaController');

// Listar turnos
router.get(
  '/',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Consultar'),
  obtenerTurnosCaja
);

// Consultar turno activo
router.get(
  '/activo',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Consultar'),
  obtenerTurnoActivo
);

// Consultar turno por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Consultar'),
  obtenerTurnoPorId
);

// Aperturar turno
router.post(
  '/aperturar',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Aperturar'),
  aperturarTurnoCaja
);

// Cerrar turno
router.patch(
  '/:id/cerrar',
  verificarToken,
  verificarPermiso('TurnosCaja', 'Cerrar'),
  cerrarTurnoCaja
);

module.exports = router;