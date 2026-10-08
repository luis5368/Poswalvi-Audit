const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerResumenDashboardAdmin
} = require('../controllers/dashboardAdminController');

// Dashboard administrativo
router.get(
  '/resumen',
  verificarToken,
  verificarPermiso('Reportes', 'Consultar'),
  obtenerResumenDashboardAdmin
);

module.exports = router;