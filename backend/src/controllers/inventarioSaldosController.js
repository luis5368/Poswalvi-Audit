const pool = require('../config/db');

// ============================================================
// GET /api/inventario-saldos
// Listar saldos de inventario
// ============================================================
const obtenerInventarioSaldos = async (req, res) => {
  try {
    const {
      id_sucursal,
      id_bodega,
      estado_producto,
      buscar,
      solo_bajo_stock
    } = req.query;

    let sql = `
      SELECT
        s.id_saldo,
        s.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.estado AS estado_producto,
        p.controla_inventario,
        s.id_sucursal,
        suc.nombre_sucursal,
        s.id_bodega,
        b.nombre_bodega,
        s.stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        CASE
          WHEN s.stock_actual < 0 THEN 'Stock negativo'
          WHEN s.stock_actual = 0 THEN 'Sin stock'
          WHEN s.stock_actual <= s.stock_minimo THEN 'Stock bajo'
          ELSE 'Normal'
        END AS estado_stock,
        s.actualizado_en
      FROM inventario_saldos s
      INNER JOIN productos p ON s.id_producto = p.id_producto
      INNER JOIN sucursales suc ON s.id_sucursal = suc.id_sucursal
      LEFT JOIN bodegas b ON s.id_bodega = b.id_bodega
      WHERE 1 = 1
    `;

    const params = [];

    if (id_sucursal) {
      sql += ` AND s.id_sucursal = ?`;
      params.push(id_sucursal);
    }

    if (id_bodega) {
      sql += ` AND s.id_bodega = ?`;
      params.push(id_bodega);
    }

    if (estado_producto) {
      sql += ` AND p.estado = ?`;
      params.push(estado_producto);
    }

    if (buscar) {
      sql += `
        AND (
          p.codigo_producto LIKE ?
          OR p.nombre_producto LIKE ?
          OR suc.nombre_sucursal LIKE ?
          OR b.nombre_bodega LIKE ?
        )
      `;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    if (solo_bajo_stock === 'true') {
      sql += ` AND s.stock_actual <= s.stock_minimo`;
    }

    sql += ` ORDER BY s.stock_actual ASC, p.nombre_producto ASC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      inventario: rows
    });
  } catch (error) {
    console.error('Error al obtener saldos de inventario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener saldos de inventario'
    });
  }
};

// ============================================================
// GET /api/inventario-saldos/criticos
// Productos con stock bajo, cero o negativo
// ============================================================
const obtenerInventarioCritico = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        s.id_saldo,
        p.codigo_producto,
        p.nombre_producto,
        suc.nombre_sucursal,
        b.nombre_bodega,
        s.stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        CASE
          WHEN s.stock_actual < 0 THEN 'Stock negativo'
          WHEN s.stock_actual = 0 THEN 'Sin stock'
          WHEN s.stock_actual <= s.stock_minimo THEN 'Stock bajo'
          ELSE 'Normal'
        END AS estado_stock,
        s.actualizado_en
      FROM inventario_saldos s
      INNER JOIN productos p ON s.id_producto = p.id_producto
      INNER JOIN sucursales suc ON s.id_sucursal = suc.id_sucursal
      LEFT JOIN bodegas b ON s.id_bodega = b.id_bodega
      WHERE p.estado = 'Activo'
        AND s.stock_actual <= s.stock_minimo
      ORDER BY s.stock_actual ASC, p.nombre_producto ASC
      `
    );

    return res.json({
      ok: true,
      total: rows.length,
      productos_criticos: rows
    });
  } catch (error) {
    console.error('Error al obtener inventario crítico:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener inventario crítico'
    });
  }
};

// ============================================================
// GET /api/inventario-saldos/:id
// Obtener saldo por ID
// ============================================================
const obtenerInventarioSaldoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        s.id_saldo,
        s.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        p.estado AS estado_producto,
        p.controla_inventario,
        s.id_sucursal,
        suc.nombre_sucursal,
        s.id_bodega,
        b.nombre_bodega,
        s.stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        s.actualizado_en
      FROM inventario_saldos s
      INNER JOIN productos p ON s.id_producto = p.id_producto
      INNER JOIN sucursales suc ON s.id_sucursal = suc.id_sucursal
      LEFT JOIN bodegas b ON s.id_bodega = b.id_bodega
      WHERE s.id_saldo = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Saldo de inventario no encontrado'
      });
    }

    return res.json({
      ok: true,
      saldo: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener saldo por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener saldo de inventario'
    });
  }
};

// ============================================================
// PATCH /api/inventario-saldos/:id/ajustar
// Ajuste manual de stock
// ============================================================
const ajustarInventarioSaldo = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { stock_nuevo, motivo } = req.body;
    const idUsuario = req.usuario.id_usuario;

    if (stock_nuevo === undefined || stock_nuevo === null) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El stock nuevo es obligatorio'
      });
    }

    const stockNuevo = Number(stock_nuevo);

    if (!Number.isInteger(stockNuevo)) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El stock nuevo debe ser un número entero'
      });
    }

    if (!motivo || motivo.trim() === '') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El motivo del ajuste es obligatorio'
      });
    }

    const [saldoRows] = await connection.query(
      `
      SELECT
        s.id_saldo,
        s.id_producto,
        s.id_sucursal,
        s.id_bodega,
        s.stock_actual,
        p.nombre_producto,
        p.controla_inventario
      FROM inventario_saldos s
      INNER JOIN productos p ON s.id_producto = p.id_producto
      WHERE s.id_saldo = ?
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (saldoRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Saldo de inventario no encontrado'
      });
    }

    const saldo = saldoRows[0];

    if (Number(saldo.controla_inventario) !== 1) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: `El producto ${saldo.nombre_producto} no controla inventario`
      });
    }

    const stockAnterior = Number(saldo.stock_actual);
    const diferencia = stockNuevo - stockAnterior;
    const cantidadMovimiento = Math.abs(diferencia);

    if (diferencia === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El stock nuevo es igual al stock actual, no hay ajuste que registrar'
      });
    }

    await connection.query(
      `
      UPDATE inventario_saldos
      SET stock_actual = ?
      WHERE id_saldo = ?
      `,
      [stockNuevo, id]
    );

    await connection.query(
      `
      INSERT INTO inventario_movimientos (
        id_producto,
        id_usuario,
        id_sucursal,
        id_bodega,
        id_turno,
        tipo_movimiento,
        origen,
        referencia_id,
        cantidad,
        stock_anterior,
        stock_nuevo,
        motivo,
        fecha_movimiento
      )
      VALUES (?, ?, ?, ?, NULL, 'Ajuste', 'AjusteManual', NULL, ?, ?, ?, ?, NOW())
      `,
      [
        saldo.id_producto,
        idUsuario,
        saldo.id_sucursal,
        saldo.id_bodega,
        cantidadMovimiento,
        stockAnterior,
        stockNuevo,
        motivo.trim()
      ]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Inventario ajustado correctamente',
      ajuste: {
        id_saldo: Number(id),
        id_producto: saldo.id_producto,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        diferencia,
        motivo: motivo.trim()
      }
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al ajustar inventario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al ajustar inventario'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  obtenerInventarioSaldos,
  obtenerInventarioCritico,
  obtenerInventarioSaldoPorId,
  ajustarInventarioSaldo
};