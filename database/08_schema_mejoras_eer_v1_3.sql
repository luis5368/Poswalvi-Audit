USE poswalvi_db;

-- ============================================================
-- POSWALVI EER V1.3
-- Mejoras aprobadas:
-- Sucursales, cajas, turnos, pagos, inventario saldos,
-- auditoría de ejecuciones, historial de revisión,
-- configuración Guatemala, correlativos y reportes.
-- ============================================================

-- ============================================================
-- 1. CONFIGURACIÓN DE EMPRESA
-- Contexto Guatemala: NIT, IVA, moneda Q
-- ============================================================

CREATE TABLE IF NOT EXISTS empresa_configuracion (
    id_empresa INT AUTO_INCREMENT PRIMARY KEY,
    nombre_comercial VARCHAR(150) NOT NULL,
    razon_social VARCHAR(150),
    nit VARCHAR(20) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    correo VARCHAR(120),
    moneda VARCHAR(10) DEFAULT 'Q',
    porcentaje_iva DECIMAL(5,2) DEFAULT 12.00,
    pais VARCHAR(80) DEFAULT 'Guatemala',
    estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. SUCURSALES
-- ============================================================

CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal INT AUTO_INCREMENT PRIMARY KEY,
    nombre_sucursal VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    responsable VARCHAR(100),
    estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. CAJAS
-- ============================================================

CREATE TABLE IF NOT EXISTS cajas (
    id_caja INT AUTO_INCREMENT PRIMARY KEY,
    id_sucursal INT NOT NULL,
    nombre_caja VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_cajas_sucursal
        FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal)
);

-- ============================================================
-- 4. TURNOS DE CAJA
-- ============================================================

CREATE TABLE IF NOT EXISTS turnos_caja (
    id_turno BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_caja INT NOT NULL,
    id_usuario INT NOT NULL,
    fecha_apertura DATETIME NOT NULL,
    fecha_cierre DATETIME NULL,
    monto_apertura DECIMAL(10,2) DEFAULT 0.00,
    monto_cierre_sistema DECIMAL(10,2) DEFAULT 0.00,
    monto_cierre_fisico DECIMAL(10,2) DEFAULT 0.00,
    diferencia DECIMAL(10,2) DEFAULT 0.00,
    estado ENUM('Abierto', 'Cerrado') DEFAULT 'Abierto',
    observaciones TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_turnos_caja
        FOREIGN KEY (id_caja)
        REFERENCES cajas(id_caja),

    CONSTRAINT fk_turnos_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);

-- ============================================================
-- 5. MÉTODOS DE PAGO
-- ============================================================

CREATE TABLE IF NOT EXISTS metodos_pago (
    id_metodo_pago INT AUTO_INCREMENT PRIMARY KEY,
    nombre_metodo VARCHAR(50) NOT NULL,
    descripcion VARCHAR(150),
    requiere_referencia TINYINT(1) DEFAULT 0,
    estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. PAGOS DE VENTA
-- Permite pagos mixtos: efectivo + tarjeta + transferencia
-- ============================================================

CREATE TABLE IF NOT EXISTS venta_pagos (
    id_venta_pago BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_venta BIGINT NOT NULL,
    id_metodo_pago INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    referencia VARCHAR(100),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_venta_pagos_venta
        FOREIGN KEY (id_venta)
        REFERENCES ventas(id_venta),

    CONSTRAINT fk_venta_pagos_metodo
        FOREIGN KEY (id_metodo_pago)
        REFERENCES metodos_pago(id_metodo_pago)
);

-- ============================================================
-- 7. MARCAS
-- ============================================================

CREATE TABLE IF NOT EXISTS marcas (
    id_marca INT AUTO_INCREMENT PRIMARY KEY,
    nombre_marca VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. UNIDADES DE MEDIDA
-- ============================================================

CREATE TABLE IF NOT EXISTS unidades_medida (
    id_unidad_medida INT AUTO_INCREMENT PRIMARY KEY,
    nombre_unidad VARCHAR(80) NOT NULL,
    abreviatura VARCHAR(20) NOT NULL,
    estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. BODEGAS
-- ============================================================

CREATE TABLE IF NOT EXISTS bodegas (
    id_bodega INT AUTO_INCREMENT PRIMARY KEY,
    id_sucursal INT NOT NULL,
    nombre_bodega VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    estado ENUM('Activa', 'Inactiva') DEFAULT 'Activa',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bodegas_sucursal
        FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal)
);

-- ============================================================
-- 10. INVENTARIO SALDOS
-- Consulta rápida para dashboard e inventario
-- ============================================================

CREATE TABLE IF NOT EXISTS inventario_saldos (
    id_saldo BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    id_sucursal INT NOT NULL,
    id_bodega INT NULL,
    stock_actual INT NOT NULL DEFAULT 0,
    stock_minimo INT NOT NULL DEFAULT 0,
    stock_maximo INT NULL,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_saldos_producto
        FOREIGN KEY (id_producto)
        REFERENCES productos(id_producto),

    CONSTRAINT fk_saldos_sucursal
        FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal),

    CONSTRAINT fk_saldos_bodega
        FOREIGN KEY (id_bodega)
        REFERENCES bodegas(id_bodega),

    UNIQUE KEY uk_producto_sucursal_bodega (
        id_producto,
        id_sucursal,
        id_bodega
    )
);

-- ============================================================
-- 11. CORRELATIVOS DE DOCUMENTOS
-- No es integración FEL. Es control interno de documentos.
-- ============================================================

CREATE TABLE IF NOT EXISTS documento_correlativos (
    id_correlativo INT AUTO_INCREMENT PRIMARY KEY,
    id_sucursal INT NOT NULL,
    tipo_documento ENUM('Venta', 'Compra', 'NotaCredito', 'AjusteInventario') NOT NULL,
    serie VARCHAR(20) NOT NULL,
    correlativo_actual BIGINT NOT NULL DEFAULT 0,
    prefijo VARCHAR(20),
    estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_correlativos_sucursal
        FOREIGN KEY (id_sucursal)
        REFERENCES sucursales(id_sucursal),

    UNIQUE KEY uk_correlativo_sucursal_tipo_serie (
        id_sucursal,
        tipo_documento,
        serie
    )
);

-- ============================================================
-- 12. EJECUCIONES DEL MOTOR DE AUDITORÍA
-- Sirve para medir ejecución y trazabilidad del motor
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria_ejecuciones (
    id_ejecucion BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NULL,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NULL,
    total_reglas_ejecutadas INT DEFAULT 0,
    total_hallazgos_generados INT DEFAULT 0,
    estado ENUM('Iniciada', 'Finalizada', 'Error') DEFAULT 'Iniciada',
    mensaje TEXT,

    CONSTRAINT fk_auditoria_ejecuciones_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);

-- ============================================================
-- 13. HISTORIAL DE REVISIÓN DE HALLAZGOS
-- ============================================================

CREATE TABLE IF NOT EXISTS auditoria_revision_historial (
    id_revision BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_hallazgo BIGINT NOT NULL,
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50) NOT NULL,
    comentario TEXT,
    revisado_por INT NOT NULL,
    fecha_revision DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_revision_hallazgo
        FOREIGN KEY (id_hallazgo)
        REFERENCES auditoria_hallazgos(id_hallazgo),

    CONSTRAINT fk_revision_usuario
        FOREIGN KEY (revisado_por)
        REFERENCES usuarios(id_usuario)
);

-- ============================================================
-- 14. REPORTES GUARDADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS reportes_guardados (
    id_reporte BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    nombre_reporte VARCHAR(150) NOT NULL,
    modulo VARCHAR(80) NOT NULL,
    filtros_json JSON NULL,
    descripcion VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_reportes_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuarios(id_usuario)
);