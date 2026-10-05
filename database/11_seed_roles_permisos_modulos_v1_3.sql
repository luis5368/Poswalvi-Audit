USE poswalvi_db;

-- ============================================================
-- POSWALVI V1.3
-- SEED DE PERMISOS PARA NUEVOS MÓDULOS
-- ============================================================

-- ============================================================
-- 1. PERMISOS NUEVOS
-- ============================================================

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Sucursales', 'Consultar', 'Consultar sucursales'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Sucursales' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Sucursales', 'Crear', 'Crear sucursales'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Sucursales' AND accion = 'Crear'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Sucursales', 'Editar', 'Editar sucursales'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Sucursales' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Cajas', 'Consultar', 'Consultar cajas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Cajas' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Cajas', 'Crear', 'Crear cajas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Cajas' AND accion = 'Crear'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Cajas', 'Editar', 'Editar cajas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Cajas' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'TurnosCaja', 'Consultar', 'Consultar turnos de caja'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'TurnosCaja' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'TurnosCaja', 'Aperturar', 'Aperturar turno de caja'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'TurnosCaja' AND accion = 'Aperturar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'TurnosCaja', 'Cerrar', 'Cerrar turno de caja'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'TurnosCaja' AND accion = 'Cerrar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'TurnosCaja', 'Editar', 'Editar observaciones de turno de caja'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'TurnosCaja' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'MetodosPago', 'Consultar', 'Consultar métodos de pago'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'MetodosPago' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'MetodosPago', 'Crear', 'Crear métodos de pago'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'MetodosPago' AND accion = 'Crear'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'MetodosPago', 'Editar', 'Editar métodos de pago'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'MetodosPago' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'InventarioSaldos', 'Consultar', 'Consultar saldos de inventario'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'InventarioSaldos' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'InventarioSaldos', 'Ajustar', 'Realizar ajustes sobre saldos de inventario'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'InventarioSaldos' AND accion = 'Ajustar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'AuditoriaEjecuciones', 'Consultar', 'Consultar ejecuciones del motor de auditoría'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'AuditoriaEjecuciones' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'AuditoriaEjecuciones', 'Ejecutar', 'Ejecutar motor de auditoría continua'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'AuditoriaEjecuciones' AND accion = 'Ejecutar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Reportes', 'Consultar', 'Consultar reportes'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Reportes' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Reportes', 'Exportar', 'Exportar reportes'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Reportes' AND accion = 'Exportar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'ConfiguracionEmpresa', 'Consultar', 'Consultar configuración de empresa'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'ConfiguracionEmpresa' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'ConfiguracionEmpresa', 'Editar', 'Editar configuración de empresa'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'ConfiguracionEmpresa' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'DocumentoCorrelativos', 'Consultar', 'Consultar correlativos de documentos'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'DocumentoCorrelativos' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'DocumentoCorrelativos', 'Editar', 'Editar correlativos de documentos'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'DocumentoCorrelativos' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Bodegas', 'Consultar', 'Consultar bodegas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Bodegas' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Bodegas', 'Crear', 'Crear bodegas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Bodegas' AND accion = 'Crear'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Bodegas', 'Editar', 'Editar bodegas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Bodegas' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Marcas', 'Consultar', 'Consultar marcas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Marcas' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Marcas', 'Crear', 'Crear marcas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Marcas' AND accion = 'Crear'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'Marcas', 'Editar', 'Editar marcas'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'Marcas' AND accion = 'Editar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'UnidadesMedida', 'Consultar', 'Consultar unidades de medida'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'UnidadesMedida' AND accion = 'Consultar'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'UnidadesMedida', 'Crear', 'Crear unidades de medida'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'UnidadesMedida' AND accion = 'Crear'
);

INSERT INTO permisos (modulo, accion, descripcion)
SELECT 'UnidadesMedida', 'Editar', 'Editar unidades de medida'
WHERE NOT EXISTS (
    SELECT 1 FROM permisos WHERE modulo = 'UnidadesMedida' AND accion = 'Editar'
);

-- ============================================================
-- 2. ASIGNAR PERMISOS A ADMINISTRADOR Y SUPERUSUARIO
-- ============================================================

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p
WHERE r.nombre_rol IN ('Administrador', 'Superusuario')
  AND p.modulo IN (
      'Sucursales',
      'Cajas',
      'TurnosCaja',
      'MetodosPago',
      'InventarioSaldos',
      'AuditoriaEjecuciones',
      'Reportes',
      'ConfiguracionEmpresa',
      'DocumentoCorrelativos',
      'Bodegas',
      'Marcas',
      'UnidadesMedida'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM rol_permiso rp
      WHERE rp.id_rol = r.id_rol
        AND rp.id_permiso = p.id_permiso
  );

-- ============================================================
-- 3. ASIGNAR PERMISOS OPERATIVOS A CAJERO
-- ============================================================

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p
WHERE r.nombre_rol = 'Cajero'
  AND (
        (p.modulo = 'TurnosCaja' AND p.accion IN ('Consultar', 'Aperturar', 'Cerrar'))
        OR (p.modulo = 'InventarioSaldos' AND p.accion = 'Consultar')
        OR (p.modulo = 'MetodosPago' AND p.accion = 'Consultar')
      )
  AND NOT EXISTS (
      SELECT 1
      FROM rol_permiso rp
      WHERE rp.id_rol = r.id_rol
        AND rp.id_permiso = p.id_permiso
  );

-- ============================================================
-- 4. ASIGNAR PERMISOS DE CONSULTA A ROL CONSULTA
-- ============================================================

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p
WHERE r.nombre_rol = 'Consulta'
  AND p.accion = 'Consultar'
  AND p.modulo IN (
      'Sucursales',
      'Cajas',
      'TurnosCaja',
      'MetodosPago',
      'InventarioSaldos',
      'AuditoriaEjecuciones',
      'Reportes',
      'ConfiguracionEmpresa',
      'DocumentoCorrelativos',
      'Bodegas',
      'Marcas',
      'UnidadesMedida'
  )
  AND NOT EXISTS (
      SELECT 1
      FROM rol_permiso rp
      WHERE rp.id_rol = r.id_rol
        AND rp.id_permiso = p.id_permiso
  );

-- ============================================================
-- 5. VALIDACIÓN FINAL
-- ============================================================

SELECT 
    p.modulo,
    p.accion,
    p.descripcion
FROM permisos p
WHERE p.modulo IN (
    'Sucursales',
    'Cajas',
    'TurnosCaja',
    'MetodosPago',
    'InventarioSaldos',
    'AuditoriaEjecuciones',
    'Reportes',
    'ConfiguracionEmpresa',
    'DocumentoCorrelativos',
    'Bodegas',
    'Marcas',
    'UnidadesMedida'
)
ORDER BY p.modulo, p.accion;

SELECT
    r.nombre_rol,
    p.modulo,
    p.accion
FROM rol_permiso rp
INNER JOIN roles r ON rp.id_rol = r.id_rol
INNER JOIN permisos p ON rp.id_permiso = p.id_permiso
WHERE p.modulo IN (
    'Sucursales',
    'Cajas',
    'TurnosCaja',
    'MetodosPago',
    'InventarioSaldos',
    'AuditoriaEjecuciones',
    'Reportes',
    'ConfiguracionEmpresa',
    'DocumentoCorrelativos',
    'Bodegas',
    'Marcas',
    'UnidadesMedida'
)
ORDER BY r.nombre_rol, p.modulo, p.accion;