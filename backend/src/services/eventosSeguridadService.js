const pool = require('../config/db');
const {normalizarIp} = require('../security/ipSeguridad');
const CONDICIONES = Object.freeze({
  LOGIN_FALLIDO_REPETIDO: 'usuarios.intentos_fallidos >= seguridad_politica_rol.max_intentos_fallidos',
  USUARIO_BLOQUEADO: 'usuarios.estado = Bloqueado',
  SESION_DUPLICADA: 'cantidad_sesiones_activas > max_sesiones_activas',
  ACCESO_MODULO_NO_AUTORIZADO: 'permiso_requerido_no_asignado',
  IP_NO_HABITUAL: 'ip_origen NOT IN usuario_ip_confiable',
  IP_BLOQUEADA: 'ip_origen IN seguridad_ip_lista_blacklist',
  INACTIVIDAD_EXCEDIDA: 'tiempo_inactividad > politica_rol.tiempo_inactividad_segundos'
});

// No ejecuta el texto libre de auditoria_reglas. Cada condición tiene un evaluador explícito.
const numero = n => Number.isSafeInteger(n) && n >= 0;
function reglasEvento(accion, e) {
  if (!e || e.version !== 1) return [];
  switch (accion) {
    case 'ACCESO_DENEGADO': return e.permisoAsignado === false ? ['ACCESO_MODULO_NO_AUTORIZADO'] : [];
    case 'BLOQUEO_USUARIO': return e.bloqueado === true && numero(e.intentos) && numero(e.maxIntentos) && e.maxIntentos > 0 && e.intentos >= e.maxIntentos ? ['LOGIN_FALLIDO_REPETIDO', 'USUARIO_BLOQUEADO'] : [];
    // Se evalúa el número de sesiones que resultaría de aceptar el intento, no un alias arbitrario.
    case 'SESION_DUPLICADA': return numero(e.sesionesActivas) && numero(e.maxSesiones) && e.maxSesiones > 0 && e.sesionesActivas + 1 > e.maxSesiones ? ['SESION_DUPLICADA'] : [];
    case 'INACTIVIDAD_EXCEDIDA': return numero(e.segundosInactivo) && numero(e.maxInactividad) && e.segundosInactivo > e.maxInactividad ? ['INACTIVIDAD_EXCEDIDA'] : [];
    case 'IP_BLOQUEADA': return e.blacklistActiva === true ? ['IP_BLOQUEADA'] : [];
    case 'IP_NO_HABITUAL': return e.ipConfiable === false ? ['IP_NO_HABITUAL'] : [];
    default: return [];
  }
}

function evidenciaSegura(e = {}) {
  const result = {version:1};
  for (const key of ['permisoAsignado','bloqueado','blacklistActiva','ipConfiable','loginExitoso','listaConfiableConfigurada','requiereIpConfiable']) if (typeof e[key] === 'boolean') result[key] = e[key];
  for (const key of ['intentos','maxIntentos','sesionesActivas','maxSesiones','segundosInactivo','maxInactividad','revisionIp']) if (numero(e[key])) result[key] = e[key];
  for (const key of ['moduloRequerido','accionRequerida']) if (typeof e[key] === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(e[key])) result[key] = e[key];
  if (typeof e.idSesion === 'string' && /^[1-9][0-9]{0,18}$/.test(e.idSesion)) result.idSesion=e.idSesion;
  return result;
}

function crearProcesador(db, informar = () => console.warn('SEGURIDAD_EVENTOS: procesamiento pendiente; revisar disponibilidad del servicio')) {
  let cursor = '0', ocupado = false, timer;
  async function procesar(id) {
    const cn = await db.getConnection();
    try {
      await cn.beginTransaction();
      // Un mismo evento se serializa incluso entre distintos procesos del servidor.
      const [[log]] = await cn.query("SELECT id_log,id_usuario,accion,descripcion,ip_origen,fecha_log FROM auditoria_logs_sistema WHERE id_log=? AND modulo='Seguridad' FOR UPDATE", [id]);
      if (!log) { await cn.rollback(); return {hallazgos:0}; }
      let evidencia;
      try { evidencia = JSON.parse(log.descripcion); } catch { evidencia = null; }
      const candidatos = reglasEvento(log.accion, evidencia);
      // La observacion se registra ANTES de consultar listas: tambien es recuperable.
      // Las listas son las vigentes al detectar, no una reconstruccion de listas historicas.
      if (log.accion === 'OBSERVACION_IP' && evidencia?.version === 1 && log.ip_origen) {
        if (evidencia.loginExitoso === false) {
          if (typeof evidencia.blacklistActiva !== 'boolean') {
            const [ips] = await cn.query("SELECT ip FROM seguridad_ip_lista WHERE tipo='Blacklist' AND estado='Activa' AND (expira_en IS NULL OR expira_en>NOW())", []);
            const origen = normalizarIp(log.ip_origen);
            if (!origen) throw new Error('IP_INVALIDA');
            evidencia.blacklistActiva = ips.some(row => normalizarIp(row.ip) === origen);
            await cn.query('UPDATE auditoria_logs_sistema SET descripcion=? WHERE id_log=?', [JSON.stringify(evidenciaSegura(evidencia)),log.id_log]);
          }
          if (evidencia.blacklistActiva) candidatos.push('IP_BLOQUEADA');
        } else if (evidencia.loginExitoso === true && log.id_usuario) {
          if (typeof evidencia.ipConfiable !== 'boolean') {
            const [ips] = await cn.query("SELECT ip FROM usuario_ip_confiable WHERE id_usuario=? AND estado='Activa'", [log.id_usuario]);
            const [[politica]] = await cn.query("SELECT p.requiere_ip_confiable FROM usuarios u LEFT JOIN seguridad_politica_rol p ON p.id_rol=u.id_rol AND p.estado='Activa' WHERE u.id_usuario=?", [log.id_usuario]);
            if (!politica || ![null,0,1].includes(politica.requiere_ip_confiable)) throw new Error('POLITICA_IP_INVALIDA');
            const origen = normalizarIp(log.ip_origen), normalizadas = ips.map(row => normalizarIp(row.ip));
            if (!origen || normalizadas.some(ip => !ip)) throw new Error('IP_INVALIDA');
            evidencia.revisionIp = 2;
            evidencia.listaConfiableConfigurada = normalizadas.length > 0;
            evidencia.requiereIpConfiable = politica.requiere_ip_confiable === 1;
            evidencia.ipConfiable = normalizadas.includes(origen);
            if (evidencia.requiereIpConfiable && !evidencia.listaConfiableConfigurada) informar();
            await cn.query('UPDATE auditoria_logs_sistema SET descripcion=? WHERE id_log=?', [JSON.stringify(evidenciaSegura(evidencia)),log.id_log]);
          }
          // Evidencias anteriores conservan su semantica; no se reclasifica el historial.
          if (!evidencia.ipConfiable && (evidencia.revisionIp !== 2 || evidencia.listaConfiableConfigurada === true)) candidatos.push('IP_NO_HABITUAL');
        }
      }
      let creados = 0;
      for (const codigo of candidatos) {
        const [[regla]] = await cn.query("SELECT id_regla,codigo_regla,nivel_riesgo,condicion FROM auditoria_reglas WHERE codigo_regla=? AND modulo='Seguridad' AND estado='Activa' FOR SHARE", [codigo]);
        if (!regla) continue;
        if (regla.condicion !== CONDICIONES[codigo]) throw new Error('CONDICION_NO_IMPLEMENTADA');
        const [existentes] = await cn.query("SELECT id_hallazgo FROM auditoria_hallazgos WHERE id_regla=? AND modulo_origen='Seguridad' AND referencia_id=? FOR UPDATE", [regla.id_regla,log.id_log]);
        if (existentes.length > 1) throw new Error('INTEGRIDAD_EVENTO');
        let idHallazgo = existentes[0]?.id_hallazgo;
        if (!idHallazgo) {
          const [r] = await cn.query("INSERT INTO auditoria_hallazgos (id_regla,modulo_origen,referencia_id,tipo_irregularidad,descripcion,nivel_riesgo,estado,id_usuario_relacionado,fecha_evento,fecha_deteccion) VALUES (?,'Seguridad',?,?,?,?, 'Pendiente',?,?,NOW())", [regla.id_regla,log.id_log,codigo,'Evento de seguridad verificado: '+codigo,regla.nivel_riesgo,log.id_usuario,log.fecha_log]);
          idHallazgo = r.insertId; creados++;
        }
        const [alertas] = await cn.query("SELECT id_alerta FROM auditoria_alertas WHERE id_hallazgo=? AND canal='Sistema' FOR UPDATE", [idHallazgo]);
        if (alertas.length > 1) throw new Error('INTEGRIDAD_ALERTA');
        if (!alertas.length) await cn.query("INSERT INTO auditoria_alertas (id_hallazgo,canal,mensaje,estado,fecha_generacion) VALUES (?,'Sistema',?,'Pendiente',NOW())", [idHallazgo,'Evento de seguridad: '+codigo]);
      }
      await cn.commit();
      return {hallazgos:creados};
    } catch (e) {
      try { await cn.rollback(); } catch { informar(); }
      throw e;
    } finally { cn.release(); }
  }
  async function registrarEnTransaccion(conexion, {idUsuario = null, accion, evidencia, ipOrigen = null}) {
    // Nunca serializar req, credenciales, JWT, user-agent ni descripciones libres.
    const permitidas = ['ACCESO_DENEGADO','BLOQUEO_USUARIO','SESION_DUPLICADA','INACTIVIDAD_EXCEDIDA','IP_BLOQUEADA','IP_NO_HABITUAL','LOGIN_EXITOSO','OBSERVACION_IP'];
    if (!permitidas.includes(accion)) throw new Error('EVENTO_NO_ADMITIDO');
    ipOrigen = normalizarIp(ipOrigen);
    const [r] = await conexion.query("INSERT INTO auditoria_logs_sistema (id_usuario,modulo,accion,descripcion,ip_origen,fecha_log) VALUES (?,'Seguridad',?,?,?,NOW())", [idUsuario,accion,JSON.stringify(evidenciaSegura(evidencia)),ipOrigen]);
    return r.insertId;
  }
  async function registrar(datos) {
    const {accion,evidencia}=datos;
    const id = await registrarEnTransaccion(db,datos);
    // El log está confirmado antes de procesar. Un fallo posterior no pierde el evento.
    if (accion === 'OBSERVACION_IP' || reglasEvento(accion, evidenciaSegura(evidencia)).length) {
      try { await procesar(id); } catch { informar(); }
    }
    return id;
  }
  async function recuperar() {
    if (ocupado) return;
    ocupado = true;
    try {
      const [logs] = await db.query("SELECT id_log FROM auditoria_logs_sistema WHERE modulo='Seguridad' AND id_log>? ORDER BY id_log LIMIT 100", [cursor]);
      if (!logs.length) cursor = '0';
      for (const log of logs) {
        try { await procesar(log.id_log); } catch { informar(); }
        cursor = String(log.id_log); // Un evento defectuoso no bloquea los posteriores; se reintenta en la siguiente vuelta.
      }
    } catch { informar(); } finally { ocupado = false; }
  }
  async function observarIp(idUsuario, ip, loginExitoso = false) {
    const normalizada = normalizarIp(ip);
    if (!normalizada) return;
    await registrar({idUsuario,accion:'OBSERVACION_IP',evidencia:{loginExitoso,revisionIp:2},ipOrigen:normalizada});
  }
  function iniciar() {
    if (timer) return;
    void recuperar();
    timer = setInterval(() => { void recuperar(); }, 30000);
    timer.unref?.();
  }
  function detener() { if (timer) clearInterval(timer); timer = null; }
  return {registrar,registrarEnTransaccion,procesar,recuperar,observarIp,iniciar,detener};
}
module.exports = {...crearProcesador(pool),crearProcesador,reglasEvento,evidenciaSegura,CONDICIONES};
