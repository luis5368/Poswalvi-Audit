const bcrypt = require('bcryptjs');
const pool = require('../config/db');

const validarEstadoUsuario = (estado) => {
  return ['Activo', 'Inactivo', 'Bloqueado'].includes(estado);
};

const validarCorreo = (correo) => {
  if (!correo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
};

const validarPassword = (password) => {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }

  const tieneLetra = /[A-Za-z]/.test(password);
  const tieneNumero = /[0-9]/.test(password);

  if (!tieneLetra || !tieneNumero) {
    return 'La contraseña debe contener letras y números';
  }

  return null;
};

const obtenerIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket?.remoteAddress ||
    req.ip ||
    null
  );
};

const registrarLogSistema = async ({
  id_usuario,
  modulo,
  accion,
  descripcion,
  ip_origen,
  user_agent
}) => {
  try {
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
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        id_usuario || null,
        modulo,
        accion,
        descripcion,
        ip_origen || null,
        user_agent || null
      ]
    );
  } catch (error) {
    console.error('No se pudo registrar log de sistema:', error.message);
  }
};

// ============================================================
// GET /api/usuarios
// Listar usuarios
// ============================================================
const obtenerUsuarios = async (req, res) => {
  try {
    const {
      estado,
      id_rol,
      id_sucursal,
      buscar
    } = req.query;

    let sql = `
      SELECT
        u.id_usuario,
        u.id_rol,
        r.nombre_rol,
        u.id_sucursal,
        s.nombre_sucursal,
        u.nombre,
        u.apellido,
        u.usuario,
        u.correo,
        u.estado,
        u.ultimo_acceso,
        u.intentos_fallidos,
        u.bloqueo_hasta,
        u.motivo_bloqueo,
        u.requiere_cambio_password,
        u.fecha_cambio_password,
        u.creado_en,
        u.actualizado_en
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN sucursales s ON u.id_sucursal = s.id_sucursal
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND u.estado = ?`;
      params.push(estado);
    }

    if (id_rol) {
      sql += ` AND u.id_rol = ?`;
      params.push(id_rol);
    }

    if (id_sucursal) {
      sql += ` AND u.id_sucursal = ?`;
      params.push(id_sucursal);
    }

    if (buscar) {
      sql += `
        AND (
          u.nombre LIKE ?
          OR u.apellido LIKE ?
          OR u.usuario LIKE ?
          OR u.correo LIKE ?
          OR r.nombre_rol LIKE ?
          OR s.nombre_sucursal LIKE ?
        )
      `;
      params.push(
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`
      );
    }

    sql += ` ORDER BY u.id_usuario DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      usuarios: rows
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener usuarios'
    });
  }
};

// ============================================================
// GET /api/usuarios/:id
// Obtener usuario por ID
// ============================================================
const obtenerUsuarioPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.id_rol,
        r.nombre_rol,
        u.id_sucursal,
        s.nombre_sucursal,
        u.nombre,
        u.apellido,
        u.usuario,
        u.correo,
        u.estado,
        u.ultimo_acceso,
        u.intentos_fallidos,
        u.bloqueo_hasta,
        u.motivo_bloqueo,
        u.requiere_cambio_password,
        u.fecha_cambio_password,
        u.creado_en,
        u.actualizado_en
      FROM usuarios u
      INNER JOIN roles r ON u.id_rol = r.id_rol
      LEFT JOIN sucursales s ON u.id_sucursal = s.id_sucursal
      WHERE u.id_usuario = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    return res.json({
      ok: true,
      usuario: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener usuario por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener usuario'
    });
  }
};

// ============================================================
// POST /api/usuarios
// Crear usuario
// ============================================================
const crearUsuario = async (req, res) => {
  try {
    const {
      id_rol,
      id_sucursal,
      nombre,
      apellido,
      usuario,
      correo,
      password_temporal,
      estado = 'Activo',
      requiere_cambio_password = true
    } = req.body;

    if (!id_rol) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El rol es obligatorio'
      });
    }

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre es obligatorio'
      });
    }

    if (!apellido || apellido.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El apellido es obligatorio'
      });
    }

    if (!usuario || usuario.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El usuario es obligatorio'
      });
    }

    if (!correo || correo.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El correo es obligatorio'
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El correo no tiene un formato válido'
      });
    }

    if (!validarEstadoUsuario(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo, Inactivo o Bloqueado'
      });
    }

    const errorPassword = validarPassword(password_temporal);

    if (errorPassword) {
      return res.status(400).json({
        ok: false,
        mensaje: errorPassword
      });
    }

    const [rolRows] = await pool.query(
      `
      SELECT id_rol, estado
      FROM roles
      WHERE id_rol = ?
      LIMIT 1
      `,
      [id_rol]
    );

    if (rolRows.length === 0 || rolRows[0].estado !== 'Activo') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El rol indicado no existe o está inactivo'
      });
    }

    if (id_sucursal) {
      const [sucursalRows] = await pool.query(
        `
        SELECT id_sucursal, estado
        FROM sucursales
        WHERE id_sucursal = ?
        LIMIT 1
        `,
        [id_sucursal]
      );

      if (sucursalRows.length === 0 || sucursalRows[0].estado !== 'Activa') {
        return res.status(400).json({
          ok: false,
          mensaje: 'La sucursal indicada no existe o está inactiva'
        });
      }
    }

    const [duplicadoUsuario] = await pool.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE LOWER(usuario) = LOWER(?)
      LIMIT 1
      `,
      [usuario.trim()]
    );

    if (duplicadoUsuario.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe un usuario con ese nombre de usuario'
      });
    }

    const [duplicadoCorreo] = await pool.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE LOWER(correo) = LOWER(?)
      LIMIT 1
      `,
      [correo.trim()]
    );

    if (duplicadoCorreo.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe un usuario con ese correo'
      });
    }

    const passwordHash = await bcrypt.hash(password_temporal, 10);

    const [result] = await pool.query(
      `
      INSERT INTO usuarios (
        id_rol,
        id_sucursal,
        nombre,
        apellido,
        usuario,
        correo,
        password_hash,
        estado,
        intentos_fallidos,
        bloqueo_hasta,
        motivo_bloqueo,
        requiere_cambio_password,
        fecha_cambio_password,
        creado_en,
        actualizado_en
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, NULL, NOW(), NOW())
      `,
      [
        id_rol,
        id_sucursal || null,
        nombre.trim(),
        apellido.trim(),
        usuario.trim(),
        correo.trim(),
        passwordHash,
        estado,
        requiere_cambio_password ? 1 : 0
      ]
    );

    await registrarLogSistema({
      id_usuario: req.usuario.id_usuario,
      modulo: 'Usuarios',
      accion: 'CREAR_USUARIO',
      descripcion: `Creó el usuario ${usuario.trim()} con ID ${result.insertId}`,
      ip_origen: obtenerIp(req),
      user_agent: req.headers['user-agent']
    });

    return res.status(201).json({
      ok: true,
      mensaje: 'Usuario creado correctamente',
      id_usuario: result.insertId
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear usuario'
    });
  }
};

// ============================================================
// PUT /api/usuarios/:id
// Actualizar usuario
// No actualiza contraseña.
// ============================================================
const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      id_rol,
      id_sucursal,
      nombre,
      apellido,
      usuario,
      correo,
      estado
    } = req.body;

    if (!id_rol) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El rol es obligatorio'
      });
    }

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre es obligatorio'
      });
    }

    if (!apellido || apellido.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El apellido es obligatorio'
      });
    }

    if (!usuario || usuario.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El usuario es obligatorio'
      });
    }

    if (!correo || correo.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El correo es obligatorio'
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El correo no tiene un formato válido'
      });
    }

    if (estado && !validarEstadoUsuario(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo, Inactivo o Bloqueado'
      });
    }

    const [usuarioActual] = await pool.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id]
    );

    if (usuarioActual.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    const [duplicadoUsuario] = await pool.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE LOWER(usuario) = LOWER(?)
        AND id_usuario <> ?
      LIMIT 1
      `,
      [usuario.trim(), id]
    );

    if (duplicadoUsuario.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otro usuario con ese nombre de usuario'
      });
    }

    const [duplicadoCorreo] = await pool.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE LOWER(correo) = LOWER(?)
        AND id_usuario <> ?
      LIMIT 1
      `,
      [correo.trim(), id]
    );

    if (duplicadoCorreo.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otro usuario con ese correo'
      });
    }

    await pool.query(
      `
      UPDATE usuarios
      SET
        id_rol = ?,
        id_sucursal = ?,
        nombre = ?,
        apellido = ?,
        usuario = ?,
        correo = ?,
        estado = ?,
        actualizado_en = NOW()
      WHERE id_usuario = ?
      `,
      [
        id_rol,
        id_sucursal || null,
        nombre.trim(),
        apellido.trim(),
        usuario.trim(),
        correo.trim(),
        estado || 'Activo',
        id
      ]
    );

    await registrarLogSistema({
      id_usuario: req.usuario.id_usuario,
      modulo: 'Usuarios',
      accion: 'EDITAR_USUARIO',
      descripcion: `Actualizó el usuario ID ${id}`,
      ip_origen: obtenerIp(req),
      user_agent: req.headers['user-agent']
    });

    return res.json({
      ok: true,
      mensaje: 'Usuario actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar usuario'
    });
  }
};

// ============================================================
// PATCH /api/usuarios/:id/estado
// Cambiar estado: Activo, Inactivo, Bloqueado
// ============================================================
const cambiarEstadoUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo_bloqueo } = req.body;

    if (!validarEstadoUsuario(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo, Inactivo o Bloqueado'
      });
    }

    const [usuarioRows] = await pool.query(
      `
      SELECT id_usuario, usuario
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    if (Number(id) === Number(req.usuario.id_usuario) && estado !== 'Activo') {
      return res.status(400).json({
        ok: false,
        mensaje: 'No puedes inactivar o bloquear tu propio usuario desde esta acción'
      });
    }

    await pool.query(
      `
      UPDATE usuarios
      SET
        estado = ?,
        motivo_bloqueo = CASE WHEN ? = 'Bloqueado' THEN ? ELSE NULL END,
        bloqueo_hasta = CASE WHEN ? = 'Bloqueado' THEN bloqueo_hasta ELSE NULL END,
        actualizado_en = NOW()
      WHERE id_usuario = ?
      `,
      [
        estado,
        estado,
        motivo_bloqueo || 'Bloqueo administrativo',
        estado,
        id
      ]
    );

    await registrarLogSistema({
      id_usuario: req.usuario.id_usuario,
      modulo: 'Usuarios',
      accion: 'CAMBIAR_ESTADO_USUARIO',
      descripcion: `Cambió estado del usuario ${usuarioRows[0].usuario} a ${estado}`,
      ip_origen: obtenerIp(req),
      user_agent: req.headers['user-agent']
    });

    return res.json({
      ok: true,
      mensaje: `Usuario marcado como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado de usuario'
    });
  }
};

// ============================================================
// PATCH /api/usuarios/:id/restablecer-password
// Restablecer contraseña por Administrador/Superusuario.
// ============================================================
const restablecerPasswordUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      password_temporal,
      forzar_cambio = true
    } = req.body;

    const errorPassword = validarPassword(password_temporal);

    if (errorPassword) {
      return res.status(400).json({
        ok: false,
        mensaje: errorPassword
      });
    }

    const [usuarioRows] = await pool.query(
      `
      SELECT id_usuario, usuario, estado
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    const passwordHash = await bcrypt.hash(password_temporal, 10);

    await pool.query(
      `
      UPDATE usuarios
      SET
        password_hash = ?,
        requiere_cambio_password = ?,
        fecha_cambio_password = NOW(),
        intentos_fallidos = 0,
        bloqueo_hasta = NULL,
        motivo_bloqueo = NULL,
        actualizado_en = NOW()
      WHERE id_usuario = ?
      `,
      [
        passwordHash,
        forzar_cambio ? 1 : 0,
        id
      ]
    );

    await registrarLogSistema({
      id_usuario: req.usuario.id_usuario,
      modulo: 'Usuarios',
      accion: 'RESTABLECER_PASSWORD',
      descripcion: `Restableció la contraseña del usuario ${usuarioRows[0].usuario}`,
      ip_origen: obtenerIp(req),
      user_agent: req.headers['user-agent']
    });

    return res.json({
      ok: true,
      mensaje: 'Contraseña restablecida correctamente',
      requiere_cambio_password: forzar_cambio ? 1 : 0
    });
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al restablecer contraseña'
    });
  }
};

// ============================================================
// PATCH /api/usuarios/:id/desbloquear
// Desbloquear usuario
// ============================================================
const desbloquearUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const [usuarioRows] = await pool.query(
      `
      SELECT id_usuario, usuario
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      `,
      [id]
    );

    if (usuarioRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Usuario no encontrado'
      });
    }

    await pool.query(
      `
      UPDATE usuarios
      SET
        estado = 'Activo',
        intentos_fallidos = 0,
        bloqueo_hasta = NULL,
        motivo_bloqueo = NULL,
        actualizado_en = NOW()
      WHERE id_usuario = ?
      `,
      [id]
    );

    await registrarLogSistema({
      id_usuario: req.usuario.id_usuario,
      modulo: 'Usuarios',
      accion: 'DESBLOQUEAR_USUARIO',
      descripcion: `Desbloqueó el usuario ${usuarioRows[0].usuario}`,
      ip_origen: obtenerIp(req),
      user_agent: req.headers['user-agent']
    });

    return res.json({
      ok: true,
      mensaje: 'Usuario desbloqueado correctamente'
    });
  } catch (error) {
    console.error('Error al desbloquear usuario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al desbloquear usuario'
    });
  }
};

module.exports = {
  obtenerUsuarios,
  obtenerUsuarioPorId,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  restablecerPasswordUsuario,
  desbloquearUsuario
};