const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
// Nunca carga config/db, dotenv ni una conexion MySQL.
function cargar(file, mocks) {
  const m = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'), {
    module:m, exports:m.exports, console, setInterval, clearInterval, process:{env:{JWT_SECRET:'SOLO_SINTETICO'}},
    require:n => { if(n==='../services/cicloSesionService') return cargar('services/cicloSesionService.js',{'../config/db':mocks['../config/db'],'./eventosSeguridadService':mocks['../services/eventosSeguridadService']}); if(n==='../security/ipSeguridad') return require('../src/security/ipSeguridad'); if (Object.hasOwn(mocks,n)) return mocks[n]; throw Error('DEPENDENCIA_NO_SIMULADA '+n); }
  });
  return m.exports;
}
const api = cargar('services/eventosSeguridadService.js', {'../config/db':{}});
const denegado = {accion:'ACCESO_DENEGADO',idUsuario:10,evidencia:{permisoAsignado:false}};
const {normalizarIp,obtenerIp} = require('../src/security/ipSeguridad');
function fixture() {
  let state={logs:[],hallazgos:[],alertas:[]}, queue=Promise.resolve();
  const reglas=Object.entries(api.CONDICIONES).map(([codigo_regla,condicion],i)=>({id_regla:i+1,codigo_regla,condicion,nivel_riesgo:'Alto',activa:true}));
  const f={fallo:null,blacklist:false,blacklistEstado:'Activa',blacklistExpira:null,confiable:true,listaVacia:false,politicaIp:0,avisos:0,consultas:[],commits:0,rollbacks:0,reglas,get state(){return state;}};
  async function query(sql,p=[]) {
    f.consultas.push(sql);
    if(f.fallo && f.fallo.test(sql)) throw Error('ERROR_SIMULADO_SECRETO_NO_PUBLICAR');
    if(sql.startsWith('INSERT INTO auditoria_logs_sistema')) { const id=state.logs.length+1;state.logs.push({id_log:id,id_usuario:p[0],accion:p[1],descripcion:p[2],ip_origen:p[3],fecha_log:'2026-11-13 12:00:00'});return [{insertId:id}]; }
    if(sql.includes('FROM auditoria_logs_sistema')) return [sql.includes('FOR UPDATE')?state.logs.filter(l=>l.id_log===Number(p[0])):state.logs.filter(l=>l.id_log>Number(p[0])).slice(0,100).map(l=>({id_log:l.id_log}))];
    if(sql.startsWith('UPDATE auditoria_logs_sistema')){state.logs.find(l=>l.id_log===p[1]).descripcion=p[0];return [{affectedRows:1}];}
    if(sql.includes('FROM auditoria_reglas'))return [reglas.filter(r=>r.codigo_regla===p[0]&&r.activa)];
    if(sql.includes('FROM auditoria_hallazgos'))return [state.hallazgos.filter(h=>h.id_regla===p[0]&&h.referencia_id===p[1])];
    if(sql.startsWith('INSERT INTO auditoria_hallazgos')){const id=state.hallazgos.length+1;state.hallazgos.push({id_hallazgo:id,id_regla:p[0],referencia_id:p[1],codigo:p[2],fecha_evento:p[6]});return [{insertId:id}];}
    if(sql.includes('FROM auditoria_alertas'))return [state.alertas.filter(a=>a.id_hallazgo===p[0])];
    if(sql.startsWith('INSERT INTO auditoria_alertas')){state.alertas.push({id_alerta:state.alertas.length+1,id_hallazgo:p[0]});return [{insertId:state.alertas.length}];}
    if(sql.includes('FROM seguridad_ip_lista'))return [f.blacklist && f.blacklistEstado==='Activa' && (!f.blacklistExpira || f.blacklistExpira>'2026-11-13 12:00:00')?[{ip:'127.0.0.1'}]:[]];
    if(sql.includes('FROM usuario_ip_confiable'))return [f.ips || (f.listaVacia?[]:[{ip:f.confiable?'127.0.0.1':'203.0.113.10'}])];
    if(sql.includes('LEFT JOIN seguridad_politica_rol'))return [[{requiere_ip_confiable:f.politicaIp}]];
    throw Error('SQL_NO_MODELADO');
  }
  f.db={query,async getConnection(){
    if(f.fallo?.test('getConnection'))throw Error('SIN_CONEXION');
    let unlock,backup;
    return {query,async beginTransaction(){const previous=queue;queue=new Promise(r=>{unlock=r;});await previous;backup=structuredClone(state);},async commit(){f.commits++;backup=null;},async rollback(){f.rollbacks++;if(backup)state=backup;backup=null;},release(){unlock?.();}};
  }};
  f.service=api.crearProcesador(f.db,()=>{f.avisos++;});
  return f;
}
test('RF01: sin lista activa y politica opcional no es IP no habitual',async()=>{
  const f=fixture();f.listaVacia=true;await f.service.observarIp(10,'::1',true);
  assert.equal(f.state.hallazgos.length,0);assert.equal(f.state.alertas.length,0);
  const e=JSON.parse(f.state.logs[0].descripcion);assert.equal(e.revisionIp,2);assert.equal(e.listaConfiableConfigurada,false);assert.equal(e.requiereIpConfiable,false);
  await f.service.recuperar();assert.equal(f.state.alertas.length,0);
});
test('RF02/03: lista configurada compara IP sin conceder confianza por rol',async()=>{
  for(const [ip,esperadas] of [['203.0.113.10',0],['203.0.113.11',1]]){
    const f=fixture();f.ips=[{ip:'203.0.113.10'}];await f.service.observarIp(10,ip,true);
    assert.equal(f.state.hallazgos.length,esperadas);assert.equal(f.state.alertas.length,esperadas);
    await f.service.recuperar();assert.equal(f.state.alertas.length,esperadas);
    if(esperadas) assert.equal(f.state.hallazgos[0].codigo,'IP_NO_HABITUAL');
  }
});
test('politica obligatoria sin lista queda pendiente, no inventa bloqueo HTTP',async()=>{
  const f=fixture();f.listaVacia=true;f.politicaIp=1;await f.service.observarIp(10,'::1',true);
  assert.equal(f.state.alertas.length,0);assert.equal(f.avisos,1);
  assert.equal(JSON.parse(f.state.logs[0].descripcion).requiereIpConfiable,true);
});
for(const [estado,expira,esperadas] of [['Activa',null,1],['Activa','2026-11-13 11:59:59',0],['Activa','2026-11-13 12:00:00',0],['Activa','2026-11-13 12:00:01',1],['Inactiva',null,0]])test(`RF04 blacklist ${estado} ${expira}`,async()=>{
  const f=fixture();f.blacklist=true;f.blacklistEstado=estado;f.blacklistExpira=expira;
  await f.service.observarIp(null,'::ffff:127.0.0.1');assert.equal(f.state.alertas.length,esperadas);
  assert.ok(f.consultas.some(q=>q.includes("estado='Activa'")&&q.includes('expira_en>NOW()')));
});
for(const fallo of [/FROM usuario_ip_confiable/,/LEFT JOIN seguridad_politica_rol/,/INSERT INTO auditoria_alertas/])test(`RF08 recuperacion IP ${fallo}`,async()=>{
  const f=fixture();f.ips=[{ip:'203.0.113.10'}];f.fallo=fallo;
  await f.service.observarIp(10,'203.0.113.11',true);assert.equal(f.state.logs.length,1);assert.equal(f.state.alertas.length,0);assert.equal(f.state.hallazgos.length,0);
  f.fallo=null;await f.service.recuperar();await f.service.procesar(1);assert.equal(f.state.hallazgos.length,1);assert.equal(f.state.alertas.length,1);
});
test('RF07 evidencia previa y alertas historicas permanecen intactas al reprocesar',async()=>{
  const f=fixture();const e=JSON.stringify({version:1,loginExitoso:true,ipConfiable:false});
  f.state.logs.push({id_log:238,id_usuario:10,accion:'OBSERVACION_IP',descripcion:e,ip_origen:'::1',fecha_log:'2026-11-13 12:00:00'});
  const regla=f.reglas.find(r=>r.codigo_regla==='IP_NO_HABITUAL');
  f.state.hallazgos.push({id_hallazgo:6,id_regla:regla.id_regla,referencia_id:238});f.state.alertas.push({id_alerta:1,id_hallazgo:6},{id_alerta:6,id_hallazgo:99});
  const before=JSON.stringify(f.state);f.listaVacia=true;await f.service.procesar(238);assert.equal(JSON.stringify(f.state),before);
  assert.ok(!f.consultas.some(q=>q.startsWith('UPDATE auditoria_logs_sistema')));
});
for(const [entrada,salida] of [['203.0.113.10','203.0.113.10'],['::ffff:203.0.113.10','203.0.113.10'],['::ffff:cb00:710a','203.0.113.10'],['0:0:0:0:0:0:0:1','::1'],['2001:0DB8:0:0:0:0:0:1','2001:db8::1'],['127.0.0.1','127.0.0.1'],['bad',null],['1.2.3.4, 5.6.7.8',null],['fe80::1%eth0',null]])test('IP normalizada '+entrada,()=>assert.equal(normalizarIp(entrada),salida));
test('RF10 no consume encabezado falsificado ni equipara loopbacks',()=>{
  assert.equal(obtenerIp({headers:{'x-forwarded-for':'203.0.113.10'},ip:'::1',socket:{remoteAddress:'::1'}}),'::1');
  assert.notEqual(normalizarIp('::1'),normalizarIp('127.0.0.1'));
});
test('IPv6 y IPv4 mapeada coinciden con listas existentes sin modificar filas',async()=>{
  for(const [lista,ip] of [['2001:0DB8:0:0:0:0:0:1','2001:db8::1'],['::ffff:cb00:710a','203.0.113.10']]){const f=fixture();f.ips=[{ip:lista}];await f.service.observarIp(10,ip,true);assert.equal(f.state.alertas.length,0);}
});
test('permiso efectivo autorizado: sin hallazgos ni alerta',async()=>{const f=fixture();await f.service.registrar({...denegado,evidencia:{permisoAsignado:true}});assert.equal(f.state.hallazgos.length,0);});
test('denegacion genera inmediatamente hallazgo vinculado y alerta persistente',async()=>{const f=fixture();await f.service.registrar(denegado);assert.equal(f.state.hallazgos.length,1);assert.equal(f.state.hallazgos[0].referencia_id,1);assert.equal(f.state.hallazgos[0].fecha_evento,f.state.logs[0].fecha_log);assert.equal(f.state.alertas[0].id_hallazgo,1);assert.ok(f.consultas.some(q=>q.includes('FOR UPDATE')));});
test('replay y recuperacion repetida no duplican',async()=>{const f=fixture();await f.service.registrar(denegado);await f.service.procesar(1);await f.service.recuperar();assert.equal(f.state.hallazgos.length,1);assert.equal(f.state.alertas.length,1);});
test('dos consumidores concurrentes serializados en mock',async()=>{const f=fixture();await f.service.registrar(denegado);await Promise.all([f.service.procesar(1),f.service.procesar(1)]);assert.equal(f.state.alertas.length,1);});
test('regla inactiva no genera hallazgo',async()=>{const f=fixture();f.reglas.forEach(r=>r.activa=false);await f.service.registrar(denegado);assert.equal(f.state.hallazgos.length,0);});
test('condicion desconocida se deniega sin ejecutar texto configurable',async()=>{const f=fixture();f.reglas.find(r=>r.codigo_regla==='ACCESO_MODULO_NO_AUTORIZADO').condicion='otra condicion';await f.service.registrar(denegado);assert.equal(f.state.hallazgos.length,0);assert.equal(f.avisos,1);});
for(const [accion,evidencia,count] of [
  ['BLOQUEO_USUARIO',{bloqueado:true,intentos:3,maxIntentos:3},2],
  ['BLOQUEO_USUARIO',{bloqueado:true,intentos:2,maxIntentos:3},0],
  ['SESION_DUPLICADA',{sesionesActivas:1,maxSesiones:1},1],
  ['SESION_DUPLICADA',{sesionesActivas:0,maxSesiones:1},0],
  ['SESION_DUPLICADA',{sesionesActivas:1,maxSesiones:0},0],
  ['INACTIVIDAD_EXCEDIDA',{segundosInactivo:61,maxInactividad:60},1],
  ['INACTIVIDAD_EXCEDIDA',{segundosInactivo:60,maxInactividad:60},0],
  ['INACTIVIDAD_EXCEDIDA',{segundosInactivo:-1,maxInactividad:60},0],
  ['LOGIN_EXITOSO',{},0]
]) test(`${accion} ${JSON.stringify(evidencia)} -> ${count}`,async()=>{const f=fixture();await f.service.registrar({accion,evidencia});assert.equal(f.state.hallazgos.length,count);assert.equal(f.state.alertas.length,count);});
test('sin aliases arbitrarios ni acciones criticas inventadas',()=>{assert.equal(api.reglasEvento('ACCION_SUPERUSUARIO',{version:1,accion_critica:true}).length,0);assert.equal(api.reglasEvento('ACCESO_MODULO_NO_AUTORIZADO',{version:1,permisoAsignado:false}).length,0);});
test('fallo de primer INSERT es visible y no finge registro durable',async()=>{const f=fixture();f.fallo=/INSERT INTO auditoria_logs/;await assert.rejects(f.service.registrar(denegado));assert.equal(f.state.logs.length,0);});
for(const fallo of [/getConnection/,/INSERT INTO auditoria_hallazgos/,/INSERT INTO auditoria_alertas/])test(`recuperacion tras ${fallo}`,async()=>{const f=fixture();f.fallo=fallo;await f.service.registrar(denegado);assert.equal(f.state.logs.length,1);assert.equal(f.state.hallazgos.length,0);assert.equal(f.state.alertas.length,0);f.fallo=null;await api.crearProcesador(f.db,()=>{}).recuperar();assert.equal(f.state.alertas.length,1);});
test('hallazgo existente sin alerta se repara sin duplicar',async()=>{const f=fixture();await f.service.registrar(denegado);f.state.alertas.length=0;await f.service.procesar(1);assert.equal(f.state.hallazgos.length,1);assert.equal(f.state.alertas.length,1);});
test('historico descriptivo no se reinterpreta sin evidencia',async()=>{const f=fixture();f.state.logs.push({id_log:1,accion:'ACCESO_DENEGADO',descripcion:'Texto historico'});await f.service.recuperar();assert.equal(f.state.hallazgos.length,0);assert.equal(f.state.logs[0].descripcion,'Texto historico');});
test('evento defectuoso no bloquea siguiente evento',async()=>{const f=fixture();f.state.logs.push({id_log:1,accion:'ACCESO_DENEGADO',descripcion:'malformado'});await f.service.registrar(denegado);await f.service.recuperar();assert.equal(f.state.alertas.length,1);});
test('listas IP verificadas, sin ampliar ni denegar permisos',async()=>{const f=fixture();await f.service.observarIp(10,'127.0.0.1',true);assert.equal(f.state.alertas.length,0);f.confiable=false;await f.service.observarIp(10,'127.0.0.1',true);f.blacklist=true;await f.service.observarIp(null,'127.0.0.1');assert.equal(f.state.alertas.length,2);assert.ok(f.consultas.some(q=>q.includes('expira_en>NOW()')));});
test('lista blanca no serializa password token user-agent ni descripcion libre',async()=>{const f=fixture();await f.service.registrar({...denegado,password:'NO_PUBLICAR',descripcion:'NO_PUBLICAR',evidencia:{permisoAsignado:false,token:'NO_PUBLICAR',password:'NO_PUBLICAR'}});assert.ok(!JSON.stringify(f.state).includes('NO_PUBLICAR'));});
test('middleware real: permiso insuficiente 403 con alerta, permiso valido next',async()=>{
  for(const permitido of [false,true]){
    const f=fixture();const permiso=cargar('middlewares/permisoMiddleware.js',{'../config/db':{query:async()=>[permitido?[{id_permiso:1}]:[]]},'../services/eventosSeguridadService':f.service});
    let next=false;const res={statusCode:200,status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;}};
    await permiso('Ventas','Consultar')({usuario:{id_usuario:10,id_rol:2},ip:'127.0.0.1'},res,()=>{next=true;});
    assert.equal(res.statusCode,permitido?200:403);assert.equal(next,permitido);assert.equal(f.state.alertas.length,permitido?0:1);
  }
});
test('fallo del procesador conserva respuesta 403 y evento recuperable',async()=>{const f=fixture();f.fallo=/INSERT INTO auditoria_alertas/;const permiso=cargar('middlewares/permisoMiddleware.js',{'../config/db':{query:async()=>[[]]},'../services/eventosSeguridadService':f.service});const res={status(n){this.code=n;return this;},json(){return this;}};await permiso('Ventas','Consultar')({usuario:{id_usuario:10,id_rol:2},ip:'127.0.0.1'},res,()=>assert.fail());assert.equal(res.code,403);assert.equal(f.state.logs.length,1);f.fallo=null;await f.service.recuperar();assert.equal(f.state.alertas.length,1);});

test('observacion IP durable se recupera tras fallo de listas',async()=>{const f=fixture();f.blacklist=true;f.fallo=/FROM seguridad_ip_lista/;await f.service.observarIp(null,'127.0.0.1');assert.equal(f.state.logs.length,1);assert.equal(f.state.alertas.length,0);f.fallo=null;await f.service.recuperar();assert.equal(f.state.alertas.length,1);});
test('listas cambiadas no reclasifican una observacion ya evaluada',async()=>{const f=fixture();await f.service.observarIp(null,'127.0.0.1');f.blacklist=true;await f.service.recuperar();assert.equal(f.state.alertas.length,0);});
function respuesta(){return {code:200,status(n){this.code=n;return this;},json(b){this.body=b;return this;}};}
for(const caso of ['autorizado','bloqueado','duplicado'])test('login real '+caso+' y procesamiento real con repositorios simulados',async()=>{
 const f=fixture(), user={id_usuario:10,id_rol:2,nombre_rol:'Etiqueta sintetica',estado:'Activo',intentos_fallidos:2,password_hash:'HASH_FICTICIO'};
 const pool={async query(q){if(q.includes('FROM usuarios'))return [[user]];if(q.includes('FROM roles'))return [[{nombre_rol:user.nombre_rol}]];if(q.includes('ORDER BY id_sesion'))return [[]];if(q.includes('FROM seguridad_politica_rol'))return [[{max_intentos_fallidos:3,max_sesiones_activas:1,tiempo_inactividad_segundos:60}]];if(q.includes('COUNT(*)'))return [[{total:caso==='duplicado'?1:0}]];if(q.includes('INSERT INTO usuario_sesion'))return [{insertId:1}];if(q.trim().startsWith('UPDATE usuarios'))return [{affectedRows:1}];throw Error('SQL_LOGIN_NO_MODELADO');}};
 pool.getConnection=async()=>({query:(q,p)=>q.includes('INSERT INTO auditoria_logs_sistema')?f.db.query(q,p):pool.query(q,p),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}});
 const auth=cargar('controllers/authcontroller.js',{'../services/eventosSeguridadService':f.service,'../config/db':pool,bcryptjs:{compare:async()=>caso!=='bloqueado'},jsonwebtoken:{sign:()=> 'TOKEN_SINTETICO'},crypto:require('node:crypto')});
 const res=respuesta();await auth.login({body:{usuario:'ficticio',password:'NO_PUBLICAR'},headers:{},ip:'127.0.0.1'},res);
 assert.equal(res.code,caso==='autorizado'?200:403);assert.equal(f.state.alertas.length,caso==='bloqueado'?2:caso==='duplicado'?1:0);assert.ok(!JSON.stringify(f.state).includes('NO_PUBLICAR'));assert.ok(!JSON.stringify(f.state).includes('TOKEN_SINTETICO'));
});
for(const segundos of [60,61])test('middleware JWT real inactividad '+segundos,async()=>{
 const f=fixture();let next=false;const pool={async query(q){if(q.includes('FROM usuarios'))return [[{id_usuario:10,id_rol:2,estado:'Activo',estado_rol:'Activo'}]];if(q.includes('FROM usuario_sesion'))return [[{id_sesion:1,segundos_inactivo:segundos,ultima_actividad:'2026-11-13 12:00:00'}]];if(q.includes('FROM seguridad_politica_rol'))return [[{tiempo_inactividad_segundos:60,max_sesiones_activas:1}]];if(q.includes('TIMESTAMPDIFF')&&!q.includes('UPDATE usuario_sesion'))return [[{segundos_inactivo:segundos}]];if(q.includes('UPDATE usuario_sesion'))return [{affectedRows:1}];throw Error('SQL_AUTH_NO_MODELADO');}};
 pool.getConnection=async()=>({query:(q,p)=>q.includes('INSERT INTO auditoria_logs_sistema')?f.db.query(q,p):pool.query(q,p),beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){}});
 const auth=cargar('middlewares/authMiddleware.js',{'../services/eventosSeguridadService':f.service,'../config/db':pool,jsonwebtoken:{verify:()=>({id_usuario:10,id_sesion:1,token_id:'FICTICIO'})}});const res=respuesta();await auth({headers:{authorization:'Bearer FICTICIO'},ip:'127.0.0.1'},res,()=>{next=true;});assert.equal(res.code,segundos>60?401:200);assert.equal(next,segundos===60);assert.equal(f.state.alertas.length,segundos>60?1:0);
});
