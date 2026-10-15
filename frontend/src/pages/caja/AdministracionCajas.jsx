
import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Pencil,
  Plus,
  Power,
  Settings2
} from 'lucide-react';
import Swal from 'sweetalert2';

import {
  crearCaja,
  actualizarCaja,
  cambiarEstadoCaja,
  obtenerSucursalesCaja
} from '../../services/cajaService';

const formularioVacio = () => ({
  id_sucursal: '',
  nombre_caja: '',
  descripcion: ''
});

const AdministracionCajas = ({
  cajas = [],
  turnos = [],
  onActualizar
}) => {
  const [visible, setVisible] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [sinPermisoSucursales, setSinPermisoSucursales] =
    useState(false);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [cajaEditando, setCajaEditando] = useState(null);
  const [form, setForm] = useState(formularioVacio());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let vigente = true;

    const cargarSucursales = async () => {
      try {
        const respuesta = await obtenerSucursalesCaja({
          estado: 'Activa'
        });

        if (vigente) {
          setSucursales(respuesta.sucursales || []);
          setSinPermisoSucursales(false);
        }
      } catch {
        if (vigente) {
          setSucursales([]);
          setSinPermisoSucursales(true);
        }
      }
    };

    cargarSucursales();

    return () => {
      vigente = false;
    };
  }, [visible]);

  const opcionesSucursal = useMemo(() => {
    if (!sinPermisoSucursales) {
      return sucursales;
    }

    const mapa = new Map();

    cajas.forEach((caja) => {
      mapa.set(Number(caja.id_sucursal), {
        id_sucursal: Number(caja.id_sucursal),
        nombre_sucursal: caja.nombre_sucursal
      });
    });

    return [...mapa.values()];
  }, [cajas, sucursales, sinPermisoSucursales]);

  const tieneHistorial = (idCaja) =>
    turnos.some(
      (turno) =>
        Number(turno.id_caja) === Number(idCaja)
    );

  const turnoAbierto = (idCaja) =>
    turnos.find(
      (turno) =>
        Number(turno.id_caja) === Number(idCaja) &&
        turno.estado === 'Abierto'
    );

  const iniciarCreacion = () => {
    if (opcionesSucursal.length === 0) {
      Swal.fire(
        'Sin sucursales',
        'No hay sucursales disponibles. Verifica los permisos de consulta.',
        'warning'
      );
      return;
    }

    setCajaEditando(null);
    setForm(formularioVacio());
    setModalAbierto(true);
  };

  const iniciarEdicion = (caja) => {
    setCajaEditando(caja);

    setForm({
      id_sucursal: String(caja.id_sucursal),
      nombre_caja: caja.nombre_caja || '',
      descripcion: caja.descripcion || ''
    });

    setModalAbierto(true);
  };

  const guardar = async (e) => {
    e.preventDefault();

    if (guardando) return;

    const idSucursal = Number(form.id_sucursal);
    const nombre = form.nombre_caja.trim();

    if (
      !Number.isSafeInteger(idSucursal) ||
      idSucursal <= 0 ||
      !nombre
    ) {
      Swal.fire(
        'Datos incompletos',
        'Selecciona la sucursal e ingresa el nombre de la caja.',
        'warning'
      );
      return;
    }

    if (
      cajaEditando &&
      tieneHistorial(cajaEditando.id_caja) &&
      idSucursal !== Number(cajaEditando.id_sucursal)
    ) {
      Swal.fire(
        'Operación bloqueada',
        'No se puede trasladar una caja que tiene historial de turnos.',
        'warning'
      );
      return;
    }

    const nombreDuplicado = cajas.some(
      (c) =>
        Number(c.id_sucursal) === idSucursal &&
        c.nombre_caja.trim().toLocaleLowerCase('es-GT') ===
          nombre.toLocaleLowerCase('es-GT') &&
        Number(c.id_caja) !== Number(cajaEditando?.id_caja)
    );

    if (nombreDuplicado) {
      Swal.fire(
        'Nombre duplicado',
        'Ya existe una caja con ese nombre en la sucursal.',
        'warning'
      );
      return;
    }

    const datos = {
      id_sucursal: idSucursal,
      nombre_caja: nombre,
      descripcion: form.descripcion.trim() || null,
      estado: cajaEditando
        ? cajaEditando.estado
        : 'Activa'
    };

    try {
      setGuardando(true);

      if (cajaEditando) {
        await actualizarCaja(cajaEditando.id_caja, datos);
      } else {
        await crearCaja(datos);
      }

      setModalAbierto(false);
      setCajaEditando(null);

      await onActualizar();

      await Swal.fire(
        'Operación correcta',
        cajaEditando
          ? 'Caja actualizada.'
          : 'Caja creada correctamente.',
        'success'
      );
    } catch (error) {
      await Swal.fire(
        'No se pudo guardar',
        error.response?.data?.mensaje ||
          'Comprueba los permisos y los datos ingresados.',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (caja) => {
    if (guardando) return;

    const nuevoEstado =
      caja.estado === 'Activa' ? 'Inactiva' : 'Activa';

    if (
      nuevoEstado === 'Inactiva' &&
      turnoAbierto(caja.id_caja)
    ) {
      Swal.fire(
        'Caja ocupada',
        'No puedes inactivar una caja con un turno abierto.',
        'warning'
      );
      return;
    }

    const confirmacion = await Swal.fire({
      title: `¿Marcar como ${nuevoEstado.toLowerCase()}?`,
      text: caja.nombre_caja,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setGuardando(true);

      await cambiarEstadoCaja(caja.id_caja, {
        estado: nuevoEstado
      });

      await onActualizar();

      await Swal.fire(
        'Estado actualizado',
        `${caja.nombre_caja}: ${nuevoEstado}`,
        'success'
      );
    } catch (error) {
      await Swal.fire(
        'No se pudo actualizar',
        error.response?.data?.mensaje ||
          'No se pudo cambiar el estado de la caja.',
        'error'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="caja-admin">
      <div className="caja-admin-cabecera">
        <div>
          <h3>
            <Settings2 size={19} />
            Administración de cajas
          </h3>
          <p>
            Crea y administra las cajas dentro de las
            sucursales existentes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
        >
          {visible
            ? 'Ocultar administración'
            : 'Administrar cajas'}
        </button>
      </div>

      {visible && (
        <div className="caja-admin-contenido">
          <div className="caja-admin-resumen">
            <span>{cajas.length} cajas registradas</span>

            <button
              type="button"
              className="caja-btn-primary"
              onClick={iniciarCreacion}
              disabled={guardando}
            >
              <Plus size={16} />
              Nueva caja
            </button>
          </div>

          {sinPermisoSucursales && (
            <p className="caja-admin-aviso">
              No se pudo consultar el catálogo de
              sucursales. Se muestran las que ya tienen
              una caja; el servidor comprobará su estado
              al guardar.
            </p>
          )}

          <div className="caja-tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Sucursal</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th>Operación</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {cajas.map((caja) => {
                  const abierto = turnoAbierto(caja.id_caja);

                  return (
                    <tr key={caja.id_caja}>
                      <td>
                        <strong>{caja.nombre_caja}</strong>
                        <small>#{caja.id_caja}</small>
                      </td>

                      <td>{caja.nombre_sucursal}</td>

                      <td>
                        {caja.descripcion ||
                          'Sin descripción'}
                      </td>

                      <td>
                        <span
                          className={`caja-admin-estado ${
                            caja.estado === 'Activa'
                              ? 'activo'
                              : 'inactivo'
                          }`}
                        >
                          {caja.estado}
                        </span>
                      </td>

                      <td>
                        {abierto
                          ? `Turno #${abierto.id_turno} abierto`
                          : 'Sin turno abierto'}
                      </td>

                      <td>
                        <div className="caja-acciones-tabla">
                          <button
                            type="button"
                            title="Editar caja"
                            onClick={() =>
                              iniciarEdicion(caja)
                            }
                            disabled={guardando}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            title={
                              caja.estado === 'Activa'
                                ? 'Inactivar caja'
                                : 'Activar caja'
                            }
                            onClick={() =>
                              cambiarEstado(caja)
                            }
                            disabled={
                              guardando ||
                              (caja.estado === 'Activa' &&
                                Boolean(abierto))
                            }
                          >
                            <Power size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {cajas.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="caja-sin-datos"
                    >
                      No hay cajas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalAbierto && (
        <div className="caja-modal-fondo">
          <div className="caja-modal">
            <div className="caja-modal-header">
              <h2>
                {cajaEditando
                  ? 'Editar caja'
                  : 'Nueva caja'}
              </h2>

              <button
                type="button"
                onClick={() =>
                  setModalAbierto(false)
                }
                disabled={guardando}
              >
                ×
              </button>
            </div>

            <form
              className="caja-form"
              onSubmit={guardar}
            >
              <label>
                <Building2 size={16} />
                Sucursal

                <select
                  required
                  value={form.id_sucursal}
                  disabled={Boolean(
                    cajaEditando &&
                      tieneHistorial(
                        cajaEditando.id_caja
                      )
                  )}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      id_sucursal: e.target.value
                    }))
                  }
                >
                  <option value="">
                    Seleccione sucursal
                  </option>

                  {opcionesSucursal.map((s) => (
                    <option
                      value={s.id_sucursal}
                      key={s.id_sucursal}
                    >
                      {s.nombre_sucursal}
                    </option>
                  ))}
                </select>
              </label>

              {cajaEditando &&
                tieneHistorial(
                  cajaEditando.id_caja
                ) && (
                  <small className="caja-admin-aviso">
                    La sucursal no puede cambiar
                    porque la caja tiene turnos
                    históricos.
                  </small>
                )}

              <label>
                Nombre de caja
                <input
                  required
                  maxLength={100}
                  value={form.nombre_caja}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      nombre_caja: e.target.value
                    }))
                  }
                  placeholder="Ej.: Caja Secundaria"
                />
              </label>

              <label>
                Descripción (opcional)
                <textarea
                  maxLength={255}
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      descripcion: e.target.value
                    }))
                  }
                  placeholder="Ubicación o uso de la caja"
                />
              </label>

              <div className="caja-modal-acciones">
                <button
                  type="button"
                  onClick={() =>
                    setModalAbierto(false)
                  }
                  disabled={guardando}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="caja-btn-primary"
                  disabled={guardando}
                >
                  {guardando
                    ? 'Guardando...'
                    : cajaEditando
                    ? 'Guardar cambios'
                    : 'Crear caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdministracionCajas;
