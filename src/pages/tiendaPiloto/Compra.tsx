import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "../../config/runtime";

const base = "/tienda-piloto", storage = "impulsa:local:piloto-a:carrito";
const button = "rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-50";
const money = (c: string) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(Number(c) / 100);
export type Item = { id: number; nombre: string; cantidad: number };
type Cart = { items: Item[]; intento: string };
type Quote = { total_centavos: string; lineas: { id: number; nombre: string; cantidad: number; precio: string; subtotal: string }[] };
function nuevo(items: Item[]): Cart { return { items, intento: Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2, "0")).join("") }; }
export function leerCarrito(): Cart {
  try { const c = JSON.parse(localStorage.getItem(storage) || "null"); if (c && /^[a-f0-9]{48}$/.test(c.intento) && Array.isArray(c.items) && c.items.length <= 40 && c.items.every((i: Item) => i && Number.isSafeInteger(i.id) && Number.isSafeInteger(i.cantidad) && i.cantidad > 0 && typeof i.nombre === "string")) return c; } catch {/* Carrito local no válido */ }
  return nuevo([]);
}
export function persistir(items: Item[]) { const c = nuevo(items); localStorage.setItem(storage, JSON.stringify(c)); return c; }
async function api<T>(ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API_BASE_URL + base + ruta, init);
  if (!r.ok) { const msg = await r.json().catch(() => null); throw Error(msg?.error || (r.status === 404 ? "No se encontró el comprobante." : "No se pudo completar la consulta.")); }
  return r.status === 204 ? undefined as T : await r.json();
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <main className="mx-auto grid max-w-4xl gap-4 p-6"><Link className="text-teal-800 underline" to={base}>Volver al catálogo</Link><p>Empresa A · Simulación local</p><h1 className="text-3xl font-bold">{titulo}</h1>{children}</main>;
}
export function Carrito({ cart, cambiar }: { cart: Cart; cambiar: (i: Item[]) => void }) {
  const nav = useNavigate(), [quote, setQuote] = useState<Quote | null>(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let live = true; setQuote(null); setErr(""); if (cart.items.length) api<Quote>("/cotizacion", post(cart)).then(q => live && setQuote(q)).catch(e => live && setErr(e.message)); return () => { live = false; }; }, [cart]);
  async function guardar() { setBusy(true); setErr(""); try { const r = await api<{ comprobante: string }>("/pedidos", post(cart)); cambiar([]); nav(`${base}/pedido/${r.comprobante}`, { replace: true }); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return <Marco titulo="Tu carrito">{cart.items.length === 0 ? <p>Tu carrito está vacío.</p> : <>
    {cart.items.map(i => <article key={i.id} className="grid gap-2 rounded border bg-white p-4"><h2 className="font-bold">{i.nombre}</h2>
      <div className="flex flex-wrap items-center gap-3"><button disabled={busy || i.cantidad <= 1} aria-label={`Restar una unidad de ${i.nombre}`} className={button} onClick={() => cambiar(cart.items.map(a => a.id === i.id ? { ...a, cantidad: a.cantidad - 1 } : a))}>−</button>
        {i.cantidad}<button disabled={busy} aria-label={`Sumar una unidad de ${i.nombre}`} className={button} onClick={() => cambiar(cart.items.map(a => a.id === i.id ? { ...a, cantidad: a.cantidad + 1 } : a))}>+</button>
        <button disabled={busy} className="p-2 underline" onClick={() => cambiar(cart.items.filter(a => a.id !== i.id))}>Quitar</button>
        {quote && money(quote.lineas.find(l => l.id === i.id)?.subtotal || "0")}</div></article>)}
    <p aria-live="polite">{err || (quote ? `Subtotal: ${money(quote.total_centavos)}` : "Consultando precios y existencias…")}</p>
    <p>Guardar la simulación no reserva unidades ni genera un cobro.</p><button className={button} disabled={busy || !quote} onClick={guardar}>{busy ? "Guardando…" : "Guardar pedido de prueba"}</button></>}</Marco>;
}
export function Comprobante() {
  const { ref } = useParams(), [q, setQ] = useState<Quote | null>(null), [err, setErr] = useState("");
  useEffect(() => { let live = true; setQ(null); setErr(""); api<Quote>("/pedidos/" + encodeURIComponent(ref || "")).then(v => live && setQ(v)).catch(e => live && setErr(e.message)); return () => { live = false; }; }, [ref]);
  return <Marco titulo="Comprobante de prueba">{q ? <><p>Pedido {ref?.slice(0, 10)} · Sin cobro ni reserva</p>{q.lineas.map(l => <p key={l.id}>{l.cantidad} × {l.nombre} — {money(l.subtotal)}</p>)}<strong>Subtotal: {money(q.total_centavos)}</strong></> : <p role="status">{err || "Consultando…"}</p>}</Marco>;
}
type Lista = { total: number; pendientes: number; pagina: number; paginas: number; pedidos: { comprobante: string; creado: string; revisado_en: string | null; total_centavos: string }[] };
export function Gestion() {
  const [key] = useState(() => new URLSearchParams(location.hash.slice(1)).get("acceso") || sessionStorage.getItem("operadorPiloto") || "");
  const [vista, setVista] = useState("todos"), [p, setP] = useState(1), [tick, refresh] = useState(0), [lista, setLista] = useState<Lista | null>(null), [err, setErr] = useState("");
  useEffect(() => { if (key) { sessionStorage.setItem("operadorPiloto", key); history.replaceState(history.state, "", location.pathname + location.search); } }, [key]);
  useEffect(() => { let live = true; setLista(null); setErr(""); api<Lista>(`/gestion/pedidos?vista=${vista}&p=${p}`, { headers: { Authorization: "Bearer " + key } }).then(v => live && setLista(v)).catch(e => live && setErr(e.message)); return () => { live = false; }; }, [vista, p, tick, key]);
  async function revisar(ref: string) { try { await api(`/gestion/pedidos/${ref}/revisar`, { method: "POST", headers: { Authorization: "Bearer " + key } }); refresh(n => n + 1); } catch (e) { setErr((e as Error).message); } }
  return <Marco titulo="Bandeja de pedidos"><div className="flex flex-wrap gap-4"><label>Mostrar <select value={vista} onChange={e => { setVista(e.target.value); setP(1); }}><option value="todos">Todos</option><option value="pendientes">Pendientes</option></select></label><button onClick={() => refresh(n => n + 1)}>Actualizar</button></div>
    {lista && <Link className="text-teal-800 underline" to={`${base}/gestion/productos`}>Elegir productos para la tienda</Link>}
    {err && <p role="alert">{err}</p>}{lista ? <><p>{lista.total} pedidos · {lista.pendientes} pendientes de revisión</p>
      {lista.pedidos.map(r => <article key={r.comprobante} className="grid gap-2 rounded border p-4"><Link className="underline" to={`${base}/pedido/${r.comprobante}`}>Pedido {r.comprobante.slice(0, 10)}</Link><span>{r.creado} · {money(r.total_centavos)}</span>
        {r.revisado_en ? <p>Revisado: {r.revisado_en}</p> : <button className={button} onClick={() => revisar(r.comprobante)}>Marcar como revisado</button>}</article>)}
      {!lista.pedidos.length && <p>No hay pedidos en esta vista.</p>}{lista.paginas > 1 && <div><button disabled={lista.pagina <= 1} onClick={() => setP(lista.pagina - 1)}>Anterior</button> · {lista.pagina}/{lista.paginas} · <button disabled={lista.pagina >= lista.paginas} onClick={() => setP(lista.pagina + 1)}>Siguiente</button></div>}</> : !err && <p>Cargando…</p>}</Marco>;
}
