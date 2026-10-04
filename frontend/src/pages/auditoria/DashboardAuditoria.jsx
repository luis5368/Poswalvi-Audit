import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
  obtenerResumenAuditoria,
  ejecutarMotorAuditoria
} from '../../services/auditoriaService';

const DashboardAuditoria = () => {
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ejecutando, setEjecutando] = useState(false);

  const cargarResumen = async () => {
    try {
      setCargando(true);

      const data = await obtenerResumenAuditoria();

      if (data.ok) {
        setResumen(data.resumen);
      }
    } catch (error) {
      console.error(error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el resumen de auditoría'
      });
    } finally {
      setCargando(false);
    }
  };

  const ejecutarMotor = async () => {
    try {
      setEjecutando(true);

      const resultado = await ejecutarMotorAuditoria();

      await Swal.fire({
        icon: 'success',
        title: 'Motor ejecutado',
        html: `
          <p><b>Reglas ejecutadas:</b> ${resultado.total_reglas_ejecutadas}</p>
          <p><b>Hallazgos generados:</b> ${resultado.total_hallazgos_generados}</p>
        `
      });

      cargarResumen();
    } catch (error) {
      console.error(error);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo ejecutar el motor de auditoría'
      });
    } finally {
      setEjecutando(false);
    }
  };

  useEffect(() => {
    cargarResumen();
  }, []);

  if (cargando) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Cargando dashboard de auditoría...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Dashboard de Auditoría Continua
          </h1>
          <p className="text-gray-600">
            Resumen de hallazgos generados por el motor de auditoría POSWALVI.
          </p>
        </div>

        <button
          onClick={ejecutarMotor}
          disabled={ejecutando}
          className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {ejecutando ? 'Ejecutando...' : 'Ejecutar motor'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow">
          <p className="text-gray-500">Total de hallazgos</p>
          <h2 className="text-4xl font-bold text-gray-800">
            {resumen?.total_hallazgos || 0}
          </h2>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <p className="text-gray-500">Estados registrados</p>
          <h2 className="text-4xl font-bold text-gray-800">
            {resumen?.por_estado?.length || 0}
          </h2>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <p className="text-gray-500">Reglas con hallazgos</p>
          <h2 className="text-4xl font-bold text-gray-800">
            {resumen?.por_regla?.length || 0}
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-5 rounded-xl shadow">
          <h3 className="text-xl font-bold mb-4">Hallazgos por estado</h3>

          {resumen?.por_estado?.map((item) => (
            <div
              key={item.estado}
              className="flex justify-between border-b py-2"
            >
              <span>{item.estado}</span>
              <strong>{item.total}</strong>
            </div>
          ))}
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <h3 className="text-xl font-bold mb-4">Hallazgos por riesgo</h3>

          {resumen?.por_riesgo?.map((item) => (
            <div
              key={item.nivel_riesgo}
              className="flex justify-between border-b py-2"
            >
              <span>{item.nivel_riesgo}</span>
              <strong>{item.total}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow mb-6">
        <h3 className="text-xl font-bold mb-4">Hallazgos por regla</h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-3">Regla</th>
                <th className="p-3">Módulo</th>
                <th className="p-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen?.por_regla?.map((item) => (
                <tr key={`${item.codigo_regla}-${item.modulo_origen}`} className="border-b">
                  <td className="p-3">
                    <div className="font-semibold">{item.codigo_regla}</div>
                    <div className="text-sm text-gray-500">
                      {item.nombre_regla}
                    </div>
                  </td>
                  <td className="p-3">{item.modulo_origen}</td>
                  <td className="p-3 font-bold">{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl shadow">
        <h3 className="text-xl font-bold mb-4">Últimos hallazgos</h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-3">ID</th>
                <th className="p-3">Irregularidad</th>
                <th className="p-3">Módulo</th>
                <th className="p-3">Riesgo</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Tiempo detección</th>
              </tr>
            </thead>
            <tbody>
              {resumen?.ultimos_hallazgos?.map((hallazgo) => (
                <tr key={hallazgo.id_hallazgo} className="border-b">
                  <td className="p-3">{hallazgo.id_hallazgo}</td>
                  <td className="p-3">{hallazgo.tipo_irregularidad}</td>
                  <td className="p-3">{hallazgo.modulo_origen}</td>
                  <td className="p-3">{hallazgo.nivel_riesgo}</td>
                  <td className="p-3">{hallazgo.estado}</td>
                  <td className="p-3">
                    {hallazgo.tiempo_deteccion_minutos} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardAuditoria;