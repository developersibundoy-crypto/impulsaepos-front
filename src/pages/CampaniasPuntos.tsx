import React, { useState, useEffect } from "react";
import API from "../api/api";

interface CampaniaForm {
  nombre: string;
  tipo: "multiplicador" | "puntos_fijos" | "descuento";
  multiplicador: number;
  puntos_fijos_por_cada: number | null;
  monto_para_puntos_fijos: number | null;
  nivel_cliente_id: number | null;
  producto_id: number | null;
  categoria: string;
  marca: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

const initialState: CampaniaForm = {
  nombre: "",
  tipo: "multiplicador",
  multiplicador: 2,
  puntos_fijos_por_cada: null,
  monto_para_puntos_fijos: null,
  nivel_cliente_id: null,
  producto_id: null,
  categoria: "",
  marca: "",
  fecha_inicio: new Date().toISOString().split("T")[0],
  fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  activo: true,
};

const safeDate = (d: any): string => {
  try {
    if (d == null) return "";
    if (typeof d === "string") {
      const s = d.trim();
      if (!s) return "";
      return s.split(" ")[0] || s.split("T")[0] || s;
    }
    if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString().split("T")[0];
    return "";
  } catch {
    return "";
  }
};

const safeStr = (v: any, fallback = ""): string => {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  return String(v);
};

const safeNum = (v: any, fallback: number | null = null): number | null => {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return isNaN(n) ? (fallback ?? null) : n;
};

function CampaniasPuntos() {
  const [campanias, setCampanias] = useState<any[]>([]);
  const [niveles, setNiveles] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [formData, setFormData] = useState<CampaniaForm>(initialState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [campRes, nivRes, prodRes] = await Promise.all([
          API.get("/puntos/campanias").catch(() => ({ data: [] })),
          API.get("/puntos/niveles").catch(() => ({ data: [] })),
          API.get("/productos").catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setCampanias(Array.isArray(campRes.data) ? campRes.data : []);
        setNiveles(Array.isArray(nivRes.data) ? nivRes.data : []);
        setProductos(Array.isArray(prodRes.data) ? prodRes.data : []);
      } catch {
        if (!cancelled) setPageError("Error cargando datos.");
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    try {
      const target = e.currentTarget;
      const { name } = target;
      if (!name) return;
      const isCheckbox = target instanceof HTMLInputElement && target.type === "checkbox";
      const rawValue = isCheckbox ? (target as HTMLInputElement).checked : target.value;
      setFormData((prev) => ({
        ...prev,
        [name]: rawValue,
      }));
    } catch {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return alert("El nombre de la campaña es obligatorio.");
    if (!formData.fecha_inicio || !formData.fecha_fin) return alert("Fechas de inicio y fin requeridas.");
    if (formData.fecha_fin < formData.fecha_inicio) return alert("La fecha fin debe ser posterior a la fecha inicio.");
    setLoading(true);
    try {
      const toNum = (v: any): number | null => v === "" || v == null ? null : Number(v);
      const payload = {
        ...formData,
        multiplicador: Number(formData.multiplicador) || 1,
        puntos_fijos_por_cada: toNum(formData.puntos_fijos_por_cada),
        monto_para_puntos_fijos: toNum(formData.monto_para_puntos_fijos),
        nivel_cliente_id: toNum(formData.nivel_cliente_id),
        producto_id: toNum(formData.producto_id),
      };
      if (editingId) {
        await API.put(`/puntos/campanias/${editingId}`, payload);
        alert("Campaña actualizada.");
      } else {
        await API.post("/puntos/campanias", payload);
        alert("Campaña creada.");
      }
      setFormData(initialState);
      setEditingId(null);
      const res = await API.get("/puntos/campanias").catch(() => ({ data: [] }));
      setCampanias(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error guardando campaña.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (c: any) => {
    if (!c) return;
    setEditingId(c.id ?? null);
    setFormData({
      nombre: safeStr(c.nombre),
      tipo: (c.tipo === "multiplicador" || c.tipo === "puntos_fijos" || c.tipo === "descuento") ? c.tipo : "multiplicador",
      multiplicador: safeNum(c.multiplicador, 1) ?? 1,
      puntos_fijos_por_cada: safeNum(c.puntos_fijos_por_cada),
      monto_para_puntos_fijos: safeNum(c.monto_para_puntos_fijos),
      nivel_cliente_id: safeNum(c.nivel_cliente_id),
      producto_id: safeNum(c.producto_id),
      categoria: safeStr(c.categoria),
      marca: safeStr(c.marca),
      fecha_inicio: safeDate(c.fecha_inicio),
      fecha_fin: safeDate(c.fecha_fin),
      activo: c.activo === 1 || c.activo === true || c.activo === "1",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setFormData(initialState);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Eliminar esta campaña? No se puede deshacer.")) return;
    try {
      await API.delete(`/puntos/campanias/${id}`);
      const res = await API.get("/puntos/campanias").catch(() => ({ data: [] }));
      setCampanias(Array.isArray(res.data) ? res.data : []);
    } catch {
      alert("Error eliminando campaña.");
    }
  };

  const tipoLabel = (t: string) => {
    const map: Record<string, string> = {
      multiplicador: "Multiplicador",
      puntos_fijos: "Puntos Fijos",
      descuento: "Descuento",
    };
    return map[t] || t;
  };

  if (initialLoading) {
    return (
      <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
        <div className="flex items-center justify-center py-40">
          <div className="text-slate-400 font-medium text-lg animate-pulse">Cargando...</div>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <div className="text-6xl">⚠️</div>
          <div className="text-slate-600 font-medium text-lg">{pageError}</div>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-violet-600 text-white rounded-2xl font-medium text-sm hover:bg-violet-700 transition-all">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-medium tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
            Campañas de Puntos
          </h1>
          <p className="text-slate-500 font-medium text-lg italic">Promociones temporales para impulsar la acumulación de puntos.</p>
        </div>
      </div>

      <details className="group mb-8 bg-gradient-to-r from-violet-50 to-purple-50/50 rounded-[32px] p-6 border border-violet-200/60 shadow-sm open:pb-8 transition-all">
        <summary className="flex items-center gap-3 cursor-pointer list-none select-none">
          <span className="w-9 h-9 bg-violet-200/80 rounded-xl flex items-center justify-center text-lg group-open:bg-violet-300 transition-colors shrink-0">📖</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-violet-800 uppercase tracking-wider">¿Cómo usar las campañas de puntos?</span>
            <span className="block text-[10px] text-violet-600 font-medium tracking-widest uppercase opacity-70 mt-0.5">Haz clic para expandir — Estrategia para campañas rentables</span>
          </div>
          <span className="text-violet-400 group-open:rotate-180 transition-transform text-xl font-bold">▾</span>
        </summary>
        <div className="mt-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/80 rounded-2xl p-4 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-sm">🚀</span>
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Multiplicador (x2, x3, etc.)</span>
              </div>
              <p className="text-[11px] text-slate-600">Duplica o triplica los puntos que ganan los clientes en un período específico. Ideal para temporadas altas (Diciembre, Día de la Madre, etc.). <span className="text-emerald-700 font-bold">Úsalo por tiempo limitado (7-15 días) para impulsar ventas sin regalar puntos permanentemente.</span></p>
            </div>
            <div className="bg-white/80 rounded-2xl p-4 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-sm">🎁</span>
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Puntos Fijos</span>
              </div>
              <p className="text-[11px] text-slate-600">Entrega una cantidad fija de puntos por cada X monto gastado. Ejemplo: "10 puntos por cada $50.000". <span className="text-emerald-700 font-bold">Perfecto para productos con margen predecible: calcula cuánto puedes "regalar" en puntos sin perder dinero.</span></p>
            </div>
            <div className="bg-white/80 rounded-2xl p-4 border border-violet-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center text-sm">💰</span>
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Descuento (Próximamente)</span>
              </div>
              <p className="text-[11px] text-slate-600">Aplica un descuento directo en productos seleccionados durante la campaña. Ideal para liquidar inventario lento. <span className="text-rose-600 font-bold">Asegúrate de que el descuento no supere tu margen para no vender a pérdida.</span></p>
            </div>
          </div>
          <div className="bg-violet-100/70 rounded-2xl p-4 border border-violet-200">
            <p className="text-[11px] font-bold text-violet-900 uppercase tracking-wider mb-2">💡 Reglas de oro para campañas rentables</p>
            <ul className="text-[11px] text-violet-800 space-y-1.5 list-disc list-inside">
              <li><span className="font-bold">Acota las fechas:</span> campañas muy largas canibalizan tu margen. 7-14 días es el punto óptimo.</li>
              <li><span className="font-bold">Segmenta:</span> usa niveles, productos o categorías para dirigir la campaña solo a los clientes o productos que te generan más ganancia.</li>
              <li><span className="font-bold">Multiplicador moderado:</span> x2 como máximo. x3 o más solo por períodos muy cortos (3-5 días).</li>
              <li><span className="font-bold">Puntos fijos seguros:</span> calcula: si regalas 10 pts por cada $50.000 y cada punto vale $1, el costo es $10 por cada $50.000 gastados = 0.02% del ticket. Si tu margen es 20%, sigue siendo muy rentable.</li>
              <li><span className="font-bold">No acumules campañas:</span> evita tener múltiples campañas activas simultáneamente. Una a la vez para mantener el control financiero.</li>
            </ul>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-5">
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-8">
            <h3 className="text-xl font-medium text-slate-900 flex items-center gap-2 mb-6">
              <span className="w-2 h-6 bg-violet-500 rounded-full"></span> {editingId ? "Actualizar Campaña" : "Nueva Campaña"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nombre <span className="text-red-500">*</span></label>
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Mes del niño - Puntos dobles" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all uppercase" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                  <select name="tipo" value={formData.tipo} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                    <option value="multiplicador">Multiplicador</option>
                    <option value="puntos_fijos">Puntos Fijos</option>
                    <option value="descuento">Descuento</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Multiplicador</label>
                  <input type="number" step="0.1" name="multiplicador" value={formData.multiplicador} onChange={handleChange} min="1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                </div>
              </div>

              {formData.tipo === "puntos_fijos" && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-violet-50/50 rounded-2xl border border-violet-100">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Puntos por cada</label>
                    <input type="number" name="puntos_fijos_por_cada" value={formData.puntos_fijos_por_cada ?? ""} onChange={handleChange} min="1" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:border-violet-400 transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">$ Monto para puntos</label>
                    <input type="number" name="monto_para_puntos_fijos" value={formData.monto_para_puntos_fijos ?? ""} onChange={handleChange} min="1" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:border-violet-400 transition-all" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nivel (opcional)</label>
                  <select name="nivel_cliente_id" value={formData.nivel_cliente_id ?? ""} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                    <option value="">Todos los niveles</option>
                    {niveles.map((n) => (
                      <option key={n.id} value={n.id}>{n.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Producto (opcional)</label>
                  <select name="producto_id" value={formData.producto_id ?? ""} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                    <option value="">Todos los productos</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Categoría (opcional)</label>
                  <input type="text" name="categoria" value={formData.categoria} onChange={handleChange} placeholder="Ej: Electrónica" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all uppercase" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Marca (opcional)</label>
                  <input type="text" name="marca" value={formData.marca} onChange={handleChange} placeholder="Ej: Sony" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all uppercase" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Fecha Inicio</label>
                  <input type="date" name="fecha_inicio" value={formData.fecha_inicio} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Fecha Fin</label>
                  <input type="date" name="fecha_fin" value={formData.fecha_fin} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange} className="sr-only peer" />
                  <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-violet-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  <span className="ml-3 text-xs font-medium text-slate-600">Activa</span>
                </label>
              </div>

              <button type="submit" disabled={loading} className="w-full py-4 bg-violet-600 text-white rounded-2xl font-medium shadow-lg shadow-violet-100 hover:bg-violet-700 hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs">
                {loading ? "Guardando..." : editingId ? "Actualizar Campaña" : "Crear Campaña"}
              </button>
              {editingId && (
                <button type="button" onClick={handleCancel} className="w-full mt-2 py-2 text-slate-400 font-medium uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">
                  Cancelar Edición
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="xl:col-span-7">
          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-medium text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-2 h-6 bg-slate-900 rounded-full"></span> Campañas Activas
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Tipo</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Vigencia</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Segmento</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campanias.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-slate-400 font-medium italic opacity-60">No hay campañas configuradas.</td>
                    </tr>
                  ) : (
                    campanias.map((c) => (
                      <tr key={c?.id ?? Math.random()} className="group hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900 uppercase">{safeStr(c?.nombre)}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                            c?.tipo === "multiplicador" ? "bg-blue-50 text-blue-600" :
                            c?.tipo === "puntos_fijos" ? "bg-amber-50 text-amber-600" :
                            "bg-emerald-50 text-emerald-600"
                          }`}>
                            {tipoLabel(c?.tipo ?? "")}
                          </span>
                          {c?.tipo === "multiplicador" && (c?.multiplicador ?? 0) > 1 && (
                            <span className="ml-2 text-xs font-medium text-slate-500">x{c.multiplicador}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {safeDate(c?.fecha_inicio)} → {safeDate(c?.fecha_fin)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {c?.nivel_cliente_id
                            ? `Nivel #${c.nivel_cliente_id}`
                            : c?.producto_id
                              ? `Producto #${c.producto_id}`
                              : c?.categoria
                                ? c.categoria
                                : c?.marca
                                  ? c.marca
                                  : "Todos"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${c?.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                            {c?.activo ? "Activa" : "Inactiva"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => handleEdit(c)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50 transition-all flex items-center justify-center" title="Editar">✏️</button>
                            <button onClick={() => handleDelete(c?.id)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center" title="Eliminar">🗑</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaniasPuntos;
