const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const jwt=require('jsonwebtoken');
// Repositorio en memoria: nunca requiere config/db ni dotenv. El mutex simula locks,
// no demuestra el aislamiento ni los deadlocks del motor MySQL.
function fixture(o={}) {
  let state={user:{id_usuario:10,id_rol:2,estado:'Activo',estado_rol:'Activo',nombre_rol:'Ficticio',usuario:'ficticio',password_hash:'HASH_SIMULADO',intentos_fallidos:0},
    sessions:o.empty?[]:[{id_sesion:81,id_usuario:10,token_id:'ANTIGUO',estado:o.estado||'Activa',absolute:o.absolute!==false,segundos_inactivo:o.segundos===undefined?174:o.segundos}],logs:[],hallazgos:[],alertas:[]};
  const policy={max_intentos_fallidos:3,max_sesiones_activas:1,tiempo_inactividad_segundos:60,...o.policy};
  let queue=Promise.resolve();const calls=[],warnings=[];
  const f={fail:o.fail,commits:0,rollbacks:0,destroyed:0,policy,calls,warnings,get state(){return state;}};
  async function query(sql,p=[]) {
    const q=sql.replace(/\s+/g,' ').trim();calls.push(q);
    if(f.fail?.test(q))throw Error('ERROR_SINTETICO_NO_PUBLICAR');
    if(q.includes('FROM usuarios'))return [[{...state.user}]];
    if(q.includes('FROM roles'))return [[{nombre_rol:'Ficticio'}]];
    if(q.includes('FROM seguridad_politica_rol'))return [o.noPolicy?[]:[{...policy}]];
    if(q.startsWith('UPDATE usuarios'))return [{affectedRows:1}];
    if(q.startsWith('SELECT')&&q.includes('FROM usuario_sesion')) {
      let rows=state.sessions.filter(s=>s.estado==='Activa'&&s.absolute);
      if(q.includes('WHERE id_sesion'))rows=rows.filter(s=>s.id_sesion===Number(p[0])&&s.id_usuario===Number(p[1])&&s.token_id===p[2]);
      else rows=rows.filter(s=>s.id_usuario===Number(p[0]));
      return [q.includes('COUNT(*)')?[{total:rows.length}]:rows.map(s=>({...s}))];
    }
    if(q.startsWith('UPDATE usuario_sesion')) {
      const s=state.sessions.find(s=>s.id_sesion===Number(p[0])&&s.id_usuario===Number(p[1])&&s.estado==='Activa'&&s.absolute);
      if(!s)return [{affectedRows:0}];
      if(q.includes("estado='Expirada'")) {
        assert.match(q,/TIMESTAMPDIFF\(SECOND,ultima_actividad,NOW\(\)\)>\?/);
        if(s.segundos_inactivo==null||s.segundos_inactivo<=Number(p[2]))return [{affectedRows:0}];
        s.estado='Expirada';s.absolute=false;
      } else s.segundos_inactivo=0;
      return [{affectedRows:1}];
    }
    if(q.startsWith('INSERT INTO usuario_sesion')) {
      const id=82+state.sessions.length;state.sessions.push({id_sesion:id,id_usuario:p[0],token_id:p[1],estado:'Activa',absolute:true,segundos_inactivo:0});return [{insertId:id}];
    }
    if(q.startsWith('INSERT INTO auditoria_logs_sistema')) {
      const id=state.logs.length+1;state.logs.push({id_log:id,id_usuario:p[0],accion:p[1],descripcion:p[2],fecha_log:'2026-11-13 12:00:00'});return [{insertId:id}];
    }
    if(q.includes('FROM auditoria_logs_sistema'))return [q.includes('FOR UPDATE')?state.logs.filter(l=>l.id_log===Number(p[0])):state.logs.filter(l=>l.id_log>Number(p[0])).map(l=>({id_log:l.id_log}))];
    if(q.includes('FROM auditoria_reglas'))return [[{id_regla:p[0],codigo_regla:p[0],condicion:f.events.CONDICIONES[p[0]],nivel_riesgo:'Alto'}]];
    if(q.includes('FROM auditoria_hallazgos'))return [state.hallazgos.filter(h=>h.id_regla===p[0]&&h.referencia_id===p[1])];
    if(q.startsWith('INSERT INTO auditoria_hallazgos')){const id=state.hallazgos.length+1;state.hallazgos.push({id_hallazgo:id,id_regla:p[0],referencia_id:p[1]});return [{insertId:id}];}
    if(q.includes('FROM auditoria_alertas'))return [state.alertas.filter(a=>a.id_hallazgo===p[0])];
    if(q.startsWith('INSERT INTO auditoria_alertas')){state.alertas.push({id_alerta:state.alertas.length+1,id_hallazgo:p[0]});return [{insertId:state.alertas.length}];}
    throw Error('SQL_NO_MODELADO '+q);
  }
  const pool={query,async getConnection(){
    if(f.fail?.test('getConnection'))throw Error('SIN_CONEXION');
    let unlock,backup;
    return {query,async beginTransaction(){const prior=queue;queue=new Promise(r=>unlock=r);await prior;backup=structuredClone(state);},
      async commit(){if(f.fail?.test('COMMIT'))throw Error('COMMIT_SIMULADO');backup=null;f.commits++;},
      async rollback(){if(o.rollbackFail)throw Error('ROLLBACK_SIMULADO');if(backup)state=backup;backup=null;f.rollbacks++;},destroy(){f.destroyed++;if(backup)state=backup;backup=null;unlock?.();},release(){unlock?.();}};
  }};
  const cache=new Map();
  function load(file){file=path.resolve(__dirname,'../src',file);if(cache.has(file))return cache.get(file);const m={exports:{}};
    vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:m,exports:m.exports,process:{env:{JWT_SECRET:'SOLO_TEST'}},console:{warn:s=>warnings.push(s),error:s=>warnings.push(s)},setInterval,clearInterval,
      require:n=>{
        if(n==='../config/db')return pool;
        if(n==='bcryptjs')return {compare:async()=>o.password!==false};
        if(n==='jsonwebtoken')return o.signFail?{...jwt,sign(){throw Error('FIRMA_FALLIDA');}}:jwt;
        if(n==='crypto')return require('node:crypto');
        if(n==='../security/ipSeguridad')return require('../src/security/ipSeguridad');
        if(n.startsWith('.'))return load(path.resolve(path.dirname(file),n+'.js'));
        throw Error('DEPENDENCIA_NO_AUTORIZADA '+n);
      }},{filename:file});cache.set(file,m.exports);return m.exports;
  }
  f.events=load('services/eventosSeguridadService.js');
  // Observacion IP tiene su propia suite; no mezclar sus consultas con el ciclo probado.
  f.events.observarIp=async()=>{};
  f.ciclo=load('services/cicloSesionService.js');const controller=load('controllers/authcontroller.js'),middleware=load('middlewares/authMiddleware.js');
  f.controller=controller;f.middleware=middleware;
  function res(){return {code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
  f.login=async()=>{const r=res();await controller.login({body:{usuario:'ficticio',password:'NO_PUBLICAR'},headers:{},ip:'127.0.0.1'},r);return r;};
  f.token=jwt.sign({id_usuario:10,id_sesion:81,token_id:'ANTIGUO'},'SOLO_TEST',{expiresIn:3600});
  f.check=async(token=f.token)=>{const r=res();let next=false;await middleware({headers:{authorization:'Bearer '+token},ip:'127.0.0.1'},r,()=>next=true);return {...r,next};};
  return f;
}

for(const seconds of [0,59,60,61,174])test('login: limite estricto >, inactividad '+seconds,async()=>{
  const f=fixture({segundos:seconds}),r=await f.login();assert.equal(r.code,seconds>60?200:403);
  assert.equal(f.state.sessions[0].estado,seconds>60?'Expirada':'Activa');
  assert.equal(f.state.sessions.filter(s=>s.estado==='Activa').length,1);
  const events=f.state.logs.filter(l=>l.accion==='INACTIVIDAD_EXCEDIDA');assert.equal(events.length,seconds>60?1:0);
  if(events.length){assert.equal(JSON.parse(events[0].descripcion).idSesion,'81');assert.equal(f.state.hallazgos.length,1);assert.equal(f.state.alertas.length,1);}
});
for(const estado of ['Expirada','Cerrada','Revocada'])test('historial '+estado+' no se cuenta ni altera',async()=>{
  const f=fixture({estado}),before=JSON.stringify(f.state.sessions[0]);assert.equal((await f.login()).code,200);assert.equal(JSON.stringify(f.state.sessions[0]),before);assert.equal(f.state.logs.filter(l=>l.accion==='INACTIVIDAD_EXCEDIDA').length,0);
});
test('vencimiento absoluto se excluye sin inventar un evento de inactividad',async()=>{const f=fixture({absolute:false}),before=JSON.stringify(f.state.sessions[0]);assert.equal((await f.login()).code,200);assert.equal(JSON.stringify(f.state.sessions[0]),before);assert.equal(f.state.alertas.length,0);});
test('ultima actividad NULL no demuestra inactividad',async()=>{const f=fixture({segundos:null});assert.equal((await f.login()).code,403);assert.equal(f.state.sessions[0].estado,'Activa');});
for(const empty of [false,true])test('dos logins concurrentes serializados, empty='+empty,async()=>{
  const f=fixture({empty});const r=await Promise.all([f.login(),f.login()]);assert.deepEqual(r.map(r=>r.code).sort(),[200,403]);assert.equal(f.state.sessions.filter(s=>s.estado==='Activa').length,1);
  assert.equal(f.state.logs.filter(l=>l.accion==='INACTIVIDAD_EXCEDIDA').length,empty?0:1);
});
for(const fail of [/getConnection/,/INSERT INTO usuario_sesion/,/INSERT INTO auditoria_logs_sistema/,/UPDATE usuario_sesion/,/COMMIT/])test('fallo '+fail+' no concede acceso ni deja cambios parciales',async()=>{
  const f=fixture({fail}),before=JSON.stringify(f.state);const r=await f.login();assert.equal(r.code,500);assert.equal(JSON.stringify(f.state),before);assert.equal(r.body.token,undefined);assert.ok(!JSON.stringify(r.body).includes('ERROR_SINTETICO'));
});
test('fallo de firma revierte expiracion, nueva sesion y log',async()=>{const f=fixture({signFail:true}),before=JSON.stringify(f.state);assert.equal((await f.login()).code,500);assert.equal(JSON.stringify(f.state),before);});
test('token anterior no recupera acceso; token nuevo si',async()=>{const f=fixture(),r=await f.login();assert.equal(r.code,200);assert.equal((await f.check()).code,401);assert.equal((await f.check(r.body.token)).next,true);assert.equal(f.state.sessions[0].estado,'Expirada');});
test('JWT vencido no se confunde con inactividad',async()=>{const f=fixture({segundos:0});const token=jwt.sign({id_usuario:10,id_sesion:81,token_id:'ANTIGUO'},'SOLO_TEST',{expiresIn:-1});assert.equal((await f.check(token)).code,401);assert.equal(f.calls.length,0);});
test('middleware y login concurrentes emiten una sola expiracion',async()=>{const f=fixture();const [a,b]=await Promise.all([f.check(),f.login()]);assert.equal(a.code,401);assert.equal(b.code,200);assert.equal(f.state.logs.filter(l=>l.accion==='INACTIVIDAD_EXCEDIDA').length,1);assert.equal(f.state.alertas.length,1);});
test('replay/recuperacion no duplica hallazgos ni alertas',async()=>{const f=fixture();await f.login();await f.events.recuperar();await f.events.recuperar();assert.equal(f.state.hallazgos.length,1);assert.equal(f.state.alertas.length,1);});
test('fallo posterior al commit deja evento durable recuperable',async()=>{const f=fixture({fail:/INSERT INTO auditoria_alertas/});assert.equal((await f.login()).code,200);assert.equal(f.state.sessions[0].estado,'Expirada');assert.equal(f.state.alertas.length,0);assert.equal(f.state.hallazgos.length,0);assert.ok(f.state.logs.some(l=>l.accion==='INACTIVIDAD_EXCEDIDA'));f.fail=null;await f.events.recuperar();await f.events.recuperar();assert.equal(f.state.alertas.length,1);});
test('fallo de log en middleware no deja expiracion sin evidencia',async()=>{const f=fixture({fail:/INSERT INTO auditoria_logs_sistema/});assert.equal((await f.check()).code,503);assert.equal(f.state.sessions[0].estado,'Activa');assert.equal(f.state.logs.length,0);});
test('politica vigente se aplica sin cambiar configuracion',async()=>{const f=fixture({policy:{tiempo_inactividad_segundos:200}});assert.equal((await f.login()).code,403);f.policy.tiempo_inactividad_segundos=60;assert.equal((await f.login()).code,200);});
test('politica invalida falla cerrado',async()=>{const f=fixture({policy:{max_sesiones_activas:-1}});assert.equal((await f.login()).code,500);assert.equal(f.state.sessions.length,1);});
test('contrasena incorrecta no depura sesiones',async()=>{const f=fixture({password:false});assert.equal((await f.login()).code,401);assert.equal(f.state.sessions[0].estado,'Activa');assert.ok(!f.calls.some(q=>q.includes('ORDER BY id_sesion')));});
test('evidencia no contiene secreto, token ni password',async()=>{const f=fixture();const r=await f.login();const evidence=JSON.stringify({logs:f.state.logs,warnings:f.warnings});for(const value of ['NO_PUBLICAR','HASH_SIMULADO','SOLO_TEST',r.body.token])assert.ok(!evidence.includes(value));});
test('orden de locks usuario, politica, sesiones antes de insertar',async()=>{const f=fixture();await f.login();const index=pattern=>f.calls.findIndex(q=>pattern.test(q));assert.ok(index(/FROM usuarios.*FOR UPDATE/)<index(/FROM seguridad_politica_rol.*FOR SHARE/));assert.ok(index(/ORDER BY id_sesion FOR UPDATE/)<index(/INSERT INTO usuario_sesion/));});
test('limite de sesiones cero mantiene denegacion sin conceder acceso',async()=>{const f=fixture({empty:true,policy:{max_sesiones_activas:0}});assert.equal((await f.login()).code,403);assert.equal(f.state.sessions.length,0);});
test('inactividad cero conserva comparacion estricta',async()=>{for(const segundos of [0,1]){const f=fixture({segundos,policy:{tiempo_inactividad_segundos:0}});assert.equal((await f.login()).code,segundos?200:403);}});
for(const operation of ['login','check'])test('fallo rollback descarta conexion, '+operation,async()=>{const f=fixture({fail:/INSERT INTO auditoria_logs_sistema/,rollbackFail:true});assert.equal((await f[operation]()).code,operation==='login'?500:503);assert.equal(f.destroyed,1);assert.equal(f.state.sessions[0].estado,'Activa');});
test('HTTP local: login y JWT real con repositorio sintetico',async()=>{
  const express=require('express'),f=fixture(),app=express();app.use(express.json());
  app.post('/api/auth/login',f.controller.login);app.get('/privado',f.middleware,(req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({usuario:'ficticio',password:'NO_PUBLICAR'})});
    assert.equal(r.status,200);const body=await r.json();
    assert.equal((await fetch(base+'/privado',{headers:{authorization:'Bearer '+f.token}})).status,401);
    assert.equal((await fetch(base+'/privado',{headers:{authorization:'Bearer '+body.token}})).status,200);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
