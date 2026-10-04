USE poswalvi_db;

-- ============================================================
-- SEED CONFIGURACIÓN BASE POSWALVI V1.3
-- Guatemala / Quetzales / IVA 12%
-- ============================================================

INSERT INTO empresa_configuracion (
    nombre_comercial,
    razon_social,
    nit,
    direccion,
    telefono,
    correo,
    moneda,
    porcentaje_iva,
    pais,
    estado
)
SELECT
    'POSWALVI',
    'POSWALVI S.A.',
    'CF',
    'Ciudad de Guatemala, Guatemala',
    '00000000',
    'admin@poswalvi.local',
    'Q',
    12.00,
    'Guatemala',
    'Activa'
WHERE NOT EXISTS (
    SELECT 1 FROM empresa_configuracion WHERE nombre_comercial = 'POSWALVI'
);

INSERT INTO sucursales (
    nombre_sucursal,
    direccion,
    telefono,
    responsable,
    estado
)
SELECT
    'Sucursal Central',
    'Ciudad de Guatemala',
    '00000000',
    'Administrador',
    'Activa'
WHERE NOT EXISTS (
    SELECT 1 FROM sucursales WHERE nombre_sucursal = 'Sucursal Central'
);

SET @id_sucursal_central = (
    SELECT id_sucursal
    FROM sucursales
    WHERE nombre_sucursal = 'Sucursal Central'
    LIMIT 1
);

INSERT INTO cajas (
    id_sucursal,
    nombre_caja,
    descripcion,
    estado
)
SELECT
    @id_sucursal_central,
    'Caja Principal',
    'Caja principal para pruebas y operación inicial',
    'Activa'
WHERE NOT EXISTS (
    SELECT 1
    FROM cajas
    WHERE id_sucursal = @id_sucursal_central
      AND nombre_caja = 'Caja Principal'
);

INSERT INTO bodegas (
    id_sucursal,
    nombre_bodega,
    descripcion,
    estado
)
SELECT
    @id_sucursal_central,
    'Bodega Principal',
    'Bodega principal de inventario',
    'Activa'
WHERE NOT EXISTS (
    SELECT 1
    FROM bodegas
    WHERE id_sucursal = @id_sucursal_central
      AND nombre_bodega = 'Bodega Principal'
);

INSERT INTO metodos_pago (
    nombre_metodo,
    descripcion,
    requiere_referencia,
    estado
)
SELECT 'Efectivo', 'Pago en efectivo', 0, 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM metodos_pago WHERE nombre_metodo = 'Efectivo'
);

INSERT INTO metodos_pago (
    nombre_metodo,
    descripcion,
    requiere_referencia,
    estado
)
SELECT 'Tarjeta', 'Pago con tarjeta de crédito o débito', 1, 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM metodos_pago WHERE nombre_metodo = 'Tarjeta'
);

INSERT INTO metodos_pago (
    nombre_metodo,
    descripcion,
    requiere_referencia,
    estado
)
SELECT 'Transferencia', 'Pago por transferencia bancaria', 1, 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM metodos_pago WHERE nombre_metodo = 'Transferencia'
);

INSERT INTO metodos_pago (
    nombre_metodo,
    descripcion,
    requiere_referencia,
    estado
)
SELECT 'Mixto', 'Pago combinado con más de un método', 1, 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM metodos_pago WHERE nombre_metodo = 'Mixto'
);

INSERT INTO unidades_medida (
    nombre_unidad,
    abreviatura,
    estado
)
SELECT 'Unidad', 'UND', 'Activa'
WHERE NOT EXISTS (
    SELECT 1 FROM unidades_medida WHERE abreviatura = 'UND'
);

INSERT INTO unidades_medida (
    nombre_unidad,
    abreviatura,
    estado
)
SELECT 'Caja', 'CJ', 'Activa'
WHERE NOT EXISTS (
    SELECT 1 FROM unidades_medida WHERE abreviatura = 'CJ'
);

INSERT INTO unidades_medida (
    nombre_unidad,
    abreviatura,
    estado
)
SELECT 'Paquete', 'PQ', 'Activa'
WHERE NOT EXISTS (
    SELECT 1 FROM unidades_medida WHERE abreviatura = 'PQ'
);

INSERT INTO marcas (
    nombre_marca,
    descripcion,
    estado
)
SELECT 'Genérica', 'Marca genérica para productos sin marca definida', 'Activa'
WHERE NOT EXISTS (
    SELECT 1 FROM marcas WHERE nombre_marca = 'Genérica'
);

INSERT INTO documento_correlativos (
    id_sucursal,
    tipo_documento,
    serie,
    correlativo_actual,
    prefijo,
    estado
)
SELECT
    @id_sucursal_central,
    'Venta',
    'V001',
    0,
    'V',
    'Activo'
WHERE NOT EXISTS (
    SELECT 1
    FROM documento_correlativos
    WHERE id_sucursal = @id_sucursal_central
      AND tipo_documento = 'Venta'
      AND serie = 'V001'
);

INSERT INTO documento_correlativos (
    id_sucursal,
    tipo_documento,
    serie,
    correlativo_actual,
    prefijo,
    estado
)
SELECT
    @id_sucursal_central,
    'Compra',
    'C001',
    0,
    'C',
    'Activo'
WHERE NOT EXISTS (
    SELECT 1
    FROM documento_correlativos
    WHERE id_sucursal = @id_sucursal_central
      AND tipo_documento = 'Compra'
      AND serie = 'C001'
);