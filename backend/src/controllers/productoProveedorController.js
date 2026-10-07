const pool = require('../config/db');

const validarEstado = (estado) => {
  return ['Activo', 'Inactivo'].includes(estado);
};

const redondear2 = (valor) => {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
};

// ============================================================
// GET /api/producto-proveedor
// Listar asignaciones producto-proveedor
// ============================================================
const obtenerProductoProveedor = async (req, res) => {
  try {
    const {
      id_producto,
      id_proveedor,
      estado,
      proveedor_principal,
      buscar
    } = req.query;

    let sql = `
      SELECT
        pp.id_producto_proveedor,
        pp.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        pp.id_proveedor,
        pr.nit,
        pr.nombre_proveedor,
        pr.razon_social,
        pp.codigo_proveedor,
        pp.precio_compra,
        pp.proveedor_principal,
        pp.estado,
        pp.creado_en,
        pp.actualizado_en
      FROM producto_proveedor pp
      INNER JOIN productos p ON pp.id_producto = p.id_producto
      INNER JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
      WHERE 1 = 1
    `;

    const params = [];

    if (id_producto) {
      sql += ` AND pp.id_producto = ?`;
      params.push(id_producto);
    }

    if (id_proveedor) {
      sql += ` AND pp.id_proveedor = ?`;
      params.push(id_proveedor);
    }

    if (estado) {
      sql += ` AND pp.estado = ?`;
      params.push(estado);
    }

    if (proveedor_principal !== undefined) {
      sql += ` AND pp.proveedor_principal = ?`;
      params.push(proveedor_principal === 'true' ? 1 : 0);
    }

    if (buscar) {
      sql += `
        AND (
          p.codigo_producto LIKE ?
          OR p.nombre_producto LIKE ?
          OR pr.nit LIKE ?
          OR pr.nombre_proveedor LIKE ?
          OR pr.razon_social LIKE ?
          OR pp.codigo_proveedor LIKE ?
        )
      `;

      params.push(
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`,
        `%${buscar}%`
      );
    }

    sql += ` ORDER BY pp.id_producto_proveedor DESC`;

    const [rows] = await pool.query(sql, params);

    return res.json({
      ok: true,
      total: rows.length,
      asignaciones: rows
    });
  } catch (error) {
    console.error('Error al obtener producto-proveedor:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener asignaciones producto-proveedor'
    });
  }
};

// ============================================================
// GET /api/producto-proveedor/:id
// Obtener asignación por ID
// ============================================================
const obtenerProductoProveedorPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT
        pp.id_producto_proveedor,
        pp.id_producto,
        p.codigo_producto,
        p.nombre_producto,
        pp.id_proveedor,
        pr.nit,
        pr.nombre_proveedor,
        pr.razon_social,
        pp.codigo_proveedor,
        pp.precio_compra,
        pp.proveedor_principal,
        pp.estado,
        pp.creado_en,
        pp.actualizado_en
      FROM producto_proveedor pp
      INNER JOIN productos p ON pp.id_producto = p.id_producto
      INNER JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
      WHERE pp.id_producto_proveedor = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Asignación producto-proveedor no encontrada'
      });
    }

    return res.json({
      ok: true,
      asignacion: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener asignación producto-proveedor:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener asignación producto-proveedor'
    });
  }
};

// ============================================================
// POST /api/producto-proveedor
// Crear asignación producto-proveedor
// ============================================================
const crearProductoProveedor = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const {
      id_producto,
      id_proveedor,
      codigo_proveedor,
      precio_compra,
      proveedor_principal = false,
      estado = 'Activo'
    } = req.body;

    if (!id_producto) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El producto es obligatorio'
      });
    }

    if (!id_proveedor) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El proveedor es obligatorio'
      });
    }

    if (!precio_compra && precio_compra !== 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El precio de compra es obligatorio'
      });
    }

    const precioCompra = redondear2(precio_compra);

    if (Number.isNaN(precioCompra) || precioCompra <= 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El precio de compra debe ser mayor a 0'
      });
    }

    if (!validarEstado(estado)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [producto] = await connection.query(
      `
      SELECT id_producto, estado
      FROM productos
      WHERE id_producto = ?
      LIMIT 1
      `,
      [id_producto]
    );

    if (producto.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        mensaje: 'El producto indicado no existe'
      });
    }

    if (producto[0].estado !== 'Activo') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede asignar proveedor a un producto inactivo'
      });
    }

    const [proveedor] = await connection.query(
      `
      SELECT id_proveedor, estado
      FROM proveedores
      WHERE id_proveedor = ?
      LIMIT 1
      `,
      [id_proveedor]
    );

    if (proveedor.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        mensaje: 'El proveedor indicado no existe'
      });
    }

    if (proveedor[0].estado !== 'Activo') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede asignar un proveedor inactivo'
      });
    }

    const [duplicado] = await connection.query(
      `
      SELECT id_producto_proveedor
      FROM producto_proveedor
      WHERE id_producto = ?
        AND id_proveedor = ?
      LIMIT 1
      `,
      [id_producto, id_proveedor]
    );

    if (duplicado.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        ok: false,
        mensaje: 'Este producto ya está asignado a este proveedor'
      });
    }

    const esPrincipal = proveedor_principal ? 1 : 0;

    if (esPrincipal === 1) {
      await connection.query(
        `
        UPDATE producto_proveedor
        SET proveedor_principal = 0,
            actualizado_en = NOW()
        WHERE id_producto = ?
        `,
        [id_producto]
      );
    }

    const [result] = await connection.query(
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
      VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        id_producto,
        id_proveedor,
        codigo_proveedor || null,
        precioCompra,
        esPrincipal,
        estado
      ]
    );

    await connection.commit();

    return res.status(201).json({
      ok: true,
      mensaje: 'Producto asignado al proveedor correctamente',
      id_producto_proveedor: result.insertId
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al crear producto-proveedor:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al asignar producto a proveedor'
    });
  } finally {
    connection.release();
  }
};

// ============================================================
// PUT /api/producto-proveedor/:id
// Actualizar asignación producto-proveedor
// ============================================================
const actualizarProductoProveedor = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const {
      codigo_proveedor,
      precio_compra,
      proveedor_principal = false,
      estado = 'Activo'
    } = req.body;

    if (!precio_compra && precio_compra !== 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El precio de compra es obligatorio'
      });
    }

    const precioCompra = redondear2(precio_compra);

    if (Number.isNaN(precioCompra) || precioCompra <= 0) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El precio de compra debe ser mayor a 0'
      });
    }

    if (!validarEstado(estado)) {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [asignacion] = await connection.query(
      `
      SELECT
        id_producto_proveedor,
        id_producto,
        id_proveedor
      FROM producto_proveedor
      WHERE id_producto_proveedor = ?
      LIMIT 1
      `,
      [id]
    );

    if (asignacion.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        mensaje: 'Asignación producto-proveedor no encontrada'
      });
    }

    const idProducto = asignacion[0].id_producto;
    const esPrincipal = proveedor_principal ? 1 : 0;

    if (esPrincipal === 1) {
      await connection.query(
        `
        UPDATE producto_proveedor
        SET proveedor_principal = 0,
            actualizado_en = NOW()
        WHERE id_producto = ?
          AND id_producto_proveedor <> ?
        `,
        [idProducto, id]
      );
    }

    await connection.query(
      `
      UPDATE producto_proveedor
      SET
        codigo_proveedor = ?,
        precio_compra = ?,
        proveedor_principal = ?,
        estado = ?,
        actualizado_en = NOW()
      WHERE id_producto_proveedor = ?
      `,
      [
        codigo_proveedor || null,
        precioCompra,
        esPrincipal,
        estado,
        id
      ]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Asignación producto-proveedor actualizada correctamente'
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al actualizar producto-proveedor:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar asignación producto-proveedor'
    });
  } finally {
    connection.release();
  }
};

// ============================================================
// PATCH /api/producto-proveedor/:id/estado
// Cambiar estado
// ============================================================
const cambiarEstadoProductoProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!validarEstado(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El estado debe ser Activo o Inactivo'
      });
    }

    const [asignacion] = await pool.query(
      `
      SELECT id_producto_proveedor
      FROM producto_proveedor
      WHERE id_producto_proveedor = ?
      LIMIT 1
      `,
      [id]
    );

    if (asignacion.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Asignación producto-proveedor no encontrada'
      });
    }

    await pool.query(
    `
    UPDATE producto_proveedor
    SET 
        estado = ?,
        proveedor_principal = CASE 
        WHEN ? = 'Inactivo' THEN 0 
        ELSE proveedor_principal 
        END,
        actualizado_en = NOW()
    WHERE id_producto_proveedor = ?
    `,
    [estado, estado, id]
    );

    return res.json({
      ok: true,
      mensaje: `Asignación marcada como ${estado}`
    });
  } catch (error) {
    console.error('Error al cambiar estado producto-proveedor:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al cambiar estado de asignación'
    });
  }
};

// ============================================================
// PATCH /api/producto-proveedor/:id/principal
// Marcar como proveedor principal
// ============================================================
const marcarProveedorPrincipal = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const [asignacion] = await connection.query(
      `
      SELECT id_producto_proveedor, id_producto, estado
      FROM producto_proveedor
      WHERE id_producto_proveedor = ?
      LIMIT 1
      `,
      [id]
    );

    if (asignacion.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        ok: false,
        mensaje: 'Asignación producto-proveedor no encontrada'
      });
    }

    if (asignacion[0].estado !== 'Activo') {
      await connection.rollback();
      return res.status(400).json({
        ok: false,
        mensaje: 'No se puede marcar como principal una asignación inactiva'
      });
    }

    const idProducto = asignacion[0].id_producto;

    await connection.query(
      `
      UPDATE producto_proveedor
      SET proveedor_principal = 0,
          actualizado_en = NOW()
      WHERE id_producto = ?
      `,
      [idProducto]
    );

    await connection.query(
      `
      UPDATE producto_proveedor
      SET proveedor_principal = 1,
          actualizado_en = NOW()
      WHERE id_producto_proveedor = ?
      `,
      [id]
    );

    await connection.commit();

    return res.json({
      ok: true,
      mensaje: 'Proveedor marcado como principal correctamente'
    });
  } catch (error) {
    await connection.rollback();

    console.error('Error al marcar proveedor principal:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al marcar proveedor principal'
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  obtenerProductoProveedor,
  obtenerProductoProveedorPorId,
  crearProductoProveedor,
  actualizarProductoProveedor,
  cambiarEstadoProductoProveedor,
  marcarProveedorPrincipal
};