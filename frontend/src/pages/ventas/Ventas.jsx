import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Eye,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  anularVenta,
  crearVenta,
  obtenerClientesVenta,
  obtenerMetodosPago,
  obtenerProductosVenta,
  obtenerTurnoActivoCaja,
  obtenerVentaPorId,
  obtenerVentas
} from '../../services/ventasService';
import './ventas.css';

const formatMoney = (value) => {
  return `Q ${Number(value || 0).toFixed(2)}`;
};

const estadoClase = (estado) => {
  return String(estado || '').toLowerCase();
};

const redondear2 = (valor) => {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
};

const Ventas = () => {
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [metodosPago, setMetodosPago] = useState([]);
  const [turnoActivo, setTurnoActivo] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [ventaDetalle, setVentaDetalle] = useState(null);

  const [form, setForm] = useState({
    id_cliente: '',
    descuento: 0,
    observaciones: '',
    id_producto: '',
    cantidad: 1,
    descuento_linea: 0,
    id_metodo_pago: '',
    monto_pago: '',
    referencia: ''
  });

  const [detalle, setDetalle] = useState([]);
  const [pagos, setPagos] = useState([]);

  const subtotal = useMemo(() => {
    return redondear2(
      detalle.reduce((total, item) => total + Number(item.subtotal || 0), 0)
    );
  }, [detalle]);

  const descuentoGeneral = useMemo(() => {
    return redondear2(Number(form.descuento || 0));
  }, [form.descuento]);

  const baseImponible = useMemo(() => {
    return redondear2(subtotal - descuentoGeneral);
  }, [subtotal, descuentoGeneral]);

  const impuesto = useMemo(() => {
    return redondear2(baseImponible * 0.12);
  }, [baseImponible]);

  const total = useMemo(() => {
    return redondear2(baseImponible + impuesto);
  }, [baseImponible, impuesto]);

  const totalPagos = useMemo(() => {
    return redondear2(
      pagos.reduce((suma, pago) => suma + Number(pago.monto || 0), 0)
    );
  }, [pagos]);

  const diferenciaPagos = useMemo(() => {
    return redondear2(total - totalPagos);
  }, [total, totalPagos]);

  const cargarVentas = async () => {
    try {
      setCargando(true);

      const response = await obtenerVentas({
        buscar: busqueda || undefined
      });

      setVentas(response.ventas || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar ventas',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el listado de ventas'
      });
    } finally {
      setCargando(false);
    }
  };

  const cargarCatalogosVenta = async () => {
    try {
      const [clientesResponse, productosResponse, metodosResponse] =
        await Promise.all([
          obtenerClientesVenta({ estado: 'Activo' }),
          obtenerProductosVenta({ estado: 'Activo' }),
          obtenerMetodosPago()
        ]);

      setClientes(clientesResponse.clientes || []);
      setProductos(productosResponse.productos || []);
      setMetodosPago(metodosResponse.metodos_pago || metodosResponse.metodos || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar catálogos de venta',
        text:
          error.response?.data?.mensaje ||
          'No se pudieron cargar clientes, productos o métodos de pago'
      });
    }
  };

  const cargarTurnoActivo = async () => {
    try {
      const response = await obtenerTurnoActivoCaja(1);

      if (response.tiene_turno_activo) {
        setTurnoActivo(response.turno);
      } else {
        setTurnoActivo(null);
      }
    } catch (error) {
      setTurnoActivo(null);
    }
  };

  useEffect(() => {
    cargarVentas();
    cargarCatalogosVenta();
    cargarTurnoActivo();
  }, []);

  const limpiarVenta = () => {
    setForm({
      id_cliente: '',
      descuento: 0,
      observaciones: '',
      id_producto: '',
      cantidad: 1,
      descuento_linea: 0,
      id_metodo_pago: '',
      monto_pago: '',
      referencia: ''
    });

    setDetalle([]);
    setPagos([]);
  };

  const abrirNuevaVenta = async () => {
    await cargarTurnoActivo();

    if (!turnoActivo) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin turno activo',
        text: 'Debes tener un turno de caja abierto para registrar ventas.'
      });
      return;
    }

    limpiarVenta();
    setModalAbierto(true);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const agregarProducto = () => {
    if (!form.id_producto) {
      Swal.fire('Producto requerido', 'Selecciona un producto', 'warning');
      return;
    }

    const producto = productos.find(
      (item) => Number(item.id_producto) === Number(form.id_producto)
    );

    if (!producto) {
      Swal.fire('Producto inválido', 'El producto seleccionado no existe', 'warning');
      return;
    }

    if (producto.estado !== 'Activo') {
      Swal.fire('Producto inactivo', 'No puedes vender un producto inactivo', 'warning');
      return;
    }

    const cantidad = Number(form.cantidad);
    const descuentoLinea = redondear2(form.descuento_linea || 0);
    const precioUnitario = redondear2(producto.precio_venta);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      Swal.fire(
        'Cantidad inválida',
        'La cantidad debe ser un número entero mayor a 0',
        'warning'
      );
      return;
    }

    const subtotalBruto = redondear2(precioUnitario * cantidad);

    if (descuentoLinea < 0 || descuentoLinea > subtotalBruto) {
      Swal.fire(
        'Descuento inválido',
        'El descuento no puede ser negativo ni mayor al subtotal de la línea',
        'warning'
      );
      return;
    }

    const existe = detalle.find(
      (item) => Number(item.id_producto) === Number(producto.id_producto)
    );

    if (existe) {
      Swal.fire({
        icon: 'warning',
        title: 'Producto ya agregado',
        text: 'El producto ya existe en el detalle. Elimínalo y vuelve a agregarlo si necesitas cambiar cantidad.'
      });
      return;
    }

    const subtotalLinea = redondear2(subtotalBruto - descuentoLinea);

    setDetalle([
      ...detalle,
      {
        id_producto: producto.id_producto,
        codigo_producto: producto.codigo_producto,
        nombre_producto: producto.nombre_producto,
        cantidad,
        precio_unitario: precioUnitario,
        descuento: descuentoLinea,
        subtotal: subtotalLinea
      }
    ]);

    setForm({
      ...form,
      id_producto: '',
      cantidad: 1,
      descuento_linea: 0
    });
  };

  const eliminarProducto = (idProducto) => {
    setDetalle(
      detalle.filter((item) => Number(item.id_producto) !== Number(idProducto))
    );
  };

  const agregarPago = () => {
    if (!form.id_metodo_pago) {
      Swal.fire('Método requerido', 'Selecciona un método de pago', 'warning');
      return;
    }

    const metodo = metodosPago.find(
      (item) => Number(item.id_metodo_pago) === Number(form.id_metodo_pago)
    );

    if (!metodo) {
      Swal.fire('Método inválido', 'El método seleccionado no existe', 'warning');
      return;
    }

    const monto = redondear2(form.monto_pago);

    if (Number.isNaN(monto) || monto <= 0) {
      Swal.fire('Monto inválido', 'El monto del pago debe ser mayor a 0', 'warning');
      return;
    }

    if (Number(metodo.requiere_referencia) === 1 && !form.referencia.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Referencia obligatoria',
        text: `El método de pago ${metodo.nombre_metodo} requiere referencia`
      });
      return;
    }

    setPagos([
      ...pagos,
      {
        id_metodo_pago: metodo.id_metodo_pago,
        nombre_metodo: metodo.nombre_metodo,
        monto,
        referencia: form.referencia.trim() || null
      }
    ]);

    setForm({
      ...form,
      id_metodo_pago: '',
      monto_pago: '',
      referencia: ''
    });
  };

  const eliminarPago = (index) => {
    setPagos(pagos.filter((_, i) => i !== index));
  };

  const registrarVenta = async (e) => {
    e.preventDefault();

    if (!form.id_cliente) {
      Swal.fire('Cliente requerido', 'Selecciona un cliente', 'warning');
      return;
    }

    if (detalle.length === 0) {
      Swal.fire('Detalle vacío', 'Agrega al menos un producto', 'warning');
      return;
    }

    if (descuentoGeneral < 0 || descuentoGeneral > subtotal) {
      Swal.fire(
        'Descuento inválido',
        'El descuento general no puede ser negativo ni mayor al subtotal',
        'warning'
      );
      return;
    }

    if (pagos.length === 0) {
      Swal.fire('Pago requerido', 'Registra al menos un pago', 'warning');
      return;
    }

    if (Math.abs(diferenciaPagos) > 0.01) {
      Swal.fire({
        icon: 'warning',
        title: 'Pagos no cuadran',
        text: `Total venta: ${formatMoney(total)} | Total pagos: ${formatMoney(totalPagos)}`
      });
      return;
    }

    const payload = {
      id_cliente: Number(form.id_cliente),
      descuento: descuentoGeneral,
      observaciones: form.observaciones.trim() || null,
      productos: detalle.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: item.descuento
      })),
      pagos: pagos.map((item) => ({
        id_metodo_pago: item.id_metodo_pago,
        monto: item.monto,
        referencia: item.referencia
      }))
    };

    try {
      const response = await crearVenta(payload);

      await Swal.fire({
        icon: 'success',
        title: 'Venta registrada',
        text: `Documento: ${response.venta?.numero_documento || ''}`
      });

      setModalAbierto(false);
      limpiarVenta();
      cargarVentas();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo registrar venta',
        text:
          error.response?.data?.mensaje ||
          'Error interno al registrar venta'
      });
    }
  };

  const verDetalleVenta = async (venta) => {
    try {
      const response = await obtenerVentaPorId(venta.id_venta);
      setVentaDetalle(response);
      setModalDetalleAbierto(true);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo obtener detalle',
        text:
          error.response?.data?.mensaje ||
          'Error interno al obtener detalle de venta'
      });
    }
  };

  const solicitarAnulacion = async (venta) => {
    const resultado = await Swal.fire({
      title: 'Anular venta',
      html: `
        <p>Documento: <b>${venta.numero_documento}</b></p>
        <textarea id="motivo_anulacion" class="swal2-textarea" placeholder="Motivo de anulación"></textarea>
      `,
      showCancelButton: true,
      confirmButtonText: 'Anular venta',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const motivo = document.getElementById('motivo_anulacion').value;

        if (!motivo || motivo.trim() === '') {
          Swal.showValidationMessage('El motivo de anulación es obligatorio');
          return false;
        }

        return motivo.trim();
      }
    });

    if (!resultado.isConfirmed) return;

    try {
      await anularVenta(venta.id_venta, {
        motivo_anulacion: resultado.value
      });

      await Swal.fire({
        icon: 'success',
        title: 'Venta anulada',
        timer: 1400,
        showConfirmButton: false
      });

      cargarVentas();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo anular',
        text:
          error.response?.data?.mensaje ||
          'Error interno al anular venta'
      });
    }
  };

  return (
    <MainLayout>
      <div className="ventas-header">
        <div>
          <h1>Ventas</h1>
          <p>Registro de ventas, pagos, detalle y anulación con inventario.</p>
        </div>

        <div className="ventas-actions">
          <button className="secondary-sale-button" onClick={cargarVentas}>
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button className="primary-sale-button" onClick={abrirNuevaVenta}>
            <Plus size={18} />
            Nueva venta
          </button>
        </div>
      </div>

      <section className="ventas-kpi-grid">
        <div className="ventas-kpi-card">
          <div className="ventas-kpi-icon blue">
            <ReceiptText size={26} />
          </div>
          <span>Total ventas</span>
          <h2>{ventas.length}</h2>
          <small>Registros cargados</small>
        </div>

        <div className="ventas-kpi-card">
          <div className="ventas-kpi-icon green">
            <ShoppingCart size={26} />
          </div>
          <span>Monto registrado</span>
          <h2>
            {formatMoney(
              ventas
                .filter((item) => item.estado === 'Registrada')
                .reduce((sum, item) => sum + Number(item.total || 0), 0)
            )}
          </h2>
          <small>Solo ventas registradas</small>
        </div>

        <div className="ventas-kpi-card">
          <div className="ventas-kpi-icon red">
            <Ban size={26} />
          </div>
          <span>Anuladas</span>
          <h2>{ventas.filter((item) => item.estado === 'Anulada').length}</h2>
          <small>Ventas anuladas</small>
        </div>

        <div className="ventas-kpi-card">
          <div className="ventas-kpi-icon purple">
            <ReceiptText size={26} />
          </div>
          <span>Turno activo</span>
          <h2>{turnoActivo ? `#${turnoActivo.id_turno}` : '-'}</h2>
          <small>{turnoActivo ? turnoActivo.nombre_caja : 'Sin turno abierto'}</small>
        </div>
      </section>

      <section className="ventas-toolbar">
        <div className="ventas-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por documento, cliente, NIT o usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarVentas();
            }}
          />
        </div>

        <button onClick={cargarVentas}>Buscar</button>
      </section>

      <section className="ventas-panel">
        <div className="ventas-panel-header">
          <div>
            <h3>Listado de ventas</h3>
            <span>{ventas.length} registros</span>
          </div>

          <div className="ventas-panel-icon">
            <ReceiptText size={22} />
          </div>
        </div>

        <div className="ventas-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Cliente</th>
                <th>Sucursal / Caja</th>
                <th>Fecha</th>
                <th>Método</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {ventas.map((venta) => (
                <tr key={venta.id_venta}>
                  <td>
                    <strong>{venta.numero_documento}</strong>
                    <small>{venta.tipo_documento}</small>
                  </td>

                  <td>
                    <strong>{venta.nombre_cliente}</strong>
                    <small>{venta.nit}</small>
                  </td>

                  <td>
                    <strong>{venta.nombre_sucursal || '-'}</strong>
                    <small>{venta.nombre_caja || '-'}</small>
                  </td>

                  <td>
                    {venta.fecha_venta
                      ? new Date(venta.fecha_venta).toLocaleString('es-GT')
                      : '-'}
                  </td>

                  <td>{venta.metodo_pago}</td>

                  <td>{formatMoney(venta.total)}</td>

                  <td>
                    <span className={`sale-status ${estadoClase(venta.estado)}`}>
                      {venta.estado}
                    </span>
                  </td>

                  <td>
                    <div className="sale-actions-cell">
                      <button title="Ver detalle" onClick={() => verDetalleVenta(venta)}>
                        <Eye size={16} />
                      </button>

                      {venta.estado === 'Registrada' && (
                        <button
                          title="Anular venta"
                          onClick={() => solicitarAnulacion(venta)}
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && ventas.length === 0 && (
                <tr>
                  <td colSpan="8" className="ventas-empty">
                    No hay ventas para mostrar.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="8" className="ventas-empty">
                    Cargando ventas...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="venta-modal-backdrop">
          <div className="venta-modal">
            <div className="venta-modal-header">
              <h2>Nueva venta</h2>
              <button onClick={() => setModalAbierto(false)}>×</button>
            </div>

            <form onSubmit={registrarVenta} className="venta-form">
              <section className="venta-form-section">
                <h3>Datos generales</h3>

                <div className="venta-form-grid">
                  <label>
                    Cliente
                    <select
                      name="id_cliente"
                      value={form.id_cliente}
                      onChange={handleChange}
                    >
                      <option value="">Seleccione cliente</option>
                      {clientes.map((cliente) => (
                        <option key={cliente.id_cliente} value={cliente.id_cliente}>
                          {cliente.nit} - {cliente.nombre_cliente}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Descuento general
                    <input
                      type="number"
                      step="0.01"
                      name="descuento"
                      value={form.descuento}
                      onChange={handleChange}
                    />
                  </label>

                  <label className="sale-full-field">
                    Observaciones
                    <input
                      name="observaciones"
                      value={form.observaciones}
                      onChange={handleChange}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              </section>

              <section className="venta-form-section">
                <h3>Detalle de productos</h3>

                <div className="venta-add-grid">
                  <label>
                    Producto
                    <select
                      name="id_producto"
                      value={form.id_producto}
                      onChange={handleChange}
                    >
                      <option value="">Seleccione producto</option>
                      {productos.map((producto) => (
                        <option key={producto.id_producto} value={producto.id_producto}>
                          {producto.codigo_producto} - {producto.nombre_producto} - {formatMoney(producto.precio_venta)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Cantidad
                    <input
                      type="number"
                      step="1"
                      name="cantidad"
                      value={form.cantidad}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Descuento línea
                    <input
                      type="number"
                      step="0.01"
                      name="descuento_linea"
                      value={form.descuento_linea}
                      onChange={handleChange}
                    />
                  </label>

                  <button type="button" onClick={agregarProducto}>
                    Agregar
                  </button>
                </div>

                <div className="venta-detail-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Precio</th>
                        <th>Descuento</th>
                        <th>Subtotal</th>
                        <th></th>
                      </tr>
                    </thead>

                    <tbody>
                      {detalle.map((item) => (
                        <tr key={item.id_producto}>
                          <td>
                            <strong>{item.codigo_producto}</strong>
                            <small>{item.nombre_producto}</small>
                          </td>
                          <td>{item.cantidad}</td>
                          <td>{formatMoney(item.precio_unitario)}</td>
                          <td>{formatMoney(item.descuento)}</td>
                          <td>{formatMoney(item.subtotal)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => eliminarProducto(item.id_producto)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {detalle.length === 0 && (
                        <tr>
                          <td colSpan="6" className="ventas-empty">
                            No hay productos agregados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="venta-form-section">
                <h3>Pagos</h3>

                <div className="venta-add-grid">
                  <label>
                    Método de pago
                    <select
                      name="id_metodo_pago"
                      value={form.id_metodo_pago}
                      onChange={handleChange}
                    >
                      <option value="">Seleccione método</option>
                      {metodosPago.map((metodo) => (
                        <option
                          key={metodo.id_metodo_pago}
                          value={metodo.id_metodo_pago}
                        >
                          {metodo.nombre_metodo}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Monto
                    <input
                      type="number"
                      step="0.01"
                      name="monto_pago"
                      value={form.monto_pago}
                      onChange={handleChange}
                    />
                  </label>

                  <label>
                    Referencia
                    <input
                      name="referencia"
                      value={form.referencia}
                      onChange={handleChange}
                      placeholder="Si aplica"
                    />
                  </label>

                  <button type="button" onClick={agregarPago}>
                    Agregar pago
                  </button>
                </div>

                <div className="payment-list">
                  {pagos.map((pago, index) => (
                    <div className="payment-item" key={`${pago.id_metodo_pago}-${index}`}>
                      <div>
                        <strong>{pago.nombre_metodo}</strong>
                        <span>{pago.referencia || 'Sin referencia'}</span>
                      </div>

                      <b>{formatMoney(pago.monto)}</b>

                      <button type="button" onClick={() => eliminarPago(index)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="sale-summary-box">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>

                <div>
                  <span>Descuento</span>
                  <strong>{formatMoney(descuentoGeneral)}</strong>
                </div>

                <div>
                  <span>IVA 12%</span>
                  <strong>{formatMoney(impuesto)}</strong>
                </div>

                <div className="sale-total-row">
                  <span>Total</span>
                  <strong>{formatMoney(total)}</strong>
                </div>

                <div>
                  <span>Pagos</span>
                  <strong>{formatMoney(totalPagos)}</strong>
                </div>

                <div className={Math.abs(diferenciaPagos) <= 0.01 ? 'sale-ok' : 'sale-pending'}>
                  <span>Diferencia</span>
                  <strong>{formatMoney(diferenciaPagos)}</strong>
                </div>
              </section>

              <div className="venta-modal-actions">
                <button
                  type="button"
                  className="cancel-sale-button"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-sale-button">
                  Registrar venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalDetalleAbierto && ventaDetalle && (
        <div className="venta-modal-backdrop">
          <div className="venta-detail-modal">
            <div className="venta-modal-header">
              <h2>Detalle de venta</h2>
              <button onClick={() => setModalDetalleAbierto(false)}>×</button>
            </div>

            <div className="venta-detail-content">
              <div className="sale-info-box">
                <div>
                  <span>Documento</span>
                  <strong>{ventaDetalle.venta.numero_documento}</strong>
                </div>

                <div>
                  <span>Cliente</span>
                  <strong>{ventaDetalle.venta.nombre_cliente}</strong>
                </div>

                <div>
                  <span>Estado</span>
                  <strong>{ventaDetalle.venta.estado}</strong>
                </div>

                <div>
                  <span>Total</span>
                  <strong>{formatMoney(ventaDetalle.venta.total)}</strong>
                </div>
              </div>

              <h3>Productos</h3>

              <div className="venta-detail-table">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Descuento</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {(ventaDetalle.detalle || []).map((item) => (
                      <tr key={item.id_venta_detalle}>
                        <td>{item.codigo_producto} - {item.nombre_producto}</td>
                        <td>{item.cantidad}</td>
                        <td>{formatMoney(item.precio_unitario)}</td>
                        <td>{formatMoney(item.descuento)}</td>
                        <td>{formatMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Pagos</h3>

              <div className="payment-list">
                {(ventaDetalle.pagos || []).map((pago) => (
                  <div className="payment-item" key={pago.id_venta_pago}>
                    <div>
                      <strong>{pago.nombre_metodo}</strong>
                      <span>{pago.referencia || 'Sin referencia'}</span>
                    </div>

                    <b>{formatMoney(pago.monto)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Ventas;