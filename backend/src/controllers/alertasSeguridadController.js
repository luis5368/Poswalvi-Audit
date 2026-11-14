const pool = require('../config/db');
const s = require('../security/pg2');
const ESTADOS = ['Pendiente','Enviada','Leida','Fallida'];
const RIESGOS = ['Bajo','Medio','Alto','Critico'];
const BASE = ` FROM auditoria_alertas a
 JOIN auditoria_hallazgos h ON h.id_hallazgo=a.id_hallazgo
 JOIN auditoria_reglas r ON r.id_regla=h.id_regla
 WHERE h.modulo_origen='Seguridad' AND r.modulo='Seguridad'`;
const CAMPOS = `CAST(a.id_alerta AS CHAR) AS id_alerta,CAST(h.id_hallazgo AS CHAR) AS id_hallazgo,
 r.codigo_regla,h.nivel_riesgo,a.estado,a.canal,h.fecha_evento,h.fecha_deteccion,
 a.fecha_generacion,a.fecha_lectura`;
function parametros(q) {
  if (Object.keys(q).some(k=>!['pagina','limite','desde','hasta','estado','regla','riesgo'].includes(k))) throw s.error(400,'Filtro no admitido');
  const entero=(v,d,max)=>{if(v===undefined)return d;if(typeof v!=='string'||!/^\d+$/.test(v)||Number(v)<1||Number(v)>max)throw s.error(400,'Paginacion invalida');return Number(v);};
  const pagina=entero(q.pagina,1,100000),limite=entero(q.limite,25,100),args=[],cond=[];
  for(const k of ['desde','hasta'])if(q[k]!==undefined){
    const v=q[k];if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||v<'1000-01-01'||v>'9998-12-31'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw s.error(400,'Fecha invalida');
    cond.push(k==='desde'?'a.fecha_generacion>=?':'a.fecha_generacion<DATE_ADD(?,INTERVAL 1 DAY)');args.push(v);
  }
  if(q.desde&&q.hasta&&q.desde>q.hasta)throw s.error(400,'Intervalo invertido');
  for(const [k,col,values] of [['estado','a.estado',ESTADOS],['riesgo','h.nivel_riesgo',RIESGOS]])if(q[k]!==undefined){if(!values.includes(q[k]))throw s.error(400,'Filtro invalido');cond.push(col+'=?');args.push(q[k]);}
  if(q.regla!==undefined){if(typeof q.regla!=='string'||! /^[A-Z][A-Z0-9_]{0,99}$/.test(q.regla))throw s.error(400,'Regla invalida');cond.push('r.codigo_regla=?');args.push(q.regla);}
  return {pagina,limite,args,where:cond.length?' AND '+cond.join(' AND '):''};
}
function dto(row) {
  const out={};
  for(const key of ['id_alerta','id_hallazgo','codigo_regla','nivel_riesgo','estado','canal','fecha_evento','fecha_deteccion','fecha_generacion','fecha_lectura'])out[key]=row[key];
  // No publicar texto libre de logs, mensajes o evidencia historica.
  out.descripcion='Evento de seguridad detectado por la regla '+row.codigo_regla;
  return out;
}
async function autorizar(req,db=pool,accion='Consultar') { await s.exigir(req,'AlertasSeguridad',accion,db); }
exports.listar=async(req,res)=>{
  res.set('Cache-Control','no-store');
  try {
    const p=parametros(req.query);await autorizar(req);
    const [rows]=await pool.query('SELECT '+CAMPOS+BASE+p.where+' ORDER BY a.fecha_generacion DESC,a.id_alerta DESC LIMIT ? OFFSET ?',[...p.args,p.limite,(p.pagina-1)*p.limite]);
    const [[indicadores]]=await pool.query(`SELECT COUNT(*) AS total,
      COALESCE(SUM(a.estado='Pendiente'),0) AS pendientes,COALESCE(SUM(a.estado='Leida'),0) AS leidas,
      COALESCE(SUM(h.nivel_riesgo IN ('Alto','Critico')),0) AS riesgo_alto,
      AVG(CASE WHEN a.fecha_generacion>=h.fecha_evento AND a.fecha_generacion<=NOW()
        THEN TIMESTAMPDIFF(SECOND,h.fecha_evento,a.fecha_generacion) END) AS promedio_generacion_segundos`+BASE+p.where,p.args);
    res.json({ok:true,pagina:p.pagina,limite:p.limite,indicadores,data:rows.map(dto)});
  } catch(e){s.responder(res,e);}
};
exports.detalle=async(req,res)=>{
  res.set('Cache-Control','no-store');
  try {
    s.id(req.params.id);if(Object.keys(req.query).length)throw s.error(400,'Parametros no admitidos');await autorizar(req);
    const [[row]]=await pool.query('SELECT '+CAMPOS+',CAST(h.referencia_id AS CHAR) AS referencia_id'+BASE+' AND a.id_alerta=?',[req.params.id]);
    if(!row)throw s.error(404,'Alerta no disponible');
    const [[log]]=await pool.query("SELECT CAST(id_log AS CHAR) AS id_log,fecha_log FROM auditoria_logs_sistema WHERE id_log=? AND modulo='Seguridad'",[row.referencia_id]);
    res.json({ok:true,alerta:dto(row),trazabilidad:{id_hallazgo:row.id_hallazgo,log:log?{id_log:log.id_log,fecha_log:log.fecha_log}:null}});
  } catch(e){s.responder(res,e);}
};
exports.reconocer=async(req,res)=>{
  res.set('Cache-Control','no-store');let cn;
  try {
    s.id(req.params.id);
    if(Object.keys(req.query).length || (req.body!==undefined && (!req.body || Array.isArray(req.body) || typeof req.body!=='object' || Object.keys(req.body).length)))throw s.error(400,'No se admiten parametros de reconocimiento');
    cn=await pool.getConnection();await cn.beginTransaction();
    await autorizar(req,cn);await autorizar(req,cn,'Reconocer');
    const [[row]]=await cn.query('SELECT '+CAMPOS+BASE+' AND a.id_alerta=? FOR UPDATE',[req.params.id]);
    if(!row)throw s.error(404,'Alerta no disponible');
    if(!ESTADOS.includes(row.estado))throw s.error(409,'Estado incompatible');
    if(row.estado!=='Leida'){
      await cn.query("UPDATE auditoria_alertas SET estado='Leida',fecha_lectura=NOW() WHERE id_alerta=?",[req.params.id]);
      await cn.query("INSERT INTO auditoria_logs_sistema (id_usuario,modulo,accion,descripcion,fecha_log) VALUES (?,'AlertasSeguridad','RECONOCER_ALERTA',?,NOW())",[req.usuario.id_usuario,JSON.stringify({version:1,id_alerta:String(row.id_alerta),id_hallazgo:String(row.id_hallazgo),estado_anterior:row.estado,estado_nuevo:'Leida'})]);
    }
    await cn.commit();res.json({ok:true,id_alerta:String(row.id_alerta),estado:'Leida',ya_leida:row.estado==='Leida'});
  } catch(e){if(cn)await cn.rollback().catch(()=>{});s.responder(res,e);}finally{cn?.release();}
};
