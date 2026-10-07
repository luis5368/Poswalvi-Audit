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
// GET /api/ventas
// Listar ventas
// ============================================================
const obtenerVentas = async (req, res) => {
  try {
    const {
      estado,
      id_sucursal,
      id_caja,
      id_turno,
      fecha_inicio,
      fecha_fin,
      buscar
    } = req.query;

    let sql = `
      SELECT
        v.id_venta,
        v.numero_documento,
        v.tipo_documento,
        v.serie,
        v.correlativo,
        v.fecha_venta,
        v.id_cliente,
        c.nombre_cliente,
        c.nit,
        v.id_usuario,
        u.usuario,
        v.id_sucursal,
        s.nombre_sucursal,
        v.id_caja,
        cj.nombre_caja,
        v.id_turno,
        v.subtotal,
        v.descuento,
        v.impuesto,
        v.total,
        v.metodo_pago,
        v.estado,
        v.creado_en
      FROM ventas v
      INNER JOIN clientes c ON v.id_cliente = c.id_cliente
      INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      LEFT JOIN cajas cj ON v.id_caja = cj.id_caja
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND v.estado = ?`;
      params.push(estado);
    }

    if (id_sucursal) {
      sql += ` AND v.id_sucursal = ?`;
      params.push(id_sucursal);
    }

    if (id_caja) {
      sql += ` AND v.id_caja = ?`;
      params.push(id_caja);
    }

    if (id_turno) {
      sql += ` AND v.id_turno = ?`;
      params.push(id_turno);
    }

    if (fecha_inicio && fecha_fin) {
      sql += ` AND DATE(v.fecha_venta) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }

    if (buscar) {
      sql += `
        AND (
          v.numero_documento LIKE ?
          OR c.nombre_cliente LIKE ?
          OR c.nit LIKE ?
          OR u.usuario LIKE ?
        )
      `;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY v.id_venta DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      ventas: rows
    });
  } catch (error) {
    console.error('Error al obtener ventas:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener ventas'
    });
  }
};

// ============================================================
// GET /api/ventas/:id
// Obtener detalle completo de venta
// ============================================================
const obtenerVentaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [ventaRows] = await pool.query(
      `
      SELECT
        v.id_venta,
        v.numero_documento,
        v.tipo_documento,
        v.serie,
        v.correlativo,
        v.fecha_venta,
        v.id_cliente,
        c.nombre_cliente,
        c.nit,
        v.id_usuario,
        u.usuario,
        v.id_sucursal,
        s.nombre_sucursal,
        v.id_caja,
        cj.nombre_caja,
        v.id_turno,
        v.subtotal,
        v.descuento,
        v.impuesto,
        v.total,
        v.metodo_pago,
        v.estado,
        v.creado_en
      FROM ventas v
      INNER JOIN clientes c ON v.id_cliente = c.id_cliente
      INNER JOIN usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      LEFT JOIN cajas cj ON v.id_caja = cj.id_caja
      WHERE v.id_venta = ?
      LIMIT 1
      `,
      [id]
    );

    if (ventaRows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Venta no encontrada'
      });
    }

    const [detalleRows] = await pool.query(
      `
      SELECT
        vd.id_venta_detalle,
        vd.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        vd.cantidad,
        vd.precio_unitario,
        vd.costo_unitario,
        vd.descuento,
        vd.subtotal
      FROM venta_detalle vd
      INNER JOIN productos p ON vd.id_producto = p.id_producto
      WHERE vd.id_venta = ?
      ORDER BY vd.id_venta_detalle ASC
      `,
      [id]
    );

    const [pagosRows] = await pool.query(
      `
      SELECT
        vp.id_venta_pago,
        vp.id_metodo_pago,
        mp.nombre_metodo,
        vp.monto,
        vp.referencia,
        vp.creado_en
      FROM venta_pagos vp
      INNER JOIN metodos_pago mp ON vp.id_metodo_pago = mp.id_metodo_pago
      WHERE vp.id_venta = ?
      ORDER BY vp.id_venta_pago ASC
      `,
      [id]
    );

    return res.json({
      ok: true,
      venta: ventaRows[0],
      detalle: detalleRows,
      pagos: pagosRows
    });
  } catch (error) {
    console.error('Error al obtener venta por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener la venta'
    });
  }
};

// ============================================================
// POST /api/ventas
// Crear venta V1.3
// Requiere turno de caja abierto.
// Actualiza inventario_saldos e inserta movimientos.
// ============================================================
const crearVenta = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idUsuario = req.usuario.id_usuario;

    const {
      id_cliente,
      productos,
      pagos,
      descuento = 0,
      observaciones
    } = req.body;

    if (!id_cliente) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El cliente es obligatorio'
      });
    }

    if (!Array.isArray(productos) || productos.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'Debe agregar al menos un producto a la venta'
      });
    }

    if (!Array.isArray(pagos) || pagos.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'Debe registrar al menos un pago'
      });
    }

    const descuentoVenta = redondear2(descuento);

    if (Number.isNaN(descuentoVenta) || descuentoVenta < 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El descuento de la venta debe ser mayor o igual a 0'
      });
    }

    // Validar cliente
    const [clienteRows] = await connection.query(
      `
      SELECT id_cliente, estado
      FROM clientes
      WHERE id_cliente = ?
      LIMIT 1
      `,
      [id_cliente]
    );

    if (clienteRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'El cliente indicado no existe'
      });
    }

    if (clienteRows[0].estado !== 'Activo') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede vender a un cliente inactivo'
      });
    }

    // Validar turno abierto del usuario
    const [turnoRows] = await connection.query(
      `
      SELECT
        t.id_turno,
        t.id_caja,
        c.id_sucursal,
        c.estado AS estado_caja,
        s.estado AS estado_sucursal
      FROM turnos_caja t
      INNER JOIN cajas c ON t.id_caja = c.id_caja
      INNER JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE t.id_usuario = ?
        AND t.estado = 'Abierto'
      LIMIT 1
      `,
      [idUsuario]
    );

    if (turnoRows.length === 0) {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'No puede registrar ventas sin un turno de caja abierto'
      });
    }

    const turno = turnoRows[0];

    if (turno.estado_sucursal !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal del turno no está activa'
      });
    }

    if (turno.estado_caja !== 'Activa') {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La caja del turno no está activa'
      });
    }

    // Bodega principal de la sucursal
    const [bodegaRows] = await connection.query(
      `
      SELECT id_bodega
      FROM bodegas
      WHERE id_sucursal = ?
        AND estado = 'Activa'
      ORDER BY id_bodega ASC
      LIMIT 1
      `,
      [turno.id_sucursal]
    );

    if (bodegaRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal no tiene una bodega activa configurada'
      });
    }

    const idBodega = bodegaRows[0].id_bodega;

    // Correlativo interno de venta
    const [correlativoRows] = await connection.query(
      `
      SELECT
        id_correlativo,
        serie,
        prefijo,
        correlativo_actual
      FROM documento_correlativos
      WHERE id_sucursal = ?
        AND tipo_documento = 'Venta'
        AND estado = 'Activo'
      ORDER BY id_correlativo ASC
      LIMIT 1
      FOR UPDATE
      `,
      [turno.id_sucursal]
    );

    if (correlativoRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'No existe correlativo activo para ventas en esta sucursal'
      });
    }

    const correlativo = correlativoRows[0];
    const nuevoCorrelativo = Number(correlativo.correlativo_actual) + 1;
    const serie = correlativo.serie;
    const numeroDocumento = `${serie}-${String(nuevoCorrelativo).padStart(6, '0')}`;

    // Procesar productos
    let subtotalVenta = 0;
    const detalleProcesado = [];

    for (const item of productos) {
      const idProducto = item.id_producto;
      const cantidad = Number(item.cantidad);
      const descuentoLinea = redondear2(item.descuento || 0);

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
          mensaje: 'La cantidad de cada producto debe ser un número entero mayor a 0'
        });
      }

      if (descuentoLinea < 0) {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: 'El descuento por producto no puede ser negativo'
        });
      }

      const [productoRows] = await connection.query(
        `
        SELECT
          id_producto,
          codigo_producto,
          nombre_producto,
          precio_costo,
          precio_venta,
          controla_inventario,
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

      const precioUnitario = redondear2(
        item.precio_unitario !== undefined
          ? item.precio_unitario
          : producto.precio_venta
      );

      const costoUnitario = redondear2(producto.precio_costo);

      if (Number.isNaN(precioUnitario) || precioUnitario <= 0) {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: `El precio unitario del producto ${producto.nombre_producto} debe ser mayor a 0`
        });
      }

      const subtotalLineaBruto = redondear2(precioUnitario * cantidad);

      if (descuentoLinea > subtotalLineaBruto) {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: `El descuento del producto ${producto.nombre_producto} no puede ser mayor al subtotal`
        });
      }

      const subtotalLinea = redondear2(subtotalLineaBruto - descuentoLinea);

      let stockAnterior = null;
      let stockNuevo = null;

      if (Number(producto.controla_inventario) === 1) {
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
          [idProducto, turno.id_sucursal, idBodega]
        );

        if (saldoRows.length === 0) {
          await connection.rollback();

          return res.status(400).json({
            ok: false,
            mensaje: `El producto ${producto.nombre_producto} no tiene saldo de inventario configurado`
          });
        }

        stockAnterior = Number(saldoRows[0].stock_actual);

        if (stockAnterior < cantidad) {
          await connection.rollback();

          return res.status(409).json({
            ok: false,
            mensaje: `Stock insuficiente para ${producto.nombre_producto}. Stock actual: ${stockAnterior}`
          });
        }

        stockNuevo = stockAnterior - cantidad;
      }

      subtotalVenta = redondear2(subtotalVenta + subtotalLinea);

      detalleProcesado.push({
        id_producto: idProducto,
        nombre_producto: producto.nombre_producto,
        cantidad,
        precio_unitario: precioUnitario,
        costo_unitario: costoUnitario,
        descuento: descuentoLinea,
        subtotal: subtotalLinea,
        controla_inventario: Number(producto.controla_inventario),
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo
      });
    }

    if (descuentoVenta > subtotalVenta) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El descuento general no puede ser mayor al subtotal de la venta'
      });
    }

    const porcentajeIva = await obtenerPorcentajeIva(connection);
    const subtotalConDescuento = redondear2(subtotalVenta - descuentoVenta);
    const impuesto = redondear2(subtotalConDescuento * (porcentajeIva / 100));
    const totalVenta = redondear2(subtotalConDescuento + impuesto);

    // Validar pagos
    let totalPagos = 0;
    const pagosProcesados = [];

    for (const pago of pagos) {
      const idMetodoPago = pago.id_metodo_pago;
      const monto = redondear2(pago.monto);

      if (!idMetodoPago) {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: 'Cada pago debe incluir id_metodo_pago'
        });
      }

      if (Number.isNaN(monto) || monto <= 0) {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: 'El monto de cada pago debe ser mayor a 0'
        });
      }

      const [metodoRows] = await connection.query(
        `
        SELECT id_metodo_pago, nombre_metodo, requiere_referencia, estado
        FROM metodos_pago
        WHERE id_metodo_pago = ?
        LIMIT 1
        `,
        [idMetodoPago]
      );

      if (metodoRows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          ok: false,
          mensaje: `El método de pago con ID ${idMetodoPago} no existe`
        });
      }

      const metodo = metodoRows[0];

      if (metodo.estado !== 'Activo') {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: `El método de pago ${metodo.nombre_metodo} está inactivo`
        });
      }

      if (Number(metodo.requiere_referencia) === 1 && !pago.referencia) {
        await connection.rollback();

        return res.status(400).json({
          ok: false,
          mensaje: `El método de pago ${metodo.nombre_metodo} requiere referencia`
        });
      }

      totalPagos = redondear2(totalPagos + monto);

      pagosProcesados.push({
        id_metodo_pago: idMetodoPago,
        nombre_metodo: metodo.nombre_metodo,
        monto,
        referencia: pago.referencia || null
      });
    }

    if (Math.abs(totalPagos - totalVenta) > 0.01) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'El total de pagos no coincide con el total de la venta',
        total_venta: totalVenta,
        total_pagos: totalPagos
      });
    }

    const metodoPagoLegacy =
      pagosProcesados.length > 1 ? 'Mixto' : pagosProcesados[0].nombre_metodo;

    // Insertar venta
    const [ventaResult] = await connection.query(
      `
      INSERT INTO ventas (
        id_cliente,
        id_usuario,
        id_sucursal,
        id_caja,
        id_turno,
        fecha_venta,
        tipo_documento,
        serie,
        correlativo,
        numero_documento,
        subtotal,
        descuento,
        impuesto,
        total,
        metodo_pago,
        estado,
        observaciones,
        creado_en
      )
      VALUES (?, ?, ?, ?, ?, NOW(), 'Venta', ?, ?, ?, ?, ?, ?, ?, ?, 'Registrada', ?, NOW())
      `,
      [
        id_cliente,
        idUsuario,
        turno.id_sucursal,
        turno.id_caja,
        turno.id_turno,
        serie,
        nuevoCorrelativo,
        numeroDocumento,
        subtotalVenta,
        descuentoVenta,
        impuesto,
        totalVenta,
        metodoPagoLegacy,
        observaciones || null
      ]
    );

    const idVenta = ventaResult.insertId;

    // Insertar detalle, actualizar inventario y crear movimientos
    for (const item of detalleProcesado) {
      await connection.query(
        `
        INSERT INTO venta_detalle (
          id_venta,
          id_producto,
          cantidad,
          precio_unitario,
          costo_unitario,
          descuento,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          idVenta,
          item.id_producto,
          item.cantidad,
          item.precio_unitario,
          item.costo_unitario,
          item.descuento,
          item.subtotal
        ]
      );

      if (item.controla_inventario === 1) {
        await connection.query(
          `
          UPDATE inventario_saldos
          SET stock_actual = ?
          WHERE id_producto = ?
            AND id_sucursal = ?
            AND id_bodega = ?
          `,
          [
            item.stock_nuevo,
            item.id_producto,
            turno.id_sucursal,
            idBodega
          ]
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
          VALUES (?, ?, ?, ?, ?, 'Salida', 'Venta', ?, ?, ?, ?, ?, NOW())
          `,
          [
            item.id_producto,
            idUsuario,
            turno.id_sucursal,
            idBodega,
            turno.id_turno,
            idVenta,
            item.cantidad,
            item.stock_anterior,
            item.stock_nuevo,
            `Venta ${numeroDocumento}`
          ]
        );
      }
    }

    // Insertar pagos
    for (const pago of pagosProcesados) {
      await connection.query(
        `
        INSERT INTO venta_pagos (
          id_venta,
          id_metodo_pago,
          monto,
          referencia
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          idVenta,
          pago.id_metodo_pago,
          pago.monto,
          pago.referencia
        ]
      );
    }

    // Actualizar correlativo
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
      mensaje: 'Venta registrada correctamente',
      venta: {
        id_venta: idVenta,
        numero_documento: numeroDocumento,
        id_turno: turno.id_turno,
        id_caja: turno.id_caja,
        id_sucursal: turno.id_sucursal,
        subtotal: subtotalVenta,
        descuento: descuentoVenta,
        impuesto,
        total: totalVenta,
        total_pagos: totalPagos,
        metodo_pago: metodoPagoLegacy
      }
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al crear venta:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear la venta'
    });
  } finally {
    connection.release();
  }
};

// ============================================================
// PATCH /api/ventas/:id/anular
// Anular venta V1.3
// Devuelve inventario y registra movimiento de anulación.
// ============================================================
const anularVenta = async (req, res) => {
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

    const [ventaRows] = await connection.query(
      `
      SELECT
        v.id_venta,
        v.numero_documento,
        v.id_sucursal,
        v.id_caja,
        v.id_turno,
        v.estado,
        v.total,
        t.estado AS estado_turno
      FROM ventas v
      LEFT JOIN turnos_caja t ON v.id_turno = t.id_turno
      WHERE v.id_venta = ?
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (ventaRows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        ok: false,
        mensaje: 'Venta no encontrada'
      });
    }

    const venta = ventaRows[0];

    if (venta.estado !== 'Registrada') {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'Solo se pueden anular ventas en estado Registrada'
      });
    }

    if (venta.estado_turno !== 'Abierto') {
      await connection.rollback();

      return res.status(409).json({
        ok: false,
        mensaje: 'No se puede anular una venta de un turno cerrado. Requiere proceso de nota de crédito o ajuste administrativo.'
      });
    }

    const [detalleRows] = await connection.query(
      `
      SELECT
        vd.id_venta_detalle,
        vd.id_producto,
        vd.cantidad,
        p.nombre_producto,
        p.controla_inventario
      FROM venta_detalle vd
      INNER JOIN productos p ON vd.id_producto = p.id_producto
      WHERE vd.id_venta = ?
      `,
      [id]
    );

    if (detalleRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La venta no tiene detalle registrado'
      });
    }

    const [bodegaRows] = await connection.query(
      `
      SELECT id_bodega
      FROM bodegas
      WHERE id_sucursal = ?
        AND estado = 'Activa'
      ORDER BY id_bodega ASC
      LIMIT 1
      `,
      [venta.id_sucursal]
    );

    if (bodegaRows.length === 0) {
      await connection.rollback();

      return res.status(400).json({
        ok: false,
        mensaje: 'La sucursal de la venta no tiene una bodega activa configurada'
      });
    }

    const idBodega = bodegaRows[0].id_bodega;

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
          [item.id_producto, venta.id_sucursal, idBodega]
        );

        if (saldoRows.length === 0) {
          await connection.rollback();

          return res.status(400).json({
            ok: false,
            mensaje: `El producto ${item.nombre_producto} no tiene saldo de inventario configurado`
          });
        }

        const stockAnterior = Number(saldoRows[0].stock_actual);
        const stockNuevo = stockAnterior + Number(item.cantidad);

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
          VALUES (?, ?, ?, ?, ?, 'Anulacion', 'AnulacionVenta', ?, ?, ?, ?, ?, NOW())
          `,
          [
            item.id_producto,
            idUsuario,
            venta.id_sucursal,
            idBodega,
            venta.id_turno,
            venta.id_venta,
            item.cantidad,
            stockAnterior,
            stockNuevo,
            `Anulación venta ${venta.numero_documento}: ${motivo_anulacion.trim()}`
          ]
        );
      }
    }

    await connection.query(
      `
      UPDATE ventas
      SET
        estado = 'Anulada',
        motivo_anulacion = ?,
        fecha_anulacion = NOW(),
        anulado_por = ?
      WHERE id_venta = ?
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
      mensaje: 'Venta anulada correctamente',
      venta: {
        id_venta: Number(id),
        numero_documento: venta.numero_documento,
        estado: 'Anulada',
        motivo_anulacion: motivo_anulacion.trim()
      }
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al anular venta:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al anular la venta'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  obtenerVentas,
  obtenerVentaPorId,
  crearVenta,
  anularVenta
};