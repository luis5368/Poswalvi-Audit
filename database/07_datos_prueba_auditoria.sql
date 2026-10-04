USE poswalvi_db;

-- ============================================================
-- DATOS DE PRUEBA PARA MOTOR DE AUDITORÍA CONTINUA POSWALVI
-- Reglas cubiertas:
-- 1. VENTA_BAJO_COSTO
-- 2. STOCK_NEGATIVO
-- 3. AJUSTE_SIN_MOTIVO
-- 4. COMPRA_DUPLICADA
-- 5. PRECIO_PROVEEDOR_ANORMAL
-- 6. ANULACIONES_FRECUENTES
-- 7. MOVIMIENTO_FUERA_HORARIO
-- ============================================================

-- ============================================================
-- 1. USUARIO ADMIN DE REFERENCIA
-- ============================================================

SET @id_admin = (
    SELECT id_usuario
    FROM usuarios
    WHERE usuario = 'admin'
    LIMIT 1
);

-- ============================================================
-- 2. CLIENTE CONSUMIDOR FINAL
-- ============================================================

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
SELECT
    'CF',
    'Consumidor Final',
    '00000000',
    'cf@poswalvi.com',
    'Ciudad de Guatemala',
    'Activo',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM clientes WHERE nit = 'CF'
);

SET @id_cliente = (
    SELECT id_cliente
    FROM clientes
    WHERE nit = 'CF'
    LIMIT 1
);

-- ============================================================
-- 3. PRODUCTO DE PRUEBA
-- ============================================================

INSERT INTO productos (
    codigo_producto,
    nombre_producto,
    descripcion,
    precio_costo,
    precio_venta,
    stock_minimo,
    controla_inventario,
    estado,
    creado_por,
    creado_en,
    actualizado_en
)
SELECT
    'AUD-001',
    'Producto prueba venta bajo costo',
    'Producto utilizado para validar reglas de auditoría continua.',
    10.00,
    15.00,
    1,
    1,
    'Activo',
    @id_admin,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM productos WHERE codigo_producto = 'AUD-001'
);

SET @id_producto = (
    SELECT id_producto
    FROM productos
    WHERE codigo_producto = 'AUD-001'
    LIMIT 1
);

-- ============================================================
-- 4. PROVEEDORES DE PRUEBA
-- ============================================================

INSERT INTO proveedores (
    nit,
    nombre_proveedor,
    razon_social,
    telefono,
    correo,
    direccion,
    contacto,
    estado,
    creado_en,
    actualizado_en
)
SELECT
    '1234567-8',
    'Proveedor Auditoria',
    'Proveedor Auditoria S.A.',
    '55555555',
    'proveedor.auditoria@poswalvi.com',
    'Ciudad de Guatemala',
    'Contacto de prueba',
    'Activo',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM proveedores WHERE nit = '1234567-8'
);

INSERT INTO proveedores (
    nit,
    nombre_proveedor,
    razon_social,
    telefono,
    correo,
    direccion,
    contacto,
    estado,
    creado_en,
    actualizado_en
)
SELECT
    '7654321-0',
    'Proveedor Precio Alto',
    'Proveedor Precio Alto S.A.',
    '55554444',
    'proveedor.alto@poswalvi.com',
    'Ciudad de Guatemala',
    'Contacto precio alto',
    'Activo',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM proveedores WHERE nit = '7654321-0'
);

SET @id_proveedor_normal = (
    SELECT id_proveedor
    FROM proveedores
    WHERE nit = '1234567-8'
    LIMIT 1
);

SET @id_proveedor_alto = (
    SELECT id_proveedor
    FROM proveedores
    WHERE nit = '7654321-0'
    LIMIT 1
);

-- ============================================================
-- 5. CASO: VENTA_BAJO_COSTO
-- ============================================================

INSERT INTO ventas (
    id_cliente,
    id_usuario,
    fecha_venta,
    subtotal,
    descuento,
    impuesto,
    total,
    metodo_pago,
    estado,
    creado_en
)
VALUES (
    @id_cliente,
    @id_admin,
    NOW(),
    5.00,
    0.00,
    0.00,
    5.00,
    'Efectivo',
    'Registrada',
    NOW()
);

SET @id_venta_bajo_costo = LAST_INSERT_ID();

INSERT INTO venta_detalle (
    id_venta,
    id_producto,
    cantidad,
    precio_unitario,
    costo_unitario,
    descuento,
    subtotal
)
VALUES (
    @id_venta_bajo_costo,
    @id_producto,
    1,
    5.00,
    10.00,
    0.00,
    5.00
);

-- ============================================================
-- 6. CASO: STOCK_NEGATIVO
-- ============================================================

INSERT INTO inventario_movimientos (
    id_producto,
    id_usuario,
    tipo_movimiento,
    origen,
    referencia_id,
    cantidad,
    stock_anterior,
    stock_nuevo,
    motivo,
    fecha_movimiento
)
VALUES (
    @id_producto,
    @id_admin,
    'Ajuste',
    'AjusteManual',
    NULL,
    5,
    2,
    -3,
    'Prueba controlada para validar regla STOCK_NEGATIVO',
    NOW()
);

-- ============================================================
-- 7. CASO: AJUSTE_SIN_MOTIVO
-- ============================================================

INSERT INTO inventario_movimientos (
    id_producto,
    id_usuario,
    tipo_movimiento,
    origen,
    referencia_id,
    cantidad,
    stock_anterior,
    stock_nuevo,
    motivo,
    fecha_movimiento
)
VALUES (
    @id_producto,
    @id_admin,
    'Ajuste',
    'AjusteManual',
    NULL,
    2,
    10,
    8,
    NULL,
    NOW()
);

-- ============================================================
-- 8. CASO: COMPRA_DUPLICADA
-- ============================================================

INSERT INTO compras (
    id_proveedor,
    id_usuario,
    numero_factura,
    fecha_compra,
    subtotal,
    descuento,
    impuesto,
    total,
    estado,
    observaciones,
    creado_en
)
VALUES
(
    @id_proveedor_normal,
    @id_admin,
    'FAC-DUP-001',
    NOW(),
    100.00,
    0.00,
    0.00,
    100.00,
    'Registrada',
    'Compra original de prueba para auditoría',
    NOW()
),
(
    @id_proveedor_normal,
    @id_admin,
    'FAC-DUP-001',
    NOW(),
    100.00,
    0.00,
    0.00,
    100.00,
    'Registrada',
    'Compra duplicada de prueba para auditoría',
    NOW()
);

-- ============================================================
-- 9. CASO: PRECIO_PROVEEDOR_ANORMAL
-- ============================================================

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
SELECT
    @id_producto,
    @id_proveedor_normal,
    'AUD-NORMAL-001',
    10.00,
    1,
    'Activo',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM producto_proveedor
    WHERE id_producto = @id_producto
      AND id_proveedor = @id_proveedor_normal
      AND codigo_proveedor = 'AUD-NORMAL-001'
);

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
SELECT
    @id_producto,
    @id_proveedor_alto,
    'AUD-ALTO-001',
    25.00,
    0,
    'Activo',
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1
    FROM producto_proveedor
    WHERE id_producto = @id_producto
      AND id_proveedor = @id_proveedor_alto
      AND codigo_proveedor = 'AUD-ALTO-001'
);

-- ============================================================
-- 10. CASO: ANULACIONES_FRECUENTES
-- 3 o más ventas anuladas por el mismo usuario en 24 horas
-- ============================================================

INSERT INTO ventas (
    id_cliente,
    id_usuario,
    fecha_venta,
    subtotal,
    descuento,
    impuesto,
    total,
    metodo_pago,
    estado,
    motivo_anulacion,
    fecha_anulacion,
    anulado_por,
    creado_en
)
VALUES
(
    @id_cliente,
    @id_admin,
    NOW(),
    10.00,
    0.00,
    0.00,
    10.00,
    'Efectivo',
    'Anulada',
    'Prueba de anulación frecuente 1',
    NOW(),
    @id_admin,
    NOW()
),
(
    @id_cliente,
    @id_admin,
    NOW(),
    15.00,
    0.00,
    0.00,
    15.00,
    'Efectivo',
    'Anulada',
    'Prueba de anulación frecuente 2',
    NOW(),
    @id_admin,
    NOW()
),
(
    @id_cliente,
    @id_admin,
    NOW(),
    20.00,
    0.00,
    0.00,
    20.00,
    'Efectivo',
    'Anulada',
    'Prueba de anulación frecuente 3',
    NOW(),
    @id_admin,
    NOW()
);

-- ============================================================
-- 11. CASO: MOVIMIENTO_FUERA_HORARIO
-- Venta registrada después de las 22:00
-- ============================================================

INSERT INTO ventas (
    id_cliente,
    id_usuario,
    fecha_venta,
    subtotal,
    descuento,
    impuesto,
    total,
    metodo_pago,
    estado,
    creado_en
)
VALUES (
    @id_cliente,
    @id_admin,
    CONCAT(CURDATE(), ' 23:30:00'),
    30.00,
    0.00,
    0.00,
    30.00,
    'Efectivo',
    'Registrada',
    NOW()
);

-- ============================================================
-- VALIDACIONES RÁPIDAS
-- ============================================================

SELECT 
    'VENTA_BAJO_COSTO' AS caso,
    vd.id_venta_detalle,
    vd.precio_unitario,
    vd.costo_unitario
FROM venta_detalle vd
WHERE vd.precio_unitario < vd.costo_unitario;

SELECT 
    'STOCK_NEGATIVO' AS caso,
    im.id_movimiento,
    im.stock_anterior,
    im.stock_nuevo
FROM inventario_movimientos im
WHERE im.stock_nuevo < 0;

SELECT 
    'AJUSTE_SIN_MOTIVO' AS caso,
    im.id_movimiento,
    im.tipo_movimiento,
    im.motivo
FROM inventario_movimientos im
WHERE im.tipo_movimiento = 'Ajuste'
  AND (im.motivo IS NULL OR TRIM(im.motivo) = '');

SELECT 
    'COMPRA_DUPLICADA' AS caso,
    c.numero_factura,
    c.id_proveedor,
    c.total,
    COUNT(*) AS cantidad
FROM compras c
GROUP BY c.numero_factura, c.id_proveedor, c.total
HAVING COUNT(*) >= 2;

SELECT 
    'PRECIO_PROVEEDOR_ANORMAL' AS caso,
    pp.id_producto_proveedor,
    pp.precio_compra
FROM producto_proveedor pp
WHERE pp.precio_compra > 20.00;

SELECT 
    'ANULACIONES_FRECUENTES' AS caso,
    anulado_por,
    COUNT(*) AS total_anulaciones
FROM ventas
WHERE estado = 'Anulada'
  AND fecha_anulacion >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY anulado_por
HAVING COUNT(*) >= 3;

SELECT 
    'MOVIMIENTO_FUERA_HORARIO' AS caso,
    id_venta,
    fecha_venta,
    TIME(fecha_venta) AS hora_venta
FROM ventas
WHERE TIME(fecha_venta) > '22:00:00';