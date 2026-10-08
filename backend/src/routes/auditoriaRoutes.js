const express = require('express');
const router = express.Router();

const verificarToken = require('../middlewares/authMiddleware');
const verificarPermiso = require('../middlewares/permisoMiddleware');

const {
  obtenerReglasAuditoria,
  obtenerHallazgos,
  ejecutarReglaVentaBajoCosto,
  obtenerEvidenciasPorHallazgo,
  actualizarEstadoHallazgo,
  obtenerDetalleHallazgo,
  ejecutarReglaStockNegativo,
  ejecutarReglaAjusteSinMotivo,
  ejecutarReglaCompraDuplicada,
  ejecutarReglaPrecioProveedorAnormal,
  ejecutarReglaAnulacionesFrecuentes,
  ejecutarReglaMovimientoFueraHorario,
  ejecutarReglaDiferenciaCaja,
  ejecutarMotorCompleto,
  obtenerResumenDashboard
} = require('../controllers/auditoriaController');

router.get(
  '/reglas',
  verificarToken,
  verificarPermiso('Auditoria', 'Consultar'),
  obtenerReglasAuditoria
);

router.get(
  '/hallazgos',
  verificarToken,
  verificarPermiso('Auditoria', 'Consultar'),
  obtenerHallazgos
);

router.get(
  '/hallazgos/:id/detalle',
  verificarToken,
  verificarPermiso('Auditoria', 'Consultar'),
  obtenerDetalleHallazgo
);

router.get(
  '/hallazgos/:id/evidencias',
  verificarToken,
  verificarPermiso('Auditoria', 'Consultar'),
  obtenerEvidenciasPorHallazgo
);

router.patch(
  '/hallazgos/:id/estado',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  actualizarEstadoHallazgo
);

router.post(
  '/ejecutar/venta-bajo-costo',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaVentaBajoCosto
);

router.post(
  '/ejecutar/stock-negativo',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaStockNegativo
);

router.post(
  '/ejecutar/ajuste-sin-motivo',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaAjusteSinMotivo
);

router.post(
  '/ejecutar/compra-duplicada',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaCompraDuplicada
);

router.post(
  '/ejecutar/precio-proveedor-anormal',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaPrecioProveedorAnormal
);

router.post(
  '/ejecutar/anulaciones-frecuentes',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaAnulacionesFrecuentes
);

router.post(
  '/ejecutar/movimiento-fuera-horario',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaMovimientoFueraHorario
);

router.post(
  '/ejecutar/diferencia-caja',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarReglaDiferenciaCaja
);

router.post(
  '/ejecutar/todas',
  verificarToken,
  verificarPermiso('Auditoria', 'Revisar'),
  ejecutarMotorCompleto
);

router.get(
  '/dashboard/resumen',
  verificarToken,
  verificarPermiso('Auditoria', 'Consultar'),
  obtenerResumenDashboard
);

module.exports = router;