const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const express=require('express'),jwt=require('jsonwebtoken');
const SECRET='SOLO-PRUEBAS-SINTETICAS';
function fixture(o={}){
  let state={rows:[1,6,10].map((id,i)=>({id_alerta:String(id),id_hallazgo:String(id+100),referencia_id:String(id+200),codigo_regla:i===2?'IP_BLOQUEADA':'IP_NO_HABITUAL',nivel_riesgo:i===2?'Alto':'Medio',estado:i===1?'Leida':'Pendiente',canal:'Sistema',fecha_evento:'2026-11-01 00:00:00',fecha_deteccion:'2026-11-01 00:00:01',fecha_generacion:'2026-11-0'+(i+1)+' 00:00:00',fecha_lectura:i===1?'2026-11-02 00:00:00':null,password_hash:'NO_PUBLICAR',descripcion:'TOKEN_NO_PUBLICAR'})),logs:[]},queue=Promise.resolve();
  const permissions=o.permissions??['AlertasSeguridad:Consultar','AlertasSeguridad:Reconocer'];const calls=[];
  const actor={id_usuario:50,id_rol:8,id_sucursal:1,estado:'Activo',estado_rol:'Activo',estado_sucursal:'Activa',requiere_cambio_password:0};
  function filtradas(q,p){let i=0,rows=state.rows.slice();for(const cond of ['a.fecha_generacion>=?','a.fecha_generacion<DATE_ADD','a.estado=?','h.nivel_riesgo=?','r.codigo_regla=?'])if(q.includes(cond)){const v=p[i++];rows=rows.filter(r=>cond==='a.fecha_generacion>=?'?r.fecha_generacion>=v:cond==='a.fecha_generacion<DATE_ADD'?r.fecha_generacion.slice(0,10)<=v:cond==='a.estado=?'?r.estado===v:cond==='h.nivel_riesgo=?'?r.nivel_riesgo===v:r.codigo_regla===v);}return rows;}
  async function query(sql,p=[]){const q=sql.replace(/\s+/g,' ').trim();calls.push({q,p});if(o.fail?.test(q))throw Error('ERROR_SQL_CON_SECRETO');
    if(q.includes('FROM usuarios WHERE'))return [[{...actor}]];
    if(q.includes('FROM usuarios u'))return [[actor]];
    if(q.includes('FROM usuario_sesion'))return [o.revoked?[]:[{id_sesion:1}]];
    if(q.includes('FROM seguridad_politica_rol'))return [[]];
    if(q.startsWith('UPDATE usuario_sesion'))return [{affectedRows:1}];
    if(q.includes('FROM rol_permiso'))return [p.length===3?(permissions.includes(p[1]+':'+p[2])?[{id_permiso:1}]:[]):permissions.map(v=>{const [modulo,accion]=v.split(':');return {modulo,accion};})];
    if(q.includes('FROM auditoria_alertas a')){
      assert.match(q,/h.modulo_origen='Seguridad'/);assert.match(q,/r.modulo='Seguridad'/);
      if(q.includes('a.id_alerta=?'))return [state.rows.filter(r=>r.id_alerta===String(p[0]))];
      const rows=filtradas(q,p);if(q.includes('COUNT(*)'))return [[{total:rows.length,pendientes:rows.filter(r=>r.estado==='Pendiente').length,leidas:rows.filter(r=>r.estado==='Leida').length,riesgo_alto:rows.filter(r=>['Alto','Critico'].includes(r.nivel_riesgo)).length,promedio_generacion_segundos:rows.length?86400:null}]];
      return [rows.sort((a,b)=>Number(b.id_alerta)-Number(a.id_alerta)).slice(p.at(-1),p.at(-1)+p.at(-2))];
    }
    if(q.includes('FROM auditoria_logs_sistema'))return [[{id_log:String(p[0]),fecha_log:'2026-11-01 00:00:00',token:'NO_PUBLICAR'}]];
    if(q.startsWith('UPDATE auditoria_alertas')){const r=state.rows.find(r=>r.id_alerta===String(p[0]));r.estado='Leida';r.fecha_lectura='2026-11-04 00:00:00';return [{affectedRows:1}];}
    if(q.startsWith('INSERT INTO auditoria_logs_sistema')){state.logs.push({id_usuario:p[0],descripcion:JSON.parse(p[1])});return [{insertId:1}];}
    throw Error('SQL_NO_MODELADO');
  }
  const pool={query,async getConnection(){let unlock,backup;return {query,async beginTransaction(){const prev=queue;queue=new Promise(r=>{unlock=r;});await prev;backup=structuredClone(state);},async commit(){backup=null;},async rollback(){if(backup)state=backup;},release(){unlock?.();}};}};
  const cache=new Map();function load(file){file=path.resolve(__dirname,'../src',file);if(cache.has(file))return cache.get(file);const m={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,console:{error(){}},process:{env:{JWT_SECRET:SECRET}},require:n=>{if(n==='express')return express;if(n==='jsonwebtoken')return jwt;if(n==='../config/db')return pool;if((n==='../services/eventosSeguridadService'||n==='./eventosSeguridadService'))return {registrar:async()=>{}};if(n.startsWith('.'))return load(path.resolve(path.dirname(file),n+'.js'));throw Error('DEPENDENCIA_NO_AUTORIZADA');}},{filename:file});cache.set(file,m.exports);return m.exports;}
  const app=express();app.use(express.json());app.use('/api/alertas-seguridad',load('routes/alertasSeguridadRoutes.js'));
  return {app,calls,actor,permissions,get state(){return state;}};
}
async function run(o,fn){const f=fixture(o),server=f.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const token=jwt.sign({id_usuario:50,id_sesion:1,token_id:'SINTETICO'},SECRET,{expiresIn:60});const ask=async(suffix='',method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/alertas-seguridad${suffix}`,{method,headers:{'content-type':'application/json',...(!o.noSession?{authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),headers:r.headers};};try{await fn(ask,f);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}}
test('administrador con permiso explicito consulta sin modificar historicos 1/6',()=>run({},async(ask,f)=>{const before=JSON.stringify(f.state);const r=await ask();assert.equal(r.status,200);assert.equal(r.body.data.length,3);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(JSON.stringify(f.state),before);assert.ok(!JSON.stringify(r.body).includes('NO_PUBLICAR'));}));
test('nombre de rol no concede permiso: operador sin permiso 403',()=>run({permissions:[]},async ask=>assert.equal((await ask()).status,403)));
test('permiso auditoria operacional no concede acceso',()=>run({permissions:['Auditoria:Consultar','Auditoria:Revisar']},async ask=>assert.equal((await ask()).status,403)));
test('sin sesion 401',()=>run({noSession:true},async ask=>assert.equal((await ask()).status,401)));
test('sesion revocada 401',()=>run({revoked:true},async ask=>assert.equal((await ask()).status,401)));
test('rol inactivo 403',()=>run({},async(ask,f)=>{f.actor.estado_rol='Inactivo';assert.equal((await ask()).status,403);}));
test('filtros combinados y paginacion efectivos',()=>run({},async ask=>{let r=await ask('?desde=2026-11-01&hasta=2026-11-03&estado=Pendiente&riesgo=Alto&regla=IP_BLOQUEADA&pagina=1&limite=1');assert.equal(r.status,200);assert.equal(r.body.indicadores.total,1);assert.equal(r.body.data[0].id_alerta,'10');r=await ask('?pagina=2&limite=1');assert.equal(r.body.data[0].id_alerta,'6');}));
for(const q of ['?pagina=0','?limite=101','?estado=otro','?riesgo=otro','?regla=x%27','?desde=2026-02-30','?desde=2026-12-01&hasta=2026-01-01','?id_usuario=1','?pagina[]=1'])test('filtro invalido '+q,()=>run({},async ask=>assert.equal((await ask(q)).status,400)));
test('detalle trazable sin datos privados y sin cambio de estado',()=>run({},async(ask,f)=>{const before=JSON.stringify(f.state);const r=await ask('/10');assert.equal(r.status,200);assert.equal(r.body.trazabilidad.id_hallazgo,'110');assert.equal(r.body.trazabilidad.log.id_log,'210');assert.ok(!JSON.stringify(r.body).includes('NO_PUBLICAR'));assert.equal(JSON.stringify(f.state),before);}));
test('ID inexistente 404',()=>run({},async ask=>assert.equal((await ask('/999')).status,404)));
test('ID malformado 400',()=>run({},async ask=>assert.equal((await ask('/1e2')).status,400)));
test('reconocimiento transaccional registra fecha y actor del JWT',()=>run({},async(ask,f)=>{const before=JSON.stringify(f.state.rows.slice(0,2));const r=await ask('/10/leida','PATCH',{});assert.equal(r.status,200);assert.equal(f.state.rows[2].estado,'Leida');assert.ok(f.state.rows[2].fecha_lectura);assert.equal(f.state.logs[0].id_usuario,50);assert.equal(f.state.logs[0].descripcion.id_alerta,'10');assert.equal(JSON.stringify(f.state.rows.slice(0,2)),before);assert.ok(f.calls.some(c=>c.q.includes('FOR UPDATE')));}));
test('repeticion y concurrencia sintetica no duplican evidencia de lectura',()=>run({},async(ask,f)=>{await Promise.all([ask('/10/leida','PATCH',{}),ask('/10/leida','PATCH',{})]);const r=await ask('/10/leida','PATCH',{});assert.equal(r.body.ya_leida,true);assert.equal(f.state.logs.length,1);}));
test('Consultar sin Reconocer no escribe',()=>run({permissions:['AlertasSeguridad:Consultar']},async(ask,f)=>{assert.equal((await ask('/10/leida','PATCH',{})).status,403);assert.equal(f.state.rows[2].estado,'Pendiente');}));
test('Reconocer sin Consultar tampoco permite lectura indirecta',()=>run({permissions:['AlertasSeguridad:Reconocer']},async ask=>assert.equal((await ask('/10/leida','PATCH',{})).status,403)));
test('actor enviado por cliente rechazado',()=>run({},async ask=>assert.equal((await ask('/10/leida','PATCH',{id_usuario:7})).status,400)));
test('error de auditoria revierte lectura y no filtra SQL',()=>run({fail:/INSERT INTO auditoria_logs/},async(ask,f)=>{const r=await ask('/10/leida','PATCH',{});assert.equal(r.status,503);assert.equal(f.state.rows[2].estado,'Pendiente');assert.equal(f.state.logs.length,0);assert.ok(!JSON.stringify(r.body).includes('SECRETO'));}));
test('servicio de consulta caido devuelve 503',()=>run({fail:/FROM auditoria_alertas/},async ask=>assert.equal((await ask()).status,503)));
