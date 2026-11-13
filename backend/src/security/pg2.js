const pool = require('../config/db');
const error = (status, mensaje) => Object.assign(new Error(mensaje), {status});
const id = value => {
  if (!/^[1-9][0-9]{0,18}$/.test(String(value)) || !['string','number'].includes(typeof value) || (typeof value==='number'&&!Number.isSafeInteger(value)) || BigInt(value)>9223372036854775807n) throw error(400,'Identificador invalido');
  return value;
};
async function identidad(req, db=pool) {
  const [rows] = await db.query(`SELECT u.id_usuario,u.id_rol,u.id_sucursal,u.estado,u.requiere_cambio_password,r.estado AS estado_rol,s.estado AS estado_sucursal
    FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol LEFT JOIN sucursales s ON s.id_sucursal=u.id_sucursal WHERE u.id_usuario=?`,[req.usuario.id_usuario]);
  const u=rows[0];
  if(!u||u.estado!=='Activo'||Number(u.id_rol)!==Number(req.usuario.id_rol))throw error(401,'Sesion no vigente');
  if(u.estado_rol!=='Activo')throw error(403,'ROL_INACTIVO');
  if(Number(u.requiere_cambio_password))throw error(403,'CAMBIO_PASSWORD_REQUERIDO');
  return u;
}
async function permisos(req,db=pool){const u=await identidad(req,db);const [rows]=await db.query('SELECT p.modulo,p.accion FROM rol_permiso rp JOIN permisos p ON p.id_permiso=rp.id_permiso WHERE rp.id_rol=? ORDER BY p.modulo,p.accion',[u.id_rol]);return {u,permisos:rows.map(p=>p.modulo+':'+p.accion)};}
async function exigir(req,modulo,accion,db=pool){const x=await permisos(req,db);if(!x.permisos.includes(modulo+':'+accion))throw error(403,'Permiso denegado');return x.u;}
function sucursal(u,solicitada){if(!u.id_sucursal||u.estado_sucursal!=='Activa')throw error(403,'Sucursal no disponible');if(solicitada!==undefined){id(solicitada);if(String(solicitada)!==String(u.id_sucursal))throw error(403,'Sucursal fuera de alcance');}return u.id_sucursal;}
function responder(res,e){return res.status(e.status||503).json({ok:false,mensaje:e.status?e.message:'Servicio no disponible'});}
module.exports={error,id,identidad,permisos,exigir,sucursal,responder};
