import { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Eye,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  actualizarProducto,
  cambiarEstadoProducto,
  crearProducto,
  obtenerCategoriasProducto,
  obtenerMarcasProducto,
  obtenerProductos,
  obtenerSubcategoriasProducto,
  obtenerSucursalesBodegasProducto,
  obtenerUnidadesMedidaProducto
} from '../../services/productosService';
import './productos.css';

const estadoClase = (estado) => {
  return String(estado || '').toLowerCase();
};

const formatMoney = (value) => {
  return `Q ${Number(value || 0).toFixed(2)}`;
};

const calcularMargen = (costo, venta) => {
  const costoNumero = Number(costo);
  const ventaNumero = Number(venta);

  if (!costoNumero || costoNumero <= 0) return 0;

  return ((ventaNumero - costoNumero) / costoNumero) * 100;
};

const Productos = () => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [subcategorias, setSubcategorias] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [sucursalesBodegas, setSucursalesBodegas] = useState([]);

  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);

  const [form, setForm] = useState({
    id_categoria: '',
    id_subcategoria: '',
    id_marca: '',
    id_unidad_medida: '',
    codigo_producto: '',
    codigo_barras: '',
    nombre_producto: '',
    descripcion: '',
    precio_costo: '',
    precio_venta: '',
    margen_minimo: 10,
    margen_maximo: 60,
    stock_minimo: 1,
    stock_maximo: 100,
    controla_inventario: true,
    estado: 'Activo',
    id_sucursal: '',
    id_bodega: '',
    stock_inicial: 0
  });

  const subcategoriasFiltradas = useMemo(() => {
    if (!form.id_categoria) return [];

    return subcategorias.filter(
      (item) => Number(item.id_categoria) === Number(form.id_categoria)
    );
  }, [subcategorias, form.id_categoria]);

  const bodegasFiltradas = useMemo(() => {
    if (!form.id_sucursal) return [];

    return sucursalesBodegas.filter(
      (item) => Number(item.id_sucursal) === Number(form.id_sucursal)
    );
  }, [sucursalesBodegas, form.id_sucursal]);

  const sucursalesUnicas = useMemo(() => {
    const mapa = new Map();

    sucursalesBodegas.forEach((item) => {
      if (!mapa.has(item.id_sucursal)) {
        mapa.set(item.id_sucursal, {
          id_sucursal: item.id_sucursal,
          nombre_sucursal: item.nombre_sucursal
        });
      }
    });

    return Array.from(mapa.values());
  }, [sucursalesBodegas]);

  const margenActual = useMemo(() => {
    return calcularMargen(form.precio_costo, form.precio_venta);
  }, [form.precio_costo, form.precio_venta]);

  const cargarProductos = async () => {
    try {
      setCargando(true);

      const response = await obtenerProductos({
        buscar: busqueda || undefined
      });

      setProductos(response.productos || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar productos',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el listado de productos'
      });
    } finally {
      setCargando(false);
    }
  };

  const cargarCatalogos = async () => {
    try {
      const [
        categoriasResponse,
        subcategoriasResponse,
        marcasResponse,
        unidadesResponse,
        sucursalesBodegasResponse
      ] = await Promise.all([
        obtenerCategoriasProducto(),
        obtenerSubcategoriasProducto(),
        obtenerMarcasProducto(),
        obtenerUnidadesMedidaProducto(),
        obtenerSucursalesBodegasProducto()
      ]);

      setCategorias(categoriasResponse.categorias || []);
      setSubcategorias(subcategoriasResponse.subcategorias || []);
      setMarcas(marcasResponse.marcas || []);
      setUnidadesMedida(unidadesResponse.unidades_medida || []);
      setSucursalesBodegas(sucursalesBodegasResponse.sucursales_bodegas || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar catálogos',
        text:
          error.response?.data?.mensaje ||
          'No se pudieron obtener los catálogos de productos'
      });
    }
  };

  useEffect(() => {
    cargarCatalogos();
    cargarProductos();
  }, []);

  const limpiarFormulario = () => {
    const primeraSucursal = sucursalesBodegas[0];

    setForm({
      id_categoria: '',
      id_subcategoria: '',
      id_marca: '',
      id_unidad_medida: '',
      codigo_producto: '',
      codigo_barras: '',
      nombre_producto: '',
      descripcion: '',
      precio_costo: '',
      precio_venta: '',
      margen_minimo: 10,
      margen_maximo: 60,
      stock_minimo: 1,
      stock_maximo: 100,
      controla_inventario: true,
      estado: 'Activo',
      id_sucursal: primeraSucursal?.id_sucursal || '',
      id_bodega: primeraSucursal?.id_bodega || '',
      stock_inicial: 0
    });

    setModoEdicion(false);
    setProductoEditando(null);
  };

  const abrirCrear = () => {
    limpiarFormulario();
    setModalAbierto(true);
  };

  const abrirEditar = (producto) => {
    setModoEdicion(true);
    setProductoEditando(producto);

    setForm({
      id_categoria: producto.id_categoria || '',
      id_subcategoria: producto.id_subcategoria || '',
      id_marca: producto.id_marca || '',
      id_unidad_medida: producto.id_unidad_medida || '',
      codigo_producto: producto.codigo_producto || '',
      codigo_barras: producto.codigo_barras || '',
      nombre_producto: producto.nombre_producto || '',
      descripcion: producto.descripcion || '',
      precio_costo: producto.precio_costo || '',
      precio_venta: producto.precio_venta || '',
      margen_minimo: producto.margen_minimo || 10,
      margen_maximo: producto.margen_maximo || 60,
      stock_minimo: producto.stock_minimo || 1,
      stock_maximo: producto.stock_maximo || 100,
      controla_inventario: Number(producto.controla_inventario || 0) === 1,
      estado: producto.estado || 'Activo',
      id_sucursal: '',
      id_bodega: '',
      stock_inicial: 0
    });

    setModalAbierto(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'id_categoria') {
      setForm({
        ...form,
        id_categoria: value,
        id_subcategoria: ''
      });

      return;
    }

    if (name === 'id_sucursal') {
      const primeraBodega = sucursalesBodegas.find(
        (item) => Number(item.id_sucursal) === Number(value)
      );

      setForm({
        ...form,
        id_sucursal: value,
        id_bodega: primeraBodega?.id_bodega || ''
      });

      return;
    }

    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const validarFormulario = () => {
    if (!form.id_categoria) {
      Swal.fire('Categoría obligatoria', 'Selecciona una categoría', 'warning');
      return false;
    }

    if (!form.id_marca) {
      Swal.fire('Marca obligatoria', 'Selecciona una marca', 'warning');
      return false;
    }

    if (!form.id_unidad_medida) {
      Swal.fire('Unidad obligatoria', 'Selecciona una unidad de medida', 'warning');
      return false;
    }

    if (!modoEdicion && !form.codigo_producto.trim()) {
      Swal.fire('Código obligatorio', 'Ingresa el código del producto', 'warning');
      return false;
    }

    if (!form.nombre_producto.trim()) {
      Swal.fire('Nombre obligatorio', 'Ingresa el nombre del producto', 'warning');
      return false;
    }

    const costo = Number(form.precio_costo);
    const venta = Number(form.precio_venta);
    const margenMinimo = Number(form.margen_minimo);
    const margenMaximo = Number(form.margen_maximo);
    const stockMinimo = Number(form.stock_minimo);
    const stockMaximo = Number(form.stock_maximo);
    const stockInicial = Number(form.stock_inicial);

    if (Number.isNaN(costo) || costo < 0) {
      Swal.fire('Costo inválido', 'El costo debe ser mayor o igual a 0', 'warning');
      return false;
    }

    if (costo > 500) {
      Swal.fire(
        'Costo excedido',
        'El precio costo no puede ser mayor a Q 500.00',
        'warning'
      );
      return false;
    }

    if (Number.isNaN(venta) || venta <= 0) {
      Swal.fire('Venta inválida', 'El precio venta debe ser mayor a 0', 'warning');
      return false;
    }

    if (venta < costo) {
      Swal.fire(
        'Precio venta inválido',
        'El precio venta no puede ser menor al precio costo',
        'warning'
      );
      return false;
    }

    if (margenMaximo < margenMinimo) {
      Swal.fire(
        'Margen inválido',
        'El margen máximo debe ser mayor o igual al margen mínimo',
        'warning'
      );
      return false;
    }

    if (costo > 0) {
      const margen = calcularMargen(costo, venta);

      if (margen < margenMinimo || margen > margenMaximo) {
        Swal.fire({
          icon: 'warning',
          title: 'Margen fuera de rango',
          text: `El margen actual es ${margen.toFixed(
            2
          )}%. Debe estar entre ${margenMinimo}% y ${margenMaximo}%.`
        });

        return false;
      }
    }

    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {
      Swal.fire(
        'Stock mínimo inválido',
        'El stock mínimo debe ser entero mayor o igual a 0',
        'warning'
      );
      return false;
    }

    if (!Number.isInteger(stockMaximo) || stockMaximo < stockMinimo) {
      Swal.fire(
        'Stock máximo inválido',
        'El stock máximo debe ser mayor o igual al stock mínimo',
        'warning'
      );
      return false;
    }

    if (!modoEdicion && form.controla_inventario) {
      if (!Number.isInteger(stockInicial) || stockInicial < 0) {
        Swal.fire(
          'Stock inicial inválido',
          'El stock inicial debe ser entero mayor o igual a 0',
          'warning'
        );
        return false;
      }
    }

    return true;
  };

  const guardarProducto = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) return;

    try {
      const payload = {
        id_categoria: Number(form.id_categoria),
        id_subcategoria: form.id_subcategoria
          ? Number(form.id_subcategoria)
          : null,
        id_marca: Number(form.id_marca),
        id_unidad_medida: Number(form.id_unidad_medida),
        codigo_barras: form.codigo_barras.trim() || null,
        nombre_producto: form.nombre_producto.trim(),
        descripcion: form.descripcion.trim() || null,
        precio_costo: Number(form.precio_costo),
        precio_venta: Number(form.precio_venta),
        margen_minimo: Number(form.margen_minimo),
        margen_maximo: Number(form.margen_maximo),
        stock_minimo: Number(form.stock_minimo),
        stock_maximo: Number(form.stock_maximo),
        controla_inventario: form.controla_inventario,
        estado: form.estado
      };

      if (modoEdicion) {
        await actualizarProducto(productoEditando.id_producto, payload);

        Swal.fire({
          icon: 'success',
          title: 'Producto actualizado',
          timer: 1400,
          showConfirmButton: false
        });
      } else {
        payload.codigo_producto = form.codigo_producto.trim();

        if (form.controla_inventario) {
          payload.id_sucursal = form.id_sucursal
            ? Number(form.id_sucursal)
            : null;
          payload.id_bodega = form.id_bodega ? Number(form.id_bodega) : null;
          payload.stock_inicial = Number(form.stock_inicial);
        }

        await crearProducto(payload);

        Swal.fire({
          icon: 'success',
          title: 'Producto creado correctamente',
          timer: 1500,
          showConfirmButton: false
        });
      }

      setModalAbierto(false);
      limpiarFormulario();
      cargarProductos();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar',
        text:
          error.response?.data?.mensaje ||
          'Verifica la información ingresada'
      });
    }
  };

  const cambiarEstado = async (producto) => {
    const nuevoEstado = producto.estado === 'Activo' ? 'Inactivo' : 'Activo';

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: `¿Cambiar estado a ${nuevoEstado}?`,
      text: `Producto: ${producto.nombre_producto}`,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await cambiarEstadoProducto(producto.id_producto, nuevoEstado);
      await cargarProductos();

      Swal.fire({
        icon: 'success',
        title: 'Estado actualizado',
        timer: 1300,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cambiar estado',
        text: error.response?.data?.mensaje || 'Error interno'
      });
    }
  };

  const verResumenProducto = (producto) => {
    Swal.fire({
      title: producto.nombre_producto,
      html: `
        <div style="text-align:left">
          <p><b>Código:</b> ${producto.codigo_producto}</p>
          <p><b>Categoría:</b> ${producto.nombre_categoria || '-'}</p>
          <p><b>Marca:</b> ${producto.nombre_marca || '-'}</p>
          <p><b>Unidad:</b> ${producto.nombre_unidad || '-'}</p>
          <p><b>Costo:</b> ${formatMoney(producto.precio_costo)}</p>
          <p><b>Venta:</b> ${formatMoney(producto.precio_venta)}</p>
          <p><b>Margen:</b> ${calcularMargen(
            producto.precio_costo,
            producto.precio_venta
          ).toFixed(2)}%</p>
          <p><b>Estado:</b> ${producto.estado}</p>
        </div>
      `,
      confirmButtonText: 'Cerrar'
    });
  };

  return (
    <MainLayout>
      <div className="productos-header">
        <div>
          <h1>Productos</h1>
          <p>
            Gestión de productos, precios, márgenes, stock e inventario inicial.
          </p>
        </div>

        <div className="productos-actions">
          <button className="secondary-product-button" onClick={cargarProductos}>
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button className="primary-product-button" onClick={abrirCrear}>
            <Plus size={18} />
            Nuevo producto
          </button>
        </div>
      </div>

      <section className="productos-toolbar">
        <div className="productos-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por código, barras, nombre o descripción..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarProductos();
            }}
          />
        </div>

        <button onClick={cargarProductos}>Buscar</button>
      </section>

      <section className="productos-panel">
        <div className="productos-panel-header">
          <div>
            <h3>Listado de productos</h3>
            <span>{productos.length} registros</span>
          </div>

          <div className="productos-panel-icon">
            <Boxes size={22} />
          </div>
        </div>

        <div className="productos-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th>Costo</th>
                <th>Venta</th>
                <th>Margen</th>
                <th>Stock Min/Max</th>
                <th>Inventario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {productos.map((producto) => (
                <tr key={producto.id_producto}>
                  <td>
                    <strong>{producto.codigo_producto}</strong>
                    <small>{producto.codigo_barras || 'Sin barras'}</small>
                  </td>

                  <td>
                    <strong>{producto.nombre_producto}</strong>
                    <small>{producto.descripcion || '-'}</small>
                  </td>

                  <td>{producto.nombre_categoria}</td>

                  <td>{producto.nombre_marca || '-'}</td>

                  <td>{formatMoney(producto.precio_costo)}</td>

                  <td>{formatMoney(producto.precio_venta)}</td>

                  <td>
                    <span className="margin-pill">
                      {calcularMargen(
                        producto.precio_costo,
                        producto.precio_venta
                      ).toFixed(2)}
                      %
                    </span>
                  </td>

                  <td>
                    {producto.stock_minimo} / {producto.stock_maximo}
                  </td>

                  <td>
                    {Number(producto.controla_inventario || 0) === 1 ? (
                      <span className="inventory-yes">Sí</span>
                    ) : (
                      <span className="inventory-no">No</span>
                    )}
                  </td>

                  <td>
                    <span className={`product-status ${estadoClase(producto.estado)}`}>
                      {producto.estado}
                    </span>
                  </td>

                  <td>
                    <div className="product-actions-cell">
                      <button
                        title="Ver resumen"
                        onClick={() => verResumenProducto(producto)}
                      >
                        <Eye size={16} />
                      </button>

                      <button title="Editar" onClick={() => abrirEditar(producto)}>
                        <Pencil size={16} />
                      </button>

                      <button
                        title={producto.estado === 'Activo' ? 'Inactivar' : 'Activar'}
                        onClick={() => cambiarEstado(producto)}
                      >
                        {producto.estado === 'Activo' ? (
                          <ToggleLeft size={17} />
                        ) : (
                          <ToggleRight size={17} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && productos.length === 0 && (
                <tr>
                  <td colSpan="11" className="productos-empty">
                    No hay productos para mostrar.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="11" className="productos-empty">
                    Cargando productos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="producto-modal-backdrop">
          <div className="producto-modal">
            <div className="producto-modal-header">
              <h2>{modoEdicion ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setModalAbierto(false)}>×</button>
            </div>

            <form onSubmit={guardarProducto} className="producto-form">
              <div className="producto-form-grid">
                <label>
                  Categoría
                  <select
                    name="id_categoria"
                    value={form.id_categoria}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione categoría</option>
                    {categorias.map((item) => (
                      <option key={item.id_categoria} value={item.id_categoria}>
                        {item.nombre_categoria}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Subcategoría
                  <select
                    name="id_subcategoria"
                    value={form.id_subcategoria}
                    onChange={handleChange}
                    disabled={!form.id_categoria}
                  >
                    <option value="">Sin subcategoría</option>
                    {subcategoriasFiltradas.map((item) => (
                      <option
                        key={item.id_subcategoria}
                        value={item.id_subcategoria}
                      >
                        {item.nombre_subcategoria}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Marca
                  <select
                    name="id_marca"
                    value={form.id_marca}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione marca</option>
                    {marcas.map((item) => (
                      <option key={item.id_marca} value={item.id_marca}>
                        {item.nombre_marca}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Unidad de medida
                  <select
                    name="id_unidad_medida"
                    value={form.id_unidad_medida}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione unidad</option>
                    {unidadesMedida.map((item) => (
                      <option
                        key={item.id_unidad_medida}
                        value={item.id_unidad_medida}
                      >
                        {item.nombre_unidad} ({item.abreviatura})
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Código producto
                  <input
                    name="codigo_producto"
                    value={form.codigo_producto}
                    onChange={handleChange}
                    placeholder="Ej. PROD-001"
                    disabled={modoEdicion}
                  />
                </label>

                <label>
                  Código de barras
                  <input
                    name="codigo_barras"
                    value={form.codigo_barras}
                    onChange={handleChange}
                    placeholder="Opcional"
                  />
                </label>

                <label className="product-full-field">
                  Nombre producto
                  <input
                    name="nombre_producto"
                    value={form.nombre_producto}
                    onChange={handleChange}
                    placeholder="Nombre del producto"
                  />
                </label>

                <label className="product-full-field">
                  Descripción
                  <input
                    name="descripcion"
                    value={form.descripcion}
                    onChange={handleChange}
                    placeholder="Descripción opcional"
                  />
                </label>

                <label>
                  Precio costo
                  <input
                    type="number"
                    step="0.01"
                    name="precio_costo"
                    value={form.precio_costo}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Precio venta
                  <input
                    type="number"
                    step="0.01"
                    name="precio_venta"
                    value={form.precio_venta}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </label>

                <label>
                  Margen mínimo %
                  <input
                    type="number"
                    step="0.01"
                    name="margen_minimo"
                    value={form.margen_minimo}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Margen máximo %
                  <input
                    type="number"
                    step="0.01"
                    name="margen_maximo"
                    value={form.margen_maximo}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Stock mínimo
                  <input
                    type="number"
                    step="1"
                    name="stock_minimo"
                    value={form.stock_minimo}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Stock máximo
                  <input
                    type="number"
                    step="1"
                    name="stock_maximo"
                    value={form.stock_maximo}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Estado
                  <select
                    name="estado"
                    value={form.estado}
                    onChange={handleChange}
                  >
                    <option value="Activo">Activo</option>
                    <option value="Inactivo">Inactivo</option>
                  </select>
                </label>

                <div className="margin-preview">
                  <span>Margen actual</span>
                  <strong>{margenActual.toFixed(2)}%</strong>
                </div>
              </div>

              <label className="product-check-row">
                <input
                  type="checkbox"
                  name="controla_inventario"
                  checked={form.controla_inventario}
                  onChange={handleChange}
                />
                Controla inventario
              </label>

              {!modoEdicion && form.controla_inventario && (
                <div className="producto-inventory-box">
                  <h3>Saldo inicial de inventario</h3>

                  <div className="producto-form-grid">
                    <label>
                      Sucursal
                      <select
                        name="id_sucursal"
                        value={form.id_sucursal}
                        onChange={handleChange}
                      >
                        <option value="">Automática</option>
                        {sucursalesUnicas.map((item) => (
                          <option key={item.id_sucursal} value={item.id_sucursal}>
                            {item.nombre_sucursal}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Bodega
                      <select
                        name="id_bodega"
                        value={form.id_bodega}
                        onChange={handleChange}
                        disabled={!form.id_sucursal}
                      >
                        <option value="">Automática</option>
                        {bodegasFiltradas.map((item) => (
                          <option key={item.id_bodega} value={item.id_bodega}>
                            {item.nombre_bodega}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Stock inicial
                      <input
                        type="number"
                        step="1"
                        name="stock_inicial"
                        value={form.stock_inicial}
                        onChange={handleChange}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="producto-modal-actions">
                <button
                  type="button"
                  className="cancel-product-button"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-product-button">
                  {modoEdicion ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Productos;