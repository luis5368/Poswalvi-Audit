import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardEdit,
  PackageSearch,
  RefreshCw,
  Search,
  TrendingDown,
  Warehouse
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  ajustarInventarioSaldo,
  obtenerInventarioSaldos
} from '../../services/inventarioService';
import './inventario.css';

const estadoStockClase = (estado) => {
  return String(estado || '')
    .toLowerCase()
    .replaceAll(' ', '-');
};

const Inventario = () => {
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [saldoEditando, setSaldoEditando] = useState(null);

  const [form, setForm] = useState({
    stock_nuevo: '',
    motivo: ''
  });

  const resumen = useMemo(() => {
    const totalProductos = inventario.length;

    const stockNormal = inventario.filter(
      (item) => item.estado_stock === 'Normal'
    ).length;

    const stockBajo = inventario.filter(
      (item) => item.estado_stock === 'Stock bajo'
    ).length;

    const sinStock = inventario.filter(
      (item) => item.estado_stock === 'Sin stock'
    ).length;

    const stockNegativo = inventario.filter(
      (item) => item.estado_stock === 'Stock negativo'
    ).length;

    const unidadesTotales = inventario.reduce((total, item) => {
      return total + Number(item.stock_actual || 0);
    }, 0);

    return {
      totalProductos,
      stockNormal,
      stockBajo,
      sinStock,
      stockNegativo,
      unidadesTotales
    };
  }, [inventario]);

  const cargarInventario = async () => {
    try {
      setCargando(true);

      const response = await obtenerInventarioSaldos({
        buscar: busqueda || undefined,
        solo_bajo_stock: soloCriticos ? 'true' : undefined
      });

      setInventario(response.inventario || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar inventario',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el inventario'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarInventario();
  }, []);

  const abrirAjuste = (saldo) => {
    setSaldoEditando(saldo);

    setForm({
      stock_nuevo: saldo.stock_actual,
      motivo: ''
    });

    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setSaldoEditando(null);

    setForm({
      stock_nuevo: '',
      motivo: ''
    });
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const guardarAjuste = async (e) => {
    e.preventDefault();

    const stockNuevo = Number(form.stock_nuevo);

    if (!Number.isInteger(stockNuevo)) {
      Swal.fire({
        icon: 'warning',
        title: 'Stock inválido',
        text: 'El stock nuevo debe ser un número entero'
      });
      return;
    }

    if (!form.motivo.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Motivo obligatorio',
        text: 'Ingresa el motivo del ajuste de inventario'
      });
      return;
    }

    if (Number(saldoEditando.stock_actual) === stockNuevo) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin cambios',
        text: 'El stock nuevo es igual al stock actual'
      });
      return;
    }

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Registrar ajuste de inventario?',
      html: `
        <div style="text-align:left">
          <p><b>Producto:</b> ${saldoEditando.codigo_producto}</p>
          <p><b>Stock actual:</b> ${saldoEditando.stock_actual}</p>
          <p><b>Stock nuevo:</b> ${stockNuevo}</p>
          <p><b>Diferencia:</b> ${stockNuevo - Number(saldoEditando.stock_actual)}</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Sí, ajustar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await ajustarInventarioSaldo(saldoEditando.id_saldo, {
        stock_nuevo: stockNuevo,
        motivo: form.motivo.trim()
      });

      await Swal.fire({
        icon: 'success',
        title: 'Inventario ajustado',
        timer: 1400,
        showConfirmButton: false
      });

      cerrarModal();
      cargarInventario();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo ajustar',
        text:
          error.response?.data?.mensaje ||
          'Error interno al ajustar inventario'
      });
    }
  };

  return (
    <MainLayout>
      <div className="inventario-header">
        <div>
          <h1>Inventario</h1>
          <p>
            Consulta de saldos, stock crítico y ajustes manuales con trazabilidad.
          </p>
        </div>

        <div className="inventario-actions">
          <button
            className="secondary-inventory-button"
            onClick={cargarInventario}
          >
            <RefreshCw size={18} />
            Actualizar
          </button>
        </div>
      </div>

      <section className="inventory-kpi-grid">
        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon blue">
            <Boxes size={26} />
          </div>
          <span>Productos con saldo</span>
          <h2>{resumen.totalProductos}</h2>
          <small>Registros de inventario</small>
        </div>

        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon green">
            <CheckCircle2 size={26} />
          </div>
          <span>Stock normal</span>
          <h2>{resumen.stockNormal}</h2>
          <small>Productos sin alerta</small>
        </div>

        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon orange">
            <AlertTriangle size={26} />
          </div>
          <span>Stock crítico</span>
          <h2>{resumen.stockBajo + resumen.sinStock + resumen.stockNegativo}</h2>
          <small>
            Bajo: {resumen.stockBajo} | Cero: {resumen.sinStock} | Negativo:{' '}
            {resumen.stockNegativo}
          </small>
        </div>

        <div className="inventory-kpi-card">
          <div className="inventory-kpi-icon purple">
            <Warehouse size={26} />
          </div>
          <span>Unidades totales</span>
          <h2>{resumen.unidadesTotales}</h2>
          <small>Suma de stock actual</small>
        </div>
      </section>

      <section className="inventario-toolbar">
        <div className="inventario-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por código, producto, sucursal o bodega..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarInventario();
            }}
          />
        </div>

        <label className="critical-toggle">
          <input
            type="checkbox"
            checked={soloCriticos}
            onChange={(e) => setSoloCriticos(e.target.checked)}
          />
          Solo críticos
        </label>

        <button onClick={cargarInventario}>Buscar</button>
      </section>

      <section className="inventario-panel">
        <div className="inventario-panel-header">
          <div>
            <h3>Saldos de inventario</h3>
            <span>{inventario.length} registros</span>
          </div>

          <div className="inventario-panel-icon">
            <PackageSearch size={22} />
          </div>
        </div>

        <div className="inventario-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Sucursal</th>
                <th>Bodega</th>
                <th>Stock actual</th>
                <th>Mínimo</th>
                <th>Máximo</th>
                <th>Estado stock</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {inventario.map((item) => (
                <tr key={item.id_saldo}>
                  <td>
                    <strong>{item.codigo_producto}</strong>
                    <small>{item.nombre_producto}</small>
                  </td>

                  <td>{item.nombre_sucursal}</td>

                  <td>{item.nombre_bodega || '-'}</td>

                  <td>
                    <span
                      className={
                        Number(item.stock_actual) < 0
                          ? 'stock-number negative'
                          : 'stock-number'
                      }
                    >
                      {item.stock_actual}
                    </span>
                  </td>

                  <td>{item.stock_minimo}</td>

                  <td>{item.stock_maximo}</td>

                  <td>
                    <span
                      className={`stock-status ${estadoStockClase(
                        item.estado_stock
                      )}`}
                    >
                      {item.estado_stock}
                    </span>
                  </td>

                  <td>
                    {item.actualizado_en
                      ? new Date(item.actualizado_en).toLocaleString('es-GT')
                      : '-'}
                  </td>

                  <td>
                    <div className="inventory-actions-cell">
                      <button
                        title="Ajustar inventario"
                        onClick={() => abrirAjuste(item)}
                      >
                        <ClipboardEdit size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && inventario.length === 0 && (
                <tr>
                  <td colSpan="9" className="inventario-empty">
                    No hay saldos de inventario para mostrar.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="9" className="inventario-empty">
                    Cargando inventario...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="inventario-modal-backdrop">
          <div className="inventario-modal">
            <div className="inventario-modal-header">
              <h2>Ajuste de inventario</h2>
              <button onClick={cerrarModal}>×</button>
            </div>

            <form onSubmit={guardarAjuste} className="inventario-form">
              <div className="inventory-product-box">
                <div>
                  <strong>{saldoEditando?.codigo_producto}</strong>
                  <span>{saldoEditando?.nombre_producto}</span>
                </div>

                <div>
                  <small>Ubicación</small>
                  <p>
                    {saldoEditando?.nombre_sucursal} /{' '}
                    {saldoEditando?.nombre_bodega || '-'}
                  </p>
                </div>
              </div>

              <div className="inventory-adjust-grid">
                <div className="inventory-stock-card">
                  <span>Stock actual</span>
                  <strong>{saldoEditando?.stock_actual}</strong>
                </div>

                <label>
                  Stock nuevo
                  <input
                    type="number"
                    step="1"
                    name="stock_nuevo"
                    value={form.stock_nuevo}
                    onChange={handleChange}
                  />
                </label>

                <div className="inventory-diff-card">
                  <span>Diferencia</span>
                  <strong>
                    {form.stock_nuevo === ''
                      ? 0
                      : Number(form.stock_nuevo) -
                        Number(saldoEditando?.stock_actual || 0)}
                  </strong>
                </div>
              </div>

              <label>
                Motivo del ajuste
                <textarea
                  name="motivo"
                  value={form.motivo}
                  onChange={handleChange}
                  placeholder="Ej. Ajuste manual por conteo físico de inventario"
                />
              </label>

              <div className="inventory-warning-box">
                <TrendingDown size={18} />
                <span>
                  Todo ajuste queda registrado como movimiento de inventario y
                  puede generar hallazgos de auditoría.
                </span>
              </div>

              <div className="inventario-modal-actions">
                <button
                  type="button"
                  className="cancel-inventory-button"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-inventory-button">
                  Guardar ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Inventario;