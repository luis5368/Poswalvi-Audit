
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

import {
  obtenerCajerosDisponibles,
  obtenerMisAsignaciones,
  obtenerAsignacionesPendientes,
  crearAsignacionCaja,
  responderAsignacionCaja,
  cancelarAsignacionCaja
} from '../../services/asignacionesCajaService';

const dinero = (valor) =>
  `Q ${Number(valor || 0).toFixed(2)}`;

const AperturaSupervisada = ({ cajas = [], onActualizar }) => {
  const [puedeAsignar, setPuedeAsignar] = useState(false);
  const [cajeros, setCajeros] = useState([]);
  const [mias, setMias] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [procesando, setProcesando] = useState(false);

  const [form, setForm] = useState({
    id_caja: '',
    id_usuario_cajero: '',
    monto_apertura: '',
    observaciones: ''
  });

  const cargar = async () => {
    try {
      const respuesta = await obtenerMisAsignaciones();
      setMias(respuesta.asignaciones || []);
    } catch (error) {
      console.error('Error al cargar mis asignaciones:', error);
    }

    try {
      const respuesta = await obtenerAsignacionesPendientes();
      setPendientes(respuesta.asignaciones || []);
      setPuedeAsignar(true);
    } catch (error) {
      setPuedeAsignar(false);
      setPendientes([]);

      if (error.response?.status !== 403) {
        console.error('Error al consultar asignaciones:', error);
      }
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const seleccionarCaja = async (idCaja) => {
    setForm((anterior) => ({
      ...anterior,
      id_caja: idCaja,
      id_usuario_cajero: ''
    }));

    setCajeros([]);

    if (!idCaja) return;

    try {
      const respuesta = await obtenerCajerosDisponibles(idCaja);
      setCajeros(respuesta.cajeros || []);
    } catch (error) {
      await Swal.fire(
        'No se pudieron consultar cajeros',
        error.response?.data?.mensaje ||
          'Comprueba la caja y los permisos.',
        'error'
      );
    }
  };

  const guardarAsignacion = async (e) => {
    e.preventDefault();

    if (procesando) return;

    if (
      !form.id_caja ||
      !form.id_usuario_cajero ||
      form.monto_apertura === '' ||
      !Number.isFinite(Number(form.monto_apertura)) ||
      Number(form.monto_apertura) < 0
    ) {
      Swal.fire(
        'Datos incompletos',
        'Selecciona la caja, el cajero y un fondo válido.',
        'warning'
      );
      return;
    }

    const confirmacion = await Swal.fire({
      icon: 'question',
      title: 'Confirmar asignación',
      text: `Fondo inicial: ${dinero(form.monto_apertura)}`,
      showCancelButton: true,
      confirmButtonText: 'Asignar fondo',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesando(true);

      await crearAsignacionCaja({
        id_caja: Number(form.id_caja),
        id_usuario_cajero: Number(form.id_usuario_cajero),
        monto_apertura: Number(form.monto_apertura),
        observaciones: form.observaciones.trim() || null
      });

      setForm({
        id_caja: '',
        id_usuario_cajero: '',
        monto_apertura: '',
        observaciones: ''
      });

      setCajeros([]);

      await cargar();
      await onActualizar?.();

      await Swal.fire(
        'Asignación registrada',
        'El cajero debe confirmar la recepción del fondo.',
        'success'
      );
    } catch (error) {
      await Swal.fire(
        'No se pudo asignar',
        error.response?.data?.mensaje ||
          'Error al registrar la asignación.',
        'error'
      );
    } finally {
      setProcesando(false);
    }
  };

  const responder = async (asignacion, accion) => {
    const confirmacion = await Swal.fire({
      icon: accion === 'Confirmar' ? 'question' : 'warning',
      title: accion === 'Confirmar'
        ? '¿Confirma que recibió el fondo?'
        : '¿Rechazar la asignación?',
      text: `${asignacion.nombre_caja} — ${dinero(asignacion.monto_apertura)}`,
      showCancelButton: true,
      confirmButtonText: accion,
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesando(true);

      await responderAsignacionCaja(
        asignacion.id_asignacion,
        accion
      );

      await cargar();
      await onActualizar?.();

      await Swal.fire(
        'Operación completada',
        accion === 'Confirmar'
          ? 'Fondo recibido. Tu turno está abierto.'
          : 'La asignación fue rechazada.',
        'success'
      );
    } catch (error) {
      Swal.fire(
        'No se pudo completar',
        error.response?.data?.mensaje || 'Error interno',
        'error'
      );
    } finally {
      setProcesando(false);
    }
  };

  const cancelar = async (asignacion) => {
    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Cancelar asignación?',
      text: `${asignacion.nombre_cajero} — ${asignacion.nombre_caja}`,
      showCancelButton: true,
      confirmButtonText: 'Cancelar asignación',
      cancelButtonText: 'Volver'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesando(true);
      await cancelarAsignacionCaja(asignacion.id_asignacion);
      await cargar();

      Swal.fire(
        'Asignación cancelada',
        'La caja y el cajero vuelven a estar disponibles.',
        'success'
      );
    } catch (error) {
      Swal.fire(
        'No se pudo cancelar',
        error.response?.data?.mensaje || 'Error interno',
        'error'
      );
    } finally {
      setProcesando(false);
    }
  };

  return (
    <section className="caja-admin">
      <div className="caja-admin-cabecera">
        <div>
          <h3>Apertura supervisada de cajas</h3>
          <p>
            Asignación de cajero, control del fondo inicial
            y confirmación de recepción.
          </p>
        </div>

        <button type="button" onClick={cargar}>
          Actualizar asignaciones
        </button>
      </div>

      {mias.length > 0 && (
        <div className="caja-admin-contenido">
          <h3>Mis asignaciones pendientes</h3>

          {mias.map((a) => (
            <div className="caja-turno-actual" key={a.id_asignacion}>
              <div>
                <strong>{a.nombre_caja}</strong>
                <p>{a.nombre_sucursal}</p>
                <p>Asignado por: {a.asignado_por}</p>
                <p>Fondo entregado: {dinero(a.monto_apertura)}</p>
                <p>{a.observaciones || 'Sin observaciones'}</p>
              </div>

              <div className="caja-modal-acciones">
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => responder(a, 'Rechazar')}
                >
                  Rechazar
                </button>

                <button
                  type="button"
                  className="caja-btn-primary"
                  disabled={procesando}
                  onClick={() => responder(a, 'Confirmar')}
                >
                  Confirmar recepción
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {puedeAsignar && (
        <div className="caja-admin-contenido">
          <h3>Asignar caja a un cajero</h3>

          <form className="caja-form" onSubmit={guardarAsignacion}>
            <label>
              Caja
              <select
                required
                value={form.id_caja}
                onChange={(e) => seleccionarCaja(e.target.value)}
              >
                <option value="">Seleccione una caja</option>

                {cajas
                  .filter((c) => c.estado === 'Activa')
                  .map((c) => (
                    <option key={c.id_caja} value={c.id_caja}>
                      {c.nombre_caja} — {c.nombre_sucursal}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Cajero-vendedor
              <select
                required
                value={form.id_usuario_cajero}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    id_usuario_cajero: e.target.value
                  }))
                }
              >
                <option value="">Seleccione un cajero</option>

                {cajeros.map((u) => (
                  <option value={u.id_usuario} key={u.id_usuario}>
                    {u.nombre} {u.apellido} — {u.nombre_rol}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Fondo inicial (Q)
              <input
                required
                type="number"
                min="0"
                max="99999999.99"
                step="0.01"
                value={form.monto_apertura}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    monto_apertura: e.target.value
                  }))
                }
              />
            </label>

            <label>
              Observaciones
              <textarea
                maxLength={500}
                value={form.observaciones}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    observaciones: e.target.value
                  }))
                }
              />
            </label>

            <div className="caja-modal-acciones">
              <button
                className="caja-btn-primary"
                type="submit"
                disabled={procesando}
              >
                {procesando ? 'Procesando...' : 'Asignar caja y fondo'}
              </button>
            </div>
          </form>

          <h3>Asignaciones pendientes de la sucursal</h3>

          <div className="caja-tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Cajero</th>
                  <th>Fondo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((a) => (
                  <tr key={a.id_asignacion}>
                    <td>{a.nombre_caja}</td>
                    <td>{a.nombre_cajero}</td>
                    <td>{dinero(a.monto_apertura)}</td>
                    <td>Pendiente</td>
                    <td>
                      <button
                        type="button"
                        disabled={procesando}
                        onClick={() => cancelar(a)}
                      >
                        Cancelar asignación
                      </button>
                    </td>
                  </tr>
                ))}

                {pendientes.length === 0 && (
                  <tr>
                    <td colSpan="5" className="caja-sin-datos">
                      No hay asignaciones pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};

export default AperturaSupervisada;
