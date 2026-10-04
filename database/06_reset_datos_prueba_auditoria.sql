USE poswalvi_db;

-- ============================================================
-- RESET DE DATOS DE PRUEBA DEL MOTOR DE AUDITORÍA POSWALVI
-- Este script limpia datos de prueba académicos/demo.
-- No usar en producción.
-- ============================================================

SET SQL_SAFE_UPDATES = 0;

-- ============================================================
-- 1. ELIMINAR EVIDENCIAS DE HALLAZGOS DE PRUEBA
-- ============================================================

DELETE e
FROM auditoria_evidencias e
INNER JOIN auditoria_hallazgos h ON e.id_hallazgo = h.id_hallazgo
WHERE h.tipo_irregularidad IN (
    'VENTA_BAJO_COSTO',
    'STOCK_NEGATIVO',
    'AJUSTE_SIN_MOTIVO',
    'COMPRA_DUPLICADA',
    'PRECIO_PROVEEDOR_ANORMAL',
    'ANULACIONES_FRECUENTES',
    'MOVIMIENTO_FUERA_HORARIO'
);

-- ============================================================
-- 2. ELIMINAR HALLAZGOS DE PRUEBA
-- ============================================================

DELETE FROM auditoria_hallazgos
WHERE tipo_irregularidad IN (
    'VENTA_BAJO_COSTO',
    'STOCK_NEGATIVO',
    'AJUSTE_SIN_MOTIVO',
    'COMPRA_DUPLICADA',
    'PRECIO_PROVEEDOR_ANORMAL',
    'ANULACIONES_FRECUENTES',
    'MOVIMIENTO_FUERA_HORARIO'
);

-- ============================================================
-- 3. OBTENER IDs DE REFERENCIA
-- ============================================================

SET @id_admin = (
    SELECT id_usuario
    FROM usuarios
    WHERE usuario = 'admin'
    LIMIT 1
);

SET @id_cliente = (
    SELECT id_cliente
    FROM clientes
    WHERE nit = 'CF'
    LIMIT 1
);

SET @id_producto = (
    SELECT id_producto
    FROM productos
    WHERE codigo_producto = 'AUD-001'
    LIMIT 1
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
-- 4. ELIMINAR DETALLE DE VENTAS DE PRUEBA
-- ============================================================

DELETE vd
FROM venta_detalle vd
INNER JOIN ventas v ON vd.id_venta = v.id_venta
WHERE v.id_usuario = @id_admin
  AND (
        v.total IN (5.00, 30.00)
        OR v.motivo_anulacion LIKE 'Prueba de anulación frecuente%'
      );

-- ============================================================
-- 5. ELIMINAR VENTAS DE PRUEBA
-- ============================================================

DELETE FROM ventas
WHERE id_usuario = @id_admin
  AND (
        total IN (5.00, 10.00, 15.00, 20.00, 30.00)
        OR motivo_anulacion LIKE 'Prueba de anulación frecuente%'
        OR TIME(fecha_venta) = '23:30:00'
      );

-- ============================================================
-- 6. ELIMINAR MOVIMIENTOS DE INVENTARIO DE PRUEBA
-- ============================================================

DELETE FROM inventario_movimientos
WHERE id_producto = @id_producto
  AND (
        motivo LIKE 'Prueba controlada para validar regla STOCK_NEGATIVO%'
        OR (
            tipo_movimiento = 'Ajuste'
            AND origen = 'AjusteManual'
            AND stock_anterior = 10
            AND stock_nuevo = 8
            AND motivo IS NULL
        )
      );

-- ============================================================
-- 7. ELIMINAR COMPRAS DUPLICADAS DE PRUEBA
-- ============================================================

DELETE FROM compras
WHERE numero_factura = 'FAC-DUP-001'
  AND id_proveedor = @id_proveedor_normal;

-- ============================================================
-- 8. ELIMINAR RELACIÓN PRODUCTO-PROVEEDOR DE PRUEBA
-- ============================================================

DELETE FROM producto_proveedor
WHERE codigo_proveedor IN (
    'AUD-NORMAL-001',
    'AUD-ALTO-001'
);

-- ============================================================
-- 9. ELIMINAR PROVEEDORES DE PRUEBA
-- ============================================================

DELETE FROM proveedores
WHERE nit IN (
    '1234567-8',
    '7654321-0'
);

-- ============================================================
-- 10. ELIMINAR PRODUCTO DE PRUEBA
-- ============================================================

DELETE FROM productos
WHERE codigo_producto = 'AUD-001';

-- ============================================================
-- 11. OPCIONAL: NO ELIMINAMOS CLIENTE CF
-- Se mantiene porque puede usarse como cliente base del sistema.
-- ============================================================

SET SQL_SAFE_UPDATES = 1;

-- ============================================================
-- VALIDACIÓN FINAL
-- ============================================================

SELECT 'Hallazgos restantes de prueba' AS validacion, COUNT(*) AS total
FROM auditoria_hallazgos
WHERE tipo_irregularidad IN (
    'VENTA_BAJO_COSTO',
    'STOCK_NEGATIVO',
    'AJUSTE_SIN_MOTIVO',
    'COMPRA_DUPLICADA',
    'PRECIO_PROVEEDOR_ANORMAL',
    'ANULACIONES_FRECUENTES',
    'MOVIMIENTO_FUERA_HORARIO'
);

SELECT 'Producto AUD-001' AS validacion, COUNT(*) AS total
FROM productos
WHERE codigo_producto = 'AUD-001';

SELECT 'Compras FAC-DUP-001' AS validacion, COUNT(*) AS total
FROM compras
WHERE numero_factura = 'FAC-DUP-001';