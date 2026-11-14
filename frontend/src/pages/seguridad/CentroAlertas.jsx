import {useEffect,useRef,useState} from 'react';
import MainLayout from '../../components/layout/MainLayout';
import {useAuth} from '../../context/AuthContext';
import api from '../../services/api';
import '../clientes/clientes.css';
import '../auditoria/auditoria.css';
import './alertas.css';

const fecha=v=>v ? new Date(v).toLocaleString('es-GT') : 'No disponible';
function Contenido({reconocer}) {
  const [form,setForm]=useState({desde:'',hasta:'',estado:'',regla:'',riesgo:''});
  const [consulta,setConsulta]=useState({pagina:1,limite:25});
  const [datos,setDatos]=useState(null),[detalle,setDetalle]=useState(null),[id,setId]=useState(null);
  const [error,setError]=useState(''),[errorDetalle,setErrorDetalle]=useState(''),[busy,setBusy]=useState(false),[guardando,setGuardando]=useState(false),[revision,setRevision]=useState(0);
  const vivo=useRef(true);
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
  useEffect(()=>{
    const abort=new AbortController();setBusy(true);setError('');setDatos(null);
    api.get('/alertas-seguridad',{params:consulta,signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setDatos(r.data);}).catch(e=>{if(!abort.signal.aborted)setError(e.response?.data?.mensaje||'No se pudieron consultar las alertas.');}).finally(()=>{if(!abort.signal.aborted)setBusy(false);});
    return()=>abort.abort();
  },[consulta,revision]);
  useEffect(()=>{
    const abort=new AbortController();setDetalle(null);setErrorDetalle('');
    if(id)api.get('/alertas-seguridad/'+id,{signal:abort.signal}).then(r=>{if(!abort.signal.aborted)setDetalle(r.data);}).catch(e=>{if(!abort.signal.aborted)setErrorDetalle(e.response?.data?.mensaje||'No se pudo consultar la trazabilidad.');});
    return()=>abort.abort();
  },[id,revision]);
  async function marcar(){
    if(guardando||!reconocer||!detalle)return;setGuardando(true);setErrorDetalle('');
    try{await api.patch('/alertas-seguridad/'+detalle.alerta.id_alerta+'/leida',{});if(vivo.current)setRevision(r=>r+1);}
    catch(e){if(vivo.current)setErrorDetalle(e.response?.data?.mensaje||'No se pudo confirmar la lectura. Consulte el detalle antes de reintentar.');}
    finally{if(vivo.current)setGuardando(false);}
  }
  function filtrar(e){e.preventDefault();setId(null);setConsulta({...Object.fromEntries(Object.entries(form).filter(([,v])=>v)),pagina:1,limite:25});}
  const ind=datos?.indicadores;
  return <div className="audit-review centro-alertas">
    <header className="clientes-header"><div><h1>Centro de Alertas de Seguridad</h1><p>Alertas almacenadas por el motor. Consultarlas no confirma su lectura ni su entrega.</p></div></header>
    <form className="alertas-filtros" onSubmit={filtrar}>
      {['desde','hasta'].map(k=><label key={k}>{k==='desde'?'Generadas desde':'Generadas hasta'}<input type="date" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}
      <label>Estado<select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})}><option value="">Todos</option>{['Pendiente','Enviada','Leida','Fallida'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Regla (código)<input value={form.regla} placeholder="IP_NO_HABITUAL" maxLength={100} onChange={e=>setForm({...form,regla:e.target.value.toUpperCase()})}/></label>
      <label>Riesgo<select value={form.riesgo} onChange={e=>setForm({...form,riesgo:e.target.value})}><option value="">Todos</option>{['Bajo','Medio','Alto','Critico'].map(v=><option key={v}>{v}</option>)}</select></label>
      <button className="secondary-client-button" disabled={busy||guardando}>Consultar</button>
    </form>
    {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Consultando alertas…</p>}
    {ind&&<><p>Indicadores del conjunto filtrado, no solo de esta página.</p><dl className="alertas-indicadores">
      <div><dt>Pendientes</dt><dd>{ind.pendientes}</dd></div><div><dt>Leídas</dt><dd>{ind.leidas}</dd></div><div><dt>Riesgo alto o crítico</dt><dd>{ind.riesgo_alto}</dd></div><div><dt>Evento a generación (promedio)</dt><dd>{ind.promedio_generacion_segundos==null?'No disponible':Number(ind.promedio_generacion_segundos).toFixed(1)+' s'}</dd></div>
    </dl></>}
    {datos&&<section className="clientes-panel" aria-label="Alertas almacenadas"><div className="clientes-table-wrap" tabIndex={0} aria-label="Tabla desplazable de alertas"><table className="clientes-table"><thead><tr>{['ID','Regla','Riesgo','Descripción','Evento','Generación','Estado','Acciones'].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{datos.data.map(a=><tr key={a.id_alerta}><td>{a.id_alerta}</td><td>{a.codigo_regla}</td><td>{a.nivel_riesgo}</td><td>{a.descripcion}</td><td className="alerta-fecha">{fecha(a.fecha_evento)}</td><td className="alerta-fecha">{fecha(a.fecha_generacion)}</td><td>{a.estado}</td><td><button className="secondary-client-button" disabled={guardando} onClick={()=>setId(a.id_alerta)} aria-label={'Ver trazabilidad de alerta '+a.id_alerta}>Detalle</button></td></tr>)}</tbody></table></div>
      {!datos.data.length&&<p>Sin alertas para estos filtros.</p>}
      <nav className="alertas-paginacion" aria-label="Paginación de alertas"><button className="secondary-client-button" disabled={busy||guardando||consulta.pagina<=1} onClick={()=>setConsulta(p=>({...p,pagina:p.pagina-1}))}>Anterior</button><span>Página {datos.pagina} · {ind.total} alertas</span><button className="secondary-client-button" disabled={busy||guardando||consulta.pagina*consulta.limite>=Number(ind.total)} onClick={()=>setConsulta(p=>({...p,pagina:p.pagina+1}))}>Siguiente</button></nav>
    </section>}
    {id&&<section className="audit-review-detail" aria-label="Trazabilidad de alerta"><h2>Alerta {id}</h2>{errorDetalle&&<p role="alert">{errorDetalle}</p>}{!detalle&&!errorDetalle&&<p role="status">Consultando detalle…</p>}{detalle&&<><p>{detalle.alerta.descripcion}</p><p>Hallazgo: {detalle.trazabilidad.id_hallazgo} · Log: {detalle.trazabilidad.log?.id_log||'No disponible'}</p><p>Evento registrado: {fecha(detalle.trazabilidad.log?.fecha_log)}</p><p>Detección: {fecha(detalle.alerta.fecha_deteccion)}</p><p>Generación: {fecha(detalle.alerta.fecha_generacion)} · Estado: {detalle.alerta.estado}</p><p>Lectura: {fecha(detalle.alerta.fecha_lectura)}</p>{reconocer&&detalle.alerta.estado!=='Leida'&&<button className="primary-client-button" disabled={guardando} onClick={marcar}>{guardando?'Registrando…':'Marcar como leída'}</button>}</>}<button className="secondary-client-button" disabled={guardando} onClick={()=>setId(null)}>Cerrar detalle</button></section>}
  </div>;
}
export default function CentroAlertas(){const {token,puede}=useAuth();return <MainLayout>{puede('AlertasSeguridad','Consultar')?<Contenido key={token} reconocer={puede('AlertasSeguridad','Reconocer')}/>:<p role="alert">No tiene permiso para consultar alertas de seguridad.</p>}</MainLayout>;}
