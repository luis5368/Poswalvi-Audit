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
        await pool.query(
          `INSERT INTO auditoria_logs_sistema
           (
            id_usuario,
            modulo,
            accion,
            descripcion,
            ip_origen,
            user_agent,
            fecha_log
           )
           VALUES (?, 'Seguridad', 'ACCESO_DENEGADO', ?, ?, ?, NOW())`,
          [
            req.usuario.id_usuario,
            `Intento de acceso no autorizado a ${modulo}:${accion}`,
            req.ip || '0.0.0.0',
            req.headers['user-agent'] || 'No identificado'
          ]
        );

        return res.status(403).json({
          ok: false,
          mensaje: 'No tiene permiso para realizar esta acción'
        });
      }

      next();

    } catch (error) {
      console.error('Error verificando permiso:', error);

      return res.status(500).json({
        ok: false,
        mensaje: 'Error interno verificando permisos'
      });
    }
  };
};

module.exports = verificarPermiso;