const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Carga controladores, rutas, alcance y permisos reales con dependencias aisladas.
// Nunca carga config/db ni dotenv, ni abre conexiones o puertos.
function escenario({ rol = 'Cajero', sucursal = 1, activo = true, permiso = true,
  estadoTurno = 'Abierto', estadoVenta = 'Registrada', autenticado = true } = {}) {
  const ventas = [
    { id_venta: 101, id_usuario: 10, id_sucursal: 1, id_caja: 1, id_turno: 11 },
    { id_venta: 102, id_usuario: 20, id_sucursal: 1, id_caja: 2, id_turno: 12 },
    { id_venta: 103, id_usuario: 30, id_sucursal: 2, id_caja: 3, id_turno: 13 },
    { id_venta: 104, id_usuario: 10, id_sucursal: 2, id_caja: 4, id_turno: 14 }
  ].map(v => ({ ...v, numero_documento: `PRUEBA-${v.id_venta}`,
    estado: estadoVenta, estado_turno: estadoTurno }));
  const consultas = [];
  const tx = { inicio: 0, commit: 0, rollback: 0, release: 0 };
  async function query(sql, params = []) {
    const normal = sql.replace(/\s+/g, ' ').trim();
    consultas.push({ sql: normal, params: [...params] });
    if (/FROM rol_permiso/.test(normal)) return [permiso ? [{ id_permiso: 1 }] : []];
    if (/FROM usuarios/.test(normal)) {
      assert.deepEqual([...params], [10]);
      return [[{ id_usuario: 10, id_sucursal: sucursal, estado: activo ? 'Activo' : 'Inactivo' }]];
    }
    if (/FROM ventas v/.test(normal)) {
      // Evalúa las restricciones efectivamente enviadas al adaptador SQL.
      let i = 0;
      const condiciones = [...normal.matchAll(/\bv\.(id_venta|id_usuario|id_sucursal|id_caja|id_turno) = \?/g)]
        .map(m => [m[1], params[i++]]);
      return [ventas.filter(v => condiciones.every(([campo, valor]) => v[campo] === Number(valor)))];
    }
    if (/FROM venta_detalle/.test(normal)) return [[{ id_producto: 1, cantidad: 1, controla_inventario: 0 }]];
    if (/FROM venta_pagos/.test(normal)) return [[{ id_venta_pago: 1, monto: 5 }]];
    if (/FROM bodegas/.test(normal)) return [[{ id_bodega: 1 }]];
    if (/^(UPDATE ventas|INSERT INTO auditoria_logs_sistema)/.test(normal)) return [{ affectedRows: 1 }];
    throw new Error(`SQL inesperado: ${normal}`);
  }
  const connection = { query,
    async beginTransaction() { tx.inicio++; },
    async commit() { tx.commit++; },
    async rollback() { tx.rollback++; },
    release() { tx.release++; }
  };
  const pool = { query, async getConnection() { return connection; } };
  const rutas = [];
  const router = Object.fromEntries(['get', 'post', 'patch'].map(method => [method,
    (ruta, ...handlers) => rutas.push({ method, ruta, handlers })]));
  const cache = new Map();
  function cargar(archivo) {
    if (cache.has(archivo)) return cache.get(archivo).exports;
    const modulo = { exports: {} };
    cache.set(archivo, modulo);
    const requireAislado = nombre => {
      if (nombre === 'express') return { Router: () => router };
      const destino = path.resolve(path.dirname(archivo), `${nombre}.js`);
      if (destino.endsWith(path.join('config', 'db.js'))) return pool;
      if (destino.endsWith(path.join('middlewares', 'authMiddleware.js'))) {
        // Precondición del controlador: identidad ya validada por authMiddleware.
        return (req, res, next) => autenticado
          ? next() : res.status(401).json({ ok: false });
      }
      assert.ok(nombre.startsWith('.'), `Dependencia inesperada: ${nombre}`);
      return cargar(destino);
    };
    vm.runInNewContext(fs.readFileSync(archivo, 'utf8'), {
      require: requireAislado, module: modulo, exports: modulo.exports, console
    }, { filename: archivo });
    return modulo.exports;
  }
  cargar(path.resolve(__dirname, '../src/routes/ventasRoutes.js'));
  async function ejecutar(method, ruta, { id = 101, query = {}, body = {} } = {}) {
    const req = { usuario: { id_usuario: 10, id_rol: 7, rol },
      params: { id: String(id) }, query,
      body: { motivo_anulacion: 'Prueba sintetica', ...body }, headers: {}, ip: '127.0.0.1' };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; } };
    const { handlers } = rutas.find(r => r.method === method && r.ruta === ruta);
    async function avanzar(i) {
      let siguiente = false;
      await handlers[i](req, res, () => { siguiente = true; });
      if (siguiente) await avanzar(i + 1);
    }
    await avanzar(0);
    return res;
  }
  return { ejecutar, consultas, tx };
}

const ids = res => Array.from(res.body.ventas, v => v.id_venta);
const hayEscriturasVenta = e => e.consultas.some(c => /^UPDATE ventas/.test(c.sql));

for (const [rol, visibles] of [
  ['Cajero', [101, 104]], ['Auditor', [101, 102]],
  ['Consulta tienda', [101, 102]], ['Administrador', [101, 102, 103, 104]],
  ['Superusuario', [101, 102, 103, 104]]
]) {
  test(`${rol}: listado dentro de su alcance`, async () => {
    const e = escenario({ rol });
    const res = await e.ejecutar('get', '/');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(ids(res), visibles);
  });
  test(`${rol}: detalle permitido conserva detalle y pagos`, async () => {
    const res = await escenario({ rol }).ejecutar('get', '/:id');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.venta.id_venta, 101);
    assert.equal(res.body.detalle.length, 1);
    assert.equal(res.body.pagos.length, 1);
  });
  test(`${rol}: anulacion permitida conserva commit y bloqueo`, async () => {
    const e = escenario({ rol });
    const res = await e.ejecutar('patch', '/:id/anular');
    assert.equal(res.statusCode, 200);
    assert.equal(e.tx.commit, 1);
    assert.equal(e.tx.rollback, 0);
    assert.equal(e.tx.release, 1);
    assert.ok(hayEscriturasVenta(e));
    assert.ok(e.consultas.some(c => /FROM ventas v.*FOR UPDATE/.test(c.sql)));
    const update = e.consultas.find(c => /^UPDATE ventas/.test(c.sql));
    assert.equal(update.params[1], 10);
  });
}

for (const [rol, id] of [['Cajero', 102], ['Cajero', 103], ['Auditor', 103], ['Consulta tienda', 103]]) {
  for (const [method, ruta] of [['get', '/:id'], ['patch', '/:id/anular']]) {
    test(`${rol}: ${method} ${ruta} rechaza venta ${id} sin detalles ni escrituras`, async () => {
      const e = escenario({ rol });
      const res = await e.ejecutar(method, ruta, { id,
        query: { id_usuario: 20, id_sucursal: 2 }, body: { id_usuario: 20, id_sucursal: 2 } });
      assert.equal(res.statusCode, 404);
      assert.equal(res.body.venta, undefined);
      assert.ok(!e.consultas.some(c => /FROM (venta_detalle|venta_pagos|bodegas)/.test(c.sql)));
      assert.ok(!hayEscriturasVenta(e));
      assert.equal(e.tx.commit, 0);
      if (method === 'patch') {
        assert.equal(e.tx.rollback, 1);
        assert.equal(e.tx.release, 1);
      }
    });
  }
}

for (const rol of ['Administrador', 'Superusuario']) {
  for (const [method, ruta] of [['get', '/:id'], ['patch', '/:id/anular']]) {
    test(`${rol}: conserva acceso a otra sucursal en ${ruta}`, async () => {
      const res = await escenario({ rol, sucursal: null }).ejecutar(method, ruta, { id: 103 });
      assert.equal(res.statusCode, 200);
    });
  }
}

for (const [rol, query, esperado] of [
  ['Cajero', { id_usuario: 20 }, [101, 104]],
  ['Cajero', { id_sucursal: 1 }, [101]],
  ['Cajero', { id_caja: 2 }, []],
  ['Cajero', { id_turno: 12 }, []],
  ['Auditor', { id_sucursal: 2 }, []],
  ['Administrador', { id_sucursal: 2 }, [103, 104]]
]) {
  test(`${rol}: filtros ${JSON.stringify(query)} no amplian alcance`, async () => {
    const res = await escenario({ rol }).ejecutar('get', '/', { query });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(ids(res), esperado);
  });
}

for (const [method, ruta, accion] of [
  ['get', '/', 'Consultar'], ['get', '/:id', 'Consultar'], ['patch', '/:id/anular', 'Anular']
]) {
  for (const rol of ['Cajero', 'Administrador', 'Superusuario']) {
    test(`${rol}: sin Ventas:${accion} no accede a ${ruta}`, async () => {
      const e = escenario({ rol, permiso: false });
      const res = await e.ejecutar(method, ruta);
      assert.equal(res.statusCode, 403);
      assert.deepEqual(e.consultas[0].params, [7, 'Ventas', accion]);
      assert.ok(!e.consultas.some(c => /FROM ventas v/.test(c.sql)));
      assert.equal(e.tx.inicio, 0);
    });
  }
  for (const opciones of [{ rol: 'Auditor', sucursal: null }, { activo: false }]) {
    test(`${ruta}: alcance invalido ${JSON.stringify(opciones)} falla cerrado`, async () => {
      const e = escenario(opciones);
      const res = await e.ejecutar(method, ruta);
      assert.equal(res.statusCode, 403);
      assert.ok(!e.consultas.some(c => /FROM ventas v/.test(c.sql)));
      assert.equal(e.tx.commit, 0);
      if (method === 'patch') assert.equal(e.tx.release, 1);
    });
  }
  test(`${ruta}: venta inexistente o sesion no autenticada`, async () => {
    const e = escenario({ autenticado: false });
    assert.equal((await e.ejecutar(method, ruta)).statusCode, 401);
    assert.equal(e.consultas.length, 0);
    if (ruta !== '/') {
      const inexistente = escenario();
      assert.equal((await inexistente.ejecutar(method, ruta, { id: 999 })).statusCode, 404);
      assert.ok(!hayEscriturasVenta(inexistente));
    }
  });
}

for (const rol of ['Cajero', 'Administrador', 'Superusuario', 'Auditor']) {
  test(`${rol}: turno cerrado sigue impidiendo anulacion`, async () => {
    const e = escenario({ rol, estadoTurno: 'Cerrado' });
    const res = await e.ejecutar('patch', '/:id/anular');
    assert.equal(res.statusCode, 409);
    assert.match(res.body.mensaje, /turno cerrado/);
    assert.ok(!hayEscriturasVenta(e));
    assert.equal(e.tx.rollback, 1);
    assert.equal(e.tx.release, 1);
  });
}

test('Venta ya anulada conserva rechazo 409', async () => {
  const e = escenario({ estadoVenta: 'Anulada' });
  assert.equal((await e.ejecutar('patch', '/:id/anular')).statusCode, 409);
  assert.ok(!hayEscriturasVenta(e));
});
