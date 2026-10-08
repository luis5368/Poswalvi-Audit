const pool = require('../config/db');
const { 
  ejecutarVentaBajoCosto,
  ejecutarStockNegativo,
  ejecutarAjusteSinMotivo,
  ejecutarCompraDuplicada,
  ejecutarPrecioProveedorAnormal,
  ejecutarAnulacionesFrecuentes,
  ejecutarMovimientoFueraHorario,
  ejecutarDiferenciaCaja,
  ejecutarTodasLasReglas
} = require('../services/auditoriaMotorService');

const obtenerReglasAuditoria = async (req, res) => {
  try {
    const [reglas] = await pool.query(`
      SELECT 
        id_regla,
        codigo_regla,
        nombre_regla,
        modulo,
        descripcion,
        nivel_riesgo,
        condicion,
        estado,
        creado_en,
        actualizado_en
      FROM auditoria_reglas
      ORDER BY id_regla ASC
    `);

    res.json({
      ok: true,
      total: reglas.length,
      data: reglas
    });
  } catch (error) {
    console.error('Error al obtener reglas de auditoría:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener reglas de auditoría'
    });
  }
};

const obtenerHallazgos = async (req, res) => {
  try {
    const [hallazgos] = await pool.query(`
      SELECT 
        h.id_hallazgo,
        h.tipo_irregularidad,
        h.modulo_origen,
        h.descripcion,
        h.nivel_riesgo,
        h.estado,
        h.fecha_evento,
        h.fecha_deteccion,
        TIMESTAMPDIFF(HOUR, h.fecha_evento, h.fecha_deteccion) AS tiempo_deteccion_horas,
        r.codigo_regla,
        r.nombre_regla
      FROM auditoria_hallazgos h
      INNER JOIN auditoria_reglas r ON h.id_regla = r.id_regla
      ORDER BY h.fecha_deteccion DESC
    `);

    res.json({
      ok: true,
      total: hallazgos.length,
      data: hallazgos
    });
  } catch (error) {
    console.error('Error al obtener hallazgos:', error);

    res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener hallazgos de auditoría'
    });
  }
};
const ejecutarReglaVentaBajoCosto = async (req, res) => {
  try {
    const resultado = await ejecutarVentaBajoCosto();

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaVentaBajoCosto:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de auditoría'
    });
  }
};

const obtenerEvidenciasPorHallazgo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'ID de hallazgo inválido'
      });
    }

    const [evidencias] = await pool.query(
      `SELECT 
          id_evidencia,
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
       FROM auditoria_evidencias
       WHERE id_hallazgo = ?
       ORDER BY id_evidencia ASC`,
      [id]
    );

    return res.json({
      ok: true,
      id_hallazgo: Number(id),
      total: evidencias.length,
      data: evidencias
    });

  } catch (error) {
    console.error('Error al obtener evidencias:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener evidencias del hallazgo'
    });
  }
};

const actualizarEstadoHallazgo = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, comentario_revision } = req.body;

    const estadosPermitidos = [
      'Pendiente',
      'En revision',
      'Confirmado',
      'Descartado',
      'Corregido'
    ];

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'ID de hallazgo inválido'
      });
    }

    if (!estado || !estadosPermitidos.includes(estado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Estado inválido. Use: Pendiente, En revision, Confirmado, Descartado o Corregido'
      });
    }

    const [hallazgos] = await pool.query(
      `SELECT id_hallazgo, estado
       FROM auditoria_hallazgos
       WHERE id_hallazgo = ?
       LIMIT 1`,
      [id]
    );

    if (hallazgos.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Hallazgo no encontrado'
      });
    }

    await pool.query(
      `UPDATE auditoria_hallazgos
       SET estado = ?,
           revisado_por = ?,
           fecha_revision = NOW(),
           comentario_revision = ?
       WHERE id_hallazgo = ?`,
      [
        estado,
        req.usuario.id_usuario,
        comentario_revision || null,
        id
      ]
    );

    await pool.query(
      `INSERT INTO auditoria_logs_sistema
       (id_usuario, modulo, accion, descripcion, ip_origen, user_agent, fecha_log)
       VALUES (?, 'Auditoria', 'ACTUALIZAR_ESTADO_HALLAZGO', ?, ?, ?, NOW())`,
      [
        req.usuario.id_usuario,
        `Actualizó el hallazgo ${id} al estado ${estado}`,
        req.ip || '0.0.0.0',
        req.headers['user-agent'] || 'No identificado'
      ]
    );

    return res.json({
      ok: true,
      mensaje: 'Estado del hallazgo actualizado correctamente',
      id_hallazgo: Number(id),
      estado
    });

  } catch (error) {
    console.error('Error al actualizar estado del hallazgo:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al actualizar estado del hallazgo'
    });
  }
};

const obtenerDetalleHallazgo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'ID de hallazgo inválido'
      });
    }

    const [hallazgos] = await pool.query(
      `SELECT 
          h.id_hallazgo,
          h.id_regla,
          r.codigo_regla,
          r.nombre_regla,
          r.modulo AS modulo_regla,
          r.descripcion AS descripcion_regla,
          h.modulo_origen,
          h.referencia_id,
          h.tipo_irregularidad,
          h.descripcion,
          h.nivel_riesgo,
          h.estado,
          h.fecha_evento,
          h.fecha_deteccion,
          TIMESTAMPDIFF(MINUTE, h.fecha_evento, h.fecha_deteccion) AS tiempo_deteccion_minutos,
          TIMESTAMPDIFF(HOUR, h.fecha_evento, h.fecha_deteccion) AS tiempo_deteccion_horas,
          h.id_usuario_relacionado,
          CONCAT(ur.nombre, ' ', ur.apellido) AS usuario_relacionado,
          ur.usuario AS usuario_relacionado_login,
          h.revisado_por,
          CONCAT(rv.nombre, ' ', rv.apellido) AS usuario_revisor,
          rv.usuario AS usuario_revisor_login,
          h.fecha_revision,
          h.comentario_revision
       FROM auditoria_hallazgos h
       INNER JOIN auditoria_reglas r ON h.id_regla = r.id_regla
       LEFT JOIN usuarios ur ON h.id_usuario_relacionado = ur.id_usuario
       LEFT JOIN usuarios rv ON h.revisado_por = rv.id_usuario
       WHERE h.id_hallazgo = ?
       LIMIT 1`,
      [id]
    );

    if (hallazgos.length === 0) {
      return res.status(404).json({
        ok: false,
        mensaje: 'Hallazgo no encontrado'
      });
    }

    const [evidencias] = await pool.query(
      `SELECT 
          id_evidencia,
          id_hallazgo,
          campo,
          valor_anterior,
          valor_actual,
          descripcion,
          creado_en
       FROM auditoria_evidencias
       WHERE id_hallazgo = ?
       ORDER BY id_evidencia ASC`,
      [id]
    );

    return res.json({
      ok: true,
      hallazgo: hallazgos[0],
      evidencias: {
        total: evidencias.length,
        data: evidencias
      }
    });

  } catch (error) {
    console.error('Error al obtener detalle del hallazgo:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener detalle del hallazgo'
    });
  }
};

const ejecutarReglaStockNegativo = async (req, res) => {
  try {
    const resultado = await ejecutarStockNegativo();

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaStockNegativo:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de stock negativo'
    });
  }
};

const ejecutarReglaAjusteSinMotivo = async (req, res) => {
  try {
    const resultado = await ejecutarAjusteSinMotivo();

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaAjusteSinMotivo:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de ajuste sin motivo'
    });
  }
};

const ejecutarReglaCompraDuplicada = async (req, res) => {
  try {
    const resultado = await ejecutarCompraDuplicada();

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaCompraDuplicada:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de compra duplicada'
    });
  }
};

const ejecutarReglaPrecioProveedorAnormal = async (req, res) => {
  try {
    const resultado = await ejecutarPrecioProveedorAnormal(req.usuario.id_usuario);

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaPrecioProveedorAnormal:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de precio proveedor anormal'
    });
  }
};

const ejecutarReglaAnulacionesFrecuentes = async (req, res) => {
  try {
    const resultado = await ejecutarAnulacionesFrecuentes();

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaAnulacionesFrecuentes:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de anulaciones frecuentes'
    });
  }
};

const ejecutarReglaMovimientoFueraHorario = async (req, res) => {
  try {
    const resultado = await ejecutarMovimientoFueraHorario();

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarReglaMovimientoFueraHorario:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando regla de movimiento fuera de horario'
    });
  }
};

// ============================================================
// POST /api/auditoria/ejecutar/diferencia-caja
// Ejecutar regla DIFERENCIA_CAJA
// ============================================================
const ejecutarReglaDiferenciaCaja = async (req, res) => {
  try {
    const resultado = await ejecutarDiferenciaCaja();

    return res.json(resultado);
  } catch (error) {
    console.error('Error al ejecutar regla DIFERENCIA_CAJA:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al ejecutar regla DIFERENCIA_CAJA'
    });
  }
};

const ejecutarMotorCompleto = async (req, res) => {
  try {
    const resultado = await ejecutarTodasLasReglas(req.usuario.id_usuario);

    return res.json(resultado);

  } catch (error) {
    console.error('Error en ejecutarMotorCompleto:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno ejecutando motor completo de auditoría'
    });
  }
};

const obtenerResumenDashboard = async (req, res) => {
  try {
    const [totalHallazgos] = await pool.query(`
      SELECT COUNT(*) AS total
      FROM auditoria_hallazgos
    `);

    const [porEstado] = await pool.query(`
      SELECT 
        estado,
        COUNT(*) AS total
      FROM auditoria_hallazgos
      GROUP BY estado
      ORDER BY total DESC
    `);

    const [porRiesgo] = await pool.query(`
      SELECT 
        nivel_riesgo,
        COUNT(*) AS total
      FROM auditoria_hallazgos
      GROUP BY nivel_riesgo
      ORDER BY 
        CASE nivel_riesgo
          WHEN 'Alto' THEN 1
          WHEN 'Medio' THEN 2
          WHEN 'Bajo' THEN 3
          ELSE 4
        END
    `);

    const [porRegla] = await pool.query(`
      SELECT 
        r.codigo_regla,
        r.nombre_regla,
        h.modulo_origen,
        COUNT(*) AS total
      FROM auditoria_hallazgos h
      INNER JOIN auditoria_reglas r ON h.id_regla = r.id_regla
      GROUP BY r.codigo_regla, r.nombre_regla, h.modulo_origen
      ORDER BY total DESC
    `);

    const [ultimosHallazgos] = await pool.query(`
      SELECT 
        h.id_hallazgo,
        h.tipo_irregularidad,
        h.modulo_origen,
        h.nivel_riesgo,
        h.estado,
        h.fecha_evento,
        h.fecha_deteccion,
        TIMESTAMPDIFF(MINUTE, h.fecha_evento, h.fecha_deteccion) AS tiempo_deteccion_minutos,
        r.nombre_regla
      FROM auditoria_hallazgos h
      INNER JOIN auditoria_reglas r ON h.id_regla = r.id_regla
      ORDER BY h.fecha_deteccion DESC
      LIMIT 10
    `);

    return res.json({
      ok: true,
      resumen: {
        total_hallazgos: totalHallazgos[0].total,
        por_estado: porEstado,
        por_riesgo: porRiesgo,
        por_regla: porRegla,
        ultimos_hallazgos: ultimosHallazgos
      }
    });

  } catch (error) {
    console.error('Error al obtener resumen de auditoría:', error);

    return res.status(500).json({
      ok: false,
      mensaje: 'Error interno al obtener resumen de auditoría'
    });
  }
};

module.exports = {
  obtenerReglasAuditoria,
  obtenerHallazgos,
  ejecutarReglaVentaBajoCosto,
  obtenerEvidenciasPorHallazgo,
  actualizarEstadoHallazgo,
  obtenerDetalleHallazgo,
  ejecutarReglaStockNegativo,
  ejecutarReglaAjusteSinMotivo,
  ejecutarReglaCompraDuplicada,
  ejecutarReglaPrecioProveedorAnormal,
  ejecutarReglaAnulacionesFrecuentes,
  ejecutarReglaMovimientoFueraHorario,
  ejecutarReglaDiferenciaCaja,
  ejecutarMotorCompleto,
  obtenerResumenDashboard
};