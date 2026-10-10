const pool = require('../config/db');

// ============================================================
// GET /api/catalogos-productos/categorias
// ============================================================
const obtenerCategorias = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id_categoria,
        nombre_categoria,
        descripcion,
        estado
      FROM categorias
      WHERE estado = 'Activo'
      ORDER BY nombre_categoria ASC
      `
    );

    return res.json({
      ok: true,
      total: rows.length,
      categorias: rows
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener categorías'
    });
  }
};

// ============================================================
// GET /api/catalogos-productos/subcategorias?id_categoria=1
// ============================================================
const obtenerSubcategorias = async (req, res) => {
  try {
    const { id_categoria } = req.query;

    let sql = `
      SELECT
        id_subcategoria,
        id_categoria,
        nombre_subcategoria,
        descripcion,
        estado
      FROM subcategorias
      WHERE estado = 'Activo'
    `;

    const params = [];

    if (id_categoria) {
      sql += ` AND id_categoria = ?`;
      params.push(id_categoria);
    }

    sql += ` ORDER BY nombre_subcategoria ASC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      subcategorias: rows
    });
  } catch (error) {
    console.error('Error al obtener subcategorías:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener subcategorías'
    });
  }
};

// ============================================================
// GET /api/catalogos-productos/marcas
// ============================================================
const obtenerMarcas = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id_marca,
        nombre_marca,
        estado
      FROM marcas
      WHERE estado = 'Activa'
      ORDER BY nombre_marca ASC
      `
    );

    return res.json({
      ok: true,
      total: rows.length,
      marcas: rows
    });
  } catch (error) {
    console.error('Error al obtener marcas:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener marcas'
    });
  }
};

// ============================================================
// GET /api/catalogos-productos/unidades-medida
// ============================================================
const obtenerUnidadesMedida = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id_unidad_medida,
        nombre_unidad,
        abreviatura,
        estado
      FROM unidades_medida
      WHERE estado = 'Activa'
      ORDER BY nombre_unidad ASC
      `
    );

    return res.json({
      ok: true,
      total: rows.length,
      unidades_medida: rows
    });
  } catch (error) {
    console.error('Error al obtener unidades de medida:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener unidades de medida'
    });
  }
};

// ============================================================
// GET /api/catalogos-productos/sucursales-bodegas
// ============================================================
const obtenerSucursalesBodegas = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        s.id_sucursal,
        s.nombre_sucursal,
        b.id_bodega,
        b.nombre_bodega
      FROM sucursales s
      INNER JOIN bodegas b ON s.id_sucursal = b.id_sucursal
      WHERE s.estado = 'Activa'
        AND b.estado = 'Activa'
      ORDER BY s.nombre_sucursal ASC, b.nombre_bodega ASC
      `
    );

    return res.json({
      ok: true,
      total: rows.length,
      sucursales_bodegas: rows
    });
  } catch (error) {
    console.error('Error al obtener sucursales y bodegas:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener sucursales y bodegas'
    });
  }
};

module.exports = {
  obtenerCategorias,
  obtenerSubcategorias,
  obtenerMarcas,
  obtenerUnidadesMedida,
  obtenerSucursalesBodegas
};