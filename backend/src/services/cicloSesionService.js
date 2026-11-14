const pool = require('../config/db');
const eventos = require('./eventosSeguridadService');

function validarPolitica(p) {
  for (const campo of ['max_sesiones_activas','tiempo_inactividad_segundos']) {
    if (p[campo] == null || !Number.isSafeInteger(Number(p[campo])) || Number(p[campo])<0) throw new Error('POLITICA_SESION_INVALIDA');
  }
}
async function procesarEventos(ids) {
  for (const id of ids) {
    try { await eventos.procesar(id); }
    catch { console.warn('SESIONES: evento confirmado pendiente de procesamiento'); }
  }
}
// El llamador mantiene el bloqueo de usuario y de las sesiones, en ese orden.
async function expirar(cn,sesion,idUsuario,politica,ipOrigen) {
  const segundos=Number(sesion.segundos_inactivo);
  if (sesion.segundos_inactivo==null || !Number.isSafeInteger(segundos) || segundos<=Number(politica.tiempo_inactividad_segundos)) return null;
  const [r]=await cn.query(`UPDATE usuario_sesion SET estado='Expirada',fecha_expiracion=NOW(),
    motivo_cierre='Sesion expirada por inactividad'
    WHERE id_sesion=? AND id_usuario=? AND estado='Activa' AND fecha_expiracion>NOW()
    AND ultima_actividad IS NOT NULL AND TIMESTAMPDIFF(SECOND,ultima_actividad,NOW())>?`,
    [sesion.id_sesion,idUsuario,politica.tiempo_inactividad_segundos]);
  if(r.affectedRows!==1)return null;
  return eventos.registrarEnTransaccion(cn,{idUsuario,accion:'INACTIVIDAD_EXCEDIDA',ipOrigen,
    evidencia:{idSesion:String(sesion.id_sesion),segundosInactivo:segundos,maxInactividad:Number(politica.tiempo_inactividad_segundos)}});
}
async function depurarParaLogin(cn,idUsuario,politica,ipOrigen) {
  validarPolitica(politica);
  const [sesiones]=await cn.query(`SELECT id_sesion,TIMESTAMPDIFF(SECOND,ultima_actividad,NOW()) AS segundos_inactivo
    FROM usuario_sesion WHERE id_usuario=? AND estado='Activa' AND fecha_expiracion>NOW()
    ORDER BY id_sesion FOR UPDATE`,[idUsuario]);
  const ids=[];
  for(const sesion of sesiones){const id=await expirar(cn,sesion,idUsuario,politica,ipOrigen);if(id!=null)ids.push(id);}
  return ids;
}
async function validarActividad(decoded,rolEsperado,ipOrigen) {
  const cn=await pool.getConnection();const ids=[];
  let activa=false, descartar=false;
  try {
    await cn.beginTransaction();
    const [[user]]=await cn.query('SELECT id_usuario,id_rol,estado FROM usuarios WHERE id_usuario=? FOR UPDATE',[decoded.id_usuario]);
    if(user?.estado==='Activo' && Number(user.id_rol)===Number(rolEsperado)){
      const [[politica]]=await cn.query("SELECT * FROM seguridad_politica_rol WHERE id_rol=? AND estado='Activa' LIMIT 1 FOR SHARE",[user.id_rol]);
      if(politica)validarPolitica(politica);
      const [[sesion]]=await cn.query(`SELECT id_sesion,TIMESTAMPDIFF(SECOND,ultima_actividad,NOW()) AS segundos_inactivo
        FROM usuario_sesion WHERE id_sesion=? AND id_usuario=? AND token_id=? AND estado='Activa'
        AND fecha_expiracion>NOW() FOR UPDATE`,[decoded.id_sesion,decoded.id_usuario,decoded.token_id]);
      if(sesion){
        const vencida=politica && sesion.segundos_inactivo!=null && Number(sesion.segundos_inactivo)>Number(politica.tiempo_inactividad_segundos);
        if(vencida){const id=await expirar(cn,sesion,user.id_usuario,politica,ipOrigen);if(id!=null)ids.push(id);}
        else {
          await cn.query("UPDATE usuario_sesion SET ultima_actividad=NOW() WHERE id_sesion=? AND id_usuario=? AND estado='Activa' AND fecha_expiracion>NOW()",[sesion.id_sesion,user.id_usuario]);
          // No confundir cero filas cambiadas (misma marca temporal) con sesion invalida.
          const [vigentes]=await cn.query("SELECT id_sesion FROM usuario_sesion WHERE id_sesion=? AND id_usuario=? AND token_id=? AND estado='Activa' AND fecha_expiracion>NOW() FOR UPDATE",[decoded.id_sesion,user.id_usuario,decoded.token_id]);
          activa=vigentes.length===1;
        }
      }
    }
    await cn.commit();
  } catch(e) {
    try { await cn.rollback(); }
    catch { descartar=true; cn.destroy(); console.warn('SESIONES: rollback no confirmado; conexion descartada'); }
    throw e;
  } finally { if (!descartar) cn.release(); }
  await procesarEventos(ids);
  return activa;
}
module.exports={validarPolitica,depurarParaLogin,validarActividad,procesarEventos};
