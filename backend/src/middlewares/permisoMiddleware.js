const eventosSeguridad = require('../services/eventosSeguridadService');
const pool = require('../config/db');

const verificarPermiso = (modulo, accion) => {
  return async (req, res, next) => {
    try {
      if (!req.usuario || !req.usuario.id_rol) {
        return res.status(401).json({
          ok: false,
          mensaje: 'Usuario no autenticado'
        });
      }

      const idRol = req.usuario.id_rol;

      const [permisos] = await pool.query(
        `SELECT p.id_permiso
         FROM rol_permiso rp
         INNER JOIN permisos p ON rp.id_permiso = p.id_permiso
         WHERE rp.id_rol = ?
           AND p.modulo = ?
           AND p.accion = ?
         LIMIT 1`,
        [idRol, modulo, accion]
      );

      if (permisos.length === 0) {
        await eventosSeguridad.registrar({idUsuario:req.usuario.id_usuario,accion:'ACCESO_DENEGADO',evidencia:{permisoAsignado:false,moduloRequerido:modulo,accionRequerida:accion},ipOrigen:req.ip || null});

        return res.status(403).json({
          ok: false,
          mensaje: 'No tiene permiso para realizar esta acción'
        });
      }

      next();

    } catch (error) {
      console.error('Error verificando permiso');

      return res.status(500).json({
        ok: false,
        mensaje: 'Error interno verificando permisos'
      });
    }
  };
};

module.exports = verificarPermiso;
