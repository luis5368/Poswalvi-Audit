const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerClientes,
  obtenerClientePorId,
  obtenerClientePorNit,
  crearCliente,
  actualizarCliente,
  cambiarEstadoCliente
} = require('../controllers/clientesController');

// Listar clientes
router.get(
  '/',
  verificarToken,
  verificarPermiso('Clientes', 'Consultar'),
  obtenerClientes
);

// Buscar cliente por NIT
router.get(
  '/nit/:nit',
  verificarToken,
  verificarPermiso('Clientes', 'Consultar'),
  obtenerClientePorNit
);

// Consultar cliente por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Clientes', 'Consultar'),
  obtenerClientePorId
);

// Crear cliente
router.post(
  '/',
  verificarToken,
  verificarPermiso('Clientes', 'Crear'),
  crearCliente
);

// Actualizar cliente
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('Clientes', 'Editar'),
  actualizarCliente
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('Clientes', 'Editar'),
  cambiarEstadoCliente
);

module.exports = router;