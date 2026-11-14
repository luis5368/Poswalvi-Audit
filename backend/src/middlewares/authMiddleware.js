const cicloSesion = require('../services/cicloSesionService');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const verificarToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Token no proporcionado'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.id_usuario || !decoded.id_sesion || !decoded.token_id) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Token incompleto o inválido'
      });
    }

    const [usuarios] = await pool.query(
      `SELECT 
          u.id_usuario, 
          u.usuario, 
          u.nombre, 
          u.apellido, 
          u.id_rol, 
          u.estado, 
          r.nombre_rol, r.estado AS estado_rol, u.requiere_cambio_password
       FROM usuarios u
       INNER JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ?
       LIMIT 1`,
      [decoded.id_usuario]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Usuario no válido'
      });
    }

    const user = usuarios[0];

    if (user.estado !== 'Activo') {
      return res.status(403).json({
        ok: false,
        mensaje: 'Usuario no activo'
      });
    }

    const [sesiones] = await pool.query(
      `SELECT *
       FROM usuario_sesion
       WHERE id_sesion = ?
         AND id_usuario = ?
         AND token_id = ?
         AND estado = 'Activa'
         AND fecha_expiracion > NOW()
       LIMIT 1`,
      [
        decoded.id_sesion,
        decoded.id_usuario,
        decoded.token_id
      ]
    );

    if (sesiones.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Sesión inválida, expirada o revocada'
      });
    }

    const salida = req.method === 'POST' && req.baseUrl === '/api/auth' && req.path === '/logout';
    const cambio = req.method === 'PATCH' && req.baseUrl === '/api/auth' && req.path === '/cambiar-password';
    if (!salida && user.estado_rol !== 'Activo') return res.status(403).json({ok:false,codigo:'ROL_INACTIVO',mensaje:'Rol inactivo'});
    if (!salida && !cambio && Number(user.requiere_cambio_password)) return res.status(403).json({ok:false,codigo:'CAMBIO_PASSWORD_REQUERIDO',mensaje:'Debe cambiar su contrasena'});


    if (!await cicloSesion.validarActividad(decoded, user.id_rol, req.ip || null)) {
      return res.status(401).json({ok:false, mensaje:'Sesion invalida, expirada o revocada'});
    }

    req.usuario = {
      id_usuario: user.id_usuario,
      usuario: user.usuario,
      nombre: user.nombre,
      apellido: user.apellido,
      id_rol: user.id_rol,
      rol: user.nombre_rol,
      id_sesion: decoded.id_sesion,
      token_id: decoded.token_id
    };

    next();

  } catch (error) {
    const invalido = ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(error.name);
    // Un fallo del repositorio no demuestra revocacion ni invalidez del JWT.
    return res.status(invalido ? 401 : 503).json({
      ok: false,
      mensaje: invalido ? 'Token inválido o expirado' : 'No se pudo verificar la sesión. Intente nuevamente.'
    });
  }
};

module.exports = verificarToken;
