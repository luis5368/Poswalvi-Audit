const pool=require('../config/db');const s=require('../security/pg2');
const fuentes={ventas:{tabla:'ventas',fecha:'fecha_venta',id:'id_venta',permiso:'Ventas'},compras:{tabla:'compras',fecha:'fecha_compra',id:'id_compra',permiso:'Compras'}};
function fecha(x){if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x))||new Date(x).toISOString().slice(0,10)!==x)throw s.error(400,'Fecha invalida');return x;}
const celda=v=>'"'+String(v??'').replace(/^[\s\u0000-\u001f]*[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';
exports.celda=celda;
exports.obtener=async(req,res)=>{let db;res.set('Cache-Control','no-store');try{const {tipo,desde,hasta,id_sucursal,formato,pagina='1'}=req.query;const f=fuentes[tipo];if(!f||Object.keys(req.query).some(k=>!['tipo','desde','hasta','id_sucursal','formato','pagina'].includes(k))||formato&&formato!=='csv')throw s.error(400,'Reporte o filtro no admitido');fecha(desde);fecha(hasta);if(desde>hasta||Date.parse(hasta)-Date.parse(desde)>366*86400000)throw s.error(400,'Intervalo invalido (maximo 366 dias)');s.id(pagina);if(Number(pagina)>100000)throw s.error(400,'Pagina fuera de rango');
 db=await pool.getConnection();await db.beginTransaction();const u=await s.exigir(req,'Reportes','Consultar',db);await s.exigir(req,f.permiso,'Consultar',db);if(formato==='csv')await s.exigir(req,'Reportes','Exportar',db);const branch=s.sucursal(u,id_sucursal);
 // Los reportes de ventas son propios; no convierten Reportes en consulta global de ventas.
 const where=`id_sucursal=? AND ${f.fecha}>=? AND ${f.fecha}<DATE_ADD(?,INTERVAL 1 DAY)`+(tipo==='ventas'?' AND id_usuario=?':'');const args=[branch,desde,hasta,...(tipo==='ventas'?[u.id_usuario]:[])];
 const [[total]]=await db.query(`SELECT COUNT(*) AS registros,COALESCE(SUM(CASE WHEN estado='Registrada' THEN total ELSE 0 END),0) AS total_registrado FROM ${f.tabla} WHERE ${where}`,args);
 if(formato==='csv'&&Number(total.registros)>10000)throw s.error(422,'Acote el intervalo: maximo 10000 filas por exportacion');
 const [rows]=await db.query(`SELECT ${f.id} AS id,${f.fecha} AS fecha,estado,total FROM ${f.tabla} WHERE ${where} ORDER BY ${f.id} LIMIT ? OFFSET ?`,[...args,formato==='csv'?10000:100,formato==='csv'?0:(Number(pagina)-1)*100]);await db.rollback();
 if(formato==='csv'){res.set('Content-Disposition','attachment; filename="reporte-'+tipo+'.csv"');return res.type('text/csv; charset=utf-8').send('\uFEFFid,fecha,estado,total\r\n'+rows.map(r=>[r.id,r.fecha instanceof Date?r.fecha.toISOString():r.fecha,r.estado,r.total].map(celda).join(',')).join('\r\n'));}
 res.json({ok:true,data:rows,totales:total,pagina:Number(pagina),tamano_pagina:100,sucursal:branch,alcance:tipo==='ventas'?'propio':'sucursal'});
}catch(e){if(db)await db.rollback().catch(()=>{});s.responder(res,e);}finally{db?.release();}};
