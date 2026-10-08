const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');

const obtenerIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
};

const registrarLogSeguridad = async ({
  idUsuario,
  accion,
  descripcion,
  ipOrigen,
  userAgent
}) => {
  await pool.query(
    `INSERT INTO auditoria_logs_sistema
     (id_usuario, modulo, accion, descripcion, ip_origen, user_agent, fecha_log)
     VALUES (?, 'Seguridad', ?, ?, ?, ?, NOW())`,
    [idUsuario, accion, descripcion, ipOrigen, userAgent]
  );
};

const login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    const ipOrigen = obtenerIp(req);
    const userAgent = req.headers['user-agent'] || 'No identificado';

    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Usuario y contraseña son obligatorios'
      });
    }

    const [usuarios] = await pool.query(
      `SELECT 
          u.*, 
          r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.usuario = ?
       LIMIT 1`,
      [usuario]
    );

    if (usuarios.length === 0) {
      return res.status(401).json({
        ok: false,
        mensaje: 'Credenciales inválidas'
      });
    }

    const user = usuarios[0];

    if (
      user.estado === 'Bloqueado' &&
      user.bloqueo_hasta &&
      new Date(user.bloqueo_hasta) <= new Date()
    ) {
      await pool.query(
        `UPDATE usuarios
         SET estado = 'Activo',
             intentos_fallidos = 0,
             bloqueo_hasta = NULL,
             motivo_bloqueo = NULL
         WHERE id_usuario = ?`,
        [user.id_usuario]
      );

      user.estado = 'Activo';
      user.intentos_fallidos = 0;
    }

    if (user.estado !== 'Activo') {
      return res.status(403).json({
        ok: false,
        mensaje: 'Usuario bloqueado o inactivo'
      });
    }

    const [politicas] = await pool.query(
      `SELECT *
       FROM seguridad_politica_rol
       WHERE id_rol = ?
         AND estado = 'Activa'
       LIMIT 1`,
      [user.id_rol]
    );

    const politica = politicas[0] || {
      max_intentos_fallidos: 3,
      max_sesiones_activas: 1,
      tiempo_inactividad_segundos: 600
    };

    const passwordValido = await bcrypt.compare(password, user.password_hash);

    if (!passwordValido) {
      const intentosActuales = Number(user.intentos_fallidos || 0);
      const nuevosIntentos = intentosActuales + 1;

      if (nuevosIntentos >= politica.max_intentos_fallidos) {
        await pool.query(
          `UPDATE usuarios
           SET intentos_fallidos = ?,
               estado = 'Bloqueado',
               bloqueo_hasta = DATE_ADD(NOW(), INTERVAL 15 MINUTE),
               motivo_bloqueo = 'Superó el máximo de intentos fallidos'
           WHERE id_usuario = ?`,
          [nuevosIntentos, user.id_usuario]
        );

        await registrarLogSeguridad({
          idUsuario: user.id_usuario,
          accion: 'BLOQUEO_USUARIO',
          descripcion: 'Usuario bloqueado por superar intentos fallidos',
          ipOrigen,
          userAgent
        });

        return res.status(403).json({
          ok: false,
          mensaje: 'Usuario bloqueado por superar el máximo de intentos fallidos'
        });
      }

      await pool.query(
        `UPDATE usuarios
         SET intentos_fallidos = ?
         WHERE id_usuario = ?`,
        [nuevosIntentos, user.id_usuario]
      );

      return res.status(401).json({
        ok: false,
        mensaje: `Credenciales inválidas. Intento ${nuevosIntentos} de ${politica.max_intentos_fallidos}`
      });
    }

    const [sesionesActivas] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM usuario_sesion
       WHERE id_usuario = ?
         AND estado = 'Activa'
         AND fecha_expiracion > NOW()`,
      [user.id_usuario]
    );

    if (sesionesActivas[0].total >= politica.max_sesiones_activas) {
      await registrarLogSeguridad({
        idUsuario: user.id_usuario,
        accion: 'SESION_DUPLICADA',
        descripcion: 'Intento de iniciar más sesiones de las permitidas',
        ipOrigen,
        userAgent
      });

      return res.status(403).json({
        ok: false,
        mensaje: 'Ya existe una sesión activa para este usuario'
      });
    }

    await pool.query(
      `UPDATE usuarios
       SET intentos_fallidos = 0,
           bloqueo_hasta = NULL,
           motivo_bloqueo = NULL,
           ultimo_acceso = NOW()
       WHERE id_usuario = ?`,
      [user.id_usuario]
    );

    const tokenId = crypto.randomUUID();

    const dispositivoHash = crypto
      .createHash('sha256')
      .update(`${user.id_usuario}|${ipOrigen}|${userAgent}`)
      .digest('hex');

    const [sesion] = await pool.query(
      `INSERT INTO usuario_sesion
       (
        id_usuario,
        token_id,
        ip_origen,
        user_agent,
        fecha_inicio,
        fecha_expiracion,
        ultima_actividad,
        dispositivo_hash,
        estado
       )
       VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 8 HOUR), NOW(), ?, 'Activa')`,
      [
        user.id_usuario,
        tokenId,
        ipOrigen,
        userAgent,
        dispositivoHash
      ]
    );

    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        id_rol: user.id_rol,
        nombre_rol: user.nombre_rol,
        id_sesion: sesion.insertId,
        token_id: tokenId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await registrarLogSeguridad({
      idUsuario: user.id_usuario,
      accion: 'LOGIN_EXITOSO',
      descripcion: 'Inicio de sesión correcto',
      ipOrigen,
      userAgent
    });

    return res.json({
      ok: true,
      mensaje: 'Login exitoso',
      token,
      usuario: {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        apellido: user.apellido,
        usuario: user.usuario,
        correo: user.correo,
        id_rol: user.id_rol,
        nombre_rol: user.nombre_rol,
        rol: user.nombre_rol,
        id_sucursal: user.id_sucursal,
        estado: user.estado,
        requiere_cambio_password: Number(user.requiere_cambio_password || 0)
      }
    });

  } catch (error) {
    console.error('Error en login:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno en login'
    });
  }
};

const logout = async (req, res) => {
  try {
    const { id_sesion } = req.usuario;

    await pool.query(
      `UPDATE usuario_sesion
       SET estado = 'Cerrada',
           fecha_expiracion = NOW(),
           motivo_cierre = 'Cierre manual de sesión'
       WHERE id_sesion = ?`,
      [id_sesion]
    );

    res.json({
      ok: true,
      mensaje: 'Sesión cerrada correctamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cerrar sesión'
    });
  }
};

const perfil = async (req, res) => {
  res.json({
    ok: true,
    usuario: req.usuario
  });
};

// ============================================================
// PATCH /api/auth/cambiar-password
// Cambiar contraseña del usuario autenticado
// ============================================================
const cambiarPassword = async (req, res) => {
  try {
    const idUsuario = req.usuario.id_usuario;

    const {
      password_actual,
      password_nueva,
      confirmar_password
    } = req.body;

    if (!password_actual || password_actual.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'La contraseña actual es obligatoria'
      });
    }

    if (!password_nueva || password_nueva.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva contraseña es obligatoria'
      });
    }

    if (password_nueva.length < 8) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva contraseña debe tener al menos 8 caracteres'
      });
    }

    const tieneLetra = /[A-Za-z]/.test(password_nueva);
    const tieneNumero = /[0-9]/.test(password_nueva);

    if (!tieneLetra || !tieneNumero) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva contraseña debe contener letras y números'
      });
    }

    if (confirmar_password && password_nueva !== confirmar_password) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La confirmación de contraseña no coincide'
      });
    }

    if (password_actual === password_nueva) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La nueva contraseña no puede ser igual a la contraseña actual'
      });
    }

    const [usuarioRows] = await pool.query(
      `
      SELECT
        id_usuario,
        usuario,
        password_hash,
        estado
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [idUsuario]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    const usuario = usuarioRows[0];

    if (usuario.estado !== 'Activo') {
      return res.status(403).json({
        ok: false,
        mensaje: 'El usuario no está activo'
      });
    }

    const passwordValida = await bcrypt.compare(
      password_actual,
      usuario.password_hash
    );

    if (!passwordValida) {
      return res.status(401).json({
        ok: false,
        mensaje: 'La contraseña actual no es correcta'
      });
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);

    await pool.query(
      `
      UPDATE usuarios
      SET
        password_hash = ?,
        requiere_cambio_password = 0,
        fecha_cambio_password = NOW(),
        intentos_fallidos = 0,
        bloqueo_hasta = NULL,
        motivo_bloqueo = NULL,
        actualizado_en = NOW()
      WHERE id_usuario = ?
      `,
      [nuevoHash, idUsuario]
    );

    // Cerrar otras sesiones activas del mismo usuario, manteniendo la actual
    if (req.usuario.id_sesion) {
      await pool.query(
        `
        UPDATE usuario_sesion
        SET
          estado = 'Cerrada',
          fecha_expiracion = NOW(),
          motivo_cierre = 'Sesión cerrada por cambio de contraseña'
        WHERE id_usuario = ?
          AND id_sesion <> ?
          AND estado = 'Activa'
        `,
        [idUsuario, req.usuario.id_sesion]
      );
    }

    await pool.query(
      `
      INSERT INTO auditoria_logs_sistema (
        id_usuario,
        modulo,
        accion,
        descripcion,
        ip_origen,
        user_agent,
        fecha_log
      )
      VALUES (?, 'Auth', 'CAMBIO_PASSWORD', ?, ?, ?, NOW())
      `,
      [
        idUsuario,
        `El usuario ${usuario.usuario} cambió su contraseña`,
        req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || req.ip || null,
        req.headers['user-agent'] || null
      ]
    );

    return res.json({
      ok: true,
      mensaje: 'Contraseña actualizada correctamente',
      requiere_cambio_password: 0
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar contraseña'
    });
  }
};

module.exports = {
  login,
  logout,
  perfil,
  cambiarPassword
};