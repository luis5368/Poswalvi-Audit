
const pool = require('../config/db');

const idValido = (valor) =>
  Number.isSafeInteger(Number(valor)) && Number(valor) > 0;

const importeValido = (valor) => {
  if (valor === null || valor === undefined || String(valor).trim() === '') {
    return false;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) &&
    numero >= 0 &&
    numero <= 99999999.99 &&
    Math.abs(numero * 100 - Math.round(numero * 100)) < 0.000001;
};

const errorInterno = (res, error) => {
  console.error('Error en asignaciones de caja:', error);
  return res.status(500).json({
    ok: false,
    mensaje: 'Error interno en la gestión de asignaciones'
  });
};

const obtenerSucursalResponsable = async (connection, idUsuario) => {
  const [rows] = await connection.query(
    `SELECT id_sucursal
     FROM usuarios
     WHERE id_usuario = ?
       AND estado = 'Activo'
     LIMIT 1`,
    [idUsuario]
  );

  return rows.length ? Number(rows[0].id_sucursal) : null;
};

const cajeroTienePermisos = async (connection, idRol) => {
  const [rows] = await connection.query(
    `
    SELECT COUNT(DISTINCT CONCAT(p.modulo, ':', p.accion)) AS total
    FROM rol_permiso rp
    INNER JOIN permisos p
      ON p.id_permiso = rp.id_permiso
    WHERE rp.id_rol = ?
      AND (
        (p.modulo = 'TurnosCaja' AND p.accion = 'Aperturar')
        OR
        (p.modulo = 'Ventas' AND p.accion = 'Crear')
      )
    `,
    [idRol]
  );

  return Number(rows[0]?.total || 0) === 2;
};

// ============================================================
// GET /api/turnos-caja/asignaciones/cajeros?id_caja=
// Cajeros disponibles para la caja seleccionada
// ============================================================

const obtenerCajerosDisponibles = async (req, res) => {
  try {
    const idCaja = Number(req.query.id_caja);

    if (!idValido(idCaja)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Seleccione una caja válida'
      });
    }

    const [cajas] = await pool.query(
      `
      SELECT c.id_caja, c.id_sucursal, c.estado,
             s.estado AS estado_sucursal
      FROM cajas c
      INNER JOIN sucursales s ON s.id_sucursal = c.id_sucursal
      WHERE c.id_caja = ?
      LIMIT 1
      `,
      [idCaja]
    );

    if (
      !cajas.length ||
      cajas[0].estado !== 'Activa' ||
      cajas[0].estado_sucursal !== 'Activa'
    ) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La caja o su sucursal no está disponible'
      });
    }

    const sucursalSupervisor = await obtenerSucursalResponsable(
      pool,
      req.usuario.id_usuario
    );

    if (sucursalSupervisor !== Number(cajas[0].id_sucursal)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No está autorizado para asignar cajas de esta sucursal'
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        u.id_usuario,
        u.usuario,
        u.nombre,
        u.apellido,
        r.nombre_rol
      FROM usuarios u
      INNER JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.estado = 'Activo'
        AND r.estado = 'Activo'
        AND u.id_sucursal = ?
        AND EXISTS (
          SELECT 1
          FROM rol_permiso rp
          INNER JOIN permisos p ON p.id_permiso = rp.id_permiso
          WHERE rp.id_rol = u.id_rol
            AND p.modulo = 'TurnosCaja'
            AND p.accion = 'Aperturar'
        )
        AND EXISTS (
          SELECT 1
          FROM rol_permiso rp
          INNER JOIN permisos p ON p.id_permiso = rp.id_permiso
          WHERE rp.id_rol = u.id_rol
            AND p.modulo = 'Ventas'
            AND p.accion = 'Crear'
        )
        AND NOT EXISTS (
          SELECT 1 FROM turnos_caja t
          WHERE t.id_usuario = u.id_usuario
            AND t.estado = 'Abierto'
        )
        AND NOT EXISTS (
          SELECT 1 FROM asignaciones_turno_caja a
          WHERE a.id_usuario_cajero = u.id_usuario
            AND a.estado = 'Pendiente'
        )
      ORDER BY u.nombre, u.apellido
      `,
      [cajas[0].id_sucursal]
    );

    return res.json({ ok: true, cajeros: rows });

  } catch (error) {
    return errorInterno(res, error);
  }
};

// ============================================================
// POST /api/turnos-caja/asignaciones
// Supervisor asigna una caja y un fondo
// ============================================================

const crearAsignacion = async (req, res) => {
  const {
    id_caja,
    id_usuario_cajero,
    monto_apertura,
    observaciones
  } = req.body || {};

  if (!idValido(id_caja) || !idValido(id_usuario_cajero)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Caja o cajero inválido'
    });
  }

  if (!importeValido(monto_apertura)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El fondo debe ser válido, no negativo y tener máximo dos decimales'
    });
  }

  if (observaciones != null && typeof observaciones !== 'string') {
    return res.status(400).json({
      ok: false,
      mensaje: 'Las observaciones deben ser texto'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [usuarios] = await connection.query(
      `
      SELECT id_usuario, id_sucursal, id_rol, estado
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      FOR UPDATE
      `,
      [Number(id_usuario_cajero)]
    );

    if (!usuarios.length || usuarios[0].estado !== 'Activo') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El cajero seleccionado no está activo'
      });
    }

    const [cajas] = await connection.query(
      `
      SELECT c.id_caja, c.id_sucursal,
             c.estado, s.estado AS estado_sucursal
      FROM cajas c
      INNER JOIN sucursales s ON s.id_sucursal = c.id_sucursal
      WHERE c.id_caja = ?
      LIMIT 1
      FOR UPDATE
      `,
      [Number(id_caja)]
    );

    if (
      !cajas.length ||
      cajas[0].estado !== 'Activa' ||
      cajas[0].estado_sucursal !== 'Activa'
    ) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'La caja no está activa'
      });
    }

    const idSucursal = Number(cajas[0].id_sucursal);

    const sucursalSupervisor = await obtenerSucursalResponsable(
      connection,
      req.usuario.id_usuario
    );

    if (
      sucursalSupervisor !== idSucursal ||
      Number(usuarios[0].id_sucursal) !== idSucursal
    ) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        mensaje: 'Supervisor, cajero y caja deben pertenecer a la misma sucursal'
      });
    }

    if (!(await cajeroTienePermisos(connection, usuarios[0].id_rol))) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        mensaje: 'El cajero no tiene permisos para aperturar turnos y crear ventas'
      });
    }

    const [abiertos] = await connection.query(
      `
      SELECT id_turno
      FROM turnos_caja
      WHERE estado = 'Abierto'
        AND (id_caja = ? OR id_usuario = ?)
      LIMIT 1
      `,
      [Number(id_caja), Number(id_usuario_cajero)]
    );

    if (abiertos.length) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'La caja o el cajero ya tiene un turno abierto'
      });
    }

    const [pendientes] = await connection.query(
      `
      SELECT id_asignacion
      FROM asignaciones_turno_caja
      WHERE estado = 'Pendiente'
        AND (id_caja = ? OR id_usuario_cajero = ?)
      LIMIT 1
      `,
      [Number(id_caja), Number(id_usuario_cajero)]
    );

    if (pendientes.length) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'Existe una asignación pendiente para esta caja o cajero'
      });
    }

    const [result] = await connection.query(
      `
      INSERT INTO asignaciones_turno_caja (
        id_caja,
        id_usuario_cajero,
        id_usuario_asignador,
        monto_apertura,
        observaciones
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        Number(id_caja),
        Number(id_usuario_cajero),
        Number(req.usuario.id_usuario),
        Number(monto_apertura).toFixed(2),
        observaciones?.trim() || null
      ]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Asignación creada. Pendiente de aceptación del cajero',
      id_asignacion: result.insertId
    });

  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya hay una asignación pendiente para la caja o el cajero'
      });
    }

    return errorInterno(res, error);
  } finally {
    connection.release();
  }
};

// ============================================================
// GET /api/turnos-caja/asignaciones/mias
// ============================================================

const obtenerMisAsignaciones = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        a.id_asignacion,
        a.id_caja,
        a.monto_apertura,
        a.observaciones,
        a.fecha_asignacion,
        c.nombre_caja,
        s.nombre_sucursal,
        CONCAT(u.nombre, ' ', u.apellido) AS asignado_por
      FROM asignaciones_turno_caja a
      INNER JOIN cajas c ON c.id_caja = a.id_caja
      INNER JOIN sucursales s ON s.id_sucursal = c.id_sucursal
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario_asignador
      WHERE a.id_usuario_cajero = ?
        AND a.estado = 'Pendiente'
      ORDER BY a.id_asignacion DESC
      `,
      [req.usuario.id_usuario]
    );

    return res.json({ ok: true, asignaciones: rows });
  } catch (error) {
    return errorInterno(res, error);
  }
};

// ============================================================
// GET /api/turnos-caja/asignaciones
// Asignaciones pendientes de la sucursal del supervisor
// ============================================================

const obtenerAsignacionesPendientes = async (req, res) => {
  try {
    const idSucursal = await obtenerSucursalResponsable(
      pool,
      req.usuario.id_usuario
    );

    const [rows] = await pool.query(
      `
      SELECT
        a.id_asignacion,
        a.id_caja,
        a.id_usuario_cajero,
        a.monto_apertura,
        a.fecha_asignacion,
        c.nombre_caja,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre_cajero
      FROM asignaciones_turno_caja a
      INNER JOIN cajas c ON c.id_caja = a.id_caja
      INNER JOIN usuarios u ON u.id_usuario = a.id_usuario_cajero
      WHERE a.estado = 'Pendiente'
        AND c.id_sucursal = ?
      ORDER BY a.id_asignacion DESC
      `,
      [idSucursal]
    );

    return res.json({ ok: true, asignaciones: rows });
  } catch (error) {
    return errorInterno(res, error);
  }
};

// ============================================================
// POST /api/turnos-caja/asignaciones/:id/responder
// El cajero confirma o rechaza
// ============================================================

const responderAsignacion = async (req, res) => {
  const idAsignacion = Number(req.params.id);
  const { accion } = req.body || {};

  if (!idValido(idAsignacion) || !['Confirmar', 'Rechazar'].includes(accion)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'Asignación o respuesta inválida'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idUsuario = Number(req.usuario.id_usuario);

    // Igual orden de bloqueos que la apertura propia.
    const [usuarios] = await connection.query(
      `
      SELECT id_usuario, id_sucursal, estado
      FROM usuarios
      WHERE id_usuario = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idUsuario]
    );

    const [asignacionesPrevias] = await connection.query(
      `
      SELECT id_caja
      FROM asignaciones_turno_caja
      WHERE id_asignacion = ?
        AND id_usuario_cajero = ?
      LIMIT 1
      `,
      [idAsignacion, idUsuario]
    );

    if (!usuarios.length || !asignacionesPrevias.length) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        mensaje: 'Asignación no encontrada para este usuario'
      });
    }

    const [cajas] = await connection.query(
      `
      SELECT c.id_caja, c.id_sucursal, c.estado,
             s.estado AS estado_sucursal
      FROM cajas c
      INNER JOIN sucursales s ON s.id_sucursal = c.id_sucursal
      WHERE c.id_caja = ?
      LIMIT 1
      FOR UPDATE
      `,
      [asignacionesPrevias[0].id_caja]
    );

    const [asignaciones] = await connection.query(
      `
      SELECT id_asignacion, id_caja, id_usuario_cajero,
             monto_apertura, estado
      FROM asignaciones_turno_caja
      WHERE id_asignacion = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idAsignacion]
    );

    const asignacion = asignaciones[0];

    if (
      !asignacion ||
      asignacion.estado !== 'Pendiente' ||
      Number(asignacion.id_usuario_cajero) !== idUsuario
    ) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'La asignación ya fue atendida'
      });
    }

    if (accion === 'Rechazar') {
      await connection.query(
        `
        UPDATE asignaciones_turno_caja
        SET estado = 'Rechazada',
            fecha_respuesta = NOW()
        WHERE id_asignacion = ?
        `,
        [idAsignacion]
      );

      await connection.commit();

      return res.json({
        ok: true,
        mensaje: 'Recepción rechazada. No se abrió ningún turno'
      });
    }

    if (
      usuarios[0].estado !== 'Activo' ||
      !cajas.length ||
      cajas[0].estado !== 'Activa' ||
      cajas[0].estado_sucursal !== 'Activa' ||
      Number(usuarios[0].id_sucursal) !== Number(cajas[0].id_sucursal)
    ) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'El cajero o la caja ya no está disponible'
      });
    }

    const [abiertos] = await connection.query(
      `
      SELECT id_turno
      FROM turnos_caja
      WHERE estado = 'Abierto'
        AND (id_caja = ? OR id_usuario = ?)
      LIMIT 1
      `,
      [asignacion.id_caja, idUsuario]
    );

    if (abiertos.length) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'La caja o el usuario ya tiene un turno abierto'
      });
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO turnos_caja (
        id_caja,
        id_usuario,
        fecha_apertura,
        monto_apertura,
        monto_cierre_sistema,
        monto_cierre_fisico,
        diferencia,
        estado,
        observaciones
      )
      VALUES (
        ?, ?, NOW(), ?,
        0.00, 0.00, 0.00,
        'Abierto', ?
      )
      `,
      [
        asignacion.id_caja,
        idUsuario,
        asignacion.monto_apertura,
        `Apertura supervisada. Asignación #${idAsignacion}`
      ]
    );

    await connection.query(
      `
      UPDATE asignaciones_turno_caja
      SET estado = 'Confirmada',
          id_turno = ?,
          fecha_respuesta = NOW()
      WHERE id_asignacion = ?
      `,
      [resultado.insertId, idAsignacion]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Fondo confirmado y turno abierto correctamente',
      id_turno: resultado.insertId
    });

  } catch (error) {
    await connection.rollback();
    return errorInterno(res, error);
  } finally {
    connection.release();
  }
};

// ============================================================
// POST /api/turnos-caja/asignaciones/:id/cancelar
// ============================================================

const cancelarAsignacion = async (req, res) => {
  const idAsignacion = Number(req.params.id);

  if (!idValido(idAsignacion)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'ID de asignación inválido'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT a.id_asignacion, a.estado, c.id_sucursal
      FROM asignaciones_turno_caja a
      INNER JOIN cajas c ON c.id_caja = a.id_caja
      WHERE a.id_asignacion = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idAsignacion]
    );

    if (!rows.length || rows[0].estado !== 'Pendiente') {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'La asignación no existe o ya fue atendida'
      });
    }

    const idSucursal = await obtenerSucursalResponsable(
      connection,
      req.usuario.id_usuario
    );

    if (idSucursal !== Number(rows[0].id_sucursal)) {
      await connection.rollback();
      return res.status(403).json({
        ok: false,
        mensaje: 'No autorizado para cancelar esta asignación'
      });
    }

    await connection.query(
      `
      UPDATE asignaciones_turno_caja
      SET estado = 'Cancelada',
          fecha_respuesta = NOW()
      WHERE id_asignacion = ?
      `,
      [idAsignacion]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Asignación cancelada correctamente'
    });

  } catch (error) {
    await connection.rollback();
    return errorInterno(res, error);
  } finally {
    connection.release();
  }
};

module.exports = {
  obtenerCajerosDisponibles,
  crearAsignacion,
  obtenerMisAsignaciones,
  obtenerAsignacionesPendientes,
  responderAsignacion,
  cancelarAsignacion
};
