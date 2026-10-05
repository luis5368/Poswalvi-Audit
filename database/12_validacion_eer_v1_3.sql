USE poswalvi_db;

-- ============================================================
-- VALIDACIÓN EER POSWALVI V1.3
-- Este script valida que las mejoras aprobadas hayan quedado bien.
-- ============================================================

-- ============================================================
-- 1. VALIDAR TABLAS NUEVAS
-- ============================================================

SELECT 
    '01_TABLAS_NUEVAS' AS seccion,
    tabla,
    CASE 
        WHEN existe = 1 THEN 'OK'
        ELSE 'FALTA'
    END AS estado
FROM (
    SELECT 'empresa_configuracion' AS tabla, COUNT(*) AS existe 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'empresa_configuracion'

    UNION ALL
    SELECT 'sucursales', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'sucursales'

    UNION ALL
    SELECT 'cajas', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'cajas'

    UNION ALL
    SELECT 'turnos_caja', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'turnos_caja'

    UNION ALL
    SELECT 'metodos_pago', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'metodos_pago'

    UNION ALL
    SELECT 'venta_pagos', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'venta_pagos'

    UNION ALL
    SELECT 'marcas', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'marcas'

    UNION ALL
    SELECT 'unidades_medida', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'unidades_medida'

    UNION ALL
    SELECT 'bodegas', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'bodegas'

    UNION ALL
    SELECT 'inventario_saldos', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'inventario_saldos'

    UNION ALL
    SELECT 'documento_correlativos', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'documento_correlativos'

    UNION ALL
    SELECT 'auditoria_ejecuciones', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'auditoria_ejecuciones'

    UNION ALL
    SELECT 'auditoria_revision_historial', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'auditoria_revision_historial'

    UNION ALL
    SELECT 'reportes_guardados', COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() AND table_name = 'reportes_guardados'
) AS validacion_tablas;


-- ============================================================
-- 2. VALIDAR DATOS BASE
-- ============================================================

SELECT 
    '02_DATOS_BASE' AS seccion,
    'empresa_configuracion' AS tabla,
    COUNT(*) AS total,
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALTA' END AS estado
FROM empresa_configuracion

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'sucursales',
    COUNT(*),
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALTA' END
FROM sucursales

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'cajas',
    COUNT(*),
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALTA' END
FROM cajas

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'bodegas',
    COUNT(*),
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALTA' END
FROM bodegas

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'metodos_pago',
    COUNT(*),
    CASE WHEN COUNT(*) >= 3 THEN 'OK' ELSE 'REVISAR' END
FROM metodos_pago

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'marcas',
    COUNT(*),
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALTA' END
FROM marcas

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'unidades_medida',
    COUNT(*),
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'FALTA' END
FROM unidades_medida

UNION ALL

SELECT 
    '02_DATOS_BASE',
    'documento_correlativos',
    COUNT(*),
    CASE WHEN COUNT(*) >= 2 THEN 'OK' ELSE 'REVISAR' END
FROM documento_correlativos;


-- ============================================================
-- 3. VALIDAR COLUMNAS AGREGADAS EN TABLAS EXISTENTES
-- ============================================================

SELECT 
    '03_COLUMNAS_AGREGADAS' AS seccion,
    table_name AS tabla,
    column_name AS columna,
    'OK' AS estado
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
        (table_name = 'usuarios' AND column_name IN ('id_sucursal'))

        OR (table_name = 'ventas' AND column_name IN (
            'id_sucursal',
            'id_caja',
            'id_turno',
            'tipo_documento',
            'serie',
            'correlativo',
            'numero_documento'
        ))

        OR (table_name = 'compras' AND column_name IN (
            'id_sucursal',
            'id_bodega',
            'tipo_documento',
            'serie',
            'correlativo',
            'numero_documento_interno'
        ))

        OR (table_name = 'productos' AND column_name IN (
            'id_marca',
            'id_unidad_medida',
            'codigo_barras',
            'stock_maximo',
            'margen_minimo',
            'margen_maximo'
        ))

        OR (table_name = 'inventario_movimientos' AND column_name IN (
            'id_sucursal',
            'id_bodega',
            'id_turno'
        ))

        OR (table_name = 'auditoria_hallazgos' AND column_name IN (
            'id_ejecucion'
        ))
  )
ORDER BY table_name, column_name;


-- ============================================================
-- 4. VALIDAR CANTIDAD ESPERADA DE COLUMNAS POR TABLA
-- ============================================================

SELECT
    '04_RESUMEN_COLUMNAS' AS seccion,
    'usuarios' AS tabla,
    COUNT(*) AS columnas_detectadas,
    1 AS columnas_esperadas,
    CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'REVISAR' END AS estado
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'usuarios'
  AND column_name IN ('id_sucursal')

UNION ALL

SELECT
    '04_RESUMEN_COLUMNAS',
    'ventas',
    COUNT(*),
    7,
    CASE WHEN COUNT(*) = 7 THEN 'OK' ELSE 'REVISAR' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'ventas'
  AND column_name IN (
        'id_sucursal',
        'id_caja',
        'id_turno',
        'tipo_documento',
        'serie',
        'correlativo',
        'numero_documento'
  )

UNION ALL

SELECT
    '04_RESUMEN_COLUMNAS',
    'compras',
    COUNT(*),
    6,
    CASE WHEN COUNT(*) = 6 THEN 'OK' ELSE 'REVISAR' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'compras'
  AND column_name IN (
        'id_sucursal',
        'id_bodega',
        'tipo_documento',
        'serie',
        'correlativo',
        'numero_documento_interno'
  )

UNION ALL

SELECT
    '04_RESUMEN_COLUMNAS',
    'productos',
    COUNT(*),
    6,
    CASE WHEN COUNT(*) = 6 THEN 'OK' ELSE 'REVISAR' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'productos'
  AND column_name IN (
        'id_marca',
        'id_unidad_medida',
        'codigo_barras',
        'stock_maximo',
        'margen_minimo',
        'margen_maximo'
  )

UNION ALL

SELECT
    '04_RESUMEN_COLUMNAS',
    'inventario_movimientos',
    COUNT(*),
    3,
    CASE WHEN COUNT(*) = 3 THEN 'OK' ELSE 'REVISAR' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'inventario_movimientos'
  AND column_name IN (
        'id_sucursal',
        'id_bodega',
        'id_turno'
  )

UNION ALL

SELECT
    '04_RESUMEN_COLUMNAS',
    'auditoria_hallazgos',
    COUNT(*),
    1,
    CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'REVISAR' END
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'auditoria_hallazgos'
  AND column_name IN ('id_ejecucion');


-- ============================================================
-- 5. VALIDAR REGISTROS YA ACTUALIZADOS
-- ============================================================

SELECT 
    '05_DATOS_ACTUALIZADOS' AS seccion,
    'usuarios con sucursal' AS validacion,
    COUNT(*) AS total,
    CASE WHEN COUNT(*) >= 1 THEN 'OK' ELSE 'REVISAR' END AS estado
FROM usuarios
WHERE id_sucursal IS NOT NULL

UNION ALL

SELECT 
    '05_DATOS_ACTUALIZADOS',
    'ventas con sucursal y caja',
    COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN 'OK' ELSE 'REVISAR' END
FROM ventas
WHERE id_sucursal IS NOT NULL
  AND id_caja IS NOT NULL

UNION ALL

SELECT 
    '05_DATOS_ACTUALIZADOS',
    'compras con sucursal y bodega',
    COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN 'OK' ELSE 'REVISAR' END
FROM compras
WHERE id_sucursal IS NOT NULL
  AND id_bodega IS NOT NULL

UNION ALL

SELECT 
    '05_DATOS_ACTUALIZADOS',
    'productos con marca y unidad',
    COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN 'OK' ELSE 'REVISAR' END
FROM productos
WHERE id_marca IS NOT NULL
  AND id_unidad_medida IS NOT NULL

UNION ALL

SELECT 
    '05_DATOS_ACTUALIZADOS',
    'movimientos con sucursal y bodega',
    COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN 'OK' ELSE 'REVISAR' END
FROM inventario_movimientos
WHERE id_sucursal IS NOT NULL
  AND id_bodega IS NOT NULL

UNION ALL

SELECT 
    '05_DATOS_ACTUALIZADOS',
    'saldos de inventario creados',
    COUNT(*),
    CASE WHEN COUNT(*) >= 0 THEN 'OK' ELSE 'REVISAR' END
FROM inventario_saldos;


-- ============================================================
-- 6. VALIDAR CONFIGURACIÓN GUATEMALA
-- ============================================================

SELECT
    '06_CONFIG_GUATEMALA' AS seccion,
    nombre_comercial,
    nit,
    moneda,
    porcentaje_iva,
    pais,
    CASE
        WHEN moneda = 'Q'
         AND porcentaje_iva = 12.00
         AND pais = 'Guatemala'
        THEN 'OK'
        ELSE 'REVISAR'
    END AS estado
FROM empresa_configuracion
LIMIT 1;


-- ============================================================
-- 7. VALIDAR RELACIONES / FOREIGN KEYS PRINCIPALES
-- ============================================================

SELECT
    '07_FOREIGN_KEYS' AS seccion,
    table_name AS tabla,
    constraint_name AS relacion,
    referenced_table_name AS tabla_referenciada,
    'OK' AS estado
FROM information_schema.key_column_usage
WHERE table_schema = DATABASE()
  AND referenced_table_name IS NOT NULL
  AND table_name IN (
        'usuarios',
        'ventas',
        'compras',
        'productos',
        'inventario_movimientos',
        'inventario_saldos',
        'cajas',
        'bodegas',
        'turnos_caja',
        'venta_pagos',
        'auditoria_hallazgos',
        'auditoria_ejecuciones',
        'auditoria_revision_historial',
        'reportes_guardados',
        'documento_correlativos'
  )
ORDER BY table_name, constraint_name;


-- ============================================================
-- 8. VALIDAR QUE NO HAYA DATOS HUÉRFANOS PRINCIPALES
-- ============================================================

SELECT
    '08_DATOS_HUERFANOS' AS seccion,
    'ventas sin sucursal' AS validacion,
    COUNT(*) AS total,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END AS estado
FROM ventas
WHERE id_sucursal IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'ventas sin caja',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM ventas
WHERE id_caja IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'compras sin sucursal',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM compras
WHERE id_sucursal IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'compras sin bodega',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM compras
WHERE id_bodega IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'productos sin marca',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM productos
WHERE id_marca IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'productos sin unidad medida',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM productos
WHERE id_unidad_medida IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'movimientos sin sucursal',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM inventario_movimientos
WHERE id_sucursal IS NULL

UNION ALL

SELECT
    '08_DATOS_HUERFANOS',
    'movimientos sin bodega',
    COUNT(*),
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END
FROM inventario_movimientos
WHERE id_bodega IS NULL;


-- ============================================================
-- 9. VALIDACIÓN FINAL GENERAL
-- ============================================================

SELECT
    '09_VALIDACION_FINAL' AS seccion,
    'Si todas las secciones anteriores muestran OK, el EER V1.3 quedó aplicado correctamente.' AS resultado;