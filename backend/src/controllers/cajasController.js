const pool = require('../config/db');

// ============================================================
// GET /api/cajas
// Listar cajas
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
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }

    if (id_sucursal) {
      sql += ` AND c.id_sucursal = ?`;
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
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY c.id_caja DESC`;

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
// Obtener caja por ID
// ============================================================
const obtenerCajaPorId = async (req, res) => {
  try {
    const { id } = req.params;

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
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
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
// Crear caja
// ============================================================
const crearCaja = async (req, res) => {
  try {
    const {
      id_sucursal,
      nombre_caja,
      descripcion,
      estado
    } = req.body;

    if (!id_sucursal) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal es obligatoria'
      });
    }

    if (!nombre_caja || nombre_caja.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre de la caja es obligatorio'
      });
    }

    const estadoFinal = estado || 'Activa';

    if (!['Activa', 'Inactiva'].includes(estadoFinal)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activa o Inactiva'
      });
    }

    const [sucursal] = await pool.query(
      `
      SELECT id_sucursal, estado
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      `,
      [id_sucursal]
    );

    if (sucursal.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'La sucursal indicada no existe'
      });
    }

    if (sucursal[0].estado !== 'Activa') {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede crear una caja en una sucursal inactiva'
      });
    }

    const [duplicado] = await pool.query(
      `
      SELECT id_caja
      FROM cajas
      WHERE id_sucursal = ?
        AND LOWER(nombre_caja) = LOWER(?)
      LIMIT 1
      `,
      [id_sucursal, nombre_caja.trim()]
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe una caja con ese nombre en esta sucursal'
      });
    }

    const [result] = await pool.query(
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
        id_sucursal,
        nombre_caja.trim(),
        descripcion || null,
        estadoFinal
      ]
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Caja creada correctamente',
      id_caja: result.insertId
    });
  } catch (error) {
    console.error('Error al crear caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear la caja'
    });
  }
};

// ============================================================
// PUT /api/cajas/:id
// Actualizar caja
// ============================================================
const actualizarCaja = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      id_sucursal,
      nombre_caja,
      descripcion,
      estado
    } = req.body;

    if (!id_sucursal) {
      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal es obligatoria'
      });
    }

    if (!nombre_caja || nombre_caja.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre de la caja es obligatorio'
      });
    }

    if (estado && !['Activa', 'Inactiva'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activa o Inactiva'
      });
    }

    const [caja] = await pool.query(
      `
      SELECT id_caja
      FROM cajas
      WHERE id_caja = ?
      LIMIT 1
      `,
      [id]
    );

    if (caja.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Caja no encontrada'
      });
    }

    const [sucursal] = await pool.query(
      `
      SELECT id_sucursal, estado
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      `,
      [id_sucursal]
    );

    if (sucursal.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'La sucursal indicada no existe'
      });
    }

    if (sucursal[0].estado !== 'Activa') {
      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede asignar una caja a una sucursal inactiva'
      });
    }

    const [duplicado] = await pool.query(
      `
      SELECT id_caja
      FROM cajas
      WHERE id_sucursal = ?
        AND LOWER(nombre_caja) = LOWER(?)
        AND id_caja <> ?
      LIMIT 1
      `,
      [id_sucursal, nombre_caja.trim(), id]
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otra caja con ese nombre en esta sucursal'
      });
    }

    await pool.query(
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
        id_sucursal,
        nombre_caja.trim(),
        descripcion || null,
        estado || 'Activa',
        id
      ]
    );

    return res.json({
      ok: true,
      mensaje: 'Caja actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar la caja'
    });
  }
};

// ============================================================
// PATCH /api/cajas/:id/estado
// Cambiar estado de caja
// ============================================================
const cambiarEstadoCaja = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['Activa', 'Inactiva'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activa o Inactiva'
      });
    }

    const [caja] = await pool.query(
      `
      SELECT id_caja
      FROM cajas
      WHERE id_caja = ?
      LIMIT 1
      `,
      [id]
    );

    if (caja.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Caja no encontrada'
      });
    }

    if (estado === 'Inactiva') {
      const [turnoAbierto] = await pool.query(
        `
        SELECT id_turno
        FROM turnos_caja
        WHERE id_caja = ?
          AND estado = 'Abierto'
        LIMIT 1
        `,
        [id]
      );

      if (turnoAbierto.length > 0) {
        return res.status(409).json({
          ok: false,
          mensaje: 'No se puede inactivar la caja porque tiene un turno abierto'
        });
      }
    }

    await pool.query(
      `
      UPDATE cajas
      SET estado = ?
      WHERE id_caja = ?
      `,
      [estado, id]
    );

    return res.json({
      ok: true,
      mensaje: `Caja marcada como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado de caja:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado de la caja'
    });
  }
};

module.exports = {
  obtenerCajas,
  obtenerCajaPorId,
  crearCaja,
  actualizarCaja,
  cambiarEstadoCaja
};