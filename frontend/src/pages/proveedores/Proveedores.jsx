import { useEffect, useState } from 'react';
import {
  Building2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Truck,
  UserCheck,
  UserX
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  actualizarProveedor,
  cambiarEstadoProveedor,
  crearProveedor,
  obtenerProveedores
} from '../../services/proveedoresService';
import './proveedores.css';

const estadoClase = (estado) => {
  return String(estado || '').toLowerCase();
};

const Proveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [proveedorEditando, setProveedorEditando] = useState(null);

  const [form, setForm] = useState({
    nit: '',
    nombre_proveedor: '',
    razon_social: '',
    telefono: '',
    correo: '',
    direccion: '',
    contacto: '',
    estado: 'Activo'
  });

  const cargarProveedores = async () => {
    try {
      setCargando(true);

      const response = await obtenerProveedores({
        buscar: busqueda || undefined
      });

      setProveedores(response.proveedores || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar proveedores',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el listado de proveedores'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProveedores();
  }, []);

  const limpiarFormulario = () => {
    setForm({
      nit: '',
      nombre_proveedor: '',
      razon_social: '',
      telefono: '',
      correo: '',
      direccion: '',
      contacto: '',
      estado: 'Activo'
    });

    setModoEdicion(false);
    setProveedorEditando(null);
  };

  const abrirCrear = () => {
    limpiarFormulario();
    setModalAbierto(true);
  };

  const abrirEditar = (proveedor) => {
    setModoEdicion(true);
    setProveedorEditando(proveedor);

    setForm({
      nit: proveedor.nit || '',
      nombre_proveedor: proveedor.nombre_proveedor || '',
      razon_social: proveedor.razon_social || '',
      telefono: proveedor.telefono || '',
      correo: proveedor.correo || '',
      direccion: proveedor.direccion || '',
      contacto: proveedor.contacto || '',
      estado: proveedor.estado || 'Activo'
    });

    setModalAbierto(true);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const validarFormulario = () => {
    if (!form.nit.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'NIT obligatorio',
        text: 'Ingresa el NIT del proveedor'
      });
      return false;
    }

    if (!form.nombre_proveedor.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre obligatorio',
        text: 'Ingresa el nombre del proveedor'
      });
      return false;
    }

    if (form.telefono && !/^[0-9]{8}$/.test(form.telefono)) {
      Swal.fire({
        icon: 'warning',
        title: 'Teléfono inválido',
        text: 'El teléfono debe tener 8 dígitos numéricos'
      });
      return false;
    }

    if (form.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      Swal.fire({
        icon: 'warning',
        title: 'Correo inválido',
        text: 'Ingresa un correo con formato válido'
      });
      return false;
    }

    return true;
  };

  const guardarProveedor = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) return;

    try {
      const payload = {
        nit: form.nit.trim(),
        nombre_proveedor: form.nombre_proveedor.trim(),
        razon_social: form.razon_social.trim() || null,
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
        direccion: form.direccion.trim() || null,
        contacto: form.contacto.trim() || null,
        estado: form.estado
      };

      if (modoEdicion) {
        await actualizarProveedor(proveedorEditando.id_proveedor, payload);

        Swal.fire({
          icon: 'success',
          title: 'Proveedor actualizado',
          timer: 1400,
          showConfirmButton: false
        });
      } else {
        await crearProveedor(payload);

        Swal.fire({
          icon: 'success',
          title: 'Proveedor creado correctamente',
          timer: 1500,
          showConfirmButton: false
        });
      }

      setModalAbierto(false);
      limpiarFormulario();
      cargarProveedores();
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

  const cambiarEstado = async (proveedor) => {
    const nuevoEstado = proveedor.estado === 'Activo' ? 'Inactivo' : 'Activo';

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: `¿Cambiar estado a ${nuevoEstado}?`,
      text: `Proveedor: ${proveedor.nombre_proveedor}`,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await cambiarEstadoProveedor(proveedor.id_proveedor, nuevoEstado);
      await cargarProveedores();

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

  return (
    <MainLayout>
      <div className="proveedores-header">
        <div>
          <h1>Proveedores</h1>
          <p>Gestión de proveedores, razón social, contacto y estado comercial.</p>
        </div>

        <div className="proveedores-actions">
          <button className="secondary-provider-button" onClick={cargarProveedores}>
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button className="primary-provider-button" onClick={abrirCrear}>
            <Plus size={18} />
            Nuevo proveedor
          </button>
        </div>
      </div>

      <section className="proveedores-toolbar">
        <div className="proveedores-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por NIT, proveedor, razón social, teléfono, correo o contacto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarProveedores();
            }}
          />
        </div>

        <button onClick={cargarProveedores}>Buscar</button>
      </section>

      <section className="proveedores-panel">
        <div className="proveedores-panel-header">
          <div>
            <h3>Listado de proveedores</h3>
            <span>{proveedores.length} registros</span>
          </div>

          <div className="proveedores-panel-icon">
            <Truck size={22} />
          </div>
        </div>

        <div className="proveedores-table-wrap">
          <table>
            <thead>
              <tr>
                <th>NIT</th>
                <th>Proveedor</th>
                <th>Razón social</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {proveedores.map((proveedor) => (
                <tr key={proveedor.id_proveedor}>
                  <td>
                    <strong>{proveedor.nit}</strong>
                  </td>

                  <td>{proveedor.nombre_proveedor}</td>

                  <td>{proveedor.razon_social || '-'}</td>

                  <td>{proveedor.telefono || '-'}</td>

                  <td>{proveedor.correo || '-'}</td>

                  <td>{proveedor.contacto || '-'}</td>

                  <td>
                    <span className={`provider-status ${estadoClase(proveedor.estado)}`}>
                      {proveedor.estado}
                    </span>
                  </td>

                  <td>
                    {proveedor.actualizado_en
                      ? new Date(proveedor.actualizado_en).toLocaleString('es-GT')
                      : '-'}
                  </td>

                  <td>
                    <div className="provider-actions-cell">
                      <button title="Editar" onClick={() => abrirEditar(proveedor)}>
                        <Pencil size={16} />
                      </button>

                      <button
                        title={proveedor.estado === 'Activo' ? 'Inactivar' : 'Activar'}
                        onClick={() => cambiarEstado(proveedor)}
                      >
                        {proveedor.estado === 'Activo' ? (
                          <UserX size={16} />
                        ) : (
                          <UserCheck size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && proveedores.length === 0 && (
                <tr>
                  <td colSpan="9" className="proveedores-empty">
                    No hay proveedores para mostrar.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="9" className="proveedores-empty">
                    Cargando proveedores...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="proveedor-modal-backdrop">
          <div className="proveedor-modal">
            <div className="proveedor-modal-header">
              <h2>{modoEdicion ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button onClick={() => setModalAbierto(false)}>×</button>
            </div>

            <form onSubmit={guardarProveedor} className="proveedor-form">
              <div className="proveedor-form-grid">
                <label>
                  NIT
                  <input
                    name="nit"
                    value={form.nit}
                    onChange={handleChange}
                    placeholder="Ej. 1234567-8"
                  />
                </label>

                <label>
                  Nombre proveedor
                  <input
                    name="nombre_proveedor"
                    value={form.nombre_proveedor}
                    onChange={handleChange}
                    placeholder="Nombre comercial"
                  />
                </label>

                <label>
                  Razón social
                  <input
                    name="razon_social"
                    value={form.razon_social}
                    onChange={handleChange}
                    placeholder="Razón social"
                  />
                </label>

                <label>
                  Teléfono
                  <input
                    name="telefono"
                    value={form.telefono}
                    onChange={handleChange}
                    placeholder="8 dígitos"
                    maxLength="8"
                  />
                </label>

                <label>
                  Correo
                  <input
                    name="correo"
                    value={form.correo}
                    onChange={handleChange}
                    placeholder="proveedor@correo.com"
                  />
                </label>

                <label>
                  Contacto
                  <input
                    name="contacto"
                    value={form.contacto}
                    onChange={handleChange}
                    placeholder="Persona de contacto"
                  />
                </label>

                <label className="provider-full-field">
                  Dirección
                  <input
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    placeholder="Dirección del proveedor"
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
              </div>

              <div className="proveedor-modal-actions">
                <button
                  type="button"
                  className="cancel-provider-button"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-provider-button">
                  {modoEdicion ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Proveedores;