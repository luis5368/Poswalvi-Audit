USE poswalvi_db;

INSERT INTO auditoria_reglas (
    codigo_regla,
    nombre_regla,
    modulo,
    descripcion,
    nivel_riesgo,
    condicion,
    estado,
    creado_en,
    actualizado_en
)
VALUES
(
    'VENTA_BAJO_COSTO',
    'Venta por debajo del costo',
    'Ventas',
    'Detecta ventas donde el precio unitario sea menor que el costo unitario del producto.',
    'Alto',
    'venta_detalle.precio_unitario < venta_detalle.costo_unitario',
    'Activa',
    NOW(),
    NOW()
),
(
    'ANULACIONES_FRECUENTES',
    'Anulaciones frecuentes por usuario',
    'Ventas',
    'Detecta usuarios con número elevado de anulaciones en un período corto.',
    'Medio',
    'cantidad_anulaciones_usuario >= 3 en 24 horas',
    'Activa',
    NOW(),
    NOW()
),
(
    'STOCK_NEGATIVO',
    'Producto con stock negativo',
    'Inventario',
    'Detecta productos cuyo stock final queda menor a cero.',
    'Alto',
    'inventario_movimientos.stock_nuevo < 0',
    'Activa',
    NOW(),
    NOW()
),
(
    'AJUSTE_SIN_MOTIVO',
    'Ajuste manual sin justificación',
    'Inventario',
    'Detecta ajustes de inventario realizados sin motivo documentado.',
    'Medio',
    'tipo_movimiento = Ajuste AND motivo IS NULL',
    'Activa',
    NOW(),
    NOW()
),
(
    'COMPRA_DUPLICADA',
    'Posible compra duplicada',
    'Compras',
    'Detecta compras repetidas con mismo proveedor, factura y monto.',
    'Medio',
    'mismo_proveedor_factura_monto',
    'Activa',
    NOW(),
    NOW()
),
(
    'PRECIO_PROVEEDOR_ANORMAL',
    'Precio de proveedor fuera del promedio',
    'Proveedores',
    'Detecta productos cuyo precio de compra sea superior al promedio histórico configurado.',
    'Alto',
    'precio_compra > promedio_referencia * 1.30',
    'Activa',
    NOW(),
    NOW()
),
(
    'MOVIMIENTO_FUERA_HORARIO',
    'Movimiento fuera de horario habitual',
    'Usuarios',
    'Detecta ventas, compras o ajustes realizados fuera del horario normal de operación.',
    'Medio',
    'hora_movimiento NOT BETWEEN 07:00:00 AND 22:00:00',
    'Activa',
    NOW(),
    NOW()
),
(
    'LOGIN_FALLIDO_REPETIDO',
    'Intentos fallidos repetidos',
    'Seguridad',
    'Detecta cuando un usuario supera el máximo de intentos fallidos permitidos.',
    'Alto',
    'usuarios.intentos_fallidos >= seguridad_politica_rol.max_intentos_fallidos',
    'Activa',
    NOW(),
    NOW()
),
(
    'USUARIO_BLOQUEADO',
    'Usuario bloqueado por seguridad',
    'Seguridad',
    'Detecta usuarios bloqueados por intentos fallidos o política de seguridad.',
    'Alto',
    'usuarios.estado = Bloqueado',
    'Activa',
    NOW(),
    NOW()
),
(
    'SESION_DUPLICADA',
    'Sesión duplicada de usuario',
    'Seguridad',
    'Detecta cuando un mismo usuario intenta abrir más sesiones de las permitidas.',
    'Medio',
    'cantidad_sesiones_activas > max_sesiones_activas',
    'Activa',
    NOW(),
    NOW()
),
(
    'ACCESO_MODULO_NO_AUTORIZADO',
    'Acceso a módulo no autorizado',
    'Seguridad',
    'Detecta intentos de acceso a módulos sin permiso asignado.',
    'Alto',
    'permiso_requerido_no_asignado',
    'Activa',
    NOW(),
    NOW()
),
(
    'IP_NO_HABITUAL',
    'Acceso desde IP no habitual',
    'Seguridad',
    'Detecta accesos realizados desde direcciones IP no registradas como confiables.',
    'Medio',
    'ip_origen NOT IN usuario_ip_confiable',
    'Activa',
    NOW(),
    NOW()
),
(
    'IP_BLOQUEADA',
    'Intento de acceso desde IP bloqueada',
    'Seguridad',
    'Detecta intentos de acceso desde direcciones registradas en blacklist.',
    'Alto',
    'ip_origen IN seguridad_ip_lista_blacklist',
    'Activa',
    NOW(),
    NOW()
),
(
    'INACTIVIDAD_EXCEDIDA',
    'Sesión expirada por inactividad',
    'Seguridad',
    'Detecta sesiones que exceden el tiempo máximo de inactividad permitido.',
    'Medio',
    'tiempo_inactividad > politica_rol.tiempo_inactividad_segundos',
    'Activa',
    NOW(),
    NOW()
),
(
    'ACCION_SUPERUSUARIO',
    'Acción crítica de superusuario',
    'Seguridad',
    'Registra acciones críticas realizadas por el usuario técnico o superusuario.',
    'Alto',
    'rol = Superusuario AND accion_critica = true',
    'Activa',
    NOW(),
    NOW()
)
ON DUPLICATE KEY UPDATE
    nombre_regla = VALUES(nombre_regla),
    modulo = VALUES(modulo),
    descripcion = VALUES(descripcion),
    nivel_riesgo = VALUES(nivel_riesgo),
    condicion = VALUES(condicion),
    estado = VALUES(estado),
    actualizado_en = NOW();