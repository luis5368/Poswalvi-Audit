const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),cp=require('child_process');
function entorno(original=false){let state,refs=[],cursor=0,effect,cleanup;const requests=[];
 let text=original?fs.readFileSync(require('node:path').join(__dirname,'permisos-antes.fixture.txt'),'utf8'):fs.readFileSync('frontend/src/context/usePermisosSesion.js','utf8');
 text=text.replace(/^import .*;\r?\n/gm,'').replace('export default function','function');const out={};
 vm.runInNewContext(text+';out.hook=usePermisosSesion;',{
 out,AbortController,trazaNavegacion(){},useState:init=>{state??=init;return [state,v=>state=typeof v==='function'?v(state):v]},useRef:init=>{const i=cursor++;return refs[i]??=( {current:init})},useCallback:f=>f,useEffect:f=>effect=f,
 api:{get:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))},validarPermisos:d=>{if(!Array.isArray(d.permisos))throw Error('Contrato invalido');return d.permisos},setInterval:()=>1,clearInterval(){},window:{addEventListener(){},removeEventListener(){}}
 });
 const render=token=>{cursor=0;return out.hook(token)};
 return {requests,get state(){return state},render,mount(token){cleanup?.();const r=render(token);cleanup=effect();return r}};
}
const ok=(r,p=['Clientes:Consultar'])=>r.resolve({data:{permisos:p,sucursal:1}});
const tick=()=>new Promise(r=>setImmediate(r));
test('Caracterizacion fixture anterior: polling vacia permisos y vuelve a cargando',async()=>{const e=entorno(true);e.mount('A');ok(e.requests[0]);await tick();e.render('A').refrescarPermisos();assert.equal(e.state.estado,'cargando');assert.equal(e.state.permisos.length,0)});
test('Corregido: polling pendiente conserva permiso y estado disponible',async()=>{const e=entorno();e.mount('A');ok(e.requests[0]);await tick();e.render('A').refrescarPermisos();assert.equal(e.state.estado,'disponible');assert.equal(e.state.permisos[0],'Clientes:Consultar')});
for(const code of [500,503])test('Fondo '+code+' conserva vista previamente autorizada',async()=>{const e=entorno();e.mount('A');ok(e.requests[0]);await tick();e.render('A').refrescarPermisos();e.requests[1].reject({response:{status:code}});await tick();assert.equal(e.state.estado,'disponible')});
test('503 inicial no concede acceso',async()=>{const e=entorno();e.mount('A');e.requests[0].reject({response:{status:503}});await tick();assert.equal(e.state.permisos.length,0);assert.equal(e.state.estado,'error')});
test('Respuesta tardia de usuario anterior descartada',async()=>{const e=entorno();e.mount('A');e.mount('B');ok(e.requests[1],[]);await tick();ok(e.requests[0]);await tick();assert.equal(e.state.token,'B');assert.equal(e.state.permisos.length,0)});
test('Logout descarta respuesta pendiente',async()=>{const e=entorno();e.mount('A');e.mount(null);ok(e.requests[0]);await tick();assert.equal(e.state.estado,'sin_sesion')});
test('Concurrencia misma sesion conserva resultado mas reciente',async()=>{const e=entorno();e.mount('A');e.render('A').refrescarPermisos();ok(e.requests[1],[]);await tick();ok(e.requests[0]);await tick();assert.equal(e.state.permisos.length,0)});
test('Contrato invalido deniega aunque antes autorizado',async()=>{const e=entorno();e.mount('A');ok(e.requests[0]);await tick();e.render('A').refrescarPermisos();e.requests[1].resolve({data:{}});await tick();assert.equal(e.state.permisos.length,0)});
for(const codigo of ['ROL_INACTIVO','CAMBIO_PASSWORD_REQUERIDO'])test(codigo+' no conserva permisos previos',async()=>{const e=entorno();e.mount('A');ok(e.requests[0]);await tick();e.render('A').refrescarPermisos();e.requests[1].reject({response:{status:403,data:{codigo}}});await tick();assert.equal(e.state.estado,codigo);assert.equal(e.state.permisos.length,0)});
test('Refresco no borra cambio obligatorio mientras espera',async()=>{const e=entorno();e.mount('A');e.requests[0].reject({response:{status:403,data:{codigo:'CAMBIO_PASSWORD_REQUERIDO'}}});await tick();e.render('A').refrescarPermisos();assert.equal(e.state.estado,'CAMBIO_PASSWORD_REQUERIDO');assert.equal(e.state.permisos.length,0)});
