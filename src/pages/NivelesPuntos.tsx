import React, { useState, useEffect } from "react";
import API from "../api/api";

interface NivelForm {
  nombre: string;
  nivel: number;
  porcentaje_acumulacion: number;
  porcentaje_redencion_max: number;
  vigencia_dias: number;
  monto_minimo_acumular: number;
  monto_minimo_redimir: number;
  multiplicador_base: number;
  activo: boolean;
}

const initialState: NivelForm = {
  nombre: "",
  nivel: 1,
  porcentaje_acumulacion: 2,
  porcentaje_redencion_max: 20,
  vigencia_dias: 90,
  monto_minimo_acumular: 0,
  monto_minimo_redimir: 0,
  multiplicador_base: 1,
  activo: true,
};

function NivelesPuntos() {
  const [niveles, setNiveles] = useState<any[]>([]);
  const [formData, setFormData] = useState<NivelForm>(initialState);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchNiveles = () => {
    API.get("/puntos/niveles")
      .then((res) => setNiveles(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchNiveles();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return alert("El nombre del nivel es obligatorio.");
    setLoading(true);
    try {
      if (editingId) {
        await API.put(`/puntos/niveles/${editingId}`, formData);
        alert("Nivel actualizado.");
      } else {
        await API.post("/puntos/niveles", formData);
        alert("Nivel creado.");
      }
      setFormData(initialState);
      setEditingId(null);
      fetchNiveles();
    } catch (err: any) {
      alert(err.response?.data?.error || "Error guardando nivel.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (n: any) => {
    setEditingId(n.id);
    setFormData({
      nombre: n.nombre,
      nivel: n.nivel,
      porcentaje_acumulacion: n.porcentaje_acumulacion,
      porcentaje_redencion_max: n.porcentaje_redencion_max,
      vigencia_dias: n.vigencia_dias,
      monto_minimo_acumular: n.monto_minimo_acumular,
      monto_minimo_redimir: n.monto_minimo_redimir,
      multiplicador_base: n.multiplicador_base,
      activo: n.activo === 1 || n.activo === true,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setFormData(initialState);
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Eliminar este nivel? No se puede deshacer.")) return;
    try {
      await API.delete(`/puntos/niveles/${id}`);
      fetchNiveles();
    } catch (err) {
      alert("Error eliminando nivel.");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-medium tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
            Niveles de Cliente
          </h1>
          <p className="text-slate-500 font-medium text-lg italic">Configura los niveles del programa de fidelización.</p>
        </div>
      </div>

      <details className="group mb-8 bg-gradient-to-r from-amber-50 to-yellow-50/50 rounded-[32px] p-6 border border-amber-200/60 shadow-sm open:pb-8 transition-all">
        <summary className="flex items-center gap-3 cursor-pointer list-none select-none">
          <span className="w-9 h-9 bg-amber-200/80 rounded-xl flex items-center justify-center text-lg group-open:bg-amber-300 transition-colors shrink-0">📖</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-amber-800 uppercase tracking-wider">¿Cómo usar los niveles de cliente?</span>
            <span className="block text-[10px] text-amber-600 font-medium tracking-widest uppercase opacity-70 mt-0.5">Haz clic para expandir — Estrategia para garantizar ganancias fijas</span>
          </div>
          <span className="text-amber-400 group-open:rotate-180 transition-transform text-xl font-bold">▾</span>
        </summary>
        <div className="mt-6 space-y-4 text-sm text-slate-700 leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/80 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center text-sm">🎯</span>
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Paso 1: Define tus niveles</span>
              </div>
              <p className="text-[11px] text-slate-600">Crea niveles (Bronce, Plata, Oro) y asigna a cada cliente el que corresponde según su historial. A mayor nivel, mayor multiplicador de puntos — pero también mayor consumo histórico, lo que asegura tu margen.</p>
            </div>
            <div className="bg-white/80 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-sm">📊</span>
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Paso 2: Ajusta % de acumulación</span>
              </div>
              <p className="text-[11px] text-slate-600">El % de acumulación determina cuántos puntos gana el cliente por cada $100 gastados. Ejemplo: si pones 2%, el cliente recibe 2 puntos por cada $100. <span className="text-emerald-700 font-bold">Mantén este % bajo (1-5%) para que el costo de los puntos no supere tu margen de ganancia.</span></p>
            </div>
            <div className="bg-white/80 rounded-2xl p-4 border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-7 h-7 bg-rose-100 rounded-lg flex items-center justify-center text-sm">🔒</span>
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Paso 3: Controla la redención</span>
              </div>
              <p className="text-[11px] text-slate-600">El % de redención máxima limita cuánto del total de una compra se puede pagar con puntos. <span className="text-emerald-700 font-bold">Recomendación: 10-20%. Así el cliente siempre paga al menos el 80% en efectivo, garantizando tu flujo de caja.</span></p>
            </div>
          </div>
          <div className="bg-amber-100/70 rounded-2xl p-4 border border-amber-200">
            <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-2">💡 Fórmula de ganancia fija</p>
            <p className="text-[11px] text-amber-800">Cada punto entregado tiene un costo para ti (valor_punto en configuración general). Si el cliente gana 2 puntos por cada $100 (2%) y cada punto vale $1, el costo de fidelización es solo 2% de la venta. Si tu margen de ganancia es 20%, te quedas con 18% neto. <span className="font-bold">La clave: Nunca configures un % de acumulación mayor a tu margen de ganancia.</span></p>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-5">
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm sticky top-8">
            <h3 className="text-xl font-medium text-slate-900 flex items-center gap-2 mb-6">
              <span className="w-2 h-6 bg-amber-500 rounded-full"></span> {editingId ? "Actualizar Nivel" : "Nuevo Nivel"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nombre del Nivel <span className="text-red-500">*</span></label>
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: Bronce, Plata, Oro..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 focus:ring-4 focus:ring-amber-50 transition-all uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nivel (orden)</label>
                  <input type="number" name="nivel" value={formData.nivel} onChange={handleChange} min="1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Multiplicador Base</label>
                  <input type="number" step="0.1" name="multiplicador_base" value={formData.multiplicador_base} onChange={handleChange} min="0.1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">% Acumulación</label>
                  <input type="number" step="0.01" name="porcentaje_acumulacion" value={formData.porcentaje_acumulacion} onChange={handleChange} min="0" max="100" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">% Redención Máx</label>
                  <input type="number" step="0.1" name="porcentaje_redencion_max" value={formData.porcentaje_redencion_max} onChange={handleChange} min="0" max="100" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Vigencia (días)</label>
                  <input type="number" name="vigencia_dias" value={formData.vigencia_dias} onChange={handleChange} min="1" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Monto Mín. Acumular</label>
                  <input type="number" name="monto_minimo_acumular" value={formData.monto_minimo_acumular} onChange={handleChange} min="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Monto Mín. Redimir</label>
                  <input type="number" name="monto_minimo_redimir" value={formData.monto_minimo_redimir} onChange={handleChange} min="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-amber-400 transition-all" />
                </div>
                <div className="space-y-2 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" name="activo" checked={formData.activo} onChange={handleChange} className="sr-only peer" />
                    <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    <span className="ml-3 text-xs font-medium text-slate-600">Activo</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full py-4 bg-amber-500 text-white rounded-2xl font-medium shadow-lg shadow-amber-100 hover:bg-amber-600 hover:-translate-y-0.5 transition-all uppercase tracking-widest text-xs">
                {loading ? "Guardando..." : editingId ? "💾 Actualizar Nivel" : "✨ Crear Nivel"}
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
                <span className="w-2 h-6 bg-slate-900 rounded-full"></span> Niveles Configurados
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Nivel</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Nombre</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">% Acum.</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">% Reden.</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Vigencia</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {niveles.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-20 text-center text-slate-400 font-medium italic opacity-60">No hay niveles configurados.</td>
                    </tr>
                  ) : (
                    niveles.map((n) => (
                      <tr key={n.id} className="group hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center text-sm font-black">{n.nivel}</span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900 uppercase">{n.nombre}</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{n.porcentaje_acumulacion}%</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{n.porcentaje_redencion_max}%</td>
                        <td className="px-6 py-4 font-medium text-slate-700">{n.vigencia_dias} días</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md ${n.activo ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                            {n.activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => handleEdit(n)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 transition-all flex items-center justify-center" title="Editar">✏️</button>
                            <button onClick={() => handleDelete(n.id)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all flex items-center justify-center" title="Eliminar">🗑</button>
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

      <details className="group mb-8 bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-[32px] p-6 border border-blue-200/60 shadow-sm open:pb-8 transition-all">
        <summary className="flex items-center gap-3 cursor-pointer list-none select-none">
          <span className="w-9 h-9 bg-blue-200/80 rounded-xl flex items-center justify-center text-lg group-open:bg-blue-300 transition-colors shrink-0">📋</span>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-blue-800 uppercase tracking-wider">Ejemplos de configuración por tipo de negocio</span>
            <span className="block text-[10px] text-blue-600 font-medium tracking-widest uppercase opacity-70 mt-0.5">Haz clic para expandir — Referencia rápida de valores recomendados</span>
          </div>
          <span className="text-blue-400 group-open:rotate-180 transition-transform text-xl font-bold">▾</span>
        </summary>
        <div className="mt-6 space-y-6 text-sm text-slate-700 leading-relaxed">
          <div className="bg-white/80 rounded-2xl p-5 border border-blue-100">
            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-3 flex items-center gap-2">☕ Cafetería — Nivel Bronce</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-blue-100">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wider">Campo</th>
                    <th className="text-left py-2 font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Nombre</td><td className="py-1.5 font-semibold text-slate-900">Bronce</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Orden</td><td className="py-1.5 font-semibold text-slate-900">1</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Multiplicador</td><td className="py-1.5 font-semibold text-slate-900">1</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">% Acumulación</td><td className="py-1.5 font-semibold text-slate-900">2</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">% Redención</td><td className="py-1.5 font-semibold text-slate-900">20</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Vigencia</td><td className="py-1.5 font-semibold text-slate-900">90 días</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Mín. Acumular</td><td className="py-1.5 font-semibold text-slate-900">$20.000</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Mín. Redimir</td><td className="py-1.5 font-semibold text-slate-900">$50.000</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 italic">Cada $100 gastados dan 2 puntos. Se necesita mínimo $20.000 para empezar a acumular y $50.000 para redimir.</p>
          </div>

          <div className="bg-white/80 rounded-2xl p-5 border border-blue-100">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">🛒 Supermercado — Nivel Plata</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-blue-100">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wider">Campo</th>
                    <th className="text-left py-2 font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Nombre</td><td className="py-1.5 font-semibold text-slate-900">Plata</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Orden</td><td className="py-1.5 font-semibold text-slate-900">2</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Multiplicador</td><td className="py-1.5 font-semibold text-slate-900">1.25</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">% Acumulación</td><td className="py-1.5 font-semibold text-slate-900">3</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">% Redención</td><td className="py-1.5 font-semibold text-slate-900">20</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Vigencia</td><td className="py-1.5 font-semibold text-slate-900">120 días</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Mín. Acumular</td><td className="py-1.5 font-semibold text-slate-900">$50.000</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Mín. Redimir</td><td className="py-1.5 font-semibold text-slate-900">$100.000</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 italic">Multiplicador 1.25 = 3.75 puntos por cada $100 (3% × 1.25). Ideal para clientes con ticket promedio alto.</p>
          </div>

          <div className="bg-white/80 rounded-2xl p-5 border border-blue-100">
            <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">💻 Tienda de Tecnología — Nivel Oro</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-blue-100">
                    <th className="text-left py-2 pr-4 font-semibold text-slate-500 uppercase tracking-wider">Campo</th>
                    <th className="text-left py-2 font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Nombre</td><td className="py-1.5 font-semibold text-slate-900">Oro</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Orden</td><td className="py-1.5 font-semibold text-slate-900">3</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Multiplicador</td><td className="py-1.5 font-semibold text-slate-900">1.5</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">% Acumulación</td><td className="py-1.5 font-semibold text-slate-900">5</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">% Redención</td><td className="py-1.5 font-semibold text-slate-900">20</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Vigencia</td><td className="py-1.5 font-semibold text-slate-900">180 días</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Mín. Acumular</td><td className="py-1.5 font-semibold text-slate-900">$100.000</td></tr>
                  <tr><td className="py-1.5 pr-4 text-slate-600 font-medium">Mín. Redimir</td><td className="py-1.5 font-semibold text-slate-900">$300.000</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 italic">Multiplicador 1.5 = 7.5 puntos por cada $100. Los clientes Oro compran más seguido, por eso la vigencia se extiende a 180 días.</p>
          </div>
        </div>
      </details>
    </div>
  );
}

export default NivelesPuntos;
