USE poswalvi_db;

-- ============================================================
-- POSWALVI EER V1.3
-- ALTER TABLES EXISTENTES
-- Conecta sucursales, cajas, turnos, bodegas, marcas,
-- unidades de medida, correlativos y auditoría con tablas actuales.
--
-- IMPORTANTE:
-- Ejecutar después de:
-- 08_schema_mejoras_eer_v1_3.sql
-- 09_seed_configuracion_base_v1_3.sql
-- ============================================================

-- ============================================================
-- 1. OBTENER DATOS BASE
-- ============================================================

SET @id_sucursal_central = (
    SELECT id_sucursal
    FROM sucursales
    WHERE nombre_sucursal = 'Sucursal Central'
    LIMIT 1
);

SET @id_caja_principal = (
    SELECT id_caja
    FROM cajas
    WHERE nombre_caja = 'Caja Principal'
      AND id_sucursal = @id_sucursal_central
    LIMIT 1
);

SET @id_bodega_principal = (
    SELECT id_bodega
    FROM bodegas
    WHERE nombre_bodega = 'Bodega Principal'
      AND id_sucursal = @id_sucursal_central
    LIMIT 1
);

SET @id_marca_generica = (
    SELECT id_marca
    FROM marcas
    WHERE nombre_marca = 'Genérica'
    LIMIT 1
);

SET @id_unidad_unidad = (
    SELECT id_unidad_medida
    FROM unidades_medida
    WHERE abreviatura = 'UND'
    LIMIT 1
);

-- ============================================================
-- 2. MODIFICAR TABLA USUARIOS
-- Relaciona usuarios con una sucursal base.
-- ============================================================

ALTER TABLE usuarios
ADD COLUMN id_sucursal INT NULL AFTER id_rol;

ALTER TABLE usuarios
ADD CONSTRAINT fk_usuarios_sucursal
FOREIGN KEY (id_sucursal)
REFERENCES sucursales(id_sucursal);

UPDATE usuarios
SET id_sucursal = @id_sucursal_central
WHERE id_sucursal IS NULL;

-- ============================================================
-- 3. MODIFICAR TABLA VENTAS
-- Se agregan sucursal, caja, turno y correlativo interno.
-- ============================================================

ALTER TABLE ventas
ADD COLUMN id_sucursal INT NULL AFTER id_usuario,
ADD COLUMN id_caja INT NULL AFTER id_sucursal,
ADD COLUMN id_turno BIGINT NULL AFTER id_caja,
ADD COLUMN tipo_documento ENUM('Venta', 'Factura', 'Ticket', 'NotaCredito') DEFAULT 'Venta' AFTER fecha_venta,
ADD COLUMN serie VARCHAR(20) NULL AFTER tipo_documento,
ADD COLUMN correlativo BIGINT NULL AFTER serie,
ADD COLUMN numero_documento VARCHAR(50) NULL AFTER correlativo;

ALTER TABLE ventas
ADD CONSTRAINT fk_ventas_sucursal
FOREIGN KEY (id_sucursal)
REFERENCES sucursales(id_sucursal);

ALTER TABLE ventas
ADD CONSTRAINT fk_ventas_caja
FOREIGN KEY (id_caja)
REFERENCES cajas(id_caja);

ALTER TABLE ventas
ADD CONSTRAINT fk_ventas_turno
FOREIGN KEY (id_turno)
REFERENCES turnos_caja(id_turno);

UPDATE ventas
SET 
    id_sucursal = @id_sucursal_central,
    id_caja = @id_caja_principal,
    tipo_documento = 'Venta',
    serie = 'V001',
    correlativo = id_venta,
    numero_documento = CONCAT('V001-', LPAD(id_venta, 6, '0'))
WHERE id_sucursal IS NULL;

CREATE INDEX idx_ventas_sucursal_fecha ON ventas(id_sucursal, fecha_venta);
CREATE INDEX idx_ventas_caja_fecha ON ventas(id_caja, fecha_venta);
CREATE INDEX idx_ventas_numero_documento ON ventas(numero_documento);

-- ============================================================
-- 4. MODIFICAR TABLA COMPRAS
-- Se agregan sucursal, bodega y documento interno.
-- ============================================================

ALTER TABLE compras
ADD COLUMN id_sucursal INT NULL AFTER id_usuario,
ADD COLUMN id_bodega INT NULL AFTER id_sucursal,
ADD COLUMN tipo_documento ENUM('Compra', 'FacturaProveedor', 'OrdenCompra') DEFAULT 'Compra' AFTER fecha_compra,
ADD COLUMN serie VARCHAR(20) NULL AFTER tipo_documento,
ADD COLUMN correlativo BIGINT NULL AFTER serie,
ADD COLUMN numero_documento_interno VARCHAR(50) NULL AFTER correlativo;

ALTER TABLE compras
ADD CONSTRAINT fk_compras_sucursal
FOREIGN KEY (id_sucursal)
REFERENCES sucursales(id_sucursal);

ALTER TABLE compras
ADD CONSTRAINT fk_compras_bodega
FOREIGN KEY (id_bodega)
REFERENCES bodegas(id_bodega);

UPDATE compras
SET
    id_sucursal = @id_sucursal_central,
    id_bodega = @id_bodega_principal,
    tipo_documento = 'Compra',
    serie = 'C001',
    correlativo = id_compra,
    numero_documento_interno = CONCAT('C001-', LPAD(id_compra, 6, '0'))
WHERE id_sucursal IS NULL;

CREATE INDEX idx_compras_sucursal_fecha ON compras(id_sucursal, fecha_compra);
CREATE INDEX idx_compras_bodega_fecha ON compras(id_bodega, fecha_compra);
CREATE INDEX idx_compras_documento_interno ON compras(numero_documento_interno);

-- ============================================================
-- 5. MODIFICAR TABLA PRODUCTOS
-- Se agregan marca, unidad de medida, código de barras y stock máximo.
-- ============================================================

ALTER TABLE productos
ADD COLUMN id_marca INT NULL AFTER id_subcategoria,
ADD COLUMN id_unidad_medida INT NULL AFTER id_marca,
ADD COLUMN codigo_barras VARCHAR(100) NULL AFTER codigo_producto,
ADD COLUMN stock_maximo INT NULL AFTER stock_minimo,
ADD COLUMN margen_minimo DECIMAL(5,2) DEFAULT 10.00 AFTER precio_venta,
ADD COLUMN margen_maximo DECIMAL(5,2) DEFAULT 60.00 AFTER margen_minimo;

ALTER TABLE productos
ADD CONSTRAINT fk_productos_marca
FOREIGN KEY (id_marca)
REFERENCES marcas(id_marca);

ALTER TABLE productos
ADD CONSTRAINT fk_productos_unidad_medida
FOREIGN KEY (id_unidad_medida)
REFERENCES unidades_medida(id_unidad_medida);

UPDATE productos
SET
    id_marca = @id_marca_generica,
    id_unidad_medida = @id_unidad_unidad,
    stock_maximo = 100,
    margen_minimo = 10.00,
    margen_maximo = 60.00
WHERE id_marca IS NULL
   OR id_unidad_medida IS NULL;

CREATE INDEX idx_productos_marca ON productos(id_marca);
CREATE INDEX idx_productos_unidad ON productos(id_unidad_medida);
CREATE INDEX idx_productos_codigo_barras ON productos(codigo_barras);

-- ============================================================
-- 6. MODIFICAR TABLA INVENTARIO_MOVIMIENTOS
-- Se agrega sucursal, bodega y turno relacionado.
-- ============================================================

ALTER TABLE inventario_movimientos
ADD COLUMN id_sucursal INT NULL AFTER id_usuario,
ADD COLUMN id_bodega INT NULL AFTER id_sucursal,
ADD COLUMN id_turno BIGINT NULL AFTER id_bodega;

ALTER TABLE inventario_movimientos
ADD CONSTRAINT fk_inv_mov_sucursal
FOREIGN KEY (id_sucursal)
REFERENCES sucursales(id_sucursal);

ALTER TABLE inventario_movimientos
ADD CONSTRAINT fk_inv_mov_bodega
FOREIGN KEY (id_bodega)
REFERENCES bodegas(id_bodega);

ALTER TABLE inventario_movimientos
ADD CONSTRAINT fk_inv_mov_turno
FOREIGN KEY (id_turno)
REFERENCES turnos_caja(id_turno);

UPDATE inventario_movimientos
SET
    id_sucursal = @id_sucursal_central,
    id_bodega = @id_bodega_principal
WHERE id_sucursal IS NULL;

CREATE INDEX idx_inv_mov_sucursal_fecha ON inventario_movimientos(id_sucursal, fecha_movimiento);
CREATE INDEX idx_inv_mov_bodega_fecha ON inventario_movimientos(id_bodega, fecha_movimiento);

-- ============================================================
-- 7. MODIFICAR TABLA AUDITORIA_HALLAZGOS
-- Se agrega relación opcional con ejecución del motor.
-- ============================================================

ALTER TABLE auditoria_hallazgos
ADD COLUMN id_ejecucion BIGINT NULL AFTER id_regla;

ALTER TABLE auditoria_hallazgos
ADD CONSTRAINT fk_hallazgos_ejecucion
FOREIGN KEY (id_ejecucion)
REFERENCES auditoria_ejecuciones(id_ejecucion);

CREATE INDEX idx_hallazgos_ejecucion ON auditoria_hallazgos(id_ejecucion);

-- ============================================================
-- 8. CREAR SALDOS INICIALES DE INVENTARIO
-- Genera saldos base por producto en Sucursal Central / Bodega Principal.
-- ============================================================

INSERT INTO inventario_saldos (
    id_producto,
    id_sucursal,
    id_bodega,
    stock_actual,
    stock_minimo,
    stock_maximo
)
SELECT
    p.id_producto,
    @id_sucursal_central,
    @id_bodega_principal,
    0,
    COALESCE(p.stock_minimo, 0),
    COALESCE(p.stock_maximo, 100)
FROM productos p
WHERE NOT EXISTS (
    SELECT 1
    FROM inventario_saldos s
    WHERE s.id_producto = p.id_producto
      AND s.id_sucursal = @id_sucursal_central
      AND s.id_bodega = @id_bodega_principal
);

-- ============================================================
-- 9. VALIDACIONES FINALES
-- ============================================================

SELECT 
    'Usuarios con sucursal' AS validacion,
    COUNT(*) AS total
FROM usuarios
WHERE id_sucursal IS NOT NULL;

SELECT 
    'Ventas con sucursal y caja' AS validacion,
    COUNT(*) AS total
FROM ventas
WHERE id_sucursal IS NOT NULL
  AND id_caja IS NOT NULL;

SELECT 
    'Compras con sucursal y bodega' AS validacion,
    COUNT(*) AS total
FROM compras
WHERE id_sucursal IS NOT NULL
  AND id_bodega IS NOT NULL;

SELECT 
    'Productos con marca y unidad' AS validacion,
    COUNT(*) AS total
FROM productos
WHERE id_marca IS NOT NULL
  AND id_unidad_medida IS NOT NULL;

SELECT 
    'Movimientos con sucursal y bodega' AS validacion,
    COUNT(*) AS total
FROM inventario_movimientos
WHERE id_sucursal IS NOT NULL
  AND id_bodega IS NOT NULL;

SELECT 
    'Saldos de inventario creados' AS validacion,
    COUNT(*) AS total
FROM inventario_saldos;