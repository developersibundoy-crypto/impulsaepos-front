// Componentes React reales en DOM aislado; REST/socket/impresión sustituidos. Sin app ni DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { JSDOM } = require(process.env.JSDOM_TEST_MODULE || 'jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement; global.localStorage = window.localStorage; global.sessionStorage = window.sessionStorage;
global.IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = () => {};
const React = require('react');
const { render, screen, fireEvent, waitFor, cleanup, act } = require('@testing-library/react');
let api, subscriptions = new Map();
const socket = { on(event, fn) { if (!subscriptions.has(event)) subscriptions.set(event, new Set()); subscriptions.get(event).add(fn); },
  off(event, fn) { if (fn) subscriptions.get(event)?.delete(fn); else subscriptions.delete(event); } };
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '../src', relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; cache.set(filename, mod);
  mod.require = id => {
    if (id.endsWith('/api/api')) return { __esModule: true, default: { get: (...a) => api.get(...a), put: (...a) => api.put(...a), post: (...a) => api.post?.(...a) } };
    if (id.endsWith('/utils/socket')) return { socket, joinEmpresaRoom() {} };
    if (id === 'react-to-print') return { useReactToPrint: () => () => {} };
    if (id.endsWith('/components/PrintReceipt')) return { __esModule: true, default: () => null };
    if (id.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), id);
      const file = ['.ts', '.tsx'].map(ext => base + ext).find(f => fs.existsSync(f));
      if (file) return load(path.relative(path.resolve(__dirname, '../src'), file));
    }
    return require(id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
test('R3/R1/R2: Facturas muestra ingresos anulados, fecha Bogotá, anomalías, socket/foco y limpieza', async () => {
  const RealDate = Date;
  global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : ['2026-10-13T00:30:00Z'])); } };
  let requests = [], rows = [1000,500].map((monto,i) => ({ id: 48+i, separado_id: 37, monto, metodo_pago: 'Efectivo',
    fecha_pago: '2026-10-12T20:57:57', cliente_nombre: 'Fixture', separado_estado: 'Anulado', separado_total: 2000,
    neto_abonado: 500, total_devuelto: 1000, pendiente_devolucion: 500, saldo_pendiente: 0,
    estado_medio: 'Inferido por método de ingreso', atribucion: 'Pendiente de atribución', pago_efectivo_crudo: 0,
    pago_transferencia_crudo: 0, pago_efectivo: monto, pago_transferencia: 0 }));
  api = { async get(url) { requests.push(url); return { data: url.startsWith('/separados/historial') ? { abonos: rows, resumen_global: {} } : url === '/empresa' ? {} : [] }; } };
  try {
    render(React.createElement(load('pages/Facturas.tsx').default));
    fireEvent.click(screen.getByRole('button', { name: /Abonos.*Separados/i }));
    await waitFor(() => assert.equal(screen.getAllByText('Pendiente de atribución').length, 2));
    assert.ok(requests.some(url => url.includes('fecha=2026-10-12')));
    const card = screen.getByText('Abonos Consultados').parentElement.parentElement;
    assert.ok(card.textContent.includes(load('utils/format.tsx').formatCOP(1500)));
    assert.ok(screen.getAllByText(/Devolución parcial.*pendiente/).length > 0);
    rows = [...rows, { ...rows[0], id: 47, separado_id: 36, monto: -3500, metodo_pago: 'Devolución Transferencia',
      estado_medio: 'Pendiente de conciliación: medio físico desconocido', pago_efectivo: null, pago_transferencia: null }];
    await act(async () => { subscriptions.get('abono_added').forEach(fn => fn()); });
    await waitFor(() => assert.ok(screen.getByText('Pendiente de conciliación: medio físico desconocido')));
    assert.ok(screen.getByText(/Flujo físico Ef: Desconocido/));
    const before = requests.length;
    await act(async () => window.dispatchEvent(new window.Event('focus')));
    assert.ok(requests.length > before);
    cleanup();
    assert.equal(subscriptions.get('abono_added').size, 0);
  } finally { global.Date = RealDate; cleanup(); }
});
test('R5/R7: UI confirma medio REAL efectivo, rechaza subcentavos y reusa payload tras respuesta perdida', async () => {
  subscriptions = new Map(); sessionStorage.clear();
  localStorage.setItem('adminToken', `x.${Buffer.from(JSON.stringify({ id: 4, empresa_id: 1 })).toString('base64')}.x`);
  const sep = { id: 37, cliente_id: 1, cliente_nombre: 'Fixture', total: 2000, saldo_pendiente: 500, neto_abonado: 1500,
    total_devuelto: 0, estado: 'Pendiente', fecha_creacion: '2026-10-12', detalles_json: '[]' };
  const puts = [], alerts = [];
  let promptAnswers = ['Efectivo', '0.004'];
  window.prompt = () => promptAnswers.shift() ?? null; window.confirm = () => true;
  global.alert = window.alert = message => alerts.push(message);
  api = { async get(url) { return { data: url === '/clientes' ? [{ id: 1, nombre: 'Fixture', documento: '123' }] :
    url === '/empresa' ? {} : url === '/caja/estado-actual' ? { abierta: true, sesion: { id: 10 } } :
    url === '/separados/37' ? { separado: { ...sep }, abonos: [{ id: 48, monto: 1500, metodo_pago: 'Transferencia', fecha_abono: '2026-10-12' },
      ...(sep.estado === 'Anulado' ? [{ id: 49, monto: -1500, metodo_pago: 'Devolución Efectivo', fecha_abono: '2026-10-12' }] : [])] } :
    url.startsWith('/separados/cliente/') ? [sep] : [] }; },
    async put(url, body) { puts.push({ url, body: structuredClone(body) }); if (puts.length === 1) {
      sep.estado = 'Anulado'; sep.neto_abonado = 0; sep.total_devuelto = 1500;
      throw new Error('Respuesta perdida');
    }
      return { data: { success: true, message: 'Confirmada' } }; } };
  render(React.createElement(load('pages/Separados.tsx').default));
  await act(async () => {});
  fireEvent.change(screen.getByPlaceholderText('Escribe el nombre o documento del cliente...'), { target: { value: 'Fixture' } });
  fireEvent.click(screen.getByText('Ver Módulo →'));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Abrir' })));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Anular' })));
  fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
  await waitFor(() => assert.ok(alerts.some(a => a.includes('dos decimales')))); assert.equal(puts.length, 0);
  promptAnswers = ['Efectivo', '1500', 'Fixture devolución'];
  fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
  await waitFor(() => assert.equal(puts.length, 1));
  assert.equal(puts[0].body.devolucion_efectivo, 1500); assert.equal(puts[0].body.devolucion_transferencia, 0);
  assert.match(puts[0].body.operacion_id, /^37\.10\./);
  // Recargar la pantalla después de devolución TOTAL confirmada en servidor, sin respuesta cliente.
  cleanup();
  render(React.createElement(load('pages/Separados.tsx').default));
  await act(async () => {});
  fireEvent.change(screen.getByPlaceholderText('Escribe el nombre o documento del cliente...'), { target: { value: 'Fixture' } });
  fireEvent.click(screen.getByText('Ver Módulo →'));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Abrir' })));
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Confirmar devolución pendiente' })));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar devolución pendiente' }));
  await waitFor(() => assert.equal(puts.length, 2));
  assert.deepEqual(puts[0], puts[1]);
  await waitFor(() => assert.equal(sessionStorage.length, 0));
  cleanup();
});
