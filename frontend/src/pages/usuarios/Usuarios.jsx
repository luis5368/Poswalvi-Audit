import { useEffect, useState } from 'react';
import {
  KeyRound,
  LockOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserX
} from 'lucide-react';
import Swal from 'sweetalert2';
import MainLayout from '../../components/layout/MainLayout';
import {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  desbloquearUsuario,
  obtenerUsuarios,
  restablecerPasswordUsuario
} from '../../services/usuariosService';
import './usuarios.css';

const estadoClase = (estado) => {
  return String(estado || '').toLowerCase();
};

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState(null);

  const [form, setForm] = useState({
    id_rol: '',
    id_sucursal: 1,
    nombre: '',
    apellido: '',
    usuario: '',
    correo: '',
    password_temporal: '',
    estado: 'Activo',
    requiere_cambio_password: true
  });

  const cargarUsuarios = async () => {
    try {
      setCargando(true);

      const response = await obtenerUsuarios({
        buscar: busqueda || undefined
      });

      setUsuarios(response.usuarios || []);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar usuarios',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el listado de usuarios'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const limpiarFormulario = () => {
    setForm({
      id_rol: '',
      id_sucursal: 1,
      nombre: '',
      apellido: '',
      usuario: '',
      correo: '',
      password_temporal: '',
      estado: 'Activo',
      requiere_cambio_password: true
    });

    setModoEdicion(false);
    setUsuarioEditando(null);
  };

  const abrirCrear = () => {
    limpiarFormulario();
    setModalAbierto(true);
  };

  const abrirEditar = (item) => {
    setModoEdicion(true);
    setUsuarioEditando(item);

    setForm({
      id_rol: item.id_rol || '',
      id_sucursal: item.id_sucursal || 1,
      nombre: item.nombre || '',
      apellido: item.apellido || '',
      usuario: item.usuario || '',
      correo: item.correo || '',
      password_temporal: '',
      estado: item.estado || 'Activo',
      requiere_cambio_password: Number(item.requiere_cambio_password || 0) === 1
    });

    setModalAbierto(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        ...form,
        id_rol: Number(form.id_rol),
        id_sucursal: form.id_sucursal ? Number(form.id_sucursal) : null
      };

      if (modoEdicion) {
        delete payload.password_temporal;
        delete payload.requiere_cambio_password;

        await actualizarUsuario(usuarioEditando.id_usuario, payload);

        Swal.fire({
          icon: 'success',
          title: 'Usuario actualizado',
          timer: 1400,
          showConfirmButton: false
        });
      } else {
        await crearUsuario(payload);

        Swal.fire({
          icon: 'success',
          title: 'Usuario creado',
          text: 'El usuario fue creado con contraseña temporal'
        });
      }

      setModalAbierto(false);
      limpiarFormulario();
      cargarUsuarios();
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

  const cambiarEstado = async (item, estado) => {
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: `¿Cambiar estado a ${estado}?`,
      text: `Usuario: ${item.usuario}`,
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await cambiarEstadoUsuario(item.id_usuario, {
        estado,
        motivo_bloqueo:
          estado === 'Bloqueado'
            ? 'Bloqueo administrativo desde panel de usuarios'
            : null
      });

      await cargarUsuarios();

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

  const restablecerPassword = async (item) => {
    const resultado = await Swal.fire({
      title: 'Restablecer contraseña',
      html: `
        <p style="margin-bottom: 10px;">Usuario: <b>${item.usuario}</b></p>
        <input id="password_temporal" class="swal2-input" placeholder="Contraseña temporal">
      `,
      showCancelButton: true,
      confirmButtonText: 'Restablecer',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const password = document.getElementById('password_temporal').value;

        if (!password || password.length < 8) {
          Swal.showValidationMessage('La contraseña debe tener al menos 8 caracteres');
          return false;
        }

        return password;
      }
    });

    if (!resultado.isConfirmed) return;

    try {
      await restablecerPasswordUsuario(item.id_usuario, {
        password_temporal: resultado.value,
        forzar_cambio: true
      });

      await cargarUsuarios();

      Swal.fire({
        icon: 'success',
        title: 'Contraseña restablecida',
        text: 'El usuario deberá cambiarla al iniciar sesión'
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo restablecer',
        text: error.response?.data?.mensaje || 'Error interno'
      });
    }
  };

  const desbloquear = async (item) => {
    try {
      await desbloquearUsuario(item.id_usuario);
      await cargarUsuarios();

      Swal.fire({
        icon: 'success',
        title: 'Usuario desbloqueado',
        timer: 1300,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo desbloquear',
        text: error.response?.data?.mensaje || 'Error interno'
      });
    }
  };

  return (
    <MainLayout>
      <div className="usuarios-header">
        <div>
          <h1>Usuarios</h1>
          <p>Administración de accesos, roles, sucursales y seguridad.</p>
        </div>

        <div className="usuarios-actions">
          <button className="secondary-user-button" onClick={cargarUsuarios}>
            <RefreshCw size={18} />
            Actualizar
          </button>

          <button className="primary-user-button" onClick={abrirCrear}>
            <Plus size={18} />
            Nuevo usuario
          </button>
        </div>
      </div>

      <section className="usuarios-toolbar">
        <div className="usuarios-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, correo, rol o sucursal..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') cargarUsuarios();
            }}
          />
        </div>

        <button onClick={cargarUsuarios}>Buscar</button>
      </section>

      <section className="usuarios-panel">
        <div className="usuarios-panel-header">
          <h3>Listado de usuarios</h3>
          <span>{usuarios.length} registros</span>
        </div>

        <div className="usuarios-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Sucursal</th>
                <th>Estado</th>
                <th>Cambio password</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuarios.map((item) => (
                <tr key={item.id_usuario}>
                  <td>
                    <strong>{item.usuario}</strong>
                    <small>{item.correo}</small>
                  </td>
                  <td>{item.nombre} {item.apellido}</td>
                  <td>{item.nombre_rol}</td>
                  <td>{item.nombre_sucursal || '-'}</td>
                  <td>
                    <span className={`user-status ${estadoClase(item.estado)}`}>
                      {item.estado}
                    </span>
                  </td>
                  <td>
                    {Number(item.requiere_cambio_password || 0) === 1 ? (
                      <span className="password-pending">Pendiente</span>
                    ) : (
                      <span className="password-ok">OK</span>
                    )}
                  </td>
                  <td>
                    {item.ultimo_acceso
                      ? new Date(item.ultimo_acceso).toLocaleString('es-GT')
                      : '-'}
                  </td>
                  <td>
                    <div className="user-actions-cell">
                      <button title="Editar" onClick={() => abrirEditar(item)}>
                        <Pencil size={16} />
                      </button>

                      <button
                        title="Restablecer contraseña"
                        onClick={() => restablecerPassword(item)}
                      >
                        <KeyRound size={16} />
                      </button>

                      {item.estado === 'Bloqueado' && (
                        <button title="Desbloquear" onClick={() => desbloquear(item)}>
                          <LockOpen size={16} />
                        </button>
                      )}

                      {item.estado === 'Activo' ? (
                        <button
                          title="Inactivar"
                          onClick={() => cambiarEstado(item, 'Inactivo')}
                        >
                          <UserX size={16} />
                        </button>
                      ) : (
                        <button
                          title="Activar"
                          onClick={() => cambiarEstado(item, 'Activo')}
                        >
                          <UserCheck size={16} />
                        </button>
                      )}

                      <button
                        title="Bloquear"
                        onClick={() => cambiarEstado(item, 'Bloqueado')}
                      >
                        <Shield size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && usuarios.length === 0 && (
                <tr>
                  <td colSpan="8" className="usuarios-empty">
                    No hay usuarios para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="usuario-modal-backdrop">
          <div className="usuario-modal">
            <div className="usuario-modal-header">
              <h2>{modoEdicion ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button onClick={() => setModalAbierto(false)}>×</button>
            </div>

            <form onSubmit={guardarUsuario} className="usuario-form">
              <div className="form-grid">
                <label>
                  Nombre
                  <input
                    name="nombre"
                    value={form.nombre}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Apellido
                  <input
                    name="apellido"
                    value={form.apellido}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Usuario
                  <input
                    name="usuario"
                    value={form.usuario}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Correo
                  <input
                    name="correo"
                    value={form.correo}
                    onChange={handleChange}
                  />
                </label>

                <label>
                  Rol
                  <select
                    name="id_rol"
                    value={form.id_rol}
                    onChange={handleChange}
                  >
                    <option value="">Seleccione rol</option>
                    <option value="1">Administrador</option>
                    <option value="2">Auditor</option>
                    <option value="6">Cajero</option>
                    <option value="7">Comprador Recepcionista</option>
                    <option value="5">Consulta tienda</option>
                    <option value="8">Superusuario</option>
                  </select>
                </label>

                <label>
                  Sucursal
                  <select
                    name="id_sucursal"
                    value={form.id_sucursal}
                    onChange={handleChange}
                  >
                    <option value="1">Sucursal Central</option>
                    <option value="2">Sucursal Zona 1 Actualizada</option>
                  </select>
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
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </label>

                {!modoEdicion && (
                  <label>
                    Contraseña temporal
                    <input
                      type="password"
                      name="password_temporal"
                      value={form.password_temporal}
                      onChange={handleChange}
                    />
                  </label>
                )}
              </div>

              {!modoEdicion && (
                <label className="check-row">
                  <input
                    type="checkbox"
                    name="requiere_cambio_password"
                    checked={form.requiere_cambio_password}
                    onChange={handleChange}
                  />
                  Forzar cambio de contraseña en próximo inicio de sesión
                </label>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setModalAbierto(false)}
                >
                  Cancelar
                </button>

                <button type="submit" className="save-button">
                  {modoEdicion ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default Usuarios;