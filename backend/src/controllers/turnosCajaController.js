
const pool = require('../config/db');

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

const importeValido = (valor) => {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ''
  ) {
    return false;
  }

  const numero = Number(valor);

  return (
    Number.isFinite(numero) &&
    numero >= 0 &&
    numero <= 99999999.99 &&
    Math.abs(numero * 100 - Math.round(numero * 100)) < 0.000001
  );
};

const redondear2 = (valor) => {
  return Math.round(
    (Number(valor) + Number.EPSILON) * 100
  ) / 100;
};

// ============================================================
// GET /api/turnos-caja
// LISTAR TURNOS
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
    console.error('Error al obtener turnos:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener turnos de caja'
    });
  }
};

// ============================================================
// GET /api/turnos-caja/activo
// CONSULTAR TURNO ACTIVO
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
// CONSULTAR TURNO POR ID
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
// APERTURAR TURNO DE CAJA
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

    const idCaja = Number(id_caja);

    // --------------------------------------------------------
    // VALIDACIÓN DE CAJA
    // --------------------------------------------------------

    if (
      !Number.isSafeInteger(idCaja) ||
      idCaja <= 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La caja indicada no es válida'
      });
    }

    // --------------------------------------------------------
    // VALIDACIÓN DEL FONDO DE APERTURA
    // --------------------------------------------------------

    const aperturaInformada = monto_apertura ?? 0;

    if (!importeValido(aperturaInformada)) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje:
          'El monto de apertura debe ser no negativo y tener máximo 2 decimales'
      });
    }

    const montoApertura = redondear2(aperturaInformada);

    // --------------------------------------------------------
    // BLOQUEAR USUARIO DURANTE LA APERTURA
    // --------------------------------------------------------

    const [usuarioBloqueado] = await connection.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE id_usuario = ?
      FOR UPDATE
      `,
      [idUsuario]
    );

    if (usuarioBloqueado.length === 0) {
      await connection.rollback();

      return res.status(401).json({
        ok: false,
        mensaje: 'Usuario no disponible'
      });
    }

    // --------------------------------------------------------
    // VALIDAR CAJA Y SUCURSAL
    // --------------------------------------------------------

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
      INNER JOIN sucursales s
        ON c.id_sucursal = s.id_sucursal
      WHERE c.id_caja = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idCaja]
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
        mensaje:
          'No se puede aperturar turno en una sucursal inactiva'
      });
    }

    if (caja[0].estado_caja !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje:
          'No se puede aperturar turno en una caja inactiva'
      });
    }

    // --------------------------------------------------------
    // EVITAR DOS TURNOS ABIERTOS EN LA MISMA CAJA
    // --------------------------------------------------------

    const [turnoCajaAbierto] = await connection.query(
      `
      SELECT id_turno
      FROM turnos_caja
      WHERE id_caja = ?
        AND estado = 'Abierto'
      LIMIT 1
      `,
      [idCaja]
    );

    if (turnoCajaAbierto.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'Esta caja ya tiene un turno abierto'
      });
    }

    // --------------------------------------------------------
    // EVITAR DOS TURNOS ABIERTOS DEL MISMO USUARIO
    // --------------------------------------------------------

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
        mensaje:
          'El usuario ya tiene un turno de caja abierto'
      });
    }

    // --------------------------------------------------------
    // REGISTRAR APERTURA
    // --------------------------------------------------------

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
      VALUES (
        ?, ?, NOW(), ?,
        0.00, 0.00, 0.00,
        'Abierto', ?
      )
      `,
      [
        idCaja,
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

    console.error('Error al aperturar turno:', error);

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
// CERRAR TURNO DE CAJA
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

    const idTurno = Number(id);

    // --------------------------------------------------------
    // VALIDAR ID DE TURNO
    // --------------------------------------------------------

    if (
      !Number.isSafeInteger(idTurno) ||
      idTurno <= 0
    ) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'ID de turno inválido'
      });
    }

    // --------------------------------------------------------
    // VALIDAR MONTO FÍSICO
    // --------------------------------------------------------

    if (!importeValido(monto_cierre_fisico)) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje:
          'El monto físico debe ser no negativo y tener máximo 2 decimales'
      });
    }

    const montoFisico = redondear2(monto_cierre_fisico);

    // --------------------------------------------------------
    // CONSULTAR Y BLOQUEAR TURNO
    // --------------------------------------------------------

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
      FOR UPDATE
      `,
      [idTurno]
    );

    if (turno.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Turno de caja no encontrado'
      });
    }

    // --------------------------------------------------------
    // VALIDAR PROPIEDAD DEL TURNO
    // --------------------------------------------------------

    if (
      Number(turno[0].id_usuario) !==
      Number(req.usuario.id_usuario)
    ) {
      await connection.rollback();

      return res.status(403).json({
        ok: false,
        mensaje:
          'No puede cerrar un turno perteneciente a otro usuario'
      });
    }

    // --------------------------------------------------------
    // VALIDAR ESTADO DEL TURNO
    // --------------------------------------------------------

    if (turno[0].estado !== 'Abierto') {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'El turno de caja ya está cerrado'
      });
    }

    // --------------------------------------------------------
    // VALIDAR CONCILIACIÓN DE PAGOS
    // --------------------------------------------------------

    const [ventasSinCuadrar] = await connection.query(
      `
      SELECT
        v.id_venta,
        v.numero_documento,
        v.total,
        COALESCE(SUM(vp.monto), 0) AS total_pagos
      FROM ventas v
      LEFT JOIN venta_pagos vp
        ON vp.id_venta = v.id_venta
      WHERE v.id_turno = ?
        AND v.estado = 'Registrada'
      GROUP BY
        v.id_venta,
        v.numero_documento,
        v.total
      HAVING
        ABS(
          v.total - COALESCE(SUM(vp.monto), 0)
        ) > 0.01
      LIMIT 1
      `,
      [idTurno]
    );

    if (ventasSinCuadrar.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje:
          'No se puede cerrar: existen ventas sin pagos completos',
        venta: ventasSinCuadrar[0].numero_documento
      });
    }

    // --------------------------------------------------------
    // TOTAL GENERAL DE VENTAS REGISTRADAS
    // --------------------------------------------------------

    const [resumenVentas] = await connection.query(
      `
      SELECT
        COALESCE(SUM(total), 0) AS total_ventas
      FROM ventas
      WHERE id_turno = ?
        AND estado = 'Registrada'
      `,
      [idTurno]
    );

    // --------------------------------------------------------
    // SEPARAR EFECTIVO DE OTROS MÉTODOS DE PAGO
    // --------------------------------------------------------

    const [resumenPagos] = await connection.query(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(mp.nombre_metodo)) = 'efectivo'
              THEN vp.monto
              ELSE 0
            END
          ), 0
        ) AS total_efectivo,

        COALESCE(
          SUM(
            CASE
              WHEN LOWER(TRIM(mp.nombre_metodo)) <> 'efectivo'
              THEN vp.monto
              ELSE 0
            END
          ), 0
        ) AS total_otros_metodos

      FROM ventas v

      INNER JOIN venta_pagos vp
        ON vp.id_venta = v.id_venta

      INNER JOIN metodos_pago mp
        ON mp.id_metodo_pago = vp.id_metodo_pago

      WHERE v.id_turno = ?
        AND v.estado = 'Registrada'
      `,
      [idTurno]
    );

    // --------------------------------------------------------
    // NORMALIZAR IMPORTES
    // --------------------------------------------------------

    const totalVentas = redondear2(
      resumenVentas[0].total_ventas || 0
    );

    const totalEfectivo = redondear2(
      resumenPagos[0].total_efectivo || 0
    );

    const totalOtrosMetodos = redondear2(
      resumenPagos[0].total_otros_metodos || 0
    );

    const montoApertura = redondear2(
      turno[0].monto_apertura || 0
    );

    // --------------------------------------------------------
    // CALCULAR EFECTIVO ESPERADO
    // --------------------------------------------------------

    const montoSistema = redondear2(
      montoApertura + totalEfectivo
    );

    // --------------------------------------------------------
    // CALCULAR DIFERENCIA
    // --------------------------------------------------------

    const diferencia = redondear2(
      montoFisico - montoSistema
    );

    // --------------------------------------------------------
    // REGISTRAR CIERRE
    // --------------------------------------------------------

    const [resultado] = await connection.query(
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
        AND estado = 'Abierto'
      `,
      [
        montoSistema,
        montoFisico,
        diferencia,
        observaciones || null,
        idTurno
      ]
    );

    if (resultado.affectedRows !== 1) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'No fue posible cerrar el turno'
      });
    }

    await connection.commit();

    // --------------------------------------------------------
    // RESPUESTA
    // --------------------------------------------------------

    return res.json({
      ok: true,
      mensaje: 'Turno de caja cerrado correctamente',
      resumen: {
        id_turno: idTurno,
        monto_apertura: montoApertura,
        total_ventas: totalVentas,
        total_ventas_efectivo: totalEfectivo,
        total_ventas_otros_metodos: totalOtrosMetodos,
        monto_cierre_sistema: montoSistema,
        monto_cierre_fisico: montoFisico,
        diferencia
      }
    });

  } catch (error) {
    await connection.rollback();

    console.error('Error al cerrar turno:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cerrar turno de caja'
    });

  } finally {
    connection.release();
  }
};

// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  obtenerTurnosCaja,
  obtenerTurnoActivo,
  obtenerTurnoPorId,
  aperturarTurnoCaja,
  cerrarTurnoCaja
};
