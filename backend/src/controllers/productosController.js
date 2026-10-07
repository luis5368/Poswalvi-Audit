const pool = require('../config/db');

const redondear2 = (valor) => {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
};

const validarEstadoProducto = (estado) => {
  return ['Activo', 'Inactivo'].includes(estado);
};

const validarMargenesPrecio = ({
  precio_costo,
  precio_venta,
  margen_minimo,
  margen_maximo
}) => {
  const costo = Number(precio_costo);
  const venta = Number(precio_venta);
  const margenMin = Number(margen_minimo);
  const margenMax = Number(margen_maximo);

  if (Number.isNaN(costo) || costo < 0) {
    return 'El precio costo debe ser mayor o igual a 0';
  }

  if (Number.isNaN(venta) || venta <= 0) {
    return 'El precio venta debe ser mayor a 0';
  }

  if (costo > 500) {
    return 'El precio costo no puede ser mayor a Q 500.00';
  }

  if (venta < costo) {
    return 'El precio venta no puede ser menor al precio costo';
  }

  if (Number.isNaN(margenMin) || margenMin < 0) {
    return 'El margen mínimo debe ser mayor o igual a 0';
  }

  if (Number.isNaN(margenMax) || margenMax < margenMin) {
    return 'El margen máximo debe ser mayor o igual al margen mínimo';
  }

  if (costo > 0) {
    const margenReal = ((venta - costo) / costo) * 100;

    if (margenReal < margenMin || margenReal > margenMax) {
      return `El margen de ganancia debe estar entre ${margenMin}% y ${margenMax}%`;
    }
  }

  return null;
};

// ============================================================
// GET /api/productos
// Listar productos
// ============================================================
const obtenerProductos = async (req, res) => {
  try {
    const {
      estado,
      id_categoria,
      id_subcategoria,
      id_marca,
      id_unidad_medida,
      buscar
    } = req.query;

    let sql = `
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.codigo_barras,
        p.nombre_producto,
        p.descripcion,
        p.id_categoria,
        c.nombre_categoria,
        p.id_subcategoria,
        sc.nombre_subcategoria,
        p.id_marca,
        m.nombre_marca,
        p.id_unidad_medida,
        um.nombre_unidad,
        um.abreviatura,
        p.precio_costo,
        p.precio_venta,
        p.margen_minimo,
        p.margen_maximo,
        p.stock_minimo,
        p.stock_maximo,
        p.controla_inventario,
        p.estado,
        p.creado_por,
        u.usuario AS creado_por_usuario,
        p.creado_en,
        p.actualizado_en
      FROM productos p
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN subcategorias sc ON p.id_subcategoria = sc.id_subcategoria
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      LEFT JOIN unidades_medida um ON p.id_unidad_medida = um.id_unidad_medida
      LEFT JOIN usuarios u ON p.creado_por = u.id_usuario
      WHERE 1 = 1
    `;

    const params = [];

    if (estado) {
      sql += ` AND p.estado = ?`;
      params.push(estado);
    }

    if (id_categoria) {
      sql += ` AND p.id_categoria = ?`;
      params.push(id_categoria);
    }

    if (id_subcategoria) {
      sql += ` AND p.id_subcategoria = ?`;
      params.push(id_subcategoria);
    }

    if (id_marca) {
      sql += ` AND p.id_marca = ?`;
      params.push(id_marca);
    }

    if (id_unidad_medida) {
      sql += ` AND p.id_unidad_medida = ?`;
      params.push(id_unidad_medida);
    }

    if (buscar) {
      sql += `
        AND (
          p.codigo_producto LIKE ?
          OR p.codigo_barras LIKE ?
          OR p.nombre_producto LIKE ?
          OR p.descripcion LIKE ?
        )
      `;
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY p.id_producto DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      productos: rows
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener productos'
    });
  }
};

// ============================================================
// GET /api/productos/:id
// Obtener producto por ID
// ============================================================
const obtenerProductoPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        p.id_producto,
        p.codigo_producto,
        p.codigo_barras,
        p.nombre_producto,
        p.descripcion,
        p.id_categoria,
        c.nombre_categoria,
        p.id_subcategoria,
        sc.nombre_subcategoria,
        p.id_marca,
        m.nombre_marca,
        p.id_unidad_medida,
        um.nombre_unidad,
        um.abreviatura,
        p.precio_costo,
        p.precio_venta,
        p.margen_minimo,
        p.margen_maximo,
        p.stock_minimo,
        p.stock_maximo,
        p.controla_inventario,
        p.estado,
        p.creado_por,
        u.usuario AS creado_por_usuario,
        p.creado_en,
        p.actualizado_en
      FROM productos p
      INNER JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN subcategorias sc ON p.id_subcategoria = sc.id_subcategoria
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      LEFT JOIN unidades_medida um ON p.id_unidad_medida = um.id_unidad_medida
      LEFT JOIN usuarios u ON p.creado_por = u.id_usuario
      WHERE p.id_producto = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Producto no encontrado'
      });
    }

    const [saldos] = await pool.query(
      `
      SELECT
        s.id_saldo,
        s.id_sucursal,
        suc.nombre_sucursal,
        s.id_bodega,
        b.nombre_bodega,
        s.stock_actual,
        s.stock_minimo,
        s.stock_maximo,
        s.actualizado_en
      FROM inventario_saldos s
      INNER JOIN sucursales suc ON s.id_sucursal = suc.id_sucursal
      LEFT JOIN bodegas b ON s.id_bodega = b.id_bodega
      WHERE s.id_producto = ?
      ORDER BY suc.nombre_sucursal, b.nombre_bodega
      `,
      [id]
    );

    return res.json({
      ok: true,
      producto: rows[0],
      saldos
    });
  } catch (error) {
    console.error('Error al obtener producto por ID:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener el producto'
    });
  }
};

// ============================================================
// POST /api/productos
// Crear producto V1.3
// ============================================================
const crearProducto = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const idUsuario = req.usuario.id_usuario;

    const {
      id_categoria,
      id_subcategoria,
      id_marca,
      id_unidad_medida,
      codigo_producto,
      codigo_barras,
      nombre_producto,
      descripcion,
      precio_costo,
      precio_venta,
      margen_minimo = 10.00,
      margen_maximo = 60.00,
      stock_minimo = 0,
      stock_maximo = 100,
      controla_inventario = true,
      estado = 'Activo',
      id_sucursal,
      id_bodega,
      stock_inicial = 0
    } = req.body;

    if (!id_categoria) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'La categoría es obligatoria' });
    }

    if (!id_marca) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'La marca es obligatoria' });
    }

    if (!id_unidad_medida) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'La unidad de medida es obligatoria' });
    }

    if (!codigo_producto || codigo_producto.trim() === '') {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'El código del producto es obligatorio' });
    }

    if (!nombre_producto || nombre_producto.trim() === '') {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'El nombre del producto es obligatorio' });
    }

    if (!validarEstadoProducto(estado)) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'El estado debe ser Activo o Inactivo' });
    }

    const stockMin = Number(stock_minimo);
    const stockMax = Number(stock_maximo);
    const stockInicial = Number(stock_inicial);

    if (!Number.isInteger(stockMin) || stockMin < 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'El stock mínimo debe ser un entero mayor o igual a 0' });
    }

    if (!Number.isInteger(stockMax) || stockMax < stockMin) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'El stock máximo debe ser mayor o igual al stock mínimo' });
    }

    if (!Number.isInteger(stockInicial) || stockInicial < 0) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: 'El stock inicial debe ser un entero mayor o igual a 0' });
    }

    const errorMargen = validarMargenesPrecio({
      precio_costo,
      precio_venta,
      margen_minimo,
      margen_maximo
    });

    if (errorMargen) {
      await connection.rollback();
      return res.status(400).json({ ok: false, mensaje: errorMargen });
    }

    const [categoria] = await connection.query(
      `SELECT id_categoria FROM categorias WHERE id_categoria = ? AND estado = 'Activo' LIMIT 1`,
      [id_categoria]
    );

    if (categoria.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, mensaje: 'La categoría indicada no existe o está inactiva' });
    }

    if (id_subcategoria) {
      const [subcategoria] = await connection.query(
        `
        SELECT id_subcategoria
        FROM subcategorias
        WHERE id_subcategoria = ?
          AND id_categoria = ?
          AND estado = 'Activo'
        LIMIT 1
        `,
        [id_subcategoria, id_categoria]
      );

      if (subcategoria.length === 0) {
        await connection.rollback();
        return res.status(404).json({ ok: false, mensaje: 'La subcategoría indicada no existe, está inactiva o no pertenece a la categoría' });
      }
    }

    const [marca] = await connection.query(
      `SELECT id_marca FROM marcas WHERE id_marca = ? AND estado = 'Activa' LIMIT 1`,
      [id_marca]
    );

    if (marca.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, mensaje: 'La marca indicada no existe o está inactiva' });
    }

    const [unidad] = await connection.query(
      `SELECT id_unidad_medida FROM unidades_medida WHERE id_unidad_medida = ? AND estado = 'Activa' LIMIT 1`,
      [id_unidad_medida]
    );

    if (unidad.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, mensaje: 'La unidad de medida indicada no existe o está inactiva' });
    }

    const [duplicadoCodigo] = await connection.query(
      `
      SELECT id_producto
      FROM productos
      WHERE LOWER(codigo_producto) = LOWER(?)
      LIMIT 1
      `,
      [codigo_producto.trim()]
    );

    if (duplicadoCodigo.length > 0) {
      await connection.rollback();
      return res.status(409).json({ ok: false, mensaje: 'Ya existe un producto con ese código' });
    }

    if (codigo_barras) {
      const [duplicadoBarras] = await connection.query(
        `
        SELECT id_producto
        FROM productos
        WHERE codigo_barras = ?
        LIMIT 1
        `,
        [codigo_barras.trim()]
      );

      if (duplicadoBarras.length > 0) {
        await connection.rollback();
        return res.status(409).json({ ok: false, mensaje: 'Ya existe un producto con ese código de barras' });
      }
    }

    const [result] = await connection.query(
      `
      INSERT INTO productos (
        id_categoria,
        id_subcategoria,
        id_marca,
        id_unidad_medida,
        codigo_producto,
        codigo_barras,
        nombre_producto,
        descripcion,
        precio_costo,
        precio_venta,
        margen_minimo,
        margen_maximo,
        stock_minimo,
        stock_maximo,
        controla_inventario,
        estado,
        creado_por,
        creado_en,
        actualizado_en
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        id_categoria,
        id_subcategoria || null,
        id_marca,
        id_unidad_medida,
        codigo_producto.trim(),
        codigo_barras || null,
        nombre_producto.trim(),
        descripcion || null,
        redondear2(precio_costo),
        redondear2(precio_venta),
        redondear2(margen_minimo),
        redondear2(margen_maximo),
        stockMin,
        stockMax,
        controla_inventario ? 1 : 0,
        estado,
        idUsuario
      ]
    );

    const idProducto = result.insertId;

    if (controla_inventario) {
      let idSucursalFinal = id_sucursal;
      let idBodegaFinal = id_bodega;

      if (!idSucursalFinal) {
        const [sucursalRows] = await connection.query(
          `
          SELECT id_sucursal
          FROM sucursales
          WHERE estado = 'Activa'
          ORDER BY id_sucursal ASC
          LIMIT 1
          `
        );

        if (sucursalRows.length === 0) {
          await connection.rollback();
          return res.status(400).json({ ok: false, mensaje: 'No existe una sucursal activa para crear el saldo inicial' });
        }

        idSucursalFinal = sucursalRows[0].id_sucursal;
      }

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

        if (bodegaRows.length === 0) {
          await connection.rollback();
          return res.status(400).json({ ok: false, mensaje: 'La sucursal no tiene una bodega activa para crear el saldo inicial' });
        }

        idBodegaFinal = bodegaRows[0].id_bodega;
      }

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
          idProducto,
          idSucursalFinal,
          idBodegaFinal,
          stockInicial,
          stockMin,
          stockMax
        ]
      );

      if (stockInicial > 0) {
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
          VALUES (?, ?, ?, ?, NULL, 'Entrada', 'Sistema', ?, ?, 0, ?, ?, NOW())
          `,
          [
            idProducto,
            idUsuario,
            idSucursalFinal,
            idBodegaFinal,
            idProducto,
            stockInicial,
            stockInicial,
            'Stock inicial por creación de producto'
          ]
        );
      }
    }

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Producto creado correctamente',
      id_producto: idProducto
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al crear producto:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al crear producto'
    });
  } finally {
    connection.release();
  }
};

// ============================================================
// PUT /api/productos/:id
// Actualizar producto V1.3
// No permite cambiar codigo_producto.
// ============================================================
const actualizarProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      id_categoria,
      id_subcategoria,
      id_marca,
      id_unidad_medida,
      codigo_barras,
      nombre_producto,
      descripcion,
      precio_costo,
      precio_venta,
      margen_minimo = 10.00,
      margen_maximo = 60.00,
      stock_minimo = 0,
      stock_maximo = 100,
      controla_inventario = true,
      estado = 'Activo'
    } = req.body;

    if (!id_categoria) {
      return res.status(400).json({ ok: false, mensaje: 'La categoría es obligatoria' });
    }

    if (!id_marca) {
      return res.status(400).json({ ok: false, mensaje: 'La marca es obligatoria' });
    }

    if (!id_unidad_medida) {
      return res.status(400).json({ ok: false, mensaje: 'La unidad de medida es obligatoria' });
    }

    if (!nombre_producto || nombre_producto.trim() === '') {
      return res.status(400).json({ ok: false, mensaje: 'El nombre del producto es obligatorio' });
    }

    if (!validarEstadoProducto(estado)) {
      return res.status(400).json({ ok: false, mensaje: 'El estado debe ser Activo o Inactivo' });
    }

    const stockMin = Number(stock_minimo);
    const stockMax = Number(stock_maximo);

    if (!Number.isInteger(stockMin) || stockMin < 0) {
      return res.status(400).json({ ok: false, mensaje: 'El stock mínimo debe ser un entero mayor o igual a 0' });
    }

    if (!Number.isInteger(stockMax) || stockMax < stockMin) {
      return res.status(400).json({ ok: false, mensaje: 'El stock máximo debe ser mayor o igual al stock mínimo' });
    }

    const errorMargen = validarMargenesPrecio({
      precio_costo,
      precio_venta,
      margen_minimo,
      margen_maximo
    });

    if (errorMargen) {
      return res.status(400).json({ ok: false, mensaje: errorMargen });
    }

    const [producto] = await pool.query(
      `SELECT id_producto FROM productos WHERE id_producto = ? LIMIT 1`,
      [id]
    );

    if (producto.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Producto no encontrado'
      });
    }

    if (codigo_barras) {
      const [duplicadoBarras] = await pool.query(
        `
        SELECT id_producto
        FROM productos
        WHERE codigo_barras = ?
          AND id_producto <> ?
        LIMIT 1
        `,
        [codigo_barras.trim(), id]
      );

      if (duplicadoBarras.length > 0) {
        return res.status(409).json({
          ok: false,
          mensaje: 'Ya existe otro producto con ese código de barras'
        });
      }
    }

    await pool.query(
      `
      UPDATE productos
      SET
        id_categoria = ?,
        id_subcategoria = ?,
        id_marca = ?,
        id_unidad_medida = ?,
        codigo_barras = ?,
        nombre_producto = ?,
        descripcion = ?,
        precio_costo = ?,
        precio_venta = ?,
        margen_minimo = ?,
        margen_maximo = ?,
        stock_minimo = ?,
        stock_maximo = ?,
        controla_inventario = ?,
        estado = ?
      WHERE id_producto = ?
      `,
      [
        id_categoria,
        id_subcategoria || null,
        id_marca,
        id_unidad_medida,
        codigo_barras || null,
        nombre_producto.trim(),
        descripcion || null,
        redondear2(precio_costo),
        redondear2(precio_venta),
        redondear2(margen_minimo),
        redondear2(margen_maximo),
        stockMin,
        stockMax,
        controla_inventario ? 1 : 0,
        estado,
        id
      ]
    );

    await pool.query(
      `
      UPDATE inventario_saldos
      SET
        stock_minimo = ?,
        stock_maximo = ?
      WHERE id_producto = ?
      `,
      [stockMin, stockMax, id]
    );

    return res.json({
      ok: true,
      mensaje: 'Producto actualizado correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar producto'
    });
  }
};

// ============================================================
// PATCH /api/productos/:id/estado
// Cambiar estado del producto
// ============================================================
const cambiarEstadoProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!validarEstadoProducto(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [producto] = await pool.query(
      `SELECT id_producto FROM productos WHERE id_producto = ? LIMIT 1`,
      [id]
    );

    if (producto.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Producto no encontrado'
      });
    }

    await pool.query(
      `
      UPDATE productos
      SET estado = ?
      WHERE id_producto = ?
      `,
      [estado, id]
    );

    return res.json({
      ok: true,
      mensaje: `Producto marcado como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado del producto:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado del producto'
    });
  }
};

module.exports = {
  obtenerProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto
};