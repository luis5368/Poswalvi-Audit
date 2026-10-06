USE poswalvi_db;

-- ============================================================
-- POSWALVI V1.3
-- ASIGNACIÓN DE PERMISOS A ROLES REALES DEL SISTEMA
-- Roles reales:
-- Administrador, Superusuario, Auditor, Cajero,
-- Comprador Recepcionista, Consulta tienda
-- ============================================================

-- ============================================================
-- CONSULTA TIENDA: solo lectura
-- ============================================================

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p
WHERE r.nombre_rol = 'Consulta tienda'
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
-- AUDITOR: consulta + ejecución de auditoría
-- ============================================================

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p
WHERE r.nombre_rol = 'Auditor'
  AND (
        (p.modulo = 'AuditoriaEjecuciones' AND p.accion IN ('Consultar', 'Ejecutar'))
        OR (p.modulo = 'InventarioSaldos' AND p.accion = 'Consultar')
        OR (p.modulo = 'Reportes' AND p.accion IN ('Consultar', 'Exportar'))
        OR (p.modulo = 'Sucursales' AND p.accion = 'Consultar')
        OR (p.modulo = 'Cajas' AND p.accion = 'Consultar')
        OR (p.modulo = 'TurnosCaja' AND p.accion = 'Consultar')
        OR (p.modulo = 'MetodosPago' AND p.accion = 'Consultar')
        OR (p.modulo = 'Bodegas' AND p.accion = 'Consultar')
        OR (p.modulo = 'DocumentoCorrelativos' AND p.accion = 'Consultar')
        OR (p.modulo = 'ConfiguracionEmpresa' AND p.accion = 'Consultar')
      )
  AND NOT EXISTS (
      SELECT 1
      FROM rol_permiso rp
      WHERE rp.id_rol = r.id_rol
        AND rp.id_permiso = p.id_permiso
  );

-- ============================================================
-- COMPRADOR RECEPCIONISTA: compras, recepción e inventario
-- ============================================================

INSERT INTO rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM roles r
INNER JOIN permisos p
WHERE r.nombre_rol = 'Comprador Recepcionista'
  AND (
        (p.modulo = 'Sucursales' AND p.accion = 'Consultar')
        OR (p.modulo = 'Bodegas' AND p.accion = 'Consultar')
        OR (p.modulo = 'InventarioSaldos' AND p.accion = 'Consultar')
        OR (p.modulo = 'Marcas' AND p.accion = 'Consultar')
        OR (p.modulo = 'UnidadesMedida' AND p.accion = 'Consultar')
        OR (p.modulo = 'MetodosPago' AND p.accion = 'Consultar')
        OR (p.modulo = 'Reportes' AND p.accion = 'Consultar')
      )
  AND NOT EXISTS (
      SELECT 1
      FROM rol_permiso rp
      WHERE rp.id_rol = r.id_rol
        AND rp.id_permiso = p.id_permiso
  );

-- ============================================================
-- VALIDACIÓN FINAL
-- ============================================================

SELECT
    r.nombre_rol,
    p.modulo,
    p.accion
FROM rol_permiso rp
INNER JOIN roles r ON rp.id_rol = r.id_rol
INNER JOIN permisos p ON rp.id_permiso = p.id_permiso
WHERE r.nombre_rol IN (
    'Administrador',
    'Superusuario',
    'Auditor',
    'Cajero',
    'Comprador Recepcionista',
    'Consulta tienda'
)
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
ORDER BY r.nombre_rol, p.modulo, p.accion;