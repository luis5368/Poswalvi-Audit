USE poswalvi_db;

-- ============================================================
-- MEJORAS DE INTEGRIDAD EER V1.3
-- Fecha: 2026-10-09
-- Objetivo: reforzar integridad relacional antes de ventas/compras
-- ============================================================

-- Validación previa de NIT duplicado en clientes
SELECT nit, COUNT(*) AS total
FROM clientes
GROUP BY nit
HAVING COUNT(*) > 1;

-- NIT único en clientes
ALTER TABLE clientes
ADD UNIQUE INDEX uk_clientes_nit (nit);

-- Validación previa de código de barras duplicado
SELECT codigo_barras, COUNT(*) AS total
FROM productos
WHERE codigo_barras IS NOT NULL
GROUP BY codigo_barras
HAVING COUNT(*) > 1;

-- Código de barras único en productos
ALTER TABLE productos
ADD UNIQUE INDEX uk_productos_codigo_barras (codigo_barras);

-- Compras deben tener sucursal y bodega
ALTER TABLE compras
MODIFY id_sucursal INT NOT NULL,
MODIFY id_bodega INT NOT NULL;

-- Proveedor principal único activo por producto
ALTER TABLE producto_proveedor
ADD COLUMN proveedor_principal_activo INT
GENERATED ALWAYS AS (
  CASE
    WHEN proveedor_principal = 1 AND estado = 'Activo'
    THEN id_producto
    ELSE NULL
  END
) STORED;

CREATE UNIQUE INDEX uk_producto_proveedor_principal_activo
ON producto_proveedor (proveedor_principal_activo);

-- Token único por sesión
ALTER TABLE usuario_sesion
ADD UNIQUE INDEX uk_usuario_sesion_token_id (token_id);

-- Ventas deben estar asociadas a sucursal, caja y turno
ALTER TABLE ventas
MODIFY id_sucursal INT NOT NULL,
MODIFY id_caja INT NOT NULL,
MODIFY id_turno BIGINT NOT NULL;