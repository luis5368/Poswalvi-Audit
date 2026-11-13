const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');

// Adaptador transaccional en memoria. El mutex modela el bloqueo del saldo,
// pero NO verifica aislamiento, planes SQL ni interbloqueos de MySQL/InnoDB.
async function escenario(t, { stock = 10, falloMovimiento = false,
  sinSaldo = false, controlaInventario = 1, precioBD = '10.00' } = {}) {
  const estado = { stock, detalles: [], movimientos: [], ventas: [], pagos: [], correlativo: 0 };
  const eventos = { commit: 0, rollback: 0, release: 0, bloqueos: 0, esperas: 0, errores: [] };
  let cola = Promise.resolve();
  let ocupado = false;
  let siguienteId = 0;
  const pool = { async getConnection() {
    let desbloquear;
    const pendiente = { detalles: [], movimientos: [], ventas: [], pagos: [] };
    let saldo;
    let correlativo;
    function liberarBloqueo() {
      if (desbloquear) { ocupado = false; desbloquear(); desbloquear = undefined; }
    }
    return {
      async beginTransaction() {},
      async commit() {
        if (saldo !== undefined) estado.stock = saldo;
        for (const campo of ['detalles', 'movimientos', 'ventas', 'pagos']) estado[campo].push(...pendiente[campo]);
        if (correlativo !== undefined) estado.correlativo = correlativo;
        eventos.commit++;
        liberarBloqueo();
      },
      async rollback() { eventos.rollback++; liberarBloqueo(); },
      release() { eventos.release++; },
      async query(sql, params = []) {
        const q = sql.replace(/\s+/g, ' ').trim();
        if (/FROM clientes/.test(q)) return [[{ id_cliente: 1, estado: 'Activo' }]];
        if (/FROM turnos_caja/.test(q)) return [[{ id_turno: params[0], id_caja: params[0],
          id_sucursal: 1, estado_caja: 'Activa', estado_sucursal: 'Activa' }]];
        if (/FROM bodegas/.test(q)) return [[{ id_bodega: 1 }]];
        if (/FROM documento_correlativos/.test(q)) return [[{ id_correlativo: 1, serie: 'TEST', correlativo_actual: estado.correlativo }]];
        if (/FROM productos/.test(q)) return [[{ id_producto: Number(params[0]), nombre_producto: 'Sintetico',
          precio_venta: precioBD, precio_costo: '5.00', controla_inventario: controlaInventario, estado: 'Activo' }]];
        if (/FROM inventario_saldos/.test(q)) {
          assert.match(q, /FOR UPDATE$/);
          eventos.bloqueos++;
          if (ocupado) eventos.esperas++;
          ocupado = true;
          const anterior = cola;
          cola = new Promise(resolve => { desbloquear = resolve; });
          await anterior;
          // Permite que otra petición llegue mientras este saldo está bloqueado.
          await new Promise(resolve => setTimeout(resolve, 20));
          return [sinSaldo ? [] : [{ id_saldo: 1, stock_actual: estado.stock }]];
        }
        if (/FROM empresa_configuracion/.test(q)) return [[{ porcentaje_iva: 12 }]];
        if (/FROM metodos_pago/.test(q)) return [[{ id_metodo_pago: 1, nombre_metodo: 'Efectivo', estado: 'Activo', requiere_referencia: 0 }]];
        if (/^INSERT INTO ventas /.test(q)) {
          pendiente.ventas.push([...params]);
          return [{ insertId: ++siguienteId }];
        }
        if (/^INSERT INTO venta_detalle/.test(q)) { pendiente.detalles.push([...params]); return [{ affectedRows: 1 }]; }
        if (/^UPDATE inventario_saldos/.test(q)) { saldo = params[0]; return [{ affectedRows: 1 }]; }
        if (/^INSERT INTO inventario_movimientos/.test(q)) {
          if (falloMovimiento) throw new Error('Fallo de inventario simulado');
          pendiente.movimientos.push([...params]); return [{ affectedRows: 1 }];
        }
        if (/^INSERT INTO venta_pagos/.test(q)) { pendiente.pagos.push([...params]); return [{ affectedRows: 1 }]; }
        if (/^UPDATE documento_correlativos/.test(q)) { correlativo = params[0]; return [{ affectedRows: 1 }]; }
        throw new Error(`Consulta inesperada: ${q}`);
      }
    };
  } };
  const modulo = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/controllers/ventasController.js'), 'utf8'), {
    module: modulo,
    require(nombre) {
      if (nombre === '../config/db') return pool;
      if (nombre === '../utils/alcanceCaja') return () => { throw new Error('Alcance ajeno a crearVenta'); };
      throw new Error(`Dependencia inesperada: ${nombre}`);
    },
    console: { error(...args) { eventos.errores.push(args); } }
  });
  const app = express();
  app.use(express.json());
  // Identidad sintética ya autenticada; JWT y permisos no se cambian ni prueban aquí.
  app.post('/api/ventas', (req, res, next) => {
    req.usuario = { id_usuario: Number(req.headers['x-test-user'] || 10) }; next();
  }, (req, res, next) => Promise.resolve(modulo.exports.crearVenta(req, res)).catch(next));
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  t.after(() => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())));
  async function vender(productos, { descuento = 0, pago, usuario = 10 } = {}) {
    // Precio esperado proviene del catálogo sintético, nunca del precio de la petición.
    const subtotal = productos.reduce((s, p) => s + Number(precioBD) * p.cantidad - Number(p.descuento || 0), 0);
    const total = Math.round((subtotal - Number(descuento)) * 1.12 * 100) / 100;
    const respuesta = await fetch(`http://127.0.0.1:${server.address().port}/api/ventas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-user': String(usuario) },
      body: JSON.stringify({ id_cliente: 1, productos, descuento,
        pagos: [{ id_metodo_pago: 1, monto: pago ?? total }] })
    });
    return { status: respuesta.status, body: await respuesta.json() };
  }
  return { estado, eventos, vender };
}

const linea = (cantidad, extra = {}) => ({ id_producto: 1, cantidad, precio_unitario: 10, ...extra });
function sinCambios(e, stock = 10) {
  assert.equal(e.estado.stock, stock);
  for (const campo of ['detalles', 'movimientos', 'ventas', 'pagos']) assert.equal(e.estado[campo].length, 0);
  assert.equal(e.estado.correlativo, 0);
  assert.equal(e.eventos.commit, 0);
  assert.equal(e.eventos.rollback, 1);
  assert.equal(e.eventos.release, 1);
}

test('HTTP: producto unico, stock suficiente y precio legitimo', async t => {
  const e = await escenario(t);
  const r = await e.vender([linea(3)]);
  assert.equal(r.status, 201);
  assert.equal(e.estado.stock, 7);
  assert.equal(r.body.venta.total, 33.6);
  assert.equal(e.estado.detalles[0][3], 10);
  assert.equal(e.eventos.commit, 1);
});

test('HTTP: repetidos conservan lineas, descuentos y movimientos encadenados', async t => {
  const e = await escenario(t);
  const r = await e.vender([linea(3, { descuento: 1 }), linea(4, { id_producto: '01', descuento: 2 })]);
  assert.equal(r.status, 201);
  assert.equal(e.estado.stock, 3);
  assert.equal(e.eventos.bloqueos, 1);
  assert.deepEqual(e.estado.detalles.map(d => [d[2], d[5], d[6]]), [[3, 1, 29], [4, 2, 38]]);
  assert.deepEqual(e.estado.movimientos.map(m => [m[6], m[7], m[8]]), [[3, 10, 7], [4, 7, 3]]);
  assert.equal(r.body.venta.subtotal, 67);
});

test('HTTP: repetidos insuficientes se rechazan sin modificaciones', async t => {
  const e = await escenario(t);
  assert.equal((await e.vender([linea(6), linea(6)])).status, 409);
  sinCambios(e);
});

test('HTTP: repetidos consumen exactamente el stock disponible', async t => {
  const e = await escenario(t);
  assert.equal((await e.vender([linea(4), linea(6)])).status, 201);
  assert.equal(e.estado.stock, 0);
});

test('HTTP: dos cajeros simultaneos sobre el mismo saldo, mutex simulado', async t => {
  const e = await escenario(t);
  const resultados = await Promise.all([
    e.vender([linea(3), linea(3)], { usuario: 10 }),
    e.vender([linea(6)], { usuario: 20 })
  ]);
  assert.deepEqual(resultados.map(r => r.status).sort(), [201, 409]);
  assert.equal(e.estado.stock, 4);
  assert.equal(e.eventos.commit, 1);
  assert.equal(e.eventos.rollback, 1);
  assert.equal(e.eventos.release, 2);
  assert.equal(e.eventos.bloqueos, 2);
  assert.ok(e.eventos.esperas > 0);
  assert.equal(e.estado.movimientos.reduce((s, m) => s + m[6], 0), 6);
});

test('HTTP: dos ventas simultaneas suficientes no pierden descuentos de stock', async t => {
  const e = await escenario(t);
  const resultados = await Promise.all([
    e.vender([linea(2)], { usuario: 10 }),
    e.vender([linea(3)], { usuario: 20 })
  ]);
  assert.deepEqual(resultados.map(r => r.status), [201, 201]);
  assert.equal(e.estado.stock, 5);
  assert.equal(e.eventos.commit, 2);
  assert.deepEqual(e.estado.movimientos.map(m => [m[7], m[8]]), [[10, 8], [8, 5]]);
});

for (const precio of [0.01, 9, 11, -1, 'NaN', 'Infinity', 10.001, null]) {
  test(`HTTP: precio manipulado ${precio} rechazado`, async t => {
    const e = await escenario(t);
    assert.equal((await e.vender([linea(1, { precio_unitario: precio })])).status, 400);
    sinCambios(e);
  });
}

test('HTTP: precio omitido usa catalogo; precio legitimo como string es compatible', async t => {
  const e = await escenario(t);
  const r = await e.vender([linea(1, { precio_unitario: undefined }), linea(1, { precio_unitario: '10.00' })]);
  assert.equal(r.status, 201);
  assert.deepEqual(e.estado.detalles.map(d => d[3]), [10, 10]);
});

test('HTTP: descuentos validos de linea y generales conservan IVA', async t => {
  const e = await escenario(t);
  const r = await e.vender([linea(2, { descuento: 2 })], { descuento: 3 });
  assert.equal(r.status, 201);
  assert.equal(r.body.venta.subtotal, 18);
  assert.equal(r.body.venta.descuento, 3);
  assert.equal(r.body.venta.impuesto, 1.8);
  assert.equal(r.body.venta.total, 16.8);
});

for (const tipo of ['linea', 'general']) {
  for (const descuento of [-1, 21, 'NaN', 'Infinity']) {
    test(`HTTP: descuento ${tipo} invalido ${descuento} sin cambios parciales`, async t => {
      const e = await escenario(t);
      const productos = [linea(2, tipo === 'linea' ? { descuento } : {})];
      assert.equal((await e.vender(productos, tipo === 'general' ? { descuento } : {})).status, 400);
      sinCambios(e);
    });
  }
}

test('HTTP: pago inconsistente revierte venta', async t => {
  const e = await escenario(t);
  assert.equal((await e.vender([linea(2)], { pago: 1 })).status, 400);
  sinCambios(e);
});

test('HTTP: fallo de inventario tras escrituras revierte y registra error', async t => {
  const e = await escenario(t, { falloMovimiento: true });
  assert.equal((await e.vender([linea(2)])).status, 500);
  sinCambios(e);
  assert.equal(e.eventos.errores.length, 1);
  assert.match(e.eventos.errores[0][1].message, /Fallo de inventario simulado/);
});

test('HTTP: saldo inexistente no se oculta', async t => {
  const e = await escenario(t, { sinSaldo: true });
  assert.equal((await e.vender([linea(1)])).status, 400);
  sinCambios(e);
});

test('HTTP: saldo invalido se rechaza explicitamente', async t => {
  const e = await escenario(t, { stock: 'invalido' });
  const r = await e.vender([linea(1)]);
  assert.equal(r.status, 409);
  assert.match(r.body.mensaje, /inventario/);
  sinCambios(e, 'invalido');
});

test('HTTP: precio invalido en catalogo no se sustituye por el del cliente', async t => {
  const e = await escenario(t, { precioBD: 'invalido' });
  assert.equal((await e.vender([linea(1)])).status, 400);
  sinCambios(e);
});

test('HTTP: producto sin control de inventario conserva detalle sin movimientos', async t => {
  const e = await escenario(t, { controlaInventario: 0 });
  assert.equal((await e.vender([linea(6), linea(6)])).status, 201);
  assert.equal(e.estado.stock, 10);
  assert.equal(e.estado.detalles.length, 2);
  assert.equal(e.estado.movimientos.length, 0);
  assert.equal(e.eventos.bloqueos, 0);
});
