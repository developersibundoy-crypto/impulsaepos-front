import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";

function ConfiguracionDian() {
  const [resoluciones, setResoluciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    prefijo: "",
    numero_resolucion: "",
    fecha_resolucion: "",
    rango_desde: "",
    rango_hasta: "",
    fecha_inicio: "",
    fecha_fin: "",
    clave_tecnica: "",
    ambiente: "pruebas"
  });

  const fetchResoluciones = () => {
    setLoading(true);
    API.get("/dian/resoluciones")
      .then(res => {
        setResoluciones(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchResoluciones();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    API.post("/dian/resoluciones", formData)
      .then(() => {
        alert("Resolución guardada correctamente");
        setShowForm(false);
        fetchResoluciones();
      })
      .catch(err => alert(err.response?.data?.error || "Error al guardar"));
  };

  const toggleEstado = (id: number, activa: boolean) => {
    API.put(`/dian/resoluciones/${id}/estado`, { activa })
      .then(() => fetchResoluciones())
      .catch(console.error);
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-700 pb-20 p-6">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">
            <span className="text-indigo-600">DIAN:</span> Configuracion Fiscal
          </h1>
          <p className="text-slate-500 font-medium italic">Gestión de resoluciones de facturación electrónica en Colombia.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="px-8 py-4 bg-indigo-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all active:scale-95 flex items-center gap-3"
        >
          {showForm ? "✕ Cerrar Formulario" : "✚ Nueva Resolución"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-10 rounded-[40px] border border-slate-200 shadow-2xl mb-12 animate-in zoom-in duration-500 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Prefijo (Ej: SETT)</label>
              <input 
                required
                type="text" 
                value={formData.prefijo}
                onChange={e => setFormData({...formData, prefijo: e.target.value.toUpperCase()})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold uppercase"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de Resolución</label>
              <input 
                required
                type="text" 
                value={formData.numero_resolucion}
                onChange={e => setFormData({...formData, numero_resolucion: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Resolución</label>
              <input 
                required
                type="date" 
                value={formData.fecha_resolucion}
                onChange={e => setFormData({...formData, fecha_resolucion: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rango Inicia</label>
              <input 
                required
                type="number" 
                value={formData.rango_desde}
                onChange={e => setFormData({...formData, rango_desde: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rango Finaliza</label>
              <input 
                required
                type="number" 
                value={formData.rango_hasta}
                onChange={e => setFormData({...formData, rango_hasta: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ambiente de Operación</label>
              <select 
                value={formData.ambiente}
                onChange={e => setFormData({...formData, ambiente: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none transition-all font-bold"
              >
                <option value="pruebas">👨‍💻 AMBIENTE DE PRUEBAS</option>
                <option value="produccion">⚡ PRODUCCIÓN REAL</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vigencia: Desde</label>
              <input 
                required
                type="date" 
                value={formData.fecha_inicio}
                onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vigencia: Hasta</label>
              <input 
                required
                type="date" 
                value={formData.fecha_fin}
                onChange={e => setFormData({...formData, fecha_fin: e.target.value})}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Clave Técnica</label>
              <input 
                type="text" 
                value={formData.clave_tecnica}
                onChange={e => setFormData({...formData, clave_tecnica: e.target.value})}
                placeholder="Opcional"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none transition-all font-bold"
              />
            </div>
            <div className="lg:col-span-3 flex justify-end gap-4 pt-4">
               <button 
                 type="submit"
                 className="px-12 py-5 bg-slate-950 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all shadow-2xl active:scale-95"
               >
                 Registrar Resolución Legal
               </button>
            </div>
          </form>
        </div>
      )}

      {/* List of Resolutions */}
      <div className="space-y-6">
        {resoluciones.map((res: any) => (
          <div key={res.id} className={`bg-white p-8 rounded-[40px] border ${res.activa ? 'border-emerald-200 bg-emerald-50/10 shadow-emerald-100' : 'border-slate-100 opacity-60'} border shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 transition-all hover:shadow-2xl`}>
             <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-3xl shadow-lg ${res.activa ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                   {res.activa ? "⚡" : "🔒"}
                </div>
                <div>
                   <div className="flex items-center gap-3">
                      <span className="text-2xl font-black text-slate-900 tracking-tighter uppercase">{res.prefijo} - {res.numero_resolucion}</span>
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${res.ambiente === 'produccion' ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}`}>
                         {res.ambiente}
                      </span>
                   </div>
                   <div className="flex flex-wrap gap-4 mt-2">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Rango: {res.rango_desde} - {res.rango_hasta}</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Actual: <span className="text-indigo-600 font-black">{res.consecutivo_actual}</span></span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic text-rose-500">Expira: {new Date(res.fecha_fin).toLocaleDateString()}</span>
                   </div>
                </div>
             </div>
             
             <div className="flex items-center gap-4">
                <button 
                  onClick={() => toggleEstado(res.id, !res.activa)}
                  className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${res.activa ? 'bg-slate-900 text-white' : 'bg-emerald-500 text-white'}`}
                >
                  {res.activa ? "Desactivar" : "Activar Ahora"}
                </button>
             </div>
          </div>
        ))}

        {resoluciones.length === 0 && !loading && (
          <div className="py-32 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200">
             <span className="text-6xl mb-6 block">⚖️</span>
             <p className="text-slate-400 font-bold uppercase tracking-widest italic">No hay resoluciones registradas ante la DIAN.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfiguracionDian;
