const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerInventarioSaldos,
  obtenerInventarioCritico,
  obtenerInventarioSaldoPorId,
  ajustarInventarioSaldo
} = require('../controllers/inventarioSaldosController');

// Listar saldos
router.get(
  '/',
  verificarToken,
  verificarPermiso('InventarioSaldos', 'Consultar'),
  obtenerInventarioSaldos
);

// Inventario crítico
router.get(
  '/criticos',
  verificarToken,
  verificarPermiso('InventarioSaldos', 'Consultar'),
  obtenerInventarioCritico
);

// Consultar saldo por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('InventarioSaldos', 'Consultar'),
  obtenerInventarioSaldoPorId
);

// Ajustar inventario
router.patch(
  '/:id/ajustar',
  verificarToken,
  verificarPermiso('InventarioSaldos', 'Ajustar'),
  ajustarInventarioSaldo
);

module.exports = router;