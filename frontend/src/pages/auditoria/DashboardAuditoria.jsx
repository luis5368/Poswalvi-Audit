import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  PlayCircle,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingUp
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  ejecutarMotorAuditoria,
  obtenerResumenAuditoria
} from '../../services/auditoriaService';
import './auditoria.css';

const normalizarClase = (texto) => {
  return String(texto || '')
    .toLowerCase()
    .replaceAll(' ', '-')
    .replaceAll('ó', 'o')
    .replaceAll('í', 'i');
};

const formatFecha = (fecha) => {
  if (!fecha) return '-';

  return new Date(fecha).toLocaleString('es-GT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
};

const formatTiempo = (horas) => {
  if (horas === null || horas === undefined) return 'No medido';
  return `${Number(horas).toFixed(0)} h`;
};

const DashboardAuditoria = () => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);

  const cargarDashboard = async () => {
    try {
      setCargando(true);
      const response = await obtenerResumenAuditoria();
      setData(response);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar auditoría',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el resumen de auditoría'
      });
    } finally {
      setCargando(false);
    }
  };

  const ejecutarMotor = async () => {
    try {
      setEjecutando(true);

      const response = await ejecutarMotorAuditoria();

      await Swal.fire({
        icon: 'success',
        title: 'Motor ejecutado',
        text: `Reglas ejecutadas: ${response.total_reglas_ejecutadas || 0}. Hallazgos generados: ${response.total_hallazgos_generados || 0}.`
      });

      await cargarDashboard();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al ejecutar auditoría',
        text:
          error.response?.data?.mensaje ||
          'No se pudo ejecutar el motor de auditoría'
      });
    } finally {
      setEjecutando(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const resumen = data?.resumen;
  const tiempo = data?.tiempo_deteccion;

  return (
    <MainLayout>
      <div className="auditoria-header">
        <div>
          <h1>Auditoría Continua</h1>
          <p>
            Monitoreo automático de ventas, compras, inventario, caja y riesgos
            operativos.
          </p>
        </div>

        <div className="auditoria-actions">
          <button className="secondary-button" onClick={cargarDashboard}>
            Actualizar
          </button>

          <button
            className="primary-button"
            onClick={ejecutarMotor}
            disabled={ejecutando}
          >
            <PlayCircle size={18} />
            {ejecutando ? 'Ejecutando...' : 'Ejecutar motor'}
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="audit-loading">
          Cargando dashboard de auditoría...
        </div>
      ) : (
        <>
          <section className="audit-kpi-grid">
            <div className="audit-kpi-card">
              <div className="audit-kpi-icon blue">
                <FileSearch size={26} />
              </div>
              <span>Total hallazgos</span>
              <h2>{resumen?.total_hallazgos || 0}</h2>
              <small>{resumen?.hallazgos_ultimas_24h || 0} en últimas 24 horas</small>
            </div>

            <div className="audit-kpi-card">
              <div className="audit-kpi-icon orange">
                <Clock size={26} />
              </div>
              <span>Pendientes</span>
              <h2>{resumen?.pendientes || 0}</h2>
              <small>{resumen?.en_revision || 0} en revisión</small>
            </div>

            <div className="audit-kpi-card">
              <div className="audit-kpi-icon red">
                <ShieldAlert size={26} />
              </div>
              <span>Riesgo alto</span>
              <h2>{resumen?.riesgo_alto || 0}</h2>
              <small>{resumen?.riesgo_medio || 0} de riesgo medio</small>
            </div>

            <div className="audit-kpi-card">
              <div className="audit-kpi-icon green">
                <Timer size={26} />
              </div>
              <span>Tiempo promedio</span>
              <h2>{formatTiempo(tiempo?.promedio_horas)}</h2>
              <small>Detección de irregularidades</small>
            </div>
          </section>

          <section className="audit-grid">
            <div className="audit-panel large">
              <div className="audit-panel-header">
                <h3>Últimos hallazgos</h3>
                <span>Con evidencia registrada</span>
              </div>

              <div className="audit-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Regla</th>
                      <th>Módulo</th>
                      <th>Riesgo</th>
                      <th>Estado</th>
                      <th>Evidencias</th>
                      <th>Detección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.ultimos_hallazgos || []).map((hallazgo) => (
                      <tr key={hallazgo.id_hallazgo}>
                        <td>AUD-{String(hallazgo.id_hallazgo).padStart(4, '0')}</td>
                        <td>{hallazgo.codigo_regla}</td>
                        <td>{hallazgo.modulo_origen}</td>
                        <td>
                          <span className={`risk ${normalizarClase(hallazgo.nivel_riesgo)}`}>
                            {hallazgo.nivel_riesgo}
                          </span>
                        </td>
                        <td>
                          <span className={`audit-status ${normalizarClase(hallazgo.estado)}`}>
                            {hallazgo.estado}
                          </span>
                        </td>
                        <td>{hallazgo.total_evidencias || 0}</td>
                        <td>{formatFecha(hallazgo.fecha_deteccion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="audit-panel">
              <div className="audit-panel-header">
                <h3>Distribución por riesgo</h3>
                <span>Clasificación actual</span>
              </div>

              <div className="risk-list">
                {(data?.por_riesgo || []).map((item) => (
                  <div key={item.nivel_riesgo}>
                    <span className={`risk-dot ${normalizarClase(item.nivel_riesgo)}`} />
                    <p>{item.nivel_riesgo}</p>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="audit-panel">
              <div className="audit-panel-header">
                <h3>Hallazgos por estado</h3>
                <span>Flujo de revisión</span>
              </div>

              <div className="state-list">
                {(data?.por_estado || []).map((item) => (
                  <div key={item.estado}>
                    <span>{item.estado}</span>
                    <strong>{item.total}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="audit-panel large">
              <div className="audit-panel-header">
                <h3>Hallazgos por regla</h3>
                <span>Reglas con mayor incidencia</span>
              </div>

              <div className="rule-list">
                {(data?.por_regla || []).map((item) => (
                  <div className="rule-item" key={item.codigo_regla}>
                    <div>
                      <strong>{item.codigo_regla}</strong>
                      <span>{item.nombre_regla}</span>
                    </div>

                    <div className="rule-metrics">
                      <small>{item.modulo}</small>
                      <b>{item.total}</b>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="audit-panel">
              <div className="audit-panel-header">
                <h3>Críticos pendientes</h3>
                <span>Prioridad de revisión</span>
              </div>

              <div className="critical-audit-list">
                {(data?.criticos_pendientes || []).map((item) => (
                  <div key={item.id_hallazgo}>
                    <AlertTriangle size={18} />
                    <div>
                      <strong>{item.codigo_regla}</strong>
                      <span>{item.tipo_irregularidad}</span>
                    </div>
                  </div>
                ))}

                {(data?.criticos_pendientes || []).length === 0 && (
                  <div className="empty-audit">
                    No hay críticos pendientes.
                  </div>
                )}
              </div>
            </div>

            <div className="audit-panel">
              <div className="audit-panel-header">
                <h3>Estado de auditoría</h3>
                <span>Resumen ejecutivo</span>
              </div>

              <div className="audit-summary-list">
                <div>
                  <ShieldCheck size={20} />
                  <span>Confirmados</span>
                  <strong>{resumen?.confirmados || 0}</strong>
                </div>

                <div>
                  <CheckCircle2 size={20} />
                  <span>Corregidos</span>
                  <strong>{resumen?.corregidos || 0}</strong>
                </div>

                <div>
                  <TrendingUp size={20} />
                  <span>Reglas activas</span>
                  <strong>{data?.reglas_activas?.length || 0}</strong>
                </div>

                <div>
                  <Clock size={20} />
                  <span>Máximo detección</span>
                  <strong>{formatTiempo(tiempo?.maximo_horas)}</strong>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </MainLayout>
  );
};

export default DashboardAuditoria;