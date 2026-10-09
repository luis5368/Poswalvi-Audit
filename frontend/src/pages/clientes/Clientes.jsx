import { useEffect, useState } from 'react';
import {
  Pencil,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  actualizarCliente,
  cambiarEstadoCliente,
  crearCliente,
  obtenerClientes
} from '../../services/clientesService';
import './clientes.css';

const estadoClase = (estado) => {
  return String(estado || '').toLowerCase();
};

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);

  const [form, setForm] = useState({
    nit: '',
    nombre_cliente: '',
    telefono: '',
    correo: '',
    direccion: '',
    estado: 'Activo'
  });

  const cargarClientes = async () => {
    try {
      setCargando(true);

      const response = await obtenerClientes({
        buscar: busqueda || undefined
      });

      setClientes(response.clientes || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar clientes',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el listado de clientes'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const limpiarFormulario = () => {
    setForm({
      nit: '',
      nombre_cliente: '',
      telefono: '',
      correo: '',
      direccion: '',
      estado: 'Activo'
    });

    setModoEdicion(false);
    setClienteEditando(null);
  };

  const abrirCrear = () => {
    limpiarFormulario();
    setModalAbierto(true);
  };

  const abrirEditar = (cliente) => {
    setModoEdicion(true);
    setClienteEditando(cliente);

    setForm({
      nit: cliente.nit || '',
      nombre_cliente: cliente.nombre_cliente || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      direccion: cliente.direccion || '',
      estado: cliente.estado || 'Activo'
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
        text: 'Ingresa el NIT del cliente'
      });
      return false;
    }

    if (!form.nombre_cliente.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nombre obligatorio',
        text: 'Ingresa el nombre del cliente'
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

  const guardarCliente = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) return;

    try {
      const payload = {
        nit: form.nit.trim(),
        nombre_cliente: form.nombre_cliente.trim(),
        telefono: form.telefono.trim() || null,
        correo: form.correo.trim() || null,
        direccion: form.direccion.trim() || null,
        estado: form.estado
      };

      if (modoEdicion) {
        await actualizarCliente(clienteEditando.id_cliente, payload);

        Swal.fire({
          icon: 'success',
          title: 'Cliente actualizado',
          timer: 1400,
          showConfirmButton: false
        });
      } else {
        await crearCliente(payload);

        Swal.fire({
          icon: 'success',
          title: 'Cliente creado correctamente',
          timer: 1500,
          showConfirmButton: false
        });
      }

      setModalAbierto(false);
      limpiarFormulario();
      cargarClientes();
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

  const cambiarEstado = async (cliente) => {
    const nuevoEstado = cliente.estado === 'Activo' ? 'Inactivo' : 'Activo';

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: `¿Cambiar estado a ${nuevoEstado}?`,
      text: `Cliente: ${cliente.nombre_cliente}`,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await cambiarEstadoCliente(cliente.id_cliente, nuevoEstado);
      await cargarClientes();

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
      <div className="clientes-header">
        <div>
          <h1>Clientes</h1>
          <p>Gestión de clientes, NIT, contacto y estado comercial.</p>
        </div>

        <div className="clientes-actions">
          <button className="secondary-client-button" onClick={cargarClientes}>
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button className="primary-client-button" onClick={abrirCrear}>
            <Plus size={18} />
            Nuevo cliente
          </button>
        </div>
      </div>

      <section className="clientes-toolbar">
        <div className="clientes-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por NIT, nombre, teléfono o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarClientes();
            }}
          />
        </div>

        <button onClick={cargarClientes}>Buscar</button>
      </section>

      <section className="clientes-panel">
        <div className="clientes-panel-header">
          <div>
            <h3>Listado de clientes</h3>
            <span>{clientes.length} registros</span>
          </div>

          <div className="clientes-panel-icon">
            <Users size={22} />
          </div>
        </div>

        <div className="clientes-table-wrap">
          <table>
            <thead>
              <tr>
                <th>NIT</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id_cliente}>
                  <td>
                    <strong>{cliente.nit}</strong>
                  </td>

                  <td>{cliente.nombre_cliente}</td>

                  <td>{cliente.telefono || '-'}</td>

                  <td>{cliente.correo || '-'}</td>

                  <td>{cliente.direccion || '-'}</td>

                  <td>
                    <span className={`client-status ${estadoClase(cliente.estado)}`}>
                      {cliente.estado}
                    </span>
                  </td>

                  <td>
                    {cliente.actualizado_en
                      ? new Date(cliente.actualizado_en).toLocaleString('es-GT')
                      : '-'}
                  </td>

                  <td>
                    <div className="client-actions-cell">
                      <button title="Editar" onClick={() => abrirEditar(cliente)}>
                        <Pencil size={16} />
                      </button>

                      <button
                        title={cliente.estado === 'Activo' ? 'Inactivar' : 'Activar'}
                        onClick={() => cambiarEstado(cliente)}
                      >
                        {cliente.estado === 'Activo' ? (
                          <UserX size={16} />
                        ) : (
                          <UserCheck size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && clientes.length === 0 && (
                <tr>
                  <td colSpan="8" className="clientes-empty">
                    No hay clientes para mostrar.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="8" className="clientes-empty">
                    Cargando clientes...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="cliente-modal-backdrop">
          <div className="cliente-modal">
            <div className="cliente-modal-header">
              <h2>{modoEdicion ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setModalAbierto(false)}>×</button>
            </div>

            <form onSubmit={guardarCliente} className="cliente-form">
              <div className="cliente-form-grid">
                <label>
                  NIT
                  <input
                    name="nit"
                    value={form.nit}
                    onChange={handleChange}
                    placeholder="Ej. 1234567-8 o CF"
                  />
                </label>

                <label>
                  Nombre del cliente
                  <input
                    name="nombre_cliente"
                    value={form.nombre_cliente}
                    onChange={handleChange}
                    placeholder="Nombre completo o razón social"
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
                    placeholder="cliente@correo.com"
                  />
                </label>

                <label className="full-field">
                  Dirección
                  <input
                    name="direccion"
                    value={form.direccion}
                    onChange={handleChange}
                    placeholder="Dirección del cliente"
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

              <div className="cliente-modal-actions">
                <button
                  type="button"
                  className="cancel-client-button"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-client-button">
                  {modoEdicion ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Clientes;