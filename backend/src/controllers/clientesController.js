const pool = require('../config/db');

const validarEstadoCliente = (estado) => {
  return ['Activo', 'Inactivo'].includes(estado);
};

const validarCorreo = (correo) => {
  if (!correo) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
};

const validarTelefonoGuatemala = (telefono) => {
  if (!telefono) return true;
  return /^[0-9]{8}$/.test(telefono);
};

// ============================================================
// GET /api/clientes
// Listar clientes
// ============================================================
const obtenerClientes = async (req, res) => {
  try {
    const { estado, buscar } = req.query;

    let sql = `
      SELECT
        id_cliente,
        nit,
        nombre_cliente,
        telefono,
        correo,
        direccion,
        estado,
        creado_en,
        actualizado_en
      FROM clientes
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
          nit LIKE ?
          OR nombre_cliente LIKE ?
          OR telefono LIKE ?
          OR correo LIKE ?
        )
      `;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY id_cliente DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      clientes: rows
    });
  } catch (error) {
    console.error('Error al obtener clientes:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener clientes'
    });
  }
};

// ============================================================
// GET /api/clientes/:id
// Obtener cliente por ID
// ============================================================
const obtenerClientePorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        id_cliente,
        nit,
        nombre_cliente,
        telefono,
        correo,
        direccion,
        estado,
        creado_en,
        actualizado_en
      FROM clientes
      WHERE id_cliente = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Cliente no encontrado'
      });
    }

    return res.json({
      ok: true,
      cliente: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener cliente por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener el cliente'
    });
  }
};

// ============================================================
// GET /api/clientes/nit/:nit
// Buscar cliente por NIT
// ============================================================
const obtenerClientePorNit = async (req, res) => {
  try {
    const { nit } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        id_cliente,
        nit,
        nombre_cliente,
        telefono,
        correo,
        direccion,
        estado,
        creado_en,
        actualizado_en
      FROM clientes
      WHERE nit = ?
      LIMIT 1
      `,
      [nit]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Cliente no encontrado con ese NIT'
      });
    }

    return res.json({
      ok: true,
      cliente: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener cliente por NIT:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al buscar cliente por NIT'
    });
  }
};

// ============================================================
// POST /api/clientes
// Crear cliente
// ============================================================
const crearCliente = async (req, res) => {
  try {
    const {
      nit,
      nombre_cliente,
      telefono,
      correo,
      direccion,
      estado
    } = req.body;

    if (!nit || nit.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El NIT es obligatorio'
      });
    }

    if (!nombre_cliente || nombre_cliente.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre del cliente es obligatorio'
      });
    }

    if (!validarTelefonoGuatemala(telefono)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El teléfono debe tener 8 dígitos numéricos'
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El correo no tiene un formato válido'
      });
    }

    const estadoFinal = estado || 'Activo';

    if (!validarEstadoCliente(estadoFinal)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [duplicado] = await pool.query(
      `
      SELECT id_cliente
      FROM clientes
      WHERE LOWER(nit) = LOWER(?)
      LIMIT 1
      `,
      [nit.trim()]
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe un cliente con ese NIT'
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO clientes (
        nit,
        nombre_cliente,
        telefono,
        correo,
        direccion,
        estado,
        creado_en,
        actualizado_en
      )
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        nit.trim(),
        nombre_cliente.trim(),
        telefono || null,
        correo || null,
        direccion || null,
        estadoFinal
      ]
    );

    return res.status(201).json({
      ok: true,
      mensaje: 'Cliente creado correctamente',
      id_cliente: result.insertId
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear cliente'
    });
  }
};

// ============================================================
// PUT /api/clientes/:id
// Actualizar cliente
// ============================================================
const actualizarCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nit,
      nombre_cliente,
      telefono,
      correo,
      direccion,
      estado
    } = req.body;

    if (!nit || nit.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El NIT es obligatorio'
      });
    }

    if (!nombre_cliente || nombre_cliente.trim() === '') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre del cliente es obligatorio'
      });
    }

    if (!validarTelefonoGuatemala(telefono)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El teléfono debe tener 8 dígitos numéricos'
      });
    }

    if (!validarCorreo(correo)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El correo no tiene un formato válido'
      });
    }

    if (estado && !validarEstadoCliente(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [cliente] = await pool.query(
      `
      SELECT id_cliente
      FROM clientes
      WHERE id_cliente = ?
      LIMIT 1
      `,
      [id]
    );

    if (cliente.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Cliente no encontrado'
      });
    }

    const [duplicado] = await pool.query(
      `
      SELECT id_cliente
      FROM clientes
      WHERE LOWER(nit) = LOWER(?)
        AND id_cliente <> ?
      LIMIT 1
      `,
      [nit.trim(), id]
    );

    if (duplicado.length > 0) {
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe otro cliente con ese NIT'
      });
    }

    await pool.query(
      `
      UPDATE clientes
      SET
        nit = ?,
        nombre_cliente = ?,
        telefono = ?,
        correo = ?,
        direccion = ?,
        estado = ?
      WHERE id_cliente = ?
      `,
      [
        nit.trim(),
        nombre_cliente.trim(),
        telefono || null,
        correo || null,
        direccion || null,
        estado || 'Activo',
        id
      ]
    );

    return res.json({
      ok: true,
      mensaje: 'Cliente actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar cliente'
    });
  }
};

// ============================================================
// PATCH /api/clientes/:id/estado
// Cambiar estado de cliente
// ============================================================
const cambiarEstadoCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!validarEstadoCliente(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [cliente] = await pool.query(
      `
      SELECT id_cliente
      FROM clientes
      WHERE id_cliente = ?
      LIMIT 1
      `,
      [id]
    );

    if (cliente.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Cliente no encontrado'
      });
    }

    await pool.query(
      `
      UPDATE clientes
      SET estado = ?
      WHERE id_cliente = ?
      `,
      [estado, id]
    );

    return res.json({
      ok: true,
      mensaje: `Cliente marcado como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado del cliente:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado del cliente'
    });
  }
};

module.exports = {
  obtenerClientes,
  obtenerClientePorId,
  obtenerClientePorNit,
  crearCliente,
  actualizarCliente,
  cambiarEstadoCliente
};