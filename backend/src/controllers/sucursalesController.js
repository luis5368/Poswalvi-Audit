const pool = require('../config/db');

// ============================================================
// GET /api/sucursales
// Listar sucursales
// ============================================================
const obtenerSucursales = async (req, res) => {
  try {
    const { estado, buscar } = req.query;

    let sql = `
      SELECT
        id_sucursal,
        nombre_sucursal,
        direccion,
        telefono,
        responsable,
        estado,
        creado_en,
        actualizado_en
      FROM sucursales
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND estado = ?`;
      params.push(estado);
    }

    if (buscar) {
      sql += `
        AND (
          nombre_sucursal LIKE ?
          OR direccion LIKE ?
          OR responsable LIKE ?
        )
      `;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY id_sucursal DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      sucursales: rows
    });
  } catch (error) {
    console.error('Error al obtener sucursales:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener sucursales'
    });
  }
};

// ============================================================
// GET /api/sucursales/:id
// Obtener sucursal por ID
// ============================================================
const obtenerSucursalPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        id_sucursal,
        nombre_sucursal,
        direccion,
        telefono,
        responsable,
        estado,
        creado_en,
        actualizado_en
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Sucursal no encontrada'
      });
    }

    return res.json({
      ok: true,
      sucursal: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener sucursal por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener la sucursal'
    });
  }
};

// ============================================================
// POST /api/sucursales
// Crear sucursal
// ============================================================
const crearSucursal = async (req, res) => {
  try {
    const {
      nombre_sucursal,
      direccion,
      telefono,
      responsable,
      estado
    } = req.body;

    if (!nombre_sucursal || nombre_sucursal.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre de la sucursal es obligatorio'
      });
    }

    const estadoFinal = estado || 'Activa';

    if (!['Activa', 'Inactiva'].includes(estadoFinal)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activa o Inactiva'
      });
    }

    const [existe] = await pool.query(
      `
      SELECT id_sucursal
      FROM sucursales
      WHERE LOWER(nombre_sucursal) = LOWER(?)
      LIMIT 1
      `,
      [nombre_sucursal.trim()]
    );

    if (existe.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe una sucursal con ese nombre'
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO sucursales (
        nombre_sucursal,
        direccion,
        telefono,
        responsable,
        estado
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        nombre_sucursal.trim(),
        direccion || null,
        telefono || null,
        responsable || null,
        estadoFinal
      ]
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Sucursal creada correctamente',
      id_sucursal: result.insertId
    });
  } catch (error) {
    console.error('Error al crear sucursal:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear la sucursal'
    });
  }
};

// ============================================================
// PUT /api/sucursales/:id
// Actualizar sucursal
// ============================================================
const actualizarSucursal = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre_sucursal,
      direccion,
      telefono,
      responsable,
      estado
    } = req.body;

    if (!nombre_sucursal || nombre_sucursal.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre de la sucursal es obligatorio'
      });
    }

    if (estado && !['Activa', 'Inactiva'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activa o Inactiva'
      });
    }

    const [sucursal] = await pool.query(
      `
      SELECT id_sucursal
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      `,
      [id]
    );

    if (sucursal.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Sucursal no encontrada'
      });
    }

    const [duplicado] = await pool.query(
      `
      SELECT id_sucursal
      FROM sucursales
      WHERE LOWER(nombre_sucursal) = LOWER(?)
        AND id_sucursal <> ?
      LIMIT 1
      `,
      [nombre_sucursal.trim(), id]
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otra sucursal con ese nombre'
      });
    }

    await pool.query(
      `
      UPDATE sucursales
      SET
        nombre_sucursal = ?,
        direccion = ?,
        telefono = ?,
        responsable = ?,
        estado = ?
      WHERE id_sucursal = ?
      `,
      [
        nombre_sucursal.trim(),
        direccion || null,
        telefono || null,
        responsable || null,
        estado || 'Activa',
        id
      ]
    );

    return res.json({
      ok: true,
      mensaje: 'Sucursal actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar sucursal:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar la sucursal'
    });
  }
};

// ============================================================
// PATCH /api/sucursales/:id/estado
// Cambiar estado de sucursal
// ============================================================
const cambiarEstadoSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['Activa', 'Inactiva'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activa o Inactiva'
      });
    }

    const [sucursal] = await pool.query(
      `
      SELECT id_sucursal
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      `,
      [id]
    );

    if (sucursal.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Sucursal no encontrada'
      });
    }

    await pool.query(
      `
      UPDATE sucursales
      SET estado = ?
      WHERE id_sucursal = ?
      `,
      [estado, id]
    );

    return res.json({
      ok: true,
      mensaje: `Sucursal marcada como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado de sucursal:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado de la sucursal'
    });
  }
};

module.exports = {
  obtenerSucursales,
  obtenerSucursalPorId,
  crearSucursal,
  actualizarSucursal,
  cambiarEstadoSucursal
};