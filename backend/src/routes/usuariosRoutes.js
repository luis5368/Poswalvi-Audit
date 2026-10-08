const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  restablecerPasswordUsuario,
  desbloquearUsuario
} = require('../controllers/usuariosController');

// Listar usuarios
router.get(
  '/',
  verificarToken,
  verificarPermiso('Usuarios', 'Consultar'),
  obtenerUsuarios
);

// Consultar usuario por ID
router.get(
  '/:id',
  verificarToken,
  verificarPermiso('Usuarios', 'Consultar'),
  obtenerUsuarioPorId
);

// Crear usuario
router.post(
  '/',
  verificarToken,
  verificarPermiso('Usuarios', 'Crear'),
  crearUsuario
);

// Actualizar usuario
router.put(
  '/:id',
  verificarToken,
  verificarPermiso('Usuarios', 'Editar'),
  actualizarUsuario
);

// Cambiar estado
router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('Usuarios', 'CambiarEstado'),
  cambiarEstadoUsuario
);

// Restablecer contraseña
router.patch(
  '/:id/restablecer-password',
  verificarToken,
  verificarPermiso('Usuarios', 'RestablecerPassword'),
  restablecerPasswordUsuario
);

// Desbloquear usuario
router.patch(
  '/:id/desbloquear',
  verificarToken,
  verificarPermiso('Usuarios', 'Desbloquear'),
  desbloquearUsuario
);

module.exports = router;