const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerCategorias,
  obtenerSubcategorias,
  obtenerMarcas,
  obtenerUnidadesMedida,
  obtenerSucursalesBodegas
} = require('../controllers/catalogosProductosController');

router.get(
  '/categorias',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerCategorias
);

router.get(
  '/subcategorias',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerSubcategorias
);

router.get(
  '/marcas',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerMarcas
);

router.get(
  '/unidades-medida',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerUnidadesMedida
);

router.get(
  '/sucursales-bodegas',
  verificarToken,
  verificarPermiso('Productos', 'Consultar'),
  obtenerSucursalesBodegas
);

module.exports = router;