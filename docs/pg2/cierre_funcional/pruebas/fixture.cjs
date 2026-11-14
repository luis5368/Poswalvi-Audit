const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../../../../');const deps=require('module').createRequire(path.join(root,'backend/package.json'));const express=deps('express'),jwt=deps('jsonwebtoken');
function fixture(o={}){
 const actor={id_usuario:10,id_rol:2,id_sucursal:o.branch??1,estado:'Activo',estado_rol:o.inactivo?'Inactivo':'Activo',estado_sucursal:'Activa',requiere_cambio_password:o.password?1:0,nombre_rol:o.rol||'Auditor'};
 const permissions=o.permisos||[],calls=[],tx={begin:0,commit:0,rollback:0};let state={empresa:{id_empresa:1,nombre_comercial:'Empresa ficticia',razon_social:'Ficticia SA',direccion:'Direccion ficticia',telefono:'55555555',correo:'ensayo@example.invalid'},h:{id_hallazgo:1,id_regla:1,codigo_regla:'VENTA_BAJO_COSTO',estado:'Pendiente',sucursal:1,descripcion:'Caso sintetico',modulo_origen:'Ventas'},historial:[]};let backup;
 async function query(sql,a=[]){const q=sql.replace(/\s+/g,' ').trim();calls.push({q,a});if(o.fail?.test(q))throw Error('FALLO_SINTETICO');
 if(q.includes('FROM usuarios WHERE'))return [[{...actor}]];
    if(q.includes('FROM usuarios u'))return [[{...actor}]];
 if(q.includes('FROM usuario_sesion'))return [o.revocada?[]:[{id_sesion:1}]];
 if(q.includes('FROM seguridad_politica_rol'))return [[]];
 if(q.includes('FROM rol_permiso'))return [a.length===3?(permissions.includes(a[1]+':'+a[2])?[{id_permiso:1}]:[]):permissions.map(p=>{const [modulo,accion]=p.split(':');return {modulo,accion}})];
 if(q.startsWith('UPDATE usuario_sesion')||q.startsWith('INSERT INTO auditoria_logs_sistema'))return [{affectedRows:1}];
 if(q.includes('FROM empresa_configuracion'))return [[{...state.empresa}]];
 if(q.startsWith('UPDATE empresa_configuracion')){const keys=q.split(' SET ')[1].split(' WHERE ')[0].split(',').map(k=>k.split('=')[0]);keys.forEach((k,i)=>state.empresa[k]=a[i]);return [{affectedRows:1}];}
 if(q.includes('FROM auditoria_reglas WHERE'))return [[{codigo_regla:'VENTA_BAJO_COSTO',nombre_regla:'Caso ficticio'}]];
 if(q.includes('FROM auditoria_hallazgos h')&&q.startsWith('SELECT COUNT(*)'))return [[{total_hallazgos:1,confirmados:0,corregidos:1,pendientes:0,en_revision:0,riesgo_alto:0,riesgo_medio:1,hallazgos_ultimas_24h:1}]];
 if(q.includes('FROM auditoria_hallazgos h')&&q.startsWith('SELECT AVG('))return [[{promedio_horas:2,maximo_horas:2}]];
 if(q.includes('FROM auditoria_hallazgos h')){const visible=Number(a[0])===state.h.sucursal&&(!q.includes('h.id_hallazgo=?')||Number(a.at(-1))===1);return [visible?[{...state.h}]:[]];}
 if(q.includes('FROM auditoria_evidencias'))return [[{id_evidencia:1,campo:'precio',descripcion:'Evidencia ficticia'}]];
 if(q.includes('FROM auditoria_revision_historial'))return [state.historial.slice()];
 if(q.startsWith('UPDATE auditoria_hallazgos')){state.h={...state.h,estado:a[0],revisado_por:a[1],comentario_revision:a[2]};return [{affectedRows:1}];}
 if(q.startsWith('INSERT INTO auditoria_revision_historial')){state.historial.push({id_revision:1,id_hallazgo:a[0],estado_anterior:a[1],estado_nuevo:a[2],comentario:a[3],revisado_por:a[4]});return [{insertId:1}];}
 if(/FROM (ventas|compras) WHERE/.test(q)){if(!q.includes('id_sucursal=?'))throw Error('SIN_ALCANCE');const data=o.empty?[]:[{id:1,fecha:'2026-11-01',estado:'Registrada',total:'10.01'},{id:2,fecha:'2026-11-02',estado:'Registrada',total:'20.02'},{id:3,fecha:'2026-11-03',estado:'Anulada',total:'99.00'}];if(q.includes('COUNT(*)'))return [[{registros:o.volumen??data.length,total_registrado:data.length?'30.03':'0.00'}]];return [data];}
 throw Error('SQL_NO_MODELADO '+q);
 }
 const pool={query,async getConnection(){return {query,async beginTransaction(){tx.begin++;backup=structuredClone(state);},async commit(){tx.commit++;backup=null;},async rollback(){tx.rollback++;if(backup)state=backup;backup=null;},release(){}};}};
 const cache=new Map();function load(file){file=path.resolve(root,'backend/src',file);if(cache.has(file))return cache.get(file);const m={exports:{}};const req=n=>{if(n==='express')return express;if(n==='jsonwebtoken')return jwt;if(n==='../config/db')return file.endsWith('cicloSesionService.js')?{query,getConnection:async()=>({query,beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}})}:pool;if((n==='../services/eventosSeguridadService'||n==='./eventosSeguridadService'))return {registrar:async()=>query('INSERT INTO auditoria_logs_sistema (modulo) VALUES (?)',['Seguridad'])};if(n==='../controllers/authcontroller')return {login:(req,res)=>res.sendStatus(501),logout:(req,res)=>res.json({ok:true}),perfil:(req,res)=>res.json({ok:true}),cambiarPassword:(req,res)=>res.json({ok:true})};if(n==='../controllers/auditoriaController')return new Proxy({},{get:()=>((req,res)=>res.json({ok:true}))});if(n.startsWith('.'))return load(path.resolve(path.dirname(file),n+'.js'));throw Error('DEPENDENCIA_NO_AUTORIZADA '+n);};vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:req,module:m,exports:m.exports,process:{env:{JWT_SECRET:'PG2-SOLO-SINTETICO'}},console:{error(){}}},{filename:file});cache.set(file,m.exports);return m.exports;}
 const app=express();app.use(express.json());app.use('/api/auth',load('routes/authRoutes.js'));app.use('/api/auditoria',load('routes/auditoriaRoutes.js'));app.use('/api',load('routes/pg2Routes.js'));return {app,load,tx,calls,actor,get state(){return state;}};
}
async function session(o,fn){const f=fixture(o),server=f.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const token=jwt.sign({id_usuario:10,id_sesion:1,token_id:'FICTICIO'},'PG2-SOLO-SINTETICO',{expiresIn:60});const ask=async(url,method='GET',body)=>{const r=await fetch('http://127.0.0.1:'+server.address().port+url,{method,headers:{'content-type':'application/json',...(!o.sinSesion?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data,headers:r.headers,f};};try{return await fn(ask,f)}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}}
module.exports={session,fixture};
