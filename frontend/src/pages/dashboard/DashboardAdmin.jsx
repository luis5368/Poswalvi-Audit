import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageCheck,
  ShieldAlert,
  ShoppingCart,
  WalletCards
} from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import { obtenerResumenDashboardAdmin } from '../../services/dashboardAdminService';
import './dashboard.css';

const formatMoney = (value) => {
  return `Q ${Number(value || 0).toFixed(2)}`;
};

const DashboardAdmin = () => {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarDashboard = async () => {
    try {
      setCargando(true);
      const response = await obtenerResumenDashboardAdmin();
      setData(response);
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDashboard();
  }, []);

  const resumen = data?.resumen;

  return (
    <MainLayout>
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Resumen general del sistema, operaciones y auditoría continua.</p>
        </div>

        <button onClick={cargarDashboard}>
          Actualizar
        </button>
      </div>

      {cargando ? (
        <div className="loading-box">
          Cargando información del dashboard...
        </div>
      ) : (
        <>
          <section className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon green">
                <ShoppingCart size={26} />
              </div>
              <span>Ventas del día</span>
              <h2>{formatMoney(resumen?.ventas_dia?.monto_ventas)}</h2>
              <small>{resumen?.ventas_dia?.total_ventas || 0} transacciones</small>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon blue">
                <Boxes size={26} />
              </div>
              <span>Unidades en stock</span>
              <h2>{resumen?.inventario?.unidades_en_stock || 0}</h2>
              <small>{resumen?.inventario?.productos_con_saldo || 0} productos con saldo</small>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon purple">
                <PackageCheck size={26} />
              </div>
              <span>Compras del día</span>
              <h2>{formatMoney(resumen?.compras_dia?.monto_compras)}</h2>
              <small>{resumen?.compras_dia?.total_compras || 0} compras registradas</small>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon orange">
                <ShieldAlert size={26} />
              </div>
              <span>Hallazgos auditoría</span>
              <h2>{resumen?.auditoria?.total_hallazgos || 0}</h2>
              <small>{resumen?.auditoria?.pendientes || 0} pendientes</small>
            </div>
          </section>

          <section className="dashboard-grid">
            <div className="panel large">
              <div className="panel-header">
                <h3>Últimas ventas</h3>
                <span>Operaciones recientes</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Cliente</th>
                      <th>Sucursal</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.ultimas_ventas || []).map((venta) => (
                      <tr key={venta.id_venta}>
                        <td>{venta.numero_documento}</td>
                        <td>{venta.nombre_cliente}</td>
                        <td>{venta.nombre_sucursal || '-'}</td>
                        <td>{formatMoney(venta.total)}</td>
                        <td>
                          <span className={`status ${venta.estado?.toLowerCase()}`}>
                            {venta.estado}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {(data?.ultimas_ventas || []).length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-cell">
                          No hay ventas recientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Inventario crítico</h3>
                <span>Stock bajo o sin stock</span>
              </div>

              <div className="critical-list">
                {(data?.productos_criticos || []).map((item) => (
                  <div className="critical-item" key={item.id_producto}>
                    <div>
                      <strong>{item.codigo_producto}</strong>
                      <span>{item.nombre_producto}</span>
                    </div>

                    <div className="stock-pill">
                      {item.stock_actual}
                    </div>
                  </div>
                ))}

                {(data?.productos_criticos || []).length === 0 && (
                  <div className="empty-box">
                    Sin productos críticos.
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Estado operativo</h3>
                <span>Resumen de control</span>
              </div>

              <div className="summary-list">
                <div>
                  <WalletCards size={20} />
                  <span>Turnos abiertos</span>
                  <strong>{resumen?.caja?.turnos_abiertos || 0}</strong>
                </div>

                <div>
                  <AlertTriangle size={20} />
                  <span>Stock crítico</span>
                  <strong>{resumen?.inventario?.productos_stock_critico || 0}</strong>
                </div>

                <div>
                  <ShieldAlert size={20} />
                  <span>Riesgo alto</span>
                  <strong>{resumen?.auditoria?.riesgo_alto || 0}</strong>
                </div>

                <div>
                  <ClipboardList size={20} />
                  <span>Hallazgos pendientes</span>
                  <strong>{resumen?.auditoria?.pendientes || 0}</strong>
                </div>
              </div>
            </div>

            <div className="panel large">
              <div className="panel-header">
                <h3>Últimos movimientos de inventario</h3>
                <span>Trazabilidad operativa</span>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Tipo</th>
                      <th>Origen</th>
                      <th>Cantidad</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.ultimos_movimientos || []).map((mov) => (
                      <tr key={mov.id_movimiento}>
                        <td>{mov.codigo_producto}</td>
                        <td>{mov.tipo_movimiento}</td>
                        <td>{mov.origen}</td>
                        <td>{mov.cantidad}</td>
                        <td>
                          {mov.stock_anterior} → {mov.stock_nuevo}
                        </td>
                      </tr>
                    ))}

                    {(data?.ultimos_movimientos || []).length === 0 && (
                      <tr>
                        <td colSpan="5" className="empty-cell">
                          No hay movimientos recientes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </MainLayout>
  );
};

export default DashboardAdmin;