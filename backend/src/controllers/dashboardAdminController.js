const pool = require('../config/db');

// ============================================================
// GET /api/dashboard-admin/resumen
// Dashboard administrativo POSWALVI V1.3
// ============================================================
const obtenerResumenDashboardAdmin = async (req, res) => {
  try {
    // ========================================================
    // 1. Ventas del día
    // ========================================================
    const [ventasDia] = await pool.query(`
      SELECT
        COUNT(*) AS total_ventas,
        COALESCE(SUM(total), 0) AS monto_ventas,
        COALESCE(AVG(total), 0) AS ticket_promedio
      FROM ventas
      WHERE DATE(fecha_venta) = CURDATE()
        AND estado = 'Registrada'
    `);

    // ========================================================
    // 2. Compras del día
    // ========================================================
    const [comprasDia] = await pool.query(`
      SELECT
        COUNT(*) AS total_compras,
        COALESCE(SUM(total), 0) AS monto_compras
      FROM compras
      WHERE DATE(fecha_compra) = CURDATE()
        AND estado = 'Registrada'
    `);

    // ========================================================
    // 3. Inventario general
    // ========================================================
    const [inventarioResumen] = await pool.query(`
      SELECT
        COUNT(*) AS productos_con_saldo,
        COALESCE(SUM(stock_actual), 0) AS unidades_en_stock,
        SUM(CASE WHEN stock_actual <= stock_minimo THEN 1 ELSE 0 END) AS productos_stock_critico,
        SUM(CASE WHEN stock_actual = 0 THEN 1 ELSE 0 END) AS productos_sin_stock,
        SUM(CASE WHEN stock_actual < 0 THEN 1 ELSE 0 END) AS productos_stock_negativo
      FROM inventario_saldos
    `);

    // ========================================================
    // 4. Turnos de caja
    // ========================================================
    const [turnosResumen] = await pool.query(`
      SELECT
        COUNT(*) AS turnos_abiertos
      FROM turnos_caja
      WHERE estado = 'Abierto'
    `);

    // ========================================================
    // 5. Auditoría continua
    // ========================================================
    const [auditoriaResumen] = await pool.query(`
      SELECT
        COUNT(*) AS total_hallazgos,
        SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
        SUM(CASE WHEN estado = 'En revision' THEN 1 ELSE 0 END) AS en_revision,
        SUM(CASE WHEN estado = 'Confirmado' THEN 1 ELSE 0 END) AS confirmados,
        SUM(CASE WHEN nivel_riesgo = 'Alto' THEN 1 ELSE 0 END) AS riesgo_alto,
        SUM(CASE WHEN nivel_riesgo = 'Medio' THEN 1 ELSE 0 END) AS riesgo_medio,
        SUM(CASE WHEN nivel_riesgo = 'Bajo' THEN 1 ELSE 0 END) AS riesgo_bajo
      FROM auditoria_hallazgos
    `);

    // ========================================================
    // 6. Últimas ventas
    // ========================================================
    const [ultimasVentas] = await pool.query(`
      SELECT
        v.id_venta,
        v.numero_documento,
        v.fecha_venta,
        c.nombre_cliente,
        u.usuario,
        s.nombre_sucursal,
        cj.nombre_caja,
        v.total,
        v.estado
      FROM ventas v
      INNER JOIN clientes c ON v.id_cliente = c.id_cliente
      INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      LEFT JOIN cajas cj ON v.id_caja = cj.id_caja
      ORDER BY v.id_venta DESC
      LIMIT 5
    `);

    // ========================================================
    // 7. Últimas compras
    // ========================================================
    const [ultimasCompras] = await pool.query(`
      SELECT
        c.id_compra,
        c.numero_factura,
        c.numero_documento_interno,
        c.fecha_compra,
        p.nombre_proveedor,
        u.usuario,
        s.nombre_sucursal,
        b.nombre_bodega,
        c.total,
        c.estado
      FROM compras c
      INNER JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      LEFT JOIN bodegas b ON c.id_bodega = b.id_bodega
      ORDER BY c.id_compra DESC
      LIMIT 5
    `);

    // ========================================================
    // 8. Productos críticos
    // ========================================================
    const [productosCriticos] = await pool.query(`
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        s.stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        suc.nombre_sucursal,
        b.nombre_bodega,
        CASE
          WHEN s.stock_actual < 0 THEN 'Stock negativo'
          WHEN s.stock_actual = 0 THEN 'Sin stock'
          WHEN s.stock_actual <= s.stock_minimo THEN 'Stock bajo'
          ELSE 'Normal'
        END AS estado_stock
      FROM inventario_saldos s
      INNER JOIN productos p ON s.id_producto = p.id_producto
      INNER JOIN sucursales suc ON s.id_sucursal = suc.id_sucursal
      LEFT JOIN bodegas b ON s.id_bodega = b.id_bodega
      WHERE p.estado = 'Activo'
        AND s.stock_actual <= s.stock_minimo
      ORDER BY s.stock_actual ASC, p.nombre_producto ASC
      LIMIT 10
    `);

    // ========================================================
    // 9. Últimos movimientos de inventario
    // ========================================================
    const [ultimosMovimientos] = await pool.query(`
      SELECT
        im.id_movimiento,
        p.codigo_producto,
        p.nombre_producto,
        im.tipo_movimiento,
        im.origen,
        im.referencia_id,
        im.cantidad,
        im.stock_anterior,
        im.stock_nuevo,
        im.motivo,
        im.fecha_movimiento,
        u.usuario
      FROM inventario_movimientos im
      INNER JOIN productos p ON im.id_producto = p.id_producto
      INNER JOIN usuarios u ON im.id_usuario = u.id_usuario
      ORDER BY im.id_movimiento DESC
      LIMIT 10
    `);

    // ========================================================
    // 10. Hallazgos recientes
    // ========================================================
    const [hallazgosRecientes] = await pool.query(`
      SELECT
        h.id_hallazgo,
        r.codigo_regla,
        h.modulo_origen,
        h.tipo_irregularidad,
        h.descripcion,
        h.nivel_riesgo,
        h.estado,
        h.fecha_evento,
        h.fecha_deteccion
      FROM auditoria_hallazgos h
      INNER JOIN auditoria_reglas r ON h.id_regla = r.id_regla
      ORDER BY h.id_hallazgo DESC
      LIMIT 5
    `);

    return res.json({
      ok: true,
      resumen: {
        ventas_dia: {
          total_ventas: Number(ventasDia[0].total_ventas || 0),
          monto_ventas: Number(ventasDia[0].monto_ventas || 0),
          ticket_promedio: Number(ventasDia[0].ticket_promedio || 0)
        },
        compras_dia: {
          total_compras: Number(comprasDia[0].total_compras || 0),
          monto_compras: Number(comprasDia[0].monto_compras || 0)
        },
        inventario: {
          productos_con_saldo: Number(inventarioResumen[0].productos_con_saldo || 0),
          unidades_en_stock: Number(inventarioResumen[0].unidades_en_stock || 0),
          productos_stock_critico: Number(inventarioResumen[0].productos_stock_critico || 0),
          productos_sin_stock: Number(inventarioResumen[0].productos_sin_stock || 0),
          productos_stock_negativo: Number(inventarioResumen[0].productos_stock_negativo || 0)
        },
        caja: {
          turnos_abiertos: Number(turnosResumen[0].turnos_abiertos || 0)
        },
        auditoria: {
          total_hallazgos: Number(auditoriaResumen[0].total_hallazgos || 0),
          pendientes: Number(auditoriaResumen[0].pendientes || 0),
          en_revision: Number(auditoriaResumen[0].en_revision || 0),
          confirmados: Number(auditoriaResumen[0].confirmados || 0),
          riesgo_alto: Number(auditoriaResumen[0].riesgo_alto || 0),
          riesgo_medio: Number(auditoriaResumen[0].riesgo_medio || 0),
          riesgo_bajo: Number(auditoriaResumen[0].riesgo_bajo || 0)
        }
      },
      ultimas_ventas: ultimasVentas,
      ultimas_compras: ultimasCompras,
      productos_criticos: productosCriticos,
      ultimos_movimientos: ultimosMovimientos,
      hallazgos_recientes: hallazgosRecientes
    });
  } catch (error) {
    console.error('Error al obtener dashboard administrativo:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener dashboard administrativo'
    });
  }
};

module.exports = {
  obtenerResumenDashboardAdmin
};