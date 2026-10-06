const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta
} = require('../controllers/ventasController');

// Listar ventas
router.get(
  '/',
  verificarToken,
  verificarPermiso('Ventas', 'Consultar'),
  obtenerVentas
);

// Consultar venta por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Ventas', 'Consultar'),
  obtenerVentaPorId
);

// Crear venta
router.post(
  '/',
  verificarToken,
  verificarPermiso('Ventas', 'Crear'),
  crearVenta
);

module.exports = router;