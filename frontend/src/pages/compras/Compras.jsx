import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Eye,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  Warehouse
} from 'lucide-react';
import Swal from 'sweetalert2';

import MainLayout from '../../components/layout/MainLayout';

import {
  obtenerCompras,
  obtenerCompraPorId,
  crearCompra,
  anularCompra,
  obtenerProveedoresCompra,
  obtenerProductosCompra,
  obtenerSucursalesBodegasCompra,
  obtenerIvaCompra
} from '../../services/comprasService';

import './compras.css';

const redondear2 = (valor) =>
  Math.round((Number(valor) + Number.EPSILON) * 100) / 100;

const dinero = (valor) =>
  `Q ${Number(valor || 0).toFixed(2)}`;

const formularioInicial = () => ({
  id_proveedor: '',
  numero_factura: '',
  id_sucursal: '',
  id_bodega: '',
  id_producto: '',
  cantidad: '1',
  precio_unitario: '',
  descuento: '0',
  observaciones: ''
});

const Compras = () => {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);

  const [porcentajeIva, setPorcentajeIva] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(null);

  const [form, setForm] = useState(formularioInicial());
  const [detalle, setDetalle] = useState([]);

  const sucursales = useMemo(() => {
    const mapa = new Map();

    ubicaciones.forEach((item) => {
      mapa.set(item.id_sucursal, {
        id_sucursal: item.id_sucursal,
        nombre_sucursal: item.nombre_sucursal
      });
    });

    return Array.from(mapa.values());
  }, [ubicaciones]);

  const bodegas = useMemo(
    () =>
      ubicaciones.filter(
        (item) =>
          Number(item.id_sucursal) === Number(form.id_sucursal)
      ),
    [ubicaciones, form.id_sucursal]
  );

  const subtotal = useMemo(
    () =>
      redondear2(
        detalle.reduce(
          (acumulado, item) => acumulado + item.subtotal,
          0
        )
      ),
    [detalle]
  );

  const descuento = Number(form.descuento || 0);

  const base = redondear2(subtotal - descuento);

  const impuesto =
    porcentajeIva === null
      ? 0
      : redondear2(base * (porcentajeIva / 100));

  const total = redondear2(base + impuesto);

  const cargarCompras = async (buscar = busqueda) => {
    try {
      setCargando(true);

      const respuesta = await obtenerCompras({
        buscar: buscar || undefined
      });

      setCompras(respuesta.compras || []);
    } catch (error) {
      Swal.fire(
        'Error',
        error.response?.data?.mensaje ||
          'No se pudieron cargar las compras',
        'error'
      );
    } finally {
      setCargando(false);
    }
  };

  const cargarCatalogos = async () => {
    try {
      const [
        respuestaProveedores,
        respuestaProductos,
        respuestaUbicaciones,
        respuestaIva
      ] = await Promise.all([
        obtenerProveedoresCompra(),
        obtenerProductosCompra(),
        obtenerSucursalesBodegasCompra(),
        obtenerIvaCompra()
      ]);

      setProveedores(
        (respuestaProveedores.proveedores || []).filter(
          (p) => p.estado === 'Activo'
        )
      );

      setProductos(
        (respuestaProductos.productos || []).filter(
          (p) => p.estado === 'Activo'
        )
      );

      setUbicaciones(
        respuestaUbicaciones.sucursales_bodegas || []
      );

      const iva = Number(respuestaIva.porcentaje_iva);

      if (!Number.isFinite(iva) || iva < 0 || iva > 100) {
        throw new Error('Porcentaje de IVA inválido');
      }

      setPorcentajeIva(iva);
    } catch (error) {
      setPorcentajeIva(null);

      Swal.fire(
        'Error de configuración',
        error.response?.data?.mensaje ||
          error.message ||
          'No se pudieron cargar los catálogos',
        'error'
      );
    }
  };

  useEffect(() => {
    cargarCompras('');
    cargarCatalogos();
  }, []);

  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    if (name === 'id_sucursal') {
      setForm((actual) => ({
        ...actual,
        id_sucursal: value,
        id_bodega: ''
      }));
      return;
    }

    if (name === 'id_producto') {
      const producto = productos.find(
        (p) => Number(p.id_producto) === Number(value)
      );

      setForm((actual) => ({
        ...actual,
        id_producto: value,
        precio_unitario:
          producto && value !== ''
            ? String(producto.precio_costo)
            : ''
      }));
      return;
    }

    setForm((actual) => ({
      ...actual,
      [name]: value
    }));
  };

  const abrirNuevaCompra = () => {
    if (porcentajeIva === null || ubicaciones.length === 0) {
      Swal.fire(
        'Configuración incompleta',
        'Verifica el IVA, las sucursales y las bodegas activas.',
        'warning'
      );
      return;
    }

    setForm(formularioInicial());
    setDetalle([]);
    setModalAbierto(true);
  };

  const agregarProducto = () => {
    const producto = productos.find(
      (p) =>
        Number(p.id_producto) === Number(form.id_producto)
    );

    if (!producto) {
      Swal.fire('Producto obligatorio', 'Selecciona un producto', 'warning');
      return;
    }

    const cantidad = Number(form.cantidad);
    const precio = Number(form.precio_unitario);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      Swal.fire(
        'Cantidad inválida',
        'Ingresa una cantidad entera mayor a cero',
        'warning'
      );
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      Swal.fire(
        'Precio inválido',
        'El costo unitario debe ser mayor a cero',
        'warning'
      );
      return;
    }

    if (
      detalle.some(
        (item) =>
          Number(item.id_producto) === Number(producto.id_producto)
      )
    ) {
      Swal.fire(
        'Producto duplicado',
        'Este producto ya se encuentra en el detalle',
        'warning'
      );
      return;
    }

    setDetalle((actual) => [
      ...actual,
      {
        id_producto: producto.id_producto,
        codigo_producto: producto.codigo_producto,
        nombre_producto: producto.nombre_producto,
        cantidad,
        precio_unitario: redondear2(precio),
        subtotal: redondear2(cantidad * redondear2(precio))
      }
    ]);

    setForm((actual) => ({
      ...actual,
      id_producto: '',
      cantidad: '1',
      precio_unitario: ''
    }));
  };

  const eliminarProducto = (id) => {
    setDetalle((actual) =>
      actual.filter((item) => item.id_producto !== id)
    );
  };

  const guardarCompra = async (e) => {
    e.preventDefault();

    if (guardando) return;

    if (
      !form.id_proveedor ||
      !form.numero_factura.trim() ||
      !form.id_sucursal ||
      !form.id_bodega
    ) {
      Swal.fire(
        'Campos obligatorios',
        'Completa proveedor, factura, sucursal y bodega',
        'warning'
      );
      return;
    }

    if (detalle.length === 0) {
      Swal.fire(
        'Detalle vacío',
        'Agrega al menos un producto',
        'warning'
      );
      return;
    }

    if (
      !Number.isFinite(descuento) ||
      descuento < 0 ||
      descuento > subtotal
    ) {
      Swal.fire(
        'Descuento inválido',
        'El descuento debe estar entre cero y el subtotal',
        'warning'
      );
      return;
    }

    if (porcentajeIva === null) {
      Swal.fire(
        'IVA no disponible',
        'No es posible registrar la compra sin la configuración de IVA',
        'warning'
      );
      return;
    }

    const confirmacion = await Swal.fire({
      icon: 'question',
      title: '¿Registrar compra?',
      text: `Total calculado: ${dinero(total)}`,
      showCancelButton: true,
      confirmButtonText: 'Registrar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    const datos = {
      id_proveedor: Number(form.id_proveedor),
      numero_factura: form.numero_factura.trim(),
      id_sucursal: Number(form.id_sucursal),
      id_bodega: Number(form.id_bodega),
      descuento: redondear2(descuento),
      observaciones: form.observaciones.trim() || null,
      productos: detalle.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario
      }))
    };

    try {
      setGuardando(true);

      const respuesta = await crearCompra(datos);

      setModalAbierto(false);
      setForm(formularioInicial());
      setDetalle([]);

      await Swal.fire({
        icon: 'success',
        title: 'Compra registrada',
        text:
          `Documento interno: ${
            respuesta.compra?.numero_documento_interno || ''
          }`
      });

      await cargarCompras();
    } catch (error) {
      Swal.fire(
        'No se pudo registrar',
        error.response?.data?.mensaje ||
          'Error interno al registrar compra',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  };

  const verDetalle = async (compra) => {
    try {
      const respuesta = await obtenerCompraPorId(compra.id_compra);
      setModalDetalle(respuesta);
    } catch (error) {
      Swal.fire(
        'Error',
        error.response?.data?.mensaje ||
          'No se pudo consultar la compra',
        'error'
      );
    }
  };

  const solicitarAnulacion = async (compra) => {
    const resultado = await Swal.fire({
      icon: 'warning',
      title: `Anular ${compra.numero_documento_interno}`,
      text: 'Esta operación intentará revertir el inventario.',
      input: 'textarea',
      inputPlaceholder: 'Escribe el motivo de anulación',
      inputValidator: (valor) =>
        !valor?.trim()
          ? 'El motivo de anulación es obligatorio'
          : undefined,
      showCancelButton: true,
      confirmButtonText: 'Anular compra',
      cancelButtonText: 'Cancelar'
    });

    if (!resultado.isConfirmed) return;

    try {
      await anularCompra(
        compra.id_compra,
        resultado.value.trim()
      );

      await Swal.fire(
        'Compra anulada',
        'La anulación se registró correctamente',
        'success'
      );

      await cargarCompras();
    } catch (error) {
      Swal.fire(
        'No se pudo anular',
        error.response?.data?.mensaje ||
          'Error al intentar revertir la compra',
        'error'
      );
    }
  };

  const montoRegistrado = compras
    .filter((compra) => compra.estado === 'Registrada')
    .reduce((suma, compra) => suma + Number(compra.total || 0), 0);

  const totalAnuladas = compras.filter(
    (compra) => compra.estado === 'Anulada'
  ).length;

  return (
    <MainLayout>
      <div className="compras-header">
        <div>
          <h1>Compras</h1>
          <p>
            Registro de compras, proveedores, facturas y control de inventario.
          </p>
        </div>

        <div className="compras-actions">
          <button onClick={() => cargarCompras()}>
            <RefreshCw size={17} /> Actualizar
          </button>

          <button
            className="compras-primary"
            onClick={abrirNuevaCompra}
          >
            <Plus size={17} /> Nueva compra
          </button>
        </div>
      </div>

      <section className="compras-kpis">
        <article className="compras-card">
          <ShoppingBag size={24} />
          <span>Total compras</span>
          <strong>{compras.length}</strong>
          <small>Registros cargados</small>
        </article>

        <article className="compras-card">
          <ShoppingBag size={24} />
          <span>Monto registrado</span>
          <strong>{dinero(montoRegistrado)}</strong>
          <small>Compras registradas</small>
        </article>

        <article className="compras-card">
          <Ban size={24} />
          <span>Anuladas</span>
          <strong>{totalAnuladas}</strong>
          <small>Compras anuladas</small>
        </article>

        <article className="compras-card">
          <Truck size={24} />
          <span>Proveedores activos</span>
          <strong>{proveedores.length}</strong>
          <small>Disponibles para compras</small>
        </article>
      </section>

      <section className="compras-toolbar">
        <div className="compras-search">
          <Search size={18} />
          <input
            placeholder="Buscar factura, documento, NIT o proveedor..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarCompras();
            }}
          />
        </div>

        <button onClick={() => cargarCompras()}>Buscar</button>
      </section>

      <section className="compras-panel">
        <h3>Listado de compras</h3>
        <small>{compras.length} registros</small>

        <div className="compras-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Factura</th>
                <th>Proveedor</th>
                <th>Sucursal / Bodega</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {compras.map((compra) => (
                <tr key={compra.id_compra}>
                  <td>{compra.numero_documento_interno}</td>
                  <td>{compra.numero_factura}</td>
                  <td>
                    <strong>{compra.nombre_proveedor}</strong>
                    <small>{compra.nit}</small>
                  </td>
                  <td>
                    <strong>{compra.nombre_sucursal}</strong>
                    <small>{compra.nombre_bodega}</small>
                  </td>
                  <td>
                    {compra.fecha_compra
                      ? new Date(compra.fecha_compra).toLocaleString('es-GT')
                      : '-'}
                  </td>
                  <td>{dinero(compra.total)}</td>
                  <td>
                    <span className={`compra-estado ${compra.estado.toLowerCase()}`}>
                      {compra.estado}
                    </span>
                  </td>
                  <td>
                    <div className="compras-acciones-tabla">
                      <button
                        title="Ver detalle"
                        onClick={() => verDetalle(compra)}
                      >
                        <Eye size={16} />
                      </button>

                      {compra.estado === 'Registrada' && (
                        <button
                          title="Anular compra"
                          onClick={() => solicitarAnulacion(compra)}
                        >
                          <Ban size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && compras.length === 0 && (
                <tr>
                  <td colSpan="8" className="compras-vacio">
                    No se encontraron compras.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="8" className="compras-vacio">
                    Cargando compras...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="compra-modal-fondo">
          <div className="compra-modal">
            <div className="compra-modal-titulo">
              <h2>Nueva compra</h2>
              <button onClick={() => setModalAbierto(false)}>
                ×
              </button>
            </div>

            <form onSubmit={guardarCompra} className="compra-form">
              <section className="compra-seccion">
                <h3>Datos generales</h3>

                <div className="compra-grid">
                  <label>
                    Proveedor
                    <select
                      name="id_proveedor"
                      value={form.id_proveedor}
                      onChange={cambiarCampo}
                    >
                      <option value="">Seleccione proveedor</option>
                      {proveedores.map((proveedor) => (
                        <option
                          key={proveedor.id_proveedor}
                          value={proveedor.id_proveedor}
                        >
                          {proveedor.nit} - {proveedor.nombre_proveedor}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Número de factura
                    <input
                      name="numero_factura"
                      value={form.numero_factura}
                      onChange={cambiarCampo}
                      placeholder="FAC-001"
                    />
                  </label>

                  <label>
                    Sucursal
                    <select
                      name="id_sucursal"
                      value={form.id_sucursal}
                      onChange={cambiarCampo}
                    >
                      <option value="">Seleccione sucursal</option>
                      {sucursales.map((sucursal) => (
                        <option
                          key={sucursal.id_sucursal}
                          value={sucursal.id_sucursal}
                        >
                          {sucursal.nombre_sucursal}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Bodega
                    <select
                      name="id_bodega"
                      value={form.id_bodega}
                      onChange={cambiarCampo}
                      disabled={!form.id_sucursal}
                    >
                      <option value="">Seleccione bodega</option>
                      {bodegas.map((bodega) => (
                        <option
                          key={bodega.id_bodega}
                          value={bodega.id_bodega}
                        >
                          {bodega.nombre_bodega}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="compra-campo-completo">
                    Observaciones
                    <input
                      name="observaciones"
                      value={form.observaciones}
                      onChange={cambiarCampo}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
              </section>

              <section className="compra-seccion">
                <h3>Detalle de productos</h3>

                <div className="compra-agregar-grid">
                  <label>
                    Producto
                    <select
                      name="id_producto"
                      value={form.id_producto}
                      onChange={cambiarCampo}
                    >
                      <option value="">Seleccione producto</option>
                      {productos.map((producto) => (
                        <option
                          key={producto.id_producto}
                          value={producto.id_producto}
                        >
                          {producto.codigo_producto} - {producto.nombre_producto}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Cantidad
                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="cantidad"
                      value={form.cantidad}
                      onChange={cambiarCampo}
                    />
                  </label>

                  <label>
                    Costo unitario
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      name="precio_unitario"
                      value={form.precio_unitario}
                      onChange={cambiarCampo}
                    />
                  </label>

                  <button type="button" onClick={agregarProducto}>
                    Agregar
                  </button>
                </div>

                <div className="compras-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Costo</th>
                        <th>Subtotal</th>
                        <th>Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {detalle.map((item) => (
                        <tr key={item.id_producto}>
                          <td>
                            {item.codigo_producto}
                            <small>{item.nombre_producto}</small>
                          </td>
                          <td>{item.cantidad}</td>
                          <td>{dinero(item.precio_unitario)}</td>
                          <td>{dinero(item.subtotal)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => eliminarProducto(item.id_producto)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {detalle.length === 0 && (
                        <tr>
                          <td colSpan="5" className="compras-vacio">
                            No hay productos agregados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="compra-seccion">
                <h3>Resumen de compra</h3>

                <label>
                  Descuento general
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="descuento"
                    value={form.descuento}
                    onChange={cambiarCampo}
                  />
                </label>

                <div className="compra-resumen">
                  <div>
                    <span>Subtotal</span>
                    <strong>{dinero(subtotal)}</strong>
                  </div>

                  <div>
                    <span>Descuento</span>
                    <strong>{dinero(descuento)}</strong>
                  </div>

                  <div>
                    <span>
                      IVA {porcentajeIva === null ? '—' : `${porcentajeIva}%`}
                    </span>
                    <strong>{dinero(impuesto)}</strong>
                  </div>

                  <div className="compra-total">
                    <span>Total</span>
                    <strong>{dinero(total)}</strong>
                  </div>
                </div>
              </section>

              <div className="compra-modal-acciones">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="compras-primary"
                  disabled={guardando || porcentajeIva === null}
                >
                  {guardando ? 'Registrando...' : 'Registrar compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalDetalle && (
        <div className="compra-modal-fondo">
          <div className="compra-modal compra-modal-detalle">
            <div className="compra-modal-titulo">
              <h2>Detalle de compra</h2>
              <button onClick={() => setModalDetalle(null)}>×</button>
            </div>

            <div className="compra-form">
              <div className="compra-grid">
                <p>
                  <strong>Documento:</strong>{' '}
                  {modalDetalle.compra.numero_documento_interno}
                </p>
                <p>
                  <strong>Factura:</strong>{' '}
                  {modalDetalle.compra.numero_factura}
                </p>
                <p>
                  <strong>Proveedor:</strong>{' '}
                  {modalDetalle.compra.nombre_proveedor}
                </p>
                <p>
                  <strong>Estado:</strong>{' '}
                  {modalDetalle.compra.estado}
                </p>
                <p>
                  <strong>Bodega:</strong>{' '}
                  {modalDetalle.compra.nombre_bodega}
                </p>
                <p>
                  <strong>Total:</strong>{' '}
                  {dinero(modalDetalle.compra.total)}
                </p>
              </div>

              <div className="compras-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Costo</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modalDetalle.detalle || []).map((item) => (
                      <tr key={item.id_compra_detalle}>
                        <td>{item.nombre_producto}</td>
                        <td>{item.cantidad}</td>
                        <td>{dinero(item.precio_unitario)}</td>
                        <td>{dinero(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Compras;