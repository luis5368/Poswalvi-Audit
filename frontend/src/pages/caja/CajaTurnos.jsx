
import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  RefreshCw,
  Plus,
  LockKeyhole,
  Eye,
  Search,
  Clock,
  AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';

import MainLayout from '../../components/layout/MainLayout';
import { useAuth } from '../../context/AuthContext';

import {
  obtenerCajas,
  obtenerTurnos,
  obtenerTurnoActivo,
  obtenerTurnoPorId,
  abrirTurno,
  cerrarTurno,
} from '../../services/cajaService';

import AdministracionCajas from './AdministracionCajas';
import AperturaSupervisada from './AperturaSupervisada';
import './cajaTurnos.css';

const dinero = (valor) =>
  `Q ${Number(valor || 0).toFixed(2)}`;

const fecha = (valor) =>
  valor ? new Date(valor).toLocaleString('es-GT') : '-';

const CajaTurnos = () => {
  const { usuario } = useAuth();

  const [cajas, setCajas] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [miTurno, setMiTurno] = useState(null);

  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('Todos');
  const [cargando, setCargando] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const [modalApertura, setModalApertura] = useState(false);
  const [modalCierre, setModalCierre] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);

  const [formApertura, setFormApertura] = useState({
    id_caja: '',
    monto_apertura: '',
    observaciones: ''
  });

  const [formCierre, setFormCierre] = useState({
    monto_cierre_fisico: '',
    observaciones: ''
  });

  const cargarDatos = async () => {
    try {
      setCargando(true);

      const [resCajas, resTurnos, resActivo] = await Promise.all([
        obtenerCajas(),
        obtenerTurnos(),
        obtenerTurnoActivo()
      ]);

      setCajas(resCajas.cajas || []);
      setTurnos(resTurnos.turnos || []);

      setMiTurno(
        resActivo.tiene_turno_activo
          ? resActivo.turno
          : null
      );
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar caja',
        text:
          error.response?.data?.mensaje ||
          'No se pudieron cargar los turnos'
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const resumen = useMemo(() => {
    const abiertos = turnos.filter(
      (item) => item.estado === 'Abierto'
    );

    const cerrados = turnos.filter(
      (item) => item.estado === 'Cerrado'
    );

    const conDiferencia = cerrados.filter(
      (item) => Math.abs(Number(item.diferencia || 0)) > 0.009
    );

    return {
      total: turnos.length,
      abiertos: abiertos.length,
      cerrados: cerrados.length,
      conDiferencia: conDiferencia.length
    };
  }, [turnos]);

  const turnosFiltrados = useMemo(() => {
    const texto = busqueda.toLowerCase().trim();

    return turnos.filter((item) => {
      const coincideEstado =
        filtroEstado === 'Todos' ||
        item.estado === filtroEstado;

      const contenido = [
        item.id_turno,
        item.nombre_caja,
        item.nombre_sucursal,
        item.usuario,
        item.nombre_usuario
      ]
        .join(' ')
        .toLowerCase();

      return coincideEstado && contenido.includes(texto);
    });
  }, [turnos, busqueda, filtroEstado]);

  const abrirFormularioApertura = () => {
    if (miTurno) {
      Swal.fire({
        icon: 'warning',
        title: 'Ya tienes un turno activo',
        text: `Turno #${miTurno.id_turno} - ${miTurno.nombre_caja}`
      });
      return;
    }

    setFormApertura({
      id_caja: '',
      monto_apertura: '',
      observaciones: ''
    });

    setModalApertura(true);
  };

  const registrarApertura = async (e) => {
    e.preventDefault();

    if (procesando) return;

    const monto = Number(formApertura.monto_apertura);

    if (!formApertura.id_caja) {
      Swal.fire('Caja requerida', 'Selecciona una caja', 'warning');
      return;
    }

    if (
      formApertura.monto_apertura.trim() === '' ||
      !Number.isFinite(monto) ||
      monto < 0
    ) {
      Swal.fire(
        'Monto inválido',
        'Ingresa un monto de apertura válido',
        'warning'
      );
      return;
    }

    const cajaOcupada = turnos.some(
      (turno) =>
        Number(turno.id_caja) === Number(formApertura.id_caja) &&
        turno.estado === 'Abierto'
    );

    if (cajaOcupada) {
      Swal.fire(
        'Caja ocupada',
        'Esta caja ya tiene un turno abierto',
        'warning'
      );
      return;
    }

    const confirmacion = await Swal.fire({
      icon: 'question',
      title: '¿Abrir turno?',
      text: `Fondo inicial: ${dinero(monto)}`,
      showCancelButton: true,
      confirmButtonText: 'Abrir turno',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesando(true);

      const resultado = await abrirTurno({
        id_caja: Number(formApertura.id_caja),
        monto_apertura: monto,
        observaciones:
          formApertura.observaciones.trim() || null
      });

      setModalApertura(false);

      await cargarDatos();

      Swal.fire({
        icon: 'success',
        title: 'Turno abierto',
        text: `Turno #${resultado.id_turno} registrado correctamente`
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo abrir el turno',
        text:
          error.response?.data?.mensaje ||
          'Error al aperturar turno'
      });
    } finally {
      setProcesando(false);
    }
  };

  const solicitarCierre = (turno) => {
    if (Number(turno.id_usuario) !== Number(usuario?.id_usuario)) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso denegado',
        text: 'No puedes cerrar un turno de otro usuario'
      });
      return;
    }

    setFormCierre({
      monto_cierre_fisico: '',
      observaciones: ''
    });

    setModalCierre(turno);
  };

  const registrarCierre = async (e) => {
    e.preventDefault();

    if (procesando || !modalCierre) return;

    const monto = Number(formCierre.monto_cierre_fisico);

    if (
      formCierre.monto_cierre_fisico.trim() === '' ||
      !Number.isFinite(monto) ||
      monto < 0
    ) {
      Swal.fire(
        'Monto inválido',
        'Ingresa el efectivo físico contado',
        'warning'
      );
      return;
    }

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: '¿Confirmar cierre de caja?',
      text:
        'El turno quedará cerrado y no podrá volver a utilizarse.',
      showCancelButton: true,
      confirmButtonText: 'Cerrar turno',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    try {
      setProcesando(true);

      const respuesta = await cerrarTurno(modalCierre.id_turno, {
        monto_cierre_fisico: monto,
        observaciones:
          formCierre.observaciones.trim() || null
      });

      const resultado = respuesta.resumen;

      setModalCierre(null);

      await cargarDatos();

      const diferencia = Number(resultado?.diferencia || 0);

      await Swal.fire({
        icon: Math.abs(diferencia) > 0.009 ? 'warning' : 'success',
        title: 'Turno cerrado correctamente',
        text:
          `Sistema: ${dinero(resultado.monto_cierre_sistema)} | ` +
          `Físico: ${dinero(resultado.monto_cierre_fisico)} | ` +
          `Diferencia: ${dinero(diferencia)}`
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo cerrar el turno',
        text:
          error.response?.data?.mensaje ||
          'Error al cerrar caja'
      });
    } finally {
      setProcesando(false);
    }
  };

  const consultarDetalle = async (idTurno) => {
    try {
      const respuesta = await obtenerTurnoPorId(idTurno);
      setModalDetalle(respuesta.turno);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al consultar turno',
        text:
          error.response?.data?.mensaje ||
          'No se pudo obtener el detalle'
      });
    }
  };

  return (
    <MainLayout>
      <div className="caja-header">
        <div>
          <h1>Caja y turnos</h1>
          <p>
            Apertura, cierre, control de efectivo y trazabilidad
            de turnos de caja.
          </p>
        </div>

        <div className="caja-header-actions">
          <button onClick={cargarDatos} disabled={cargando}>
            <RefreshCw size={17} />
            Actualizar
          </button>

          <button
            className="caja-btn-primary"
            onClick={abrirFormularioApertura}
            disabled={Boolean(miTurno)}
          >
            <Plus size={17} />
            Abrir turno
          </button>
        </div>
      </div>

      <section className="caja-kpi-grid">
        <article className="caja-kpi">
          <Wallet size={26} />
          <span>Total de turnos</span>
          <strong>{resumen.total}</strong>
          <small>Registros históricos</small>
        </article>

        <article className="caja-kpi">
          <Clock size={26} />
          <span>Turnos abiertos</span>
          <strong>{resumen.abiertos}</strong>
          <small>Actualmente en operación</small>
        </article>

        <article className="caja-kpi">
          <LockKeyhole size={26} />
          <span>Turnos cerrados</span>
          <strong>{resumen.cerrados}</strong>
          <small>Cierres registrados</small>
        </article>

        <article className="caja-kpi">
          <AlertTriangle size={26} />
          <span>Cierres con diferencia</span>
          <strong>{resumen.conDiferencia}</strong>
          <small>Requieren revisión</small>
        </article>
      </section>

      <section className="caja-turno-actual">
        <div>
          <h3>Mi turno activo</h3>

          {miTurno ? (
            <>
              <p>
                Turno #{miTurno.id_turno} - {miTurno.nombre_caja}
              </p>
              <p>{miTurno.nombre_sucursal}</p>
              <p>Apertura: {fecha(miTurno.fecha_apertura)}</p>
              <strong>
                Fondo inicial: {dinero(miTurno.monto_apertura)}
              </strong>
            </>
          ) : (
            <p>No tienes un turno de caja abierto.</p>
          )}
        </div>

        {miTurno && (
          <button
            className="caja-btn-danger"
            onClick={() => solicitarCierre(miTurno)}
          >
            <LockKeyhole size={17} />
            Cerrar mi turno
          </button>
        )}
      </section>

      <AdministracionCajas
        cajas={cajas}
        turnos={turnos}
        onActualizar={cargarDatos}
      />

      {/* NUEVO: APERTURA SUPERVISADA DE CAJAS */}
      <AperturaSupervisada
        cajas={cajas}
        onActualizar={cargarDatos}
      />

      <section className="caja-toolbar">
        <div className="caja-busqueda">
          <Search size={18} />

          <input
            placeholder="Buscar por caja, sucursal, usuario o turno..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="Todos">Todos los estados</option>
          <option value="Abierto">Abiertos</option>
          <option value="Cerrado">Cerrados</option>
        </select>
      </section>

      <section className="caja-panel">
        <div className="caja-panel-header">
          <h3>Historial de turnos</h3>
          <small>{turnosFiltrados.length} registros</small>
        </div>

        <div className="caja-tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Turno</th>
                <th>Caja / Sucursal</th>
                <th>Usuario</th>
                <th>Apertura</th>
                <th>Cierre</th>
                <th>Fondo inicial</th>
                <th>Diferencia</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {turnosFiltrados.map((turno) => (
                <tr key={turno.id_turno}>
                  <td>#{turno.id_turno}</td>

                  <td>
                    <strong>{turno.nombre_caja}</strong>
                    <small>{turno.nombre_sucursal}</small>
                  </td>

                  <td>{turno.nombre_usuario || turno.usuario}</td>

                  <td>{fecha(turno.fecha_apertura)}</td>
                  <td>{fecha(turno.fecha_cierre)}</td>

                  <td>{dinero(turno.monto_apertura)}</td>

                  <td>
                    {turno.estado === 'Cerrado'
                      ? dinero(turno.diferencia)
                      : 'Pendiente'}
                  </td>

                  <td>
                    <span
                      className={`caja-estado ${turno.estado.toLowerCase()}`}
                    >
                      {turno.estado}
                    </span>
                  </td>

                  <td>
                    <div className="caja-acciones-tabla">
                      <button
                        title="Consultar turno"
                        onClick={() => consultarDetalle(turno.id_turno)}
                      >
                        <Eye size={16} />
                      </button>

                      {turno.estado === 'Abierto' &&
                        Number(turno.id_usuario) ===
                          Number(usuario?.id_usuario) && (
                          <button
                            title="Cerrar turno"
                            onClick={() => solicitarCierre(turno)}
                          >
                            <LockKeyhole size={16} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}

              {!cargando && turnosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="9" className="caja-sin-datos">
                    No se encontraron turnos.
                  </td>
                </tr>
              )}

              {cargando && (
                <tr>
                  <td colSpan="9" className="caja-sin-datos">
                    Cargando turnos...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalApertura && (
        <div className="caja-modal-fondo">
          <div className="caja-modal">
            <div className="caja-modal-header">
              <h2>Apertura de turno</h2>
              <button onClick={() => setModalApertura(false)}>×</button>
            </div>

            <form onSubmit={registrarApertura} className="caja-form">
              <label>
                Caja
                <select
                  name="id_caja"
                  value={formApertura.id_caja}
                  onChange={(e) =>
                    setFormApertura({
                      ...formApertura,
                      id_caja: e.target.value
                    })
                  }
                >
                  <option value="">Seleccione caja</option>

                  {cajas
                    .filter((caja) => caja.estado === 'Activa')
                    .map((caja) => (
                      <option
                        key={caja.id_caja}
                        value={caja.id_caja}
                      >
                        {caja.nombre_caja} - {caja.nombre_sucursal}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Monto de apertura (Q)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formApertura.monto_apertura}
                  onChange={(e) =>
                    setFormApertura({
                      ...formApertura,
                      monto_apertura: e.target.value
                    })
                  }
                  placeholder="500.00"
                />
              </label>

              <label>
                Observaciones
                <textarea
                  value={formApertura.observaciones}
                  onChange={(e) =>
                    setFormApertura({
                      ...formApertura,
                      observaciones: e.target.value
                    })
                  }
                  placeholder="Observaciones de apertura"
                />
              </label>

              <div className="caja-modal-acciones">
                <button
                  type="button"
                  onClick={() => setModalApertura(false)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="caja-btn-primary"
                  disabled={procesando}
                >
                  {procesando ? 'Abriendo...' : 'Abrir turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalCierre && (
        <div className="caja-modal-fondo">
          <div className="caja-modal">
            <div className="caja-modal-header">
              <h2>Cierre de turno #{modalCierre.id_turno}</h2>
              <button onClick={() => setModalCierre(null)}>×</button>
            </div>

            <form onSubmit={registrarCierre} className="caja-form">
              <div className="caja-info-turno">
                <p><strong>Caja:</strong> {modalCierre.nombre_caja}</p>
                <p>
                  <strong>Fondo inicial:</strong>{' '}
                  {dinero(modalCierre.monto_apertura)}
                </p>
              </div>

              <label>
                Efectivo físico contado (Q)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCierre.monto_cierre_fisico}
                  onChange={(e) =>
                    setFormCierre({
                      ...formCierre,
                      monto_cierre_fisico: e.target.value
                    })
                  }
                  placeholder="Monto contado físicamente"
                />
              </label>

              <label>
                Observaciones del cierre
                <textarea
                  value={formCierre.observaciones}
                  onChange={(e) =>
                    setFormCierre({
                      ...formCierre,
                      observaciones: e.target.value
                    })
                  }
                  placeholder="Explicación de diferencias, si existen"
                />
              </label>

              <p className="caja-advertencia">
                El sistema calculará la diferencia al cerrar el turno.
                Verifica el efectivo físico antes de confirmar.
              </p>

              <div className="caja-modal-acciones">
                <button
                  type="button"
                  onClick={() => setModalCierre(null)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="caja-btn-danger"
                  disabled={procesando}
                >
                  {procesando ? 'Cerrando...' : 'Confirmar cierre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalDetalle && (
        <div className="caja-modal-fondo">
          <div className="caja-modal">
            <div className="caja-modal-header">
              <h2>Detalle de turno #{modalDetalle.id_turno}</h2>
              <button onClick={() => setModalDetalle(null)}>×</button>
            </div>

            <div className="caja-detalle">
              <p><strong>Caja:</strong> {modalDetalle.nombre_caja}</p>
              <p><strong>Usuario:</strong> {modalDetalle.nombre_usuario}</p>
              <p><strong>Estado:</strong> {modalDetalle.estado}</p>
              <p>
                <strong>Apertura:</strong> {fecha(modalDetalle.fecha_apertura)}
              </p>
              <p>
                <strong>Cierre:</strong> {fecha(modalDetalle.fecha_cierre)}
              </p>
              <p>
                <strong>Fondo inicial:</strong>{' '}
                {dinero(modalDetalle.monto_apertura)}
              </p>

              {modalDetalle.estado === 'Cerrado' && (
                <>
                  <p>
                    <strong>Monto sistema:</strong>{' '}
                    {dinero(modalDetalle.monto_cierre_sistema)}
                  </p>
                  <p>
                    <strong>Monto físico:</strong>{' '}
                    {dinero(modalDetalle.monto_cierre_fisico)}
                  </p>
                  <p>
                    <strong>Diferencia:</strong>{' '}
                    {dinero(modalDetalle.diferencia)}
                  </p>
                </>
              )}

              <p>
                <strong>Observaciones:</strong>{' '}
                {modalDetalle.observaciones || 'Sin observaciones'}
              </p>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default CajaTurnos;
