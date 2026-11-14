export const rutasPermisos = Object.freeze({
  '/alertas-seguridad':['AlertasSeguridad:Consultar'],
  '/dashboard':['Reportes:Consultar'], '/ventas':['Ventas:Consultar'], '/compras':['Compras:Consultar'],
  '/inventario':['InventarioSaldos:Consultar'], '/productos':['Productos:Consultar'], '/clientes':['Clientes:Consultar'],
  '/proveedores':['Proveedores:Consultar'], '/usuarios':['Usuarios:Consultar'], '/auditoria':['Auditoria:Consultar'],
  '/reportes':['Reportes:Consultar'], '/configuracion':['ConfiguracionEmpresa:Consultar'],
  '/caja':['Cajas:Consultar','TurnosCaja:Consultar','TurnosCaja:Aperturar','TurnosCaja:Cerrar','Cajas:Crear']
});
export const rutaPermitida=(ruta,permisos)=>Boolean(rutasPermisos[ruta]?.some(p=>permisos.includes(p)));
export function validarPermisos(data){if(data?.ok!==true||data.version!==1||!Array.isArray(data.permisos)||data.permisos.some(p=>typeof p!=='string'||!/^\w+:\w+$/.test(p)))throw Error('Contrato de permisos invalido');return [...new Set(data.permisos)];}
