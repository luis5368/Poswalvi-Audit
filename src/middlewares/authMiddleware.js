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
          r.nombre_rol
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

    const sesion = sesiones[0];

    const [politicas] = await pool.query(
      `SELECT *
       FROM seguridad_politica_rol
       WHERE id_rol = ?
         AND estado = 'Activa'
       LIMIT 1`,
      [user.id_rol]
    );

    const politica = politicas[0];

    if (politica && sesion.ultima_actividad) {
      const [tiempo] = await pool.query(
        `SELECT TIMESTAMPDIFF(SECOND, ?, NOW()) AS segundos_inactivo`,
        [sesion.ultima_actividad]
      );

      const segundosInactivo = tiempo[0].segundos_inactivo;

      if (segundosInactivo > politica.tiempo_inactividad_segundos) {
        await pool.query(
          `UPDATE usuario_sesion
           SET estado = 'Expirada',
               fecha_expiracion = NOW(),
               motivo_cierre = 'Sesión expirada por inactividad'
           WHERE id_sesion = ?`,
          [decoded.id_sesion]
        );

        await pool.query(
          `INSERT INTO auditoria_logs_sistema
           (id_usuario, modulo, accion, descripcion, ip_origen, user_agent, fecha_log)
           VALUES (?, 'Seguridad', 'INACTIVIDAD_EXCEDIDA', ?, ?, ?, NOW())`,
          [
            user.id_usuario,
            `Sesión expirada por inactividad. Tiempo inactivo: ${segundosInactivo} segundos`,
            req.ip,
            req.headers['user-agent'] || 'No identificado'
          ]
        );

        return res.status(401).json({
          ok: false,
          mensaje: 'Sesión expirada por inactividad'
        });
      }
    }

    await pool.query(
      `UPDATE usuario_sesion
       SET ultima_actividad = NOW()
       WHERE id_sesion = ?`,
      [decoded.id_sesion]
    );

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
    console.error('Error en authMiddleware:', error.message);

    return res.status(401).json({
      ok: false,
      mensaje: 'Token inválido o expirado'
    });
  }
};

module.exports = verificarToken;