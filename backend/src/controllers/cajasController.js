
const pool = require('../config/db');
const obtenerAlcanceCaja = require('../utils/alcanceCaja');

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

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      ok: false,
      mensaje: 'Ya existe una caja con ese nombre en esta sucursal'
    });
  }

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

    // SEGURIDAD: restringir consultas por sucursal.
    const alcance = await obtenerAlcanceCaja(req);

    if (!alcance || (!alcance.esGlobal && !alcance.idSucursal)) {
      return res.status(403).json({
        ok: false,
        mensaje: 'Usuario sin sucursal autorizada'
      });
    }

    if (!alcance.esGlobal) {
      sql += ' AND c.id_sucursal = ?';
      params.push(alcance.idSucursal);
    }

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

    // SEGURIDAD: impedir consulta de caja ajena.
    const alcance = await obtenerAlcanceCaja(req);

    if (
      !alcance ||
      (
        !alcance.esGlobal &&
        Number(rows[0].id_sucursal) !== alcance.idSucursal
      )
    ) {
      return res.status(403).json({
        ok: false,
        mensaje: 'No autorizado para consultar esta caja'
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

    // SEGURIDAD: restringir creación por sucursal.
    const alcance = await obtenerAlcanceCaja(req, connection);

    if (
      !alcance ||
      (
        !alcance.esGlobal &&
        alcance.idSucursal !== idSucursal
      )
    ) {
      await connection.rollback();

      return res.status(403).json({
        ok: false,
        mensaje: 'No autorizado para crear cajas en esta sucursal'
      });
    }

    // Bloquear sucursal durante la creación.
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

    // Validar nombre duplicado.
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

    return responderError(res, error, 'crear');

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

    // Bloquear caja.
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

    // SEGURIDAD: validar sucursal actual y destino.
    const alcance = await obtenerAlcanceCaja(req, connection);

    if (
      !alcance ||
      (
        !alcance.esGlobal &&
        (
          Number(cajaActual.id_sucursal) !== alcance.idSucursal ||
          idSucursal !== alcance.idSucursal
        )
      )
    ) {
      await connection.rollback();

      return res.status(403).json({
        ok: false,
        mensaje: 'No autorizado para modificar cajas de esta sucursal'
      });
    }

    // Conservar el estado cuando el frontend no lo envía.
    const estadoFinal =
      estado === undefined ? cajaActual.estado : estado;

    const cambiaSucursal =
      Number(cajaActual.id_sucursal) !== idSucursal;

    // ========================================================
    // VALIDACIÓN DE ASIGNACIONES PENDIENTES
    // ========================================================
    // Impedir traslado o inactivación mientras exista un
    // cajero pendiente de confirmar su fondo.
    // ========================================================

    if (cambiaSucursal || estadoFinal === 'Inactiva') {
      const [pendientes] = await connection.query(
        `
        SELECT id_asignacion
        FROM asignaciones_turno_caja
        WHERE id_caja = ?
          AND estado = 'Pendiente'
        LIMIT 1
        `,
        [idCaja]
      );

      if (pendientes.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          ok: false,
          mensaje:
            'No se puede trasladar o inactivar una caja con asignación pendiente'
        });
      }
    }

    // ========================================================
    // IMPEDIR TRASLADO DE CAJAS CON HISTORIAL
    // ========================================================

    if (cambiaSucursal) {
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

    // ========================================================
    // PROTEGER TURNOS ABIERTOS
    // ========================================================

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

    // ========================================================
    // VALIDACIÓN DE NOMBRE DUPLICADO
    // ========================================================

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

    // ========================================================
    // ACTUALIZAR REGISTRO
    // ========================================================

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

    return responderError(res, error, 'actualizar');

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

    // Consultar y bloquear caja y sucursal.
    const [cajas] = await connection.query(
      `
      SELECT
        c.id_caja,
        c.id_sucursal,
        c.estado,
        s.estado AS estado_sucursal
      FROM cajas c
      INNER JOIN sucursales s
        ON s.id_sucursal = c.id_sucursal
      WHERE c.id_caja = ?
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

    // SEGURIDAD: validar alcance por sucursal.
    const alcance = await obtenerAlcanceCaja(req, connection);

    if (
      !alcance ||
      (
        !alcance.esGlobal &&
        Number(cajas[0].id_sucursal) !== alcance.idSucursal
      )
    ) {
      await connection.rollback();

      return res.status(403).json({
        ok: false,
        mensaje: 'No autorizado para cambiar el estado de esta caja'
      });
    }

    // Impedir reactivación en una sucursal inactiva.
    if (
      estado === 'Activa' &&
      cajas[0].estado_sucursal !== 'Activa'
    ) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje:
          'No se puede activar una caja de una sucursal inactiva'
      });
    }

    if (estado === 'Inactiva') {

      // ======================================================
      // VALIDAR ASIGNACIONES PENDIENTES
      // ======================================================

      const [pendientes] = await connection.query(
        `
        SELECT id_asignacion
        FROM asignaciones_turno_caja
        WHERE id_caja = ?
          AND estado = 'Pendiente'
        LIMIT 1
        `,
        [idCaja]
      );

      if (pendientes.length > 0) {
        await connection.rollback();

        return res.status(409).json({
          ok: false,
          mensaje:
            'No se puede inactivar una caja con asignación pendiente'
        });
      }

      // ======================================================
      // VALIDAR TURNOS ABIERTOS
      // ======================================================

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

    // ========================================================
    // ACTUALIZAR ESTADO
    // ========================================================

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
