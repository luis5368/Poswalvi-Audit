const pool = require('../config/db');

const ejecutarVentaBajoCosto = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'VENTA_BAJO_COSTO'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla VENTA_BAJO_COSTO no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [ventasBajoCosto] = await connection.query(
      `SELECT 
          vd.id_venta_detalle,
          v.id_venta,
          v.id_usuario,
          v.fecha_venta,
          p.id_producto,
          p.codigo_producto,
          p.nombre_producto,
          vd.precio_unitario,
          vd.costo_unitario,
          vd.cantidad,
          vd.subtotal
       FROM venta_detalle vd
       INNER JOIN ventas v ON vd.id_venta = v.id_venta
       INNER JOIN productos p ON vd.id_producto = p.id_producto
       WHERE vd.precio_unitario < vd.costo_unitario
         AND NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = vd.id_venta_detalle
              AND ah.modulo_origen = 'Ventas'
         )`,
      [regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const venta of ventasBajoCosto) {
      const descripcion = `
Venta por debajo del costo detectada.
Producto: ${venta.codigo_producto} - ${venta.nombre_producto}.
Precio unitario vendido: Q${venta.precio_unitario}.
Costo unitario: Q${venta.costo_unitario}.
Cantidad vendida: ${venta.cantidad}.
Venta No.: ${venta.id_venta}.
Detalle No.: ${venta.id_venta_detalle}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
  `INSERT INTO auditoria_hallazgos
   (
    id_regla,
    modulo_origen,
    referencia_id,
    tipo_irregularidad,
    descripcion,
    nivel_riesgo,
    estado,
    id_usuario_relacionado,
    fecha_evento,
    fecha_deteccion
   )
   VALUES (?, 'Ventas', ?, ?, ?, ?, 'Pendiente', ?, ?, NOW())`,
  [
    regla.id_regla,
    venta.id_venta_detalle,
    regla.codigo_regla,
    descripcion,
    regla.nivel_riesgo,
    venta.id_usuario,
    venta.fecha_venta
  ]
);

const idHallazgo = hallazgoInsertado.insertId;

    await connection.query(
    `INSERT INTO auditoria_evidencias
    (
        id_hallazgo,
        campo,
        valor_anterior,
        valor_actual,
        descripcion
    )
    VALUES
    (?, 'precio_unitario', NULL, ?, 'Precio unitario registrado en la venta'),
    (?, 'costo_unitario', NULL, ?, 'Costo unitario del producto vendido'),
    (?, 'codigo_producto', NULL, ?, 'Código del producto relacionado al hallazgo'),
    (?, 'id_venta', NULL, ?, 'Venta relacionada al hallazgo'),
    (?, 'id_venta_detalle', NULL, ?, 'Detalle de venta relacionado al hallazgo')`,
    [
        idHallazgo,
        venta.precio_unitario,

        idHallazgo,
        venta.costo_unitario,

        idHallazgo,
        venta.codigo_producto,

        idHallazgo,
        venta.id_venta,

        idHallazgo,
        venta.id_venta_detalle
    ]
    );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      ventas_detectadas: ventasBajoCosto.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla VENTA_BAJO_COSTO:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla VENTA_BAJO_COSTO',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarStockNegativo = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'STOCK_NEGATIVO'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla STOCK_NEGATIVO no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [movimientos] = await connection.query(
      `SELECT 
          im.id_movimiento,
          im.id_producto,
          im.id_usuario,
          im.tipo_movimiento,
          im.origen,
          im.referencia_id,
          im.cantidad,
          im.stock_anterior,
          im.stock_nuevo,
          im.motivo,
          im.fecha_movimiento,
          p.codigo_producto,
          p.nombre_producto
       FROM inventario_movimientos im
       INNER JOIN productos p ON im.id_producto = p.id_producto
       WHERE im.stock_nuevo < 0
         AND NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = im.id_movimiento
              AND ah.modulo_origen = 'Inventario'
         )`,
      [regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const mov of movimientos) {
      const descripcion = `
Stock negativo detectado.
Producto: ${mov.codigo_producto} - ${mov.nombre_producto}.
Stock anterior: ${mov.stock_anterior}.
Cantidad del movimiento: ${mov.cantidad}.
Stock nuevo: ${mov.stock_nuevo}.
Tipo de movimiento: ${mov.tipo_movimiento}.
Movimiento No.: ${mov.id_movimiento}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
        `INSERT INTO auditoria_hallazgos
         (
          id_regla,
          modulo_origen,
          referencia_id,
          tipo_irregularidad,
          descripcion,
          nivel_riesgo,
          estado,
          id_usuario_relacionado,
          fecha_evento,
          fecha_deteccion
         )
         VALUES (?, 'Inventario', ?, ?, ?, ?, 'Pendiente', ?, ?, NOW())`,
        [
          regla.id_regla,
          mov.id_movimiento,
          regla.codigo_regla,
          descripcion,
          regla.nivel_riesgo,
          mov.id_usuario,
          mov.fecha_movimiento
        ]
      );

      const idHallazgo = hallazgoInsertado.insertId;

      await connection.query(
        `INSERT INTO auditoria_evidencias
         (
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
         )
         VALUES
         (?, 'stock_anterior', NULL, ?, 'Stock anterior al movimiento de inventario', NOW()),
         (?, 'cantidad_movimiento', NULL, ?, 'Cantidad aplicada en el movimiento de inventario', NOW()),
         (?, 'stock_nuevo', NULL, ?, 'Stock resultante después del movimiento', NOW()),
         (?, 'codigo_producto', NULL, ?, 'Código del producto relacionado al hallazgo', NOW()),
         (?, 'nombre_producto', NULL, ?, 'Nombre del producto relacionado al hallazgo', NOW()),
         (?, 'id_movimiento', NULL, ?, 'Movimiento de inventario relacionado al hallazgo', NOW())`,
        [
          idHallazgo,
          mov.stock_anterior,

          idHallazgo,
          mov.cantidad,

          idHallazgo,
          mov.stock_nuevo,

          idHallazgo,
          mov.codigo_producto,

          idHallazgo,
          mov.nombre_producto,

          idHallazgo,
          mov.id_movimiento
        ]
      );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      movimientos_detectados: movimientos.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla STOCK_NEGATIVO:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla STOCK_NEGATIVO',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarAjusteSinMotivo = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'AJUSTE_SIN_MOTIVO'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla AJUSTE_SIN_MOTIVO no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [movimientos] = await connection.query(
      `SELECT 
          im.id_movimiento,
          im.id_producto,
          im.id_usuario,
          im.tipo_movimiento,
          im.origen,
          im.referencia_id,
          im.cantidad,
          im.stock_anterior,
          im.stock_nuevo,
          im.motivo,
          im.fecha_movimiento,
          p.codigo_producto,
          p.nombre_producto
       FROM inventario_movimientos im
       INNER JOIN productos p ON im.id_producto = p.id_producto
       WHERE im.tipo_movimiento = 'Ajuste'
         AND (im.motivo IS NULL OR TRIM(im.motivo) = '')
         AND NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = im.id_movimiento
              AND ah.modulo_origen = 'Inventario'
         )`,
      [regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const mov of movimientos) {
      const descripcion = `
Ajuste manual sin justificación detectado.
Producto: ${mov.codigo_producto} - ${mov.nombre_producto}.
Tipo de movimiento: ${mov.tipo_movimiento}.
Origen: ${mov.origen}.
Stock anterior: ${mov.stock_anterior}.
Stock nuevo: ${mov.stock_nuevo}.
Cantidad aplicada: ${mov.cantidad}.
Movimiento No.: ${mov.id_movimiento}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
        `INSERT INTO auditoria_hallazgos
         (
          id_regla,
          modulo_origen,
          referencia_id,
          tipo_irregularidad,
          descripcion,
          nivel_riesgo,
          estado,
          id_usuario_relacionado,
          fecha_evento,
          fecha_deteccion
         )
         VALUES (?, 'Inventario', ?, ?, ?, ?, 'Pendiente', ?, ?, NOW())`,
        [
          regla.id_regla,
          mov.id_movimiento,
          regla.codigo_regla,
          descripcion,
          regla.nivel_riesgo,
          mov.id_usuario,
          mov.fecha_movimiento
        ]
      );

      const idHallazgo = hallazgoInsertado.insertId;

      await connection.query(
        `INSERT INTO auditoria_evidencias
         (
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
         )
         VALUES
         (?, 'tipo_movimiento', NULL, ?, 'Tipo de movimiento registrado', NOW()),
         (?, 'origen', NULL, ?, 'Origen del movimiento de inventario', NOW()),
         (?, 'motivo', NULL, ?, 'Motivo registrado en el movimiento', NOW()),
         (?, 'stock_anterior', NULL, ?, 'Stock anterior al ajuste', NOW()),
         (?, 'stock_nuevo', NULL, ?, 'Stock posterior al ajuste', NOW()),
         (?, 'codigo_producto', NULL, ?, 'Código del producto relacionado al hallazgo', NOW()),
         (?, 'id_movimiento', NULL, ?, 'Movimiento de inventario relacionado al hallazgo', NOW())`,
        [
          idHallazgo,
          mov.tipo_movimiento,

          idHallazgo,
          mov.origen,

          idHallazgo,
          mov.motivo,

          idHallazgo,
          mov.stock_anterior,

          idHallazgo,
          mov.stock_nuevo,

          idHallazgo,
          mov.codigo_producto,

          idHallazgo,
          mov.id_movimiento
        ]
      );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      movimientos_detectados: movimientos.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla AJUSTE_SIN_MOTIVO:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla AJUSTE_SIN_MOTIVO',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarCompraDuplicada = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'COMPRA_DUPLICADA'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla COMPRA_DUPLICADA no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [comprasDuplicadas] = await connection.query(
      `SELECT 
          c2.id_compra AS id_compra_duplicada,
          c1.id_compra AS id_compra_original,
          c2.id_proveedor,
          c2.id_usuario,
          p.nit,
          p.nombre_proveedor,
          c2.numero_factura,
          c2.fecha_compra,
          c2.subtotal,
          c2.descuento,
          c2.impuesto,
          c2.total,
          c2.estado
       FROM compras c1
       INNER JOIN compras c2 
          ON c1.id_proveedor = c2.id_proveedor
         AND c1.numero_factura = c2.numero_factura
         AND c1.total = c2.total
         AND c1.id_compra < c2.id_compra
       INNER JOIN proveedores p ON c2.id_proveedor = p.id_proveedor
       WHERE NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = c2.id_compra
              AND ah.modulo_origen = 'Compras'
       )`,
      [regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const compra of comprasDuplicadas) {
      const descripcion = `
Posible compra duplicada detectada.
Proveedor: ${compra.nit} - ${compra.nombre_proveedor}.
Factura: ${compra.numero_factura}.
Total: Q${compra.total}.
Compra original No.: ${compra.id_compra_original}.
Compra duplicada No.: ${compra.id_compra_duplicada}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
        `INSERT INTO auditoria_hallazgos
         (
          id_regla,
          modulo_origen,
          referencia_id,
          tipo_irregularidad,
          descripcion,
          nivel_riesgo,
          estado,
          id_usuario_relacionado,
          fecha_evento,
          fecha_deteccion
         )
         VALUES (?, 'Compras', ?, ?, ?, ?, 'Pendiente', ?, ?, NOW())`,
        [
          regla.id_regla,
          compra.id_compra_duplicada,
          regla.codigo_regla,
          descripcion,
          regla.nivel_riesgo,
          compra.id_usuario,
          compra.fecha_compra
        ]
      );

      const idHallazgo = hallazgoInsertado.insertId;

      await connection.query(
        `INSERT INTO auditoria_evidencias
         (
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
         )
         VALUES
         (?, 'id_compra_original', NULL, ?, 'Compra original relacionada con la posible duplicidad', NOW()),
         (?, 'id_compra_duplicada', NULL, ?, 'Compra detectada como posible duplicada', NOW()),
         (?, 'id_proveedor', NULL, ?, 'Proveedor relacionado con la compra', NOW()),
         (?, 'nit_proveedor', NULL, ?, 'NIT del proveedor relacionado', NOW()),
         (?, 'nombre_proveedor', NULL, ?, 'Nombre del proveedor relacionado', NOW()),
         (?, 'numero_factura', NULL, ?, 'Número de factura repetido', NOW()),
         (?, 'total_compra', NULL, ?, 'Total de la compra duplicada', NOW())`,
        [
          idHallazgo,
          compra.id_compra_original,

          idHallazgo,
          compra.id_compra_duplicada,

          idHallazgo,
          compra.id_proveedor,

          idHallazgo,
          compra.nit,

          idHallazgo,
          compra.nombre_proveedor,

          idHallazgo,
          compra.numero_factura,

          idHallazgo,
          compra.total
        ]
      );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      compras_detectadas: comprasDuplicadas.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla COMPRA_DUPLICADA:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla COMPRA_DUPLICADA',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarPrecioProveedorAnormal = async (idUsuarioEjecutor = null) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'PRECIO_PROVEEDOR_ANORMAL'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla PRECIO_PROVEEDOR_ANORMAL no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [preciosAnormales] = await connection.query(
      `SELECT *
       FROM (
          SELECT 
              pp.id_producto_proveedor,
              pp.id_producto,
              pp.id_proveedor,
              pp.codigo_proveedor,
              pp.precio_compra,
              pp.proveedor_principal,
              pp.estado,
              p.codigo_producto,
              p.nombre_producto,
              pr.nit,
              pr.nombre_proveedor,

              (
                SELECT AVG(pp2.precio_compra)
                FROM producto_proveedor pp2
                WHERE pp2.id_producto = pp.id_producto
                  AND pp2.id_producto_proveedor <> pp.id_producto_proveedor
                  AND pp2.estado = 'Activo'
              ) AS promedio_referencia,

              (
                SELECT COUNT(*)
                FROM producto_proveedor pp3
                WHERE pp3.id_producto = pp.id_producto
                  AND pp3.id_producto_proveedor <> pp.id_producto_proveedor
                  AND pp3.estado = 'Activo'
              ) AS total_referencias

          FROM producto_proveedor pp
          INNER JOIN productos p ON pp.id_producto = p.id_producto
          INNER JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
          WHERE pp.estado = 'Activo'
       ) base
       WHERE base.total_referencias >= 1
         AND base.precio_compra > (base.promedio_referencia * 1.30)
         AND NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = base.id_producto_proveedor
              AND ah.modulo_origen = 'Proveedores'
         )`,
      [regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const item of preciosAnormales) {
      const descripcion = `
Precio de proveedor anormal detectado.
Producto: ${item.codigo_producto} - ${item.nombre_producto}.
Proveedor: ${item.nit} - ${item.nombre_proveedor}.
Precio compra registrado: Q${item.precio_compra}.
Promedio de referencia: Q${Number(item.promedio_referencia).toFixed(2)}.
Límite permitido aplicado: 30% sobre promedio.
Registro producto_proveedor No.: ${item.id_producto_proveedor}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
        `INSERT INTO auditoria_hallazgos
         (
          id_regla,
          modulo_origen,
          referencia_id,
          tipo_irregularidad,
          descripcion,
          nivel_riesgo,
          estado,
          id_usuario_relacionado,
          fecha_evento,
          fecha_deteccion
         )
         VALUES (?, 'Proveedores', ?, ?, ?, ?, 'Pendiente', ?, NOW(), NOW())`,
        [
          regla.id_regla,
          item.id_producto_proveedor,
          regla.codigo_regla,
          descripcion,
          regla.nivel_riesgo,
          idUsuarioEjecutor
        ]
      );

      const idHallazgo = hallazgoInsertado.insertId;

      await connection.query(
        `INSERT INTO auditoria_evidencias
         (
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
         )
         VALUES
         (?, 'id_producto_proveedor', NULL, ?, 'Registro de relación producto-proveedor evaluado', NOW()),
         (?, 'codigo_producto', NULL, ?, 'Código del producto evaluado', NOW()),
         (?, 'nombre_producto', NULL, ?, 'Nombre del producto evaluado', NOW()),
         (?, 'nit_proveedor', NULL, ?, 'NIT del proveedor evaluado', NOW()),
         (?, 'nombre_proveedor', NULL, ?, 'Nombre del proveedor evaluado', NOW()),
         (?, 'precio_compra', NULL, ?, 'Precio de compra registrado para el proveedor', NOW()),
         (?, 'promedio_referencia', NULL, ?, 'Promedio de precio de otros proveedores para el mismo producto', NOW()),
         (?, 'porcentaje_limite', NULL, '30%', 'Porcentaje máximo permitido sobre el promedio de referencia', NOW())`,
        [
          idHallazgo,
          item.id_producto_proveedor,

          idHallazgo,
          item.codigo_producto,

          idHallazgo,
          item.nombre_producto,

          idHallazgo,
          item.nit,

          idHallazgo,
          item.nombre_proveedor,

          idHallazgo,
          item.precio_compra,

          idHallazgo,
          Number(item.promedio_referencia).toFixed(2),

          idHallazgo
        ]
      );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      precios_detectados: preciosAnormales.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla PRECIO_PROVEEDOR_ANORMAL:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla PRECIO_PROVEEDOR_ANORMAL',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarAnulacionesFrecuentes = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'ANULACIONES_FRECUENTES'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla ANULACIONES_FRECUENTES no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [usuariosDetectados] = await connection.query(
      `SELECT 
          v.anulado_por AS id_usuario,
          u.usuario,
          CONCAT(u.nombre, ' ', u.apellido) AS nombre_usuario,
          COUNT(*) AS total_anulaciones,
          MIN(v.fecha_anulacion) AS primera_anulacion,
          MAX(v.fecha_anulacion) AS ultima_anulacion
       FROM ventas v
       INNER JOIN usuarios u ON v.anulado_por = u.id_usuario
       WHERE v.estado = 'Anulada'
         AND v.fecha_anulacion >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         AND v.anulado_por IS NOT NULL
       GROUP BY v.anulado_por, u.usuario, u.nombre, u.apellido
       HAVING COUNT(*) >= 3
         AND NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = v.anulado_por
              AND ah.modulo_origen = 'Ventas'
              AND ah.fecha_evento >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         )`,
      [regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const usuario of usuariosDetectados) {
      const descripcion = `
Anulaciones frecuentes detectadas.
Usuario: ${usuario.nombre_usuario} (${usuario.usuario}).
Total de anulaciones en las últimas 24 horas: ${usuario.total_anulaciones}.
Primera anulación: ${usuario.primera_anulacion}.
Última anulación: ${usuario.ultima_anulacion}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
        `INSERT INTO auditoria_hallazgos
         (
          id_regla,
          modulo_origen,
          referencia_id,
          tipo_irregularidad,
          descripcion,
          nivel_riesgo,
          estado,
          id_usuario_relacionado,
          fecha_evento,
          fecha_deteccion
         )
         VALUES (?, 'Ventas', ?, ?, ?, ?, 'Pendiente', ?, ?, NOW())`,
        [
          regla.id_regla,
          usuario.id_usuario,
          regla.codigo_regla,
          descripcion,
          regla.nivel_riesgo,
          usuario.id_usuario,
          usuario.ultima_anulacion
        ]
      );

      const idHallazgo = hallazgoInsertado.insertId;

      await connection.query(
        `INSERT INTO auditoria_evidencias
         (
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
         )
         VALUES
         (?, 'usuario', NULL, ?, 'Usuario que realizó las anulaciones', NOW()),
         (?, 'total_anulaciones', NULL, ?, 'Cantidad de anulaciones detectadas en las últimas 24 horas', NOW()),
         (?, 'primera_anulacion', NULL, ?, 'Primera anulación detectada en el período evaluado', NOW()),
         (?, 'ultima_anulacion', NULL, ?, 'Última anulación detectada en el período evaluado', NOW()),
         (?, 'periodo_evaluado', NULL, '24 horas', 'Período utilizado para evaluar la frecuencia de anulaciones', NOW())`,
        [
          idHallazgo,
          usuario.nombre_usuario,

          idHallazgo,
          usuario.total_anulaciones,

          idHallazgo,
          usuario.primera_anulacion,

          idHallazgo,
          usuario.ultima_anulacion,

          idHallazgo
        ]
      );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      usuarios_detectados: usuariosDetectados.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla ANULACIONES_FRECUENTES:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla ANULACIONES_FRECUENTES',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarMovimientoFueraHorario = async () => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const HORA_INICIO = '07:00:00';
    const HORA_FIN = '22:00:00';

    const [reglas] = await connection.query(
      `SELECT id_regla, codigo_regla, nombre_regla, nivel_riesgo
       FROM auditoria_reglas
       WHERE codigo_regla = 'MOVIMIENTO_FUERA_HORARIO'
         AND estado = 'Activa'
       LIMIT 1`
    );

    if (reglas.length === 0) {
      await connection.rollback();

      return {
        ok: false,
        mensaje: 'La regla MOVIMIENTO_FUERA_HORARIO no existe o no está activa',
        hallazgos_generados: 0
      };
    }

    const regla = reglas[0];

    const [movimientos] = await connection.query(
      `SELECT *
       FROM (
          SELECT 
              'Ventas' AS modulo_origen,
              v.id_venta AS referencia_id,
              v.id_usuario,
              v.fecha_venta AS fecha_evento,
              TIME(v.fecha_venta) AS hora_evento,
              CONCAT('Venta No. ', v.id_venta, ' por Q', v.total) AS detalle_evento
          FROM ventas v
          WHERE v.fecha_venta IS NOT NULL

          UNION ALL

          SELECT 
              'Compras' AS modulo_origen,
              c.id_compra AS referencia_id,
              c.id_usuario,
              c.fecha_compra AS fecha_evento,
              TIME(c.fecha_compra) AS hora_evento,
              CONCAT('Compra No. ', c.id_compra, ' Factura ', c.numero_factura, ' por Q', c.total) AS detalle_evento
          FROM compras c
          WHERE c.fecha_compra IS NOT NULL

          UNION ALL

          SELECT 
              'Inventario' AS modulo_origen,
              im.id_movimiento AS referencia_id,
              im.id_usuario,
              im.fecha_movimiento AS fecha_evento,
              TIME(im.fecha_movimiento) AS hora_evento,
              CONCAT('Movimiento inventario No. ', im.id_movimiento, ' Tipo ', im.tipo_movimiento, ' Origen ', im.origen) AS detalle_evento
          FROM inventario_movimientos im
          WHERE im.fecha_movimiento IS NOT NULL
       ) base
       WHERE (base.hora_evento < ? OR base.hora_evento > ?)
         AND NOT EXISTS (
            SELECT 1
            FROM auditoria_hallazgos ah
            WHERE ah.id_regla = ?
              AND ah.referencia_id = base.referencia_id
              AND ah.modulo_origen = base.modulo_origen
         )`,
      [HORA_INICIO, HORA_FIN, regla.id_regla]
    );

    let hallazgosGenerados = 0;

    for (const mov of movimientos) {
      const descripcion = `
Movimiento fuera de horario detectado.
Módulo origen: ${mov.modulo_origen}.
Referencia No.: ${mov.referencia_id}.
Fecha y hora del evento: ${mov.fecha_evento}.
Hora detectada: ${mov.hora_evento}.
Horario permitido: ${HORA_INICIO} a ${HORA_FIN}.
Detalle: ${mov.detalle_evento}.
      `.trim();

      const [hallazgoInsertado] = await connection.query(
        `INSERT INTO auditoria_hallazgos
         (
          id_regla,
          modulo_origen,
          referencia_id,
          tipo_irregularidad,
          descripcion,
          nivel_riesgo,
          estado,
          id_usuario_relacionado,
          fecha_evento,
          fecha_deteccion
         )
         VALUES (?, ?, ?, ?, ?, ?, 'Pendiente', ?, ?, NOW())`,
        [
          regla.id_regla,
          mov.modulo_origen,
          mov.referencia_id,
          regla.codigo_regla,
          descripcion,
          regla.nivel_riesgo,
          mov.id_usuario,
          mov.fecha_evento
        ]
      );

      const idHallazgo = hallazgoInsertado.insertId;

      await connection.query(
        `INSERT INTO auditoria_evidencias
         (
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
         )
         VALUES
         (?, 'modulo_origen', NULL, ?, 'Módulo donde ocurrió el movimiento', NOW()),
         (?, 'referencia_id', NULL, ?, 'ID del registro evaluado', NOW()),
         (?, 'fecha_evento', NULL, ?, 'Fecha y hora del movimiento detectado', NOW()),
         (?, 'hora_evento', NULL, ?, 'Hora exacta evaluada', NOW()),
         (?, 'horario_permitido', NULL, ?, 'Rango de horario permitido para operar', NOW()),
         (?, 'detalle_evento', NULL, ?, 'Descripción del evento fuera de horario', NOW())`,
        [
          idHallazgo,
          mov.modulo_origen,

          idHallazgo,
          mov.referencia_id,

          idHallazgo,
          mov.fecha_evento,

          idHallazgo,
          mov.hora_evento,

          idHallazgo,
          `${HORA_INICIO} a ${HORA_FIN}`,

          idHallazgo,
          mov.detalle_evento
        ]
      );

      hallazgosGenerados++;
    }

    await connection.commit();

    return {
      ok: true,
      regla: regla.codigo_regla,
      movimientos_detectados: movimientos.length,
      hallazgos_generados: hallazgosGenerados
    };

  } catch (error) {
    await connection.rollback();
    console.error('Error ejecutando regla MOVIMIENTO_FUERA_HORARIO:', error);

    return {
      ok: false,
      mensaje: 'Error ejecutando regla MOVIMIENTO_FUERA_HORARIO',
      error: error.message
    };

  } finally {
    connection.release();
  }
};

const ejecutarTodasLasReglas = async (idUsuarioEjecutor = null) => {
  const resultados = [];

  resultados.push(await ejecutarVentaBajoCosto());
  resultados.push(await ejecutarStockNegativo());
  resultados.push(await ejecutarAjusteSinMotivo());
  resultados.push(await ejecutarCompraDuplicada());
  resultados.push(await ejecutarPrecioProveedorAnormal(idUsuarioEjecutor));
  resultados.push(await ejecutarAnulacionesFrecuentes());
  resultados.push(await ejecutarMovimientoFueraHorario());

  const totalHallazgosGenerados = resultados.reduce((total, resultado) => {
    return total + Number(resultado.hallazgos_generados || 0);
  }, 0);

  return {
    ok: true,
    mensaje: 'Motor de auditoría continua ejecutado correctamente',
    total_reglas_ejecutadas: resultados.length,
    total_hallazgos_generados: totalHallazgosGenerados,
    resultados
  };
};

module.exports = {
  ejecutarVentaBajoCosto,
  ejecutarStockNegativo,
  ejecutarAjusteSinMotivo,
  ejecutarCompraDuplicada,
  ejecutarPrecioProveedorAnormal,
  ejecutarAnulacionesFrecuentes,
  ejecutarMovimientoFueraHorario,
  ejecutarTodasLasReglas
};