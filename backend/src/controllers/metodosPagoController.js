const pool = require('../config/db');

// ============================================================
// GET /api/metodos-pago
// Listar métodos de pago
// ============================================================
const obtenerMetodosPago = async (req, res) => {
  try {
    const { estado, buscar } = req.query;

    let sql = `
      SELECT
        id_metodo_pago,
        nombre_metodo,
        descripcion,
        requiere_referencia,
        estado,
        creado_en
      FROM metodos_pago
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
          nombre_metodo LIKE ?
          OR descripcion LIKE ?
        )
      `;
      params.push(`%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY id_metodo_pago ASC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      metodos_pago: rows
    });
  } catch (error) {
    console.error('Error al obtener métodos de pago:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener métodos de pago'
    });
  }
};

// ============================================================
// GET /api/metodos-pago/:id
// Obtener método de pago por ID
// ============================================================
const obtenerMetodoPagoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        id_metodo_pago,
        nombre_metodo,
        descripcion,
        requiere_referencia,
        estado,
        creado_en
      FROM metodos_pago
      WHERE id_metodo_pago = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Método de pago no encontrado'
      });
    }

    return res.json({
      ok: true,
      metodo_pago: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener método de pago:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener el método de pago'
    });
  }
};

// ============================================================
// POST /api/metodos-pago
// Crear método de pago
// ============================================================
const crearMetodoPago = async (req, res) => {
  try {
    const {
      nombre_metodo,
      descripcion,
      requiere_referencia,
      estado
    } = req.body;

    if (!nombre_metodo || nombre_metodo.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre del método de pago es obligatorio'
      });
    }

    const estadoFinal = estado || 'Activo';

    if (!['Activo', 'Inactivo'].includes(estadoFinal)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const requiereReferenciaFinal = requiere_referencia ? 1 : 0;

    const [existe] = await pool.query(
      `
      SELECT id_metodo_pago
      FROM metodos_pago
      WHERE LOWER(nombre_metodo) = LOWER(?)
      LIMIT 1
      `,
      [nombre_metodo.trim()]
    );

    if (existe.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe un método de pago con ese nombre'
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO metodos_pago (
        nombre_metodo,
        descripcion,
        requiere_referencia,
        estado
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        nombre_metodo.trim(),
        descripcion || null,
        requiereReferenciaFinal,
        estadoFinal
      ]
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Método de pago creado correctamente',
      id_metodo_pago: result.insertId
    });
  } catch (error) {
    console.error('Error al crear método de pago:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear el método de pago'
    });
  }
};

// ============================================================
// PUT /api/metodos-pago/:id
// Actualizar método de pago
// ============================================================
const actualizarMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nombre_metodo,
      descripcion,
      requiere_referencia,
      estado
    } = req.body;

    if (!nombre_metodo || nombre_metodo.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre del método de pago es obligatorio'
      });
    }

    if (estado && !['Activo', 'Inactivo'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [metodo] = await pool.query(
      `
      SELECT id_metodo_pago
      FROM metodos_pago
      WHERE id_metodo_pago = ?
      LIMIT 1
      `,
      [id]
    );

    if (metodo.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Método de pago no encontrado'
      });
    }

    const [duplicado] = await pool.query(
      `
      SELECT id_metodo_pago
      FROM metodos_pago
      WHERE LOWER(nombre_metodo) = LOWER(?)
        AND id_metodo_pago <> ?
      LIMIT 1
      `,
      [nombre_metodo.trim(), id]
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otro método de pago con ese nombre'
      });
    }

    const requiereReferenciaFinal = requiere_referencia ? 1 : 0;

    await pool.query(
      `
      UPDATE metodos_pago
      SET
        nombre_metodo = ?,
        descripcion = ?,
        requiere_referencia = ?,
        estado = ?
      WHERE id_metodo_pago = ?
      `,
      [
        nombre_metodo.trim(),
        descripcion || null,
        requiereReferenciaFinal,
        estado || 'Activo',
        id
      ]
    );

    return res.json({
      ok: true,
      mensaje: 'Método de pago actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar método de pago:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar el método de pago'
    });
  }
};

// ============================================================
// PATCH /api/metodos-pago/:id/estado
// Cambiar estado de método de pago
// ============================================================
const cambiarEstadoMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['Activo', 'Inactivo'].includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [metodo] = await pool.query(
      `
      SELECT id_metodo_pago
      FROM metodos_pago
      WHERE id_metodo_pago = ?
      LIMIT 1
      `,
      [id]
    );

    if (metodo.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Método de pago no encontrado'
      });
    }

    await pool.query(
      `
      UPDATE metodos_pago
      SET estado = ?
      WHERE id_metodo_pago = ?
      `,
      [estado, id]
    );

    return res.json({
      ok: true,
      mensaje: `Método de pago marcado como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado de método de pago:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado del método de pago'
    });
  }
};

module.exports = {
  obtenerMetodosPago,
  obtenerMetodoPagoPorId,
  crearMetodoPago,
  actualizarMetodoPago,
  cambiarEstadoMetodoPago
};