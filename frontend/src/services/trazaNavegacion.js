// Activación temporal en desarrollo: window.__POSWALVI_DIAGNOSTICO__ = true.
// Solo rutas conocidas: nunca query strings, IDs, cuerpos, tokens ni datos personales.
const rutas = new Set(['/login','/cambiar-password','/dashboard','/auditoria','/usuarios','/clientes','/proveedores','/productos','/inventario','/ventas','/compras','/caja','/reportes','/configuracion']);
export function rutaSegura(ruta) { return rutas.has(ruta) ? ruta : '[otra ruta]'; }
export function trazaNavegacion(evento, {anterior, nueva, http, solicitud, autenticado} = {}) {
  if (!import.meta.env.DEV || !window.__POSWALVI_DIAGNOSTICO__) return;
  console.debug('[POSWALVI navegación]', {
    hora: new Date().toISOString(), evento,
    anterior: rutaSegura(anterior || window.location.pathname),
    nueva: rutaSegura(nueva || window.location.pathname),
    http, solicitud: solicitud === '/auth/permisos' ? solicitud : solicitud ? '[recurso API]' : undefined,
    autenticado: autenticado === undefined ? Boolean(localStorage.getItem('poswalvi_token')) : Boolean(autenticado)
  });
}
