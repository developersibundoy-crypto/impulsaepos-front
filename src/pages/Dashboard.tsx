import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import WompiCheckout from '../components/WompiCheckout';

function Dashboard() {
  const [datos, setDatos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saasState, setSaasState] = useState<any>(null);
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionStorage.getItem('dismiss_promo_tienda_dashboard') === 'true');

  useEffect(() => {
    API.get("/dashboard/resumen")
      .then((res) => {
        setDatos(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando dashboard:", err);
        setLoading(false);
      });

    API.get("/suscripciones/estado")
      .then(res => setSaasState(res.data))
      .catch(err => console.log("Trial Status Check failed", err));
  }, []);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b'];

  if (loading || !datos) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Cargando Monitor de Negocio...</p>
      </div>
    );
  }

  const { globales, categorias, alertasBajoStock } = datos;

  const CustomTooltipPie = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 shadow-xl rounded-2xl border border-slate-100 animate-in zoom-in duration-200">
          <p className="text-slate-400 font-black text-[9px] uppercase tracking-widest mb-1">{payload[0].name}</p>
          <p className="text-indigo-600 font-black text-sm">{formatCOP(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20 px-6">
      
      {/* SaaS Banner Compact */}
      {saasState && (saasState.estado === 'Trial' || saasState.estado === 'Expired') && (
        <div className={`p-4 rounded-[1.5rem] mb-6 border flex items-center justify-between gap-4 ${
          saasState.estado === 'Expired' ? 'bg-red-50 border-red-100 text-red-900' : 'bg-indigo-50 border-indigo-100 text-indigo-900'
        }`}>
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
                {saasState.estado === 'Expired' ? '⚠️' : '⏱️'}
             </div>
             <div>
                <p className="text-sm font-black tracking-tight">{saasState.estado === 'Expired' ? 'Suscripción Expirada' : `Quedan ${saasState.diasRestantes} días de prueba`}</p>
                <p className="text-[10px] opacity-70 underline">$70.000 / mes para continuar</p>
             </div>
          </div>
          <div className="scale-75 origin-right">
             <WompiCheckout reference={`SUB_${localStorage.getItem('empresa_id')}_${Date.now()}`} amountInCents={7000000} />
          </div>
        </div>
      )}

      {/* Banner Promocional Tienda en Línea */}
      {!bannerDismissed && (
        <div className="relative overflow-hidden bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg mb-8 border border-purple-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-xl flex-shrink-0">
               🛍️
             </div>
             <div>
               <div className="flex items-center gap-2">
                 <span className="text-[9px] bg-emerald-500 text-slate-950 font-black px-1.5 py-0.5 rounded uppercase">✨ NUEVO</span>
                 <p className="text-sm font-extrabold text-white">¿Ya activaste tu Tienda en Línea?</p>
               </div>
               <p className="text-xs text-slate-300 mt-0.5">Publica tus productos a internet en 1 clic y recibe pedidos 24/7. Incluye 14 días gratis de prueba.</p>
             </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-shrink-0">
            <Link
              to="/tienda-admin"
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow transition"
            >
              Configurar Tienda →
            </Link>
            <button
              onClick={() => {
                sessionStorage.setItem('dismiss_promo_tienda_dashboard', 'true');
                setBannerDismissed(true);
              }}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
              title="Cerrar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header Compact */}
      <div className="flex justify-between items-center mb-10 pb-4 border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-medium tracking-tighter text-slate-900">Monitor Financiero</h1>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Resumen Integral de Mercancía y Capital</p>
        </div>
        <div className="px-4 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center gap-2 font-medium text-emerald-600 text-[9px] uppercase tracking-widest">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Vivo
        </div>
      </div>

      {/* Metrics Spotlight Compact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <MetricCard title="Capital Invertido" value={formatCOP(globales.total_invertido || 0)} desc="Costo en Bodega" icon="💰" color="indigo" />
        <MetricCard title="Venta Proyectada" value={formatCOP(globales.ganancia_proyectada || 0)} desc="Potencial Bruto" icon="📈" color="emerald" />
        <MetricCard title="Stock Total" value={globales.total_articulos || 0} desc="Unidades Físicas" icon="📦" color="amber" isNumber />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Category Performance List (LARGE VISIBILITY) */}
        <div className="xl:col-span-8 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div> Rentabilidad por Categoría
             </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {categorias.map((c: any, index: number) => {
                const totalInvertido = Number(globales.total_invertido) || 0;
                const percentage = totalInvertido > 0 ? (Number(c.valor_invertido) / totalInvertido) * 100 : 0;
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-end">
                       <div>
                          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mb-1">Nombre</p>
                          <h4 className="text-xs font-medium text-slate-800 uppercase tracking-tight">{c.categoria}</h4>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-medium text-indigo-600">{formatCOP(c.valor_invertido)}</p>
                          <p className="text-[9px] font-medium text-slate-400 tracking-tighter">{percentage.toFixed(1)}% del Total</p>
                       </div>
                    </div>
                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                       <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%`, backgroundColor: COLORS[index % COLORS.length] }}></div>
                    </div>
                  </div>
                );
             })}
          </div>
        </div>

        {/* Small Analytics Side */}
        <div className="xl:col-span-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
            <h3 className="text-sm font-medium text-slate-900 mb-6 uppercase tracking-wider">Distribución de Capital</h3>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie
                        data={categorias.map((c: any) => ({ ...c, valor_invertido: Number(c.valor_invertido) || 0 })).filter((c: any) => c.valor_invertido > 0)}
                        dataKey="valor_invertido" nameKey="categoria" cx="50%" cy="50%" outerRadius={100} innerRadius={70} paddingAngle={2} stroke="none" cornerRadius={8}
                      >
                        {categorias.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    <Tooltip content={(props: any) => <CustomTooltipPie {...props} />} />
                  </PieChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* CRITICAL ALERTS (FULL WIDTH & PRO VISIBILITY) */}
        <div className="xl:col-span-12 bg-white rounded-[2rem] border-2 border-red-100 shadow-xl shadow-red-50/50 overflow-hidden mt-4">
           <div className="bg-red-500 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                 <span className="text-2xl animate-bounce">🚨</span>
                 <div>
                    <h3 className="text-lg font-medium tracking-tight leading-none uppercase">Alertas Críticas de Inventario</h3>
                    <p className="text-[9px] font-medium opacity-80 uppercase tracking-[0.2em]">Sugerencia Inmediata de Reabastecimiento</p>
                 </div>
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest border border-white/30 backdrop-blur-md">
                 {alertasBajoStock.length} Artículos por Agotarse
              </div>
           </div>
           
           <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                 {alertasBajoStock.length === 0 ? (
                    <div className="col-span-full py-12 text-center">
                       <p className="text-3xl mb-2">✅</p>
                       <p className="font-medium text-slate-800 uppercase tracking-widest text-xs">Inventario en Niveles Óptimos</p>
                    </div>
                 ) : (
                    alertasBajoStock.map((prod: any) => (
                       <div key={prod.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-red-300 hover:bg-red-50/30 transition-all flex items-start justify-between gap-3 group">
                          <div className="min-w-0">
                             <h4 className="text-[10px] font-medium text-slate-800 uppercase truncate leading-tight mb-1 group-hover:text-red-700 transition-colors">{prod.nombre}</h4>
                             <div className="flex items-center gap-2">
                                <span className="bg-white px-1.5 py-0.5 rounded-md border border-slate-200 text-[8px] font-medium text-slate-400 uppercase">{prod.referencia || "SIN REF"}</span>
                                <span className="text-[8px] font-medium text-slate-300 uppercase tracking-widest">{prod.categoria}</span>
                             </div>
                          </div>
                          <div className={`shrink-0 w-8 h-8 rounded-lg flex flex-col items-center justify-center font-medium ${
                             prod.cantidad === 0 ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-100 text-amber-700'
                          }`}>
                             <span className="text-xs">{prod.cantidad}</span>
                             <span className="text-[6px] uppercase tracking-tighter opacity-60">PZS</span>
                          </div>
                       </div>
                    ))
                 )}
              </div>
           </div>
           
           <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <button className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.3em] hover:text-indigo-600 transition-colors">
                 Ver Reporte de Stock Completo ➔
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, desc, icon, color, isNumber }: any) {
  const variants: any = {
    indigo: "border-indigo-600 bg-indigo-50/30 text-indigo-700",
    emerald: "border-emerald-500 bg-emerald-50/30 text-emerald-700",
    amber: "border-amber-500 bg-amber-50/30 text-amber-700"
  };
  
  return (
    <div className={`p-4 rounded-xl border-l-4 shadow-sm hover:shadow-md transition-all bg-white border-t border-r border-b border-slate-100 ${variants[color]}`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-medium uppercase tracking-widest opacity-60">{title}</span>
            <span className="text-xl">{icon}</span>
        </div>
        <div className="text-xl font-medium tracking-tight text-slate-900 leading-none mb-1">{value}</div>
        <p className="text-[9px] font-medium opacity-40 uppercase tracking-tighter leading-none">{desc}</p>
    </div>
  );
}

export default Dashboard;
