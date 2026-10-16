
const pool = require('../config/db');

// ============================================================
// VALIDACIONES COMUNES
// ============================================================

const estadosValidos = ['Activa', 'Inactiva'];

const idValido = (id) =>
  Number.isSafeInteger(Number(id)) && Number(id) > 0;

const normalizarDatosCaja = (datos) => {
  const {
    id_sucursal,
    nombre_caja,
    descripcion,
    estado
  } = datos;

  if (!idValido(id_sucursal)) {
    return {
      error: 'La sucursal indicada no es válida'
    };
  }

  if (
    typeof nombre_caja !== 'string' ||
    !nombre_caja.trim()
  ) {
    return {
      error: 'El nombre de la caja es obligatorio'
    };
  }

  if (
    descripcion != null &&
    typeof descripcion !== 'string'
  ) {
    return {
      error: 'La descripción no es válida'
    };
  }

  if (
    estado !== undefined &&
    !estadosValidos.includes(estado)
  ) {
    return {
      error: 'El estado debe ser Activa o Inactiva'
    };
  }

  return {
    datos: {
      id_sucursal: Number(id_sucursal),
      nombre_caja: nombre_caja.trim(),
      descripcion:
        typeof descripcion === 'string'
          ? descripcion.trim() || null
          : null,
      estado
    }
  };
};

const responderError = (res, error, operacion) => {
  console.error(`Error al ${operacion} caja:`, error);

  return res.status(500).json({
    ok: false,
    mensaje: `Error interno al ${operacion} la caja`
  });
};

// ============================================================
// GET /api/cajas
// LISTAR CAJAS
// ============================================================

const obtenerCajas = async (req, res) => {
  try {
    const { estado, id_sucursal, buscar } = req.query;

    let sql = `
      SELECT
        c.id_caja,
        c.id_sucursal,
        s.nombre_sucursal,
        c.nombre_caja,
        c.descripcion,
        c.estado,
        c.creado_en,
        c.actualizado_en
      FROM cajas c
      INNER JOIN sucursales s
        ON c.id_sucursal = s.id_sucursal
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ' AND c.estado = ?';
      params.push(estado);
    }

    if (id_sucursal) {
      sql += ' AND c.id_sucursal = ?';
      params.push(id_sucursal);
    }

    if (buscar) {
      sql += `
        AND (
          c.nombre_caja LIKE ?
          OR c.descripcion LIKE ?
          OR s.nombre_sucursal LIKE ?
        )
      `;

      params.push(
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`
      );
    }

    sql += ' ORDER BY c.id_caja DESC';

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      cajas: rows
    });

  } catch (error) {
    console.error('Error al obtener cajas:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener cajas'
    });
  }
};

// ============================================================
// GET /api/cajas/:id
// OBTENER CAJA POR ID
// ============================================================

const obtenerCajaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    if (!idValido(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'ID de caja inválido'
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        c.id_caja,
        c.id_sucursal,
        s.nombre_sucursal,
        c.nombre_caja,
        c.descripcion,
        c.estado,
        c.creado_en,
        c.actualizado_en
      FROM cajas c
      INNER JOIN sucursales s
        ON c.id_sucursal = s.id_sucursal
      WHERE c.id_caja = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Caja no encontrada'
      });
    }

    return res.json({
      ok: true,
      caja: rows[0]
    });

  } catch (error) {
    console.error('Error al obtener caja por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener la caja'
    });
  }
};

// ============================================================
// POST /api/cajas
// CREAR CAJA
// ============================================================

const crearCaja = async (req, res) => {
  const {
    id_sucursal,
    nombre_caja,
    descripcion,
    estado
  } = req.body || {};

  const idSucursal = Number(id_sucursal);

  if (!Number.isSafeInteger(idSucursal) || idSucursal <= 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'La sucursal indicada no es válida'
    });
  }

  if (
    typeof nombre_caja !== 'string' ||
    nombre_caja.trim() === ''
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El nombre de la caja es obligatorio'
    });
  }

  if (
    descripcion != null &&
    typeof descripcion !== 'string'
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'La descripción debe ser texto'
    });
  }

  const estadoFinal = estado === undefined ? 'Activa' : estado;

  if (!['Activa', 'Inactiva'].includes(estadoFinal)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El estado debe ser Activa o Inactiva'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Bloqueo de sucursal para coordinar creaciones
    // simultáneas realizadas mediante este controlador.
    const [sucursales] = await connection.query(
      `
      SELECT id_sucursal, estado
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idSucursal]
    );

    if (sucursales.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'La sucursal indicada no existe'
      });
    }

    if (sucursales[0].estado !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede crear una caja en una sucursal inactiva'
      });
    }

    const [duplicados] = await connection.query(
      `
      SELECT id_caja
      FROM cajas
      WHERE id_sucursal = ?
        AND LOWER(nombre_caja) = LOWER(?)
      LIMIT 1
      `,
      [idSucursal, nombre_caja.trim()]
    );

    if (duplicados.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe una caja con ese nombre en esta sucursal'
      });
    }

    const [resultado] = await connection.query(
      `
      INSERT INTO cajas (
        id_sucursal,
        nombre_caja,
        descripcion,
        estado
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        idSucursal,
        nombre_caja.trim(),
        typeof descripcion === 'string'
          ? descripcion.trim() || null
          : null,
        estadoFinal
      ]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Caja creada correctamente',
      id_caja: resultado.insertId
    });

  } catch (error) {
    await connection.rollback();

    console.error('Error al crear caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear la caja'
    });

  } finally {
    connection.release();
  }
};

// ============================================================
// PUT /api/cajas/:id
// ACTUALIZAR CAJA CON VALIDACIONES DE INTEGRIDAD
// ============================================================

const actualizarCaja = async (req, res) => {
  const { id } = req.params;

  const {
    id_sucursal,
    nombre_caja,
    descripcion,
    estado
  } = req.body || {};

  const idCaja = Number(id);
  const idSucursal = Number(id_sucursal);

  if (!Number.isSafeInteger(idCaja) || idCaja <= 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'ID de caja inválido'
    });
  }

  if (!Number.isSafeInteger(idSucursal) || idSucursal <= 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'La sucursal indicada no es válida'
    });
  }

  if (
    typeof nombre_caja !== 'string' ||
    nombre_caja.trim() === ''
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El nombre de la caja es obligatorio'
    });
  }

  if (
    descripcion != null &&
    typeof descripcion !== 'string'
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'La descripción debe ser texto'
    });
  }

  if (
    estado !== undefined &&
    !['Activa', 'Inactiva'].includes(estado)
  ) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El estado debe ser Activa o Inactiva'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Bloquear sucursal de destino.
    const [sucursales] = await connection.query(
      `
      SELECT id_sucursal, estado
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idSucursal]
    );

    if (sucursales.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'La sucursal indicada no existe'
      });
    }

    if (sucursales[0].estado !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede asignar una caja a una sucursal inactiva'
      });
    }

    // Bloquear caja para coordinar cambios con
    // posibles aperturas de turno.
    const [cajas] = await connection.query(
      `
      SELECT id_caja, id_sucursal, estado
      FROM cajas
      WHERE id_caja = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idCaja]
    );

    if (cajas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Caja no encontrada'
      });
    }

    const cajaActual = cajas[0];

    // Evita reactivar accidentalmente una caja
    // cuando el frontend omite la propiedad estado.
    const estadoFinal =
      estado === undefined ? cajaActual.estado : estado;

    // Una caja con operaciones históricas no debe
    // trasladarse a una sucursal distinta.
    if (Number(cajaActual.id_sucursal) !== idSucursal) {
      const [turnos] = await connection.query(
        `
        SELECT id_turno
        FROM turnos_caja
        WHERE id_caja = ?
        LIMIT 1
        `,
        [idCaja]
      );

      const [ventas] = await connection.query(
        `
        SELECT id_venta
        FROM ventas
        WHERE id_caja = ?
        LIMIT 1
        `,
        [idCaja]
      );

      if (turnos.length > 0 || ventas.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          ok: false,
          mensaje:
            'No se puede cambiar la sucursal de una caja con historial de turnos o ventas'
        });
      }
    }

    // No permitir inactivación mientras haya
    // un turno abierto.
    if (estadoFinal === 'Inactiva') {
      const [turnosAbiertos] = await connection.query(
        `
        SELECT id_turno
        FROM turnos_caja
        WHERE id_caja = ?
          AND estado = 'Abierto'
        LIMIT 1
        `,
        [idCaja]
      );

      if (turnosAbiertos.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          ok: false,
          mensaje: 'No se puede inactivar una caja con turno abierto'
        });
      }
    }

    // Comprobar unicidad del nombre por sucursal.
    const [duplicados] = await connection.query(
      `
      SELECT id_caja
      FROM cajas
      WHERE id_sucursal = ?
        AND LOWER(nombre_caja) = LOWER(?)
        AND id_caja <> ?
      LIMIT 1
      `,
      [idSucursal, nombre_caja.trim(), idCaja]
    );

    if (duplicados.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otra caja con ese nombre en esta sucursal'
      });
    }

    const [resultado] = await connection.query(
      `
      UPDATE cajas
      SET
        id_sucursal = ?,
        nombre_caja = ?,
        descripcion = ?,
        estado = ?
      WHERE id_caja = ?
      `,
      [
        idSucursal,
        nombre_caja.trim(),
        typeof descripcion === 'string'
          ? descripcion.trim() || null
          : null,
        estadoFinal,
        idCaja
      ]
    );

    if (resultado.affectedRows !== 1) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'No se pudo actualizar la caja'
      });
    }

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Caja actualizada correctamente'
    });

  } catch (error) {
    await connection.rollback();

    console.error('Error al actualizar caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar la caja'
    });

  } finally {
    connection.release();
  }
};

// ============================================================
// PATCH /api/cajas/:id/estado
// CAMBIAR ESTADO
// ============================================================

const cambiarEstadoCaja = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};

  const idCaja = Number(id);

  if (!Number.isSafeInteger(idCaja) || idCaja <= 0) {
    return res.status(400).json({
      ok: false,
      mensaje: 'ID de caja inválido'
    });
  }

  if (!['Activa', 'Inactiva'].includes(estado)) {
    return res.status(400).json({
      ok: false,
      mensaje: 'El estado debe ser Activa o Inactiva'
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [cajas] = await connection.query(
      `
      SELECT id_caja, estado
      FROM cajas
      WHERE id_caja = ?
      LIMIT 1
      FOR UPDATE
      `,
      [idCaja]
    );

    if (cajas.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Caja no encontrada'
      });
    }

    if (estado === 'Inactiva') {
      const [turnosAbiertos] = await connection.query(
        `
        SELECT id_turno
        FROM turnos_caja
        WHERE id_caja = ?
          AND estado = 'Abierto'
        LIMIT 1
        `,
        [idCaja]
      );

      if (turnosAbiertos.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          ok: false,
          mensaje:
            'No se puede inactivar una caja con turno abierto'
        });
      }
    }

    await connection.query(
      `
      UPDATE cajas
      SET estado = ?
      WHERE id_caja = ?
      `,
      [estado, idCaja]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: `Caja marcada como ${estado}`
    });

  } catch (error) {
    await connection.rollback();

    console.error('Error al cambiar estado de caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado de caja'
    });

  } finally {
    connection.release();
  }
};

// ============================================================
// EXPORTACIONES
// ============================================================

module.exports = {
  obtenerCajas,
  obtenerCajaPorId,
  crearCaja,
  actualizarCaja,
  cambiarEstadoCaja
};
