const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta,
  anularVenta
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

// Anular venta
router.patch(
  '/:id/anular',
  verificarToken,
  verificarPermiso('Ventas', 'Anular'),
  anularVenta
);


module.exports = router;