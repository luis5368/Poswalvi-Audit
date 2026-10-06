const pool = require('../config/db');

// ============================================================
// GET /api/turnos-caja
// Listar turnos de caja
// ============================================================
const obtenerTurnosCaja = async (req, res) => {
  try {
    const {
      estado,
      id_caja,
      id_usuario,
      fecha_inicio,
      fecha_fin
    } = req.query;

    let sql = `
      SELECT
        t.id_turno,
        t.id_caja,
        c.nombre_caja,
        c.id_sucursal,
        s.nombre_sucursal,
        t.id_usuario,
        u.usuario,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario,
        t.fecha_apertura,
        t.fecha_cierre,
        t.monto_apertura,
        t.monto_cierre_sistema,
        t.monto_cierre_fisico,
        t.diferencia,
        t.estado,
        t.observaciones,
        t.creado_en
      FROM turnos_caja t
      INNER JOIN cajas c ON t.id_caja = c.id_caja
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND t.estado = ?`;
      params.push(estado);
    }

    if (id_caja) {
      sql += ` AND t.id_caja = ?`;
      params.push(id_caja);
    }

    if (id_usuario) {
      sql += ` AND t.id_usuario = ?`;
      params.push(id_usuario);
    }

    if (fecha_inicio && fecha_fin) {
      sql += ` AND DATE(t.fecha_apertura) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    sql += ` ORDER BY t.id_turno DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      turnos: rows
    });
  } catch (error) {
    console.error('Error al obtener turnos de caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener turnos de caja'
    });
  }
};

// ============================================================
// GET /api/turnos-caja/activo
// Obtener turno activo del usuario autenticado o por caja
// ============================================================
const obtenerTurnoActivo = async (req, res) => {
  try {
    const { id_caja } = req.query;
    const idUsuario = req.usuario.id_usuario;

    let sql = `
      SELECT
        t.id_turno,
        t.id_caja,
        c.nombre_caja,
        c.id_sucursal,
        s.nombre_sucursal,
        t.id_usuario,
        u.usuario,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario,
        t.fecha_apertura,
        t.monto_apertura,
        t.estado,
        t.observaciones
      FROM turnos_caja t
      INNER JOIN cajas c ON t.id_caja = c.id_caja
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.estado = 'Abierto'
    `;

    const params = [];

    if (id_caja) {
      sql += ` AND t.id_caja = ?`;
      params.push(id_caja);
    } else {
      sql += ` AND t.id_usuario = ?`;
      params.push(idUsuario);
    }

    sql += ` LIMIT 1`;

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.json({
        ok: true,
        tiene_turno_activo: false,
        turno: null
      });
    }

    return res.json({
      ok: true,
      tiene_turno_activo: true,
      turno: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener turno activo:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener turno activo'
    });
  }
};

// ============================================================
// GET /api/turnos-caja/:id
// Obtener turno por ID
// ============================================================
const obtenerTurnoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        t.id_turno,
        t.id_caja,
        c.nombre_caja,
        c.id_sucursal,
        s.nombre_sucursal,
        t.id_usuario,
        u.usuario,
        CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario,
        t.fecha_apertura,
        t.fecha_cierre,
        t.monto_apertura,
        t.monto_cierre_sistema,
        t.monto_cierre_fisico,
        t.diferencia,
        t.estado,
        t.observaciones,
        t.creado_en
      FROM turnos_caja t
      INNER JOIN cajas c ON t.id_caja = c.id_caja
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_turno = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Turno de caja no encontrado'
      });
    }

    return res.json({
      ok: true,
      turno: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener turno por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener el turno de caja'
    });
  }
};

// ============================================================
// POST /api/turnos-caja/aperturar
// Aperturar turno de caja
// ============================================================
const aperturarTurnoCaja = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idUsuario = req.usuario.id_usuario;

    const {
      id_caja,
      monto_apertura,
      observaciones
    } = req.body;

    if (!id_caja) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La caja es obligatoria'
      });
    }

    const montoApertura = Number(monto_apertura || 0);

    if (Number.isNaN(montoApertura) || montoApertura < 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El monto de apertura debe ser mayor o igual a 0'
      });
    }

    const [caja] = await connection.query(
      `
      SELECT
        c.id_caja,
        c.nombre_caja,
        c.estado AS estado_caja,
        s.id_sucursal,
        s.nombre_sucursal,
        s.estado AS estado_sucursal
      FROM cajas c
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE c.id_caja = ?
      LIMIT 1
      `,
      [id_caja]
    );

    if (caja.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'La caja indicada no existe'
      });
    }

    if (caja[0].estado_sucursal !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede aperturar turno en una sucursal inactiva'
      });
    }

    if (caja[0].estado_caja !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede aperturar turno en una caja inactiva'
      });
    }

    const [turnoCajaAbierto] = await connection.query(
      `
      SELECT id_turno
      FROM turnos_caja
      WHERE id_caja = ?
        AND estado = 'Abierto'
      LIMIT 1
      `,
      [id_caja]
    );

    if (turnoCajaAbierto.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'Esta caja ya tiene un turno abierto'
      });
    }

    const [turnoUsuarioAbierto] = await connection.query(
      `
      SELECT id_turno
      FROM turnos_caja
      WHERE id_usuario = ?
        AND estado = 'Abierto'
      LIMIT 1
      `,
      [idUsuario]
    );

    if (turnoUsuarioAbierto.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'El usuario ya tiene un turno de caja abierto'
      });
    }

    const [result] = await connection.query(
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
      VALUES (?, ?, NOW(), ?, 0.00, 0.00, 0.00, 'Abierto', ?)
      `,
      [
        id_caja,
        idUsuario,
        montoApertura,
        observaciones || null
      ]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Turno de caja aperturado correctamente',
      id_turno: result.insertId
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al aperturar turno de caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al aperturar turno de caja'
    });
  } finally {
    connection.release();
  }
};

// ============================================================
// PATCH /api/turnos-caja/:id/cerrar
// Cerrar turno de caja
// ============================================================
const cerrarTurnoCaja = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const {
      monto_cierre_fisico,
      observaciones
    } = req.body;

    const montoFisico = Number(monto_cierre_fisico);

    if (Number.isNaN(montoFisico) || montoFisico < 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El monto físico de cierre debe ser mayor o igual a 0'
      });
    }

    const [turno] = await connection.query(
      `
      SELECT
        id_turno,
        id_caja,
        id_usuario,
        monto_apertura,
        estado
      FROM turnos_caja
      WHERE id_turno = ?
      LIMIT 1
      `,
      [id]
    );

    if (turno.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Turno de caja no encontrado'
      });
    }

    if (turno[0].estado !== 'Abierto') {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'El turno de caja ya está cerrado'
      });
    }

    const [ventasTurno] = await connection.query(
      `
      SELECT COALESCE(SUM(total), 0) AS total_ventas
      FROM ventas
      WHERE id_turno = ?
        AND estado = 'Registrada'
      `,
      [id]
    );

    const totalVentas = Number(ventasTurno[0].total_ventas || 0);
    const montoApertura = Number(turno[0].monto_apertura || 0);

    const montoSistema = montoApertura + totalVentas;
    const diferencia = montoFisico - montoSistema;

    await connection.query(
      `
      UPDATE turnos_caja
      SET
        fecha_cierre = NOW(),
        monto_cierre_sistema = ?,
        monto_cierre_fisico = ?,
        diferencia = ?,
        estado = 'Cerrado',
        observaciones = ?
      WHERE id_turno = ?
      `,
      [
        montoSistema,
        montoFisico,
        diferencia,
        observaciones || null,
        id
      ]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Turno de caja cerrado correctamente',
      resumen: {
        id_turno: Number(id),
        monto_apertura: montoApertura,
        total_ventas: totalVentas,
        monto_cierre_sistema: montoSistema,
        monto_cierre_fisico: montoFisico,
        diferencia
      }
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al cerrar turno de caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cerrar turno de caja'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  obtenerTurnosCaja,
  obtenerTurnoActivo,
  obtenerTurnoPorId,
  aperturarTurnoCaja,
  cerrarTurnoCaja
};