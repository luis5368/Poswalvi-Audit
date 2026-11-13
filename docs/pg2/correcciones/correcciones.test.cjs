const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('fs'),vm=require('vm');
const {session}=require('../cierre_funcional/pruebas/fixture.cjs');
const source=p=>fs.readFileSync(p,'utf8');
const metricas={};vm.runInNewContext(source('frontend/src/services/metricasAuditoria.js').replaceAll('export function','function')+';Object.assign(out,{formatDuracion,formatHoras});',{out:metricas});
for(const [input,expected] of [[12.5,'12.5 ms'],[1500,'1.50 s'],[120000,'2.00 min'],[null,'No disponible'],[-1,'No disponible'],[NaN,'No disponible']])test('Duracion '+input,()=>assert.equal(metricas.formatDuracion(input),expected));
for(const [input,expected] of [[201,'201.00 h'],[null,'No disponible'],[0,'0.00 h'],[1/3600,'< 0.01 h']])test('Resolucion '+input,()=>assert.equal(metricas.formatHoras(input),expected));
test('Motor real controlador: mide await del servicio, no antiguedad de hallazgos',async()=>{
 const m={exports:{}};let now=10,called=false;
 vm.runInNewContext(source('backend/src/controllers/auditoriaController.js'),{module:m,exports:m.exports,console,require:n=>{
 if(n==='node:perf_hooks')return {performance:{now:()=>now}};
 if(n==='../config/db')return {query:()=>{throw Error('BD_PROHIBIDA')}};
 if(n==='../services/auditoriaMotorService')return {ejecutarTodasLasReglas:async()=>{await Promise.resolve();called=true;now=22.5;return {ok:true,total_reglas_ejecutadas:8}}};throw Error(n);
 }});let result;await m.exports.ejecutarMotorCompleto({usuario:{id_usuario:1}},{json:x=>result=x,status:()=>{throw Error('Fallo controlador')}});assert.ok(called);assert.equal(result.ejecucion.duracion_ms,12.5);assert.equal(result.ejecucion.unidad,'ms');assert.equal(result.total_reglas_ejecutadas,8);
});
for(const fail of [/FROM usuarios u/,/FROM usuario_sesion/,/UPDATE usuario_sesion/])test('Fallo autenticacion repositorio devuelve 503 '+fail,()=>session({fail},async ask=>assert.equal((await ask('/api/auth/permisos')).status,503)));
test('Revocada conserva 401',()=>session({revocada:true},async ask=>assert.equal((await ask('/api/auth/permisos')).status,401)));
test('Rol inactivo conserva 403',()=>session({inactivo:true},async ask=>assert.equal((await ask('/api/auth/permisos')).status,403)));
for(const name of ['TokenExpiredError','JsonWebTokenError','NotBeforeError'])test('JWT '+name+' devuelve 401 sin consulta',async()=>{const m={exports:{}};vm.runInNewContext(source('backend/src/middlewares/authMiddleware.js'),{module:m,exports:m.exports,process:{env:{JWT_SECRET:'SINTETICO'}},require:n=>n==='jsonwebtoken'?{verify(){const e=Error('Sintetico');e.name=name;throw e}}:{query(){throw Error('CONSULTA_PROHIBIDA')}}});let code;await m.exports({headers:{authorization:'Bearer FICTICIO'}},{status:c=>{code=c;return {json(){}}}},()=>assert.fail('No debe continuar'));assert.equal(code,401)});

// Adaptador sintético: valida la consulta generada y modela fechas; no ejecuta SQL.
async function resumen(filas){const m={exports:{}},queries=[];const ahora=Date.parse('2026-11-13T12:00:00Z');
 const pool={query:async(q,p)=>{queries.push({q,p});if(q.includes('AS promedio_segundos')){
 assert.match(q,/TIMESTAMPDIFF\(SECOND,h.fecha_deteccion,h.fecha_revision\)/);assert.match(q,/h.estado IN \('Corregido','Descartado'\)/);assert.match(q,/h.fecha_revision>=h.fecha_deteccion/);assert.match(q,/h.fecha_revision<=NOW\(\)/);assert.match(q,/EXISTS/);assert.deepEqual(Array.from(p),[1,1,1,1]);
 const valid=filas.filter(x=>['Corregido','Descartado'].includes(x.estado)&&Number.isFinite(Date.parse(x.inicio))&&Number.isFinite(Date.parse(x.fin))&&Date.parse(x.fin)>=Date.parse(x.inicio)&&Date.parse(x.fin)<=ahora);const secs=valid.map(x=>(Date.parse(x.fin)-Date.parse(x.inicio))/1000);const promedio=secs.length?secs.reduce((a,b)=>a+b,0)/secs.length:null;return [[{casos_validos:secs.length,promedio_segundos:promedio,promedio_horas:promedio===null?null:promedio/3600}]];
 }return [[{}]];}};
 vm.runInNewContext(source('backend/src/controllers/auditoriaRevisionController.js'),{module:m,exports:m.exports,require:n=>n==='../config/db'?pool:{exigir:async()=>({}),sucursal:()=>1,responder:()=>{throw Error('Fallo resumen')}}});let result;await m.exports.resumen({}, {json:x=>result=x});return result.tiempo_resolucion;
}
test('Resolucion historica conserva 201 horas',async()=>{const r=await resumen([{estado:'Corregido',inicio:'2026-11-01T00:00:00Z',fin:'2026-11-09T09:00:00Z'}]);assert.equal(r.promedio_horas,201)});
test('Sin cerrados validos null, no cero',async()=>{const r=await resumen([{estado:'Pendiente',inicio:'2026-11-01',fin:'2026-11-02'}]);assert.equal(r.promedio_horas,null);assert.equal(r.casos_validos,0)});
test('Descartado y segundos fraccion de hora',async()=>{const r=await resumen([{estado:'Descartado',inicio:'2026-11-01T00:00:00Z',fin:'2026-11-01T00:00:30Z'}]);assert.equal(r.promedio_segundos,30);assert.equal(r.promedio_horas,1/120)});
test('Excluye invertidas futuras nulas y abiertas',async()=>{const r=await resumen([{estado:'Corregido',inicio:'2026-11-03',fin:'2026-11-01'},{estado:'Corregido',inicio:'2026-11-01',fin:'2099-01-01'},{estado:'Corregido',inicio:'invalida',fin:null},{estado:'Confirmado',inicio:'2026-11-01',fin:'2026-11-02'}]);assert.equal(r.casos_validos,0)});
