const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerCompras,
  obtenerCompraPorId,
  crearCompra
} = require('../controllers/comprasController');

// Listar compras
router.get(
  '/',
  verificarToken,
  verificarPermiso('Compras', 'Consultar'),
  obtenerCompras
);

// Consultar compra por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Compras', 'Consultar'),
  obtenerCompraPorId
);

// Crear compra
router.post(
  '/',
  verificarToken,
  verificarPermiso('Compras', 'Crear'),
  crearCompra
);

module.exports = router;