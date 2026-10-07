const pool = require('../config/db');

const redondear2 = (valor) => {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
};

const obtenerPorcentajeIva = async (connection) => {
  const [rows] = await connection.query(`
    SELECT porcentaje_iva
    FROM empresa_configuracion
    WHERE estado = 'Activa'
    ORDER BY id_empresa ASC
    LIMIT 1
  `);

  return Number(rows[0]?.porcentaje_iva || 12);
};

// ============================================================
// GET /api/compras
// Listar compras
// ============================================================
const obtenerCompras = async (req, res) => {
  try {
    const {
      estado,
      id_proveedor,
      id_sucursal,
      id_bodega,
      fecha_inicio,
      fecha_fin,
      buscar
    } = req.query;

    let sql = `
      SELECT
        c.id_compra,
        c.numero_factura,
        c.numero_documento_interno,
        c.tipo_documento,
        c.serie,
        c.correlativo,
        c.id_proveedor,
        p.nit,
        p.nombre_proveedor,
        c.id_usuario,
        u.usuario,
        c.id_sucursal,
        s.nombre_sucursal,
        c.id_bodega,
        b.nombre_bodega,
        c.fecha_compra,
        c.subtotal,
        c.descuento,
        c.impuesto,
        c.total,
        c.estado,
        c.observaciones,
        c.creado_en
      FROM compras c
      INNER JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      LEFT JOIN bodegas b ON c.id_bodega = b.id_bodega
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND c.estado = ?`;
      params.push(estado);
    }

    if (id_proveedor) {
      sql += ` AND c.id_proveedor = ?`;
      params.push(id_proveedor);
    }

    if (id_sucursal) {
      sql += ` AND c.id_sucursal = ?`;
      params.push(id_sucursal);
    }

    if (id_bodega) {
      sql += ` AND c.id_bodega = ?`;
      params.push(id_bodega);
    }

    if (fecha_inicio && fecha_fin) {
      sql += ` AND DATE(c.fecha_compra) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (buscar) {
      sql += `
        AND (
          c.numero_factura LIKE ?
          OR c.numero_documento_interno LIKE ?
          OR p.nit LIKE ?
          OR p.nombre_proveedor LIKE ?
          OR u.usuario LIKE ?
        )
      `;
      params.push(
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`
      );
    }

    sql += ` ORDER BY c.id_compra DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      compras: rows
    });
  } catch (error) {
    console.error('Error al obtener compras:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener compras'
    });
  }
};

// ============================================================
// GET /api/compras/:id
// Obtener compra por ID con detalle
// ============================================================
const obtenerCompraPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [compraRows] = await pool.query(
      `
      SELECT
        c.id_compra,
        c.numero_factura,
        c.numero_documento_interno,
        c.tipo_documento,
        c.serie,
        c.correlativo,
        c.id_proveedor,
        p.nit,
        p.nombre_proveedor,
        c.id_usuario,
        u.usuario,
        c.id_sucursal,
        s.nombre_sucursal,
        c.id_bodega,
        b.nombre_bodega,
        c.fecha_compra,
        c.subtotal,
        c.descuento,
        c.impuesto,
        c.total,
        c.estado,
        c.observaciones,
        c.creado_en
      FROM compras c
      INNER JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      INNER JOIN usuarios u ON c.id_usuario = u.id_usuario
      LEFT JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      LEFT JOIN bodegas b ON c.id_bodega = b.id_bodega
      WHERE c.id_compra = ?
      LIMIT 1
      `,
      [id]
    );

    if (compraRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Compra no encontrada'
      });
    }

    const [detalleRows] = await pool.query(
      `
      SELECT
        cd.id_compra_detalle,
        cd.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        cd.cantidad,
        cd.precio_unitario,
        cd.subtotal
      FROM compra_detalle cd
      INNER JOIN productos p ON cd.id_producto = p.id_producto
      WHERE cd.id_compra = ?
      ORDER BY cd.id_compra_detalle ASC
      `,
      [id]
    );

    return res.json({
      ok: true,
      compra: compraRows[0],
      detalle: detalleRows
    });
  } catch (error) {
    console.error('Error al obtener compra por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener compra'
    });
  }
};

// ============================================================
// POST /api/compras
// Crear compra V1.3
// Registra detalle, entrada de inventario y actualiza precio proveedor.
// ============================================================
const crearCompra = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idUsuario = req.usuario.id_usuario;

    const {
      id_proveedor,
      numero_factura,
      id_sucursal,
      id_bodega,
      productos,
      descuento = 0,
      observaciones
    } = req.body;

    if (!id_proveedor) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El proveedor es obligatorio'
      });
    }

    if (!numero_factura || numero_factura.trim() === '') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El número de factura es obligatorio'
      });
    }

    if (!Array.isArray(productos) || productos.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'Debe agregar al menos un producto a la compra'
      });
    }

    const descuentoCompra = redondear2(descuento);

    if (Number.isNaN(descuentoCompra) || descuentoCompra < 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El descuento de la compra debe ser mayor o igual a 0'
      });
    }

    const [proveedorRows] = await connection.query(
      `
      SELECT id_proveedor, estado
      FROM proveedores
      WHERE id_proveedor = ?
      LIMIT 1
      `,
      [id_proveedor]
    );

    if (proveedorRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        mensaje: 'El proveedor indicado no existe'
      });
    }

    if (proveedorRows[0].estado !== 'Activo') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede registrar compra a un proveedor inactivo'
      });
    }

    let idSucursalFinal = id_sucursal;

    if (!idSucursalFinal) {
      const [usuarioRows] = await connection.query(
        `
        SELECT id_sucursal
        FROM usuarios
        WHERE id_usuario = ?
        LIMIT 1
        `,
        [idUsuario]
      );

      idSucursalFinal = usuarioRows[0]?.id_sucursal || null;
    }

    if (!idSucursalFinal) {
      const [sucursalDefault] = await connection.query(
        `
        SELECT id_sucursal
        FROM sucursales
        WHERE estado = 'Activa'
        ORDER BY id_sucursal ASC
        LIMIT 1
        `
      );

      idSucursalFinal = sucursalDefault[0]?.id_sucursal || null;
    }

    if (!idSucursalFinal) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'No existe una sucursal activa para registrar la compra'
      });
    }

    const [sucursalRows] = await connection.query(
      `
      SELECT id_sucursal, estado
      FROM sucursales
      WHERE id_sucursal = ?
      LIMIT 1
      `,
      [idSucursalFinal]
    );

    if (sucursalRows.length === 0 || sucursalRows[0].estado !== 'Activa') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal indicada no existe o está inactiva'
      });
    }

    let idBodegaFinal = id_bodega;

    if (!idBodegaFinal) {
      const [bodegaRows] = await connection.query(
        `
        SELECT id_bodega
        FROM bodegas
        WHERE id_sucursal = ?
          AND estado = 'Activa'
        ORDER BY id_bodega ASC
        LIMIT 1
        `,
        [idSucursalFinal]
      );

      idBodegaFinal = bodegaRows[0]?.id_bodega || null;
    }

    if (!idBodegaFinal) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal no tiene una bodega activa configurada'
      });
    }

    const [bodegaValida] = await connection.query(
      `
      SELECT id_bodega
      FROM bodegas
      WHERE id_bodega = ?
        AND id_sucursal = ?
        AND estado = 'Activa'
      LIMIT 1
      `,
      [idBodegaFinal, idSucursalFinal]
    );

    if (bodegaValida.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'La bodega indicada no existe, está inactiva o no pertenece a la sucursal'
      });
    }

    // Evitar duplicado operativo de factura por proveedor
    const [compraDuplicada] = await connection.query(
      `
      SELECT id_compra
      FROM compras
      WHERE id_proveedor = ?
        AND numero_factura = ?
        AND estado = 'Registrada'
      LIMIT 1
      `,
      [id_proveedor, numero_factura.trim()]
    );

    if (compraDuplicada.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'Ya existe una compra registrada con este proveedor y número de factura'
      });
    }

    const [correlativoRows] = await connection.query(
      `
      SELECT
        id_correlativo,
        serie,
        prefijo,
        correlativo_actual
      FROM documento_correlativos
      WHERE id_sucursal = ?
        AND tipo_documento = 'Compra'
        AND estado = 'Activo'
      ORDER BY id_correlativo ASC
      LIMIT 1
      FOR UPDATE
      `,
      [idSucursalFinal]
    );

    if (correlativoRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'No existe correlativo activo para compras en esta sucursal'
      });
    }

    const correlativo = correlativoRows[0];
    const nuevoCorrelativo = Number(correlativo.correlativo_actual) + 1;
    const serie = correlativo.serie;
    const numeroDocumentoInterno = `${serie}-${String(nuevoCorrelativo).padStart(6, '0')}`;

    let subtotalCompra = 0;
    const detalleProcesado = [];

    for (const item of productos) {
      const idProducto = item.id_producto;
      const cantidad = Number(item.cantidad);
      const precioUnitario = redondear2(item.precio_unitario);

      if (!idProducto) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: 'Cada producto debe incluir id_producto'
        });
      }

      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: 'La cantidad de cada producto debe ser un entero mayor a 0'
        });
      }

      if (Number.isNaN(precioUnitario) || precioUnitario <= 0) {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: 'El precio unitario de cada producto debe ser mayor a 0'
        });
      }

      const [productoRows] = await connection.query(
        `
        SELECT
          id_producto,
          codigo_producto,
          nombre_producto,
          controla_inventario,
          stock_minimo,
          stock_maximo,
          estado
        FROM productos
        WHERE id_producto = ?
        LIMIT 1
        `,
        [idProducto]
      );

      if (productoRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          ok: false,
          mensaje: `El producto con ID ${idProducto} no existe`
        });
      }

      const producto = productoRows[0];

      if (producto.estado !== 'Activo') {
        await connection.rollback();
        return res.status(400).json({
          ok: false,
          mensaje: `El producto ${producto.nombre_producto} está inactivo`
        });
      }

      const subtotalLinea = redondear2(cantidad * precioUnitario);
      subtotalCompra = redondear2(subtotalCompra + subtotalLinea);

      detalleProcesado.push({
        id_producto: idProducto,
        nombre_producto: producto.nombre_producto,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: subtotalLinea,
        controla_inventario: Number(producto.controla_inventario),
        stock_minimo: Number(producto.stock_minimo || 0),
        stock_maximo: producto.stock_maximo !== null ? Number(producto.stock_maximo) : null
      });
    }

    if (descuentoCompra > subtotalCompra) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El descuento no puede ser mayor al subtotal de la compra'
      });
    }

    const porcentajeIva = await obtenerPorcentajeIva(connection);
    const subtotalConDescuento = redondear2(subtotalCompra - descuentoCompra);
    const impuesto = redondear2(subtotalConDescuento * (porcentajeIva / 100));
    const totalCompra = redondear2(subtotalConDescuento + impuesto);

    const [compraResult] = await connection.query(
      `
      INSERT INTO compras (
        id_proveedor,
        id_usuario,
        id_sucursal,
        id_bodega,
        numero_factura,
        fecha_compra,
        tipo_documento,
        serie,
        correlativo,
        numero_documento_interno,
        subtotal,
        descuento,
        impuesto,
        total,
        estado,
        observaciones,
        creado_en
      )
      VALUES (?, ?, ?, ?, ?, NOW(), 'Compra', ?, ?, ?, ?, ?, ?, ?, 'Registrada', ?, NOW())
      `,
      [
        id_proveedor,
        idUsuario,
        idSucursalFinal,
        idBodegaFinal,
        numero_factura.trim(),
        serie,
        nuevoCorrelativo,
        numeroDocumentoInterno,
        subtotalCompra,
        descuentoCompra,
        impuesto,
        totalCompra,
        observaciones || null
      ]
    );

    const idCompra = compraResult.insertId;

    for (const item of detalleProcesado) {
      await connection.query(
        `
        INSERT INTO compra_detalle (
          id_compra,
          id_producto,
          cantidad,
          precio_unitario,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          idCompra,
          item.id_producto,
          item.cantidad,
          item.precio_unitario,
          item.subtotal
        ]
      );

      if (item.controla_inventario === 1) {
        const [saldoRows] = await connection.query(
          `
          SELECT
            id_saldo,
            stock_actual
          FROM inventario_saldos
          WHERE id_producto = ?
            AND id_sucursal = ?
            AND id_bodega = ?
          LIMIT 1
          FOR UPDATE
          `,
          [item.id_producto, idSucursalFinal, idBodegaFinal]
        );

        let stockAnterior = 0;
        let stockNuevo = 0;

        if (saldoRows.length === 0) {
          stockAnterior = 0;
          stockNuevo = item.cantidad;

          await connection.query(
            `
            INSERT INTO inventario_saldos (
              id_producto,
              id_sucursal,
              id_bodega,
              stock_actual,
              stock_minimo,
              stock_maximo
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              item.id_producto,
              idSucursalFinal,
              idBodegaFinal,
              stockNuevo,
              item.stock_minimo,
              item.stock_maximo
            ]
          );
        } else {
          stockAnterior = Number(saldoRows[0].stock_actual);
          stockNuevo = stockAnterior + item.cantidad;

          await connection.query(
            `
            UPDATE inventario_saldos
            SET stock_actual = ?
            WHERE id_saldo = ?
            `,
            [stockNuevo, saldoRows[0].id_saldo]
          );
        }

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
          VALUES (?, ?, ?, ?, NULL, 'Entrada', 'Compra', ?, ?, ?, ?, ?, NOW())
          `,
          [
            item.id_producto,
            idUsuario,
            idSucursalFinal,
            idBodegaFinal,
            idCompra,
            item.cantidad,
            stockAnterior,
            stockNuevo,
            `Compra ${numeroDocumentoInterno} / Factura ${numero_factura.trim()}`
          ]
        );
      }

      // Actualizar o crear relación producto-proveedor
      const [relacionRows] = await connection.query(
        `
        SELECT id_producto_proveedor
        FROM producto_proveedor
        WHERE id_producto = ?
          AND id_proveedor = ?
        LIMIT 1
        `,
        [item.id_producto, id_proveedor]
      );

      if (relacionRows.length > 0) {
        await connection.query(
          `
          UPDATE producto_proveedor
          SET precio_compra = ?,
              estado = 'Activo',
              actualizado_en = NOW()
          WHERE id_producto_proveedor = ?
          `,
          [item.precio_unitario, relacionRows[0].id_producto_proveedor]
        );
      } else {
        const [principalRows] = await connection.query(
          `
          SELECT id_producto_proveedor
          FROM producto_proveedor
          WHERE id_producto = ?
            AND proveedor_principal = 1
            AND estado = 'Activo'
          LIMIT 1
          `,
          [item.id_producto]
        );

        const esPrincipal = principalRows.length === 0 ? 1 : 0;

        await connection.query(
          `
          INSERT INTO producto_proveedor (
            id_producto,
            id_proveedor,
            codigo_proveedor,
            precio_compra,
            proveedor_principal,
            estado,
            creado_en,
            actualizado_en
          )
          VALUES (?, ?, NULL, ?, ?, 'Activo', NOW(), NOW())
          `,
          [
            item.id_producto,
            id_proveedor,
            item.precio_unitario,
            esPrincipal
          ]
        );
      }
    }

    await connection.query(
      `
      UPDATE documento_correlativos
      SET correlativo_actual = ?
      WHERE id_correlativo = ?
      `,
      [nuevoCorrelativo, correlativo.id_correlativo]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Compra registrada correctamente',
      compra: {
        id_compra: idCompra,
        numero_factura: numero_factura.trim(),
        numero_documento_interno: numeroDocumentoInterno,
        id_sucursal: idSucursalFinal,
        id_bodega: idBodegaFinal,
        subtotal: subtotalCompra,
        descuento: descuentoCompra,
        impuesto,
        total: totalCompra
      }
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al crear compra:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear compra'
    });
  } finally {
    connection.release();
  }
};

// ============================================================
// PATCH /api/compras/:id/anular
// Anular compra V1.3
// Revierte inventario y registra movimiento de anulación.
// ============================================================
const anularCompra = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { motivo_anulacion } = req.body;
    const idUsuario = req.usuario.id_usuario;

    if (!motivo_anulacion || motivo_anulacion.trim() === '') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El motivo de anulación es obligatorio'
      });
    }

    const [compraRows] = await connection.query(
      `
      SELECT
        id_compra,
        numero_factura,
        numero_documento_interno,
        id_proveedor,
        id_sucursal,
        id_bodega,
        estado,
        total
      FROM compras
      WHERE id_compra = ?
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (compraRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Compra no encontrada'
      });
    }

    const compra = compraRows[0];

    if (compra.estado !== 'Registrada') {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'Solo se pueden anular compras en estado Registrada'
      });
    }

    const [detalleRows] = await connection.query(
      `
      SELECT
        cd.id_compra_detalle,
        cd.id_producto,
        cd.cantidad,
        cd.precio_unitario,
        p.nombre_producto,
        p.controla_inventario
      FROM compra_detalle cd
      INNER JOIN productos p ON cd.id_producto = p.id_producto
      WHERE cd.id_compra = ?
      `,
      [id]
    );

    if (detalleRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La compra no tiene detalle registrado'
      });
    }

    for (const item of detalleRows) {
      if (Number(item.controla_inventario) === 1) {
        const [saldoRows] = await connection.query(
          `
          SELECT
            id_saldo,
            stock_actual
          FROM inventario_saldos
          WHERE id_producto = ?
            AND id_sucursal = ?
            AND id_bodega = ?
          LIMIT 1
          FOR UPDATE
          `,
          [
            item.id_producto,
            compra.id_sucursal,
            compra.id_bodega
          ]
        );

        if (saldoRows.length === 0) {
          await connection.rollback();

          return res.status(400).json({
            ok: false,
            mensaje: `El producto ${item.nombre_producto} no tiene saldo de inventario configurado`
          });
        }

        const stockAnterior = Number(saldoRows[0].stock_actual);
        const cantidad = Number(item.cantidad);
        const stockNuevo = stockAnterior - cantidad;

        if (stockNuevo < 0) {
          await connection.rollback();

          return res.status(409).json({
            ok: false,
            mensaje: `No se puede anular la compra porque el producto ${item.nombre_producto} quedaría con stock negativo. Stock actual: ${stockAnterior}, cantidad a revertir: ${cantidad}`
          });
        }

        await connection.query(
          `
          UPDATE inventario_saldos
          SET stock_actual = ?
          WHERE id_saldo = ?
          `,
          [stockNuevo, saldoRows[0].id_saldo]
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
          VALUES (?, ?, ?, ?, NULL, 'Anulacion', 'AnulacionCompra', ?, ?, ?, ?, ?, NOW())
          `,
          [
            item.id_producto,
            idUsuario,
            compra.id_sucursal,
            compra.id_bodega,
            compra.id_compra,
            cantidad,
            stockAnterior,
            stockNuevo,
            `Anulación compra ${compra.numero_documento_interno} / Factura ${compra.numero_factura}: ${motivo_anulacion.trim()}`
          ]
        );
      }
    }

    await connection.query(
      `
      UPDATE compras
      SET
        estado = 'Anulada',
        motivo_anulacion = ?,
        fecha_anulacion = NOW(),
        anulado_por = ?
      WHERE id_compra = ?
      `,
      [
        motivo_anulacion.trim(),
        idUsuario,
        id
      ]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Compra anulada correctamente',
      compra: {
        id_compra: Number(id),
        numero_factura: compra.numero_factura,
        numero_documento_interno: compra.numero_documento_interno,
        estado: 'Anulada',
        motivo_anulacion: motivo_anulacion.trim()
      }
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al anular compra:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al anular compra'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  obtenerCompras,
  obtenerCompraPorId,
  crearCompra,
  anularCompra
};