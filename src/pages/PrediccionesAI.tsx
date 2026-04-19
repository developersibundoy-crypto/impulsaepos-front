import React, { useEffect, useState } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import * as XLSX from 'xlsx';
import { useRef } from "react";

function PrediccionesAI() {
  const [tendenciaGeneral, setTendenciaGeneral] = useState<any[]>([]);
  const [rankingIA, setRankingIA] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [proximosVencer, setProximosVencer] = useState<any[]>([]);
  
  // Refs for navigation
  const sectionCantidadesRef = useRef<HTMLDivElement>(null);
  const sectionVencimientosRef = useRef<HTMLDivElement>(null);
  
  // Pagination State
  const [currentPageIA, setCurrentPageIA] = useState(1);
  const [itemsPerPageIA] = useState(10);
  const [currentPageVenc, setCurrentPageVenc] = useState(1);
  const [itemsPerPageVenc] = useState(4);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await API.get("/ai/predicciones");
      setTendenciaGeneral(res.data.tendenciaGeneral);
      setRankingIA(res.data.analisisInteligente);
      setResumen(res.data.resumenEjecutivo);
      
      const resVencimientos = await API.get("/reportes/proximos-vencer");
      setProximosVencer(resVencimientos.data);
      
      setLoading(false);
    } catch (error) {
      console.error("Error cargando motor de IA", error);
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 backdrop-blur-xl border border-sky-500/30 p-5 rounded-2xl shadow-2xl">
          <p className="text-sky-400 font-medium text-[10px] uppercase tracking-widest mb-3">{label}</p>
          <div className="space-y-2">
              {payload.map((entry: any, index: number) => {
                if (entry.value === 0) return null;
                return (
                  <div key={index} className="flex items-center justify-between gap-6">
                      <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tight">{entry.name}:</span>
                      <span className="text-sm font-medium text-white">{entry.value} uds.</span>
                  </div>
                )
              })}
          </div>
        </div>
      );
    }
    return null;
  };

  const formatCurrency = (val: number) => {
    return formatCOP(val);
  }

  const handleDownloadReport = () => {
    // 1. Filtrar solo productos que necesitan reabastecimiento (faltante > 0)
    const criticalProducts = rankingIA.filter(p => p.faltante > 0);
    
    if (criticalProducts.length === 0) {
      alert("No hay productos sugeridos para reabastecer en este momento.");
      return;
    }

    // 2. Preparar los datos para Excel de forma estructurada
    const excelData = criticalProducts.map(p => ({
      "PRODUCTO": p.nombre,
      "CATEGORÍA": p.categoria,
      "CLASIFICACIÓN ABC": p.clase_abc,
      "STOCK ACTUAL": p.stock_disponible,
      "CANTIDAD A PEDIR": p.faltante,
      "PROVEEDOR SUGERIDO": p.proveedor_sugerido,
      "IMPORTE PROYECTADO": formatCurrency(p.oportunidad_venta_usd),
      "ESTADO": p.status
    }));

    // 3. Crear el libro de Excel (Workbook)
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos Sugeridos IA");

    // 4. Mejorar usabilidad: Ajuste automático de anchos de columna
    const columnWidths = [
      { wch: 40 }, // Producto
      { wch: 20 }, // Categoría
      { wch: 15 }, // ABC
      { wch: 15 }, // Stock
      { wch: 20 }, // Cantidad
      { wch: 30 }, // Proveedor
      { wch: 20 }, // Importe
      { wch: 20 }  // Estado
    ];
    worksheet['!cols'] = columnWidths;

    // 5. Activar AutoFiltros para el usuario final
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:H1");
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

    // 6. Descargar el archivo .xlsx (Formato profesional)
    XLSX.writeFile(workbook, `PEDIDOS_SUGERIDOS_IA_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const handleDownloadVencimientos = () => {
    if (proximosVencer.length === 0) {
      alert("No hay alertas de vencimiento para exportar.");
      return;
    }

    // 1. Mapear datos a formato legible para una persona sin conocimiento de excel
    const excelData = proximosVencer.map(p => ({
      "PRODUCTO A ROTAR / CAMBIAR": p.nombre,
      "REFERENCIA / SKU": p.referencia || "SIN REF",
      "CATEGORÍA": p.categoria || "GENERAL",
      "FECHA DE VENCIMIENTO": p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString() : "PENDIENTE",
      "CANTIDAD EN STOCK": p.cantidad,
      "DÍAS PARA VENCER": p.dias_faltantes,
      "ESTADO CRÍTICO": p.dias_faltantes < 0 ? "⚠️ VENCIDO" : (p.dias_faltantes < 7 ? "🛑 CRÍTICO" : "⚠️ PRÓXIMO"),
      "ACCIÓN SUGERIDA": p.dias_faltantes < 0 ? "RETIRAR Y CAMBIAR CON PROVEEDOR" : "PONER EN PROMOCIÓN / ROTAR YA"
    }));

    // 2. Crear el libro
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alertas Vencimiento");

    // 3. Formateo de columnas para que se vea ordenado al abrir
    const columnWidths = [
      { wch: 45 }, // Producto
      { wch: 20 }, // Ref
      { wch: 20 }, // Cat
      { wch: 25 }, // Fecha
      { wch: 20 }, // Stock
      { wch: 20 }, // Dias
      { wch: 20 }, // Estado
      { wch: 40 }  // Accion
    ];
    worksheet['!cols'] = columnWidths;

    // 4. Descarga
    XLSX.writeFile(workbook, `REPORTE_VENCIMIENTOS_PARA_CAMBIO_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-1000 pb-20 px-4">
      
      {/* AI Header Section */}
      <div className="relative overflow-hidden bg-slate-900 rounded-[48px] p-8 md:p-12 mb-12 border border-slate-800 shadow-2xl group">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-sky-500/10 border border-sky-500/20 rounded-full">
                    <span className="w-2 h-2 bg-sky-500 rounded-full animate-ping"></span>
                    <span className="text-[10px] font-medium text-sky-400 uppercase tracking-widest">Neural Engine Multi-Tenant v4.2</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tighter leading-none mb-2 italic">
                    Inteligencia <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-300 to-indigo-400 not-italic uppercase font-bold">Predictiva ERP</span>
                </h1>
                <p className="text-slate-400 font-medium text-sm md:text-md max-w-xl italic opacity-80">
                    Genere reportes profesionales de Excel con un solo clic. Datos estructurados para su departamento de compras.
                </p>
                <div className="flex flex-wrap gap-4 mt-6">
                    <button 
                      onClick={handleDownloadReport}
                      className="px-6 py-3 bg-white text-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-xl hover:bg-sky-50 hover:text-sky-700 active:scale-95 flex items-center gap-3 group"
                    >
                      <span className="group-hover:animate-bounce">📊</span> Reporte Full (.xlsx)
                    </button>

                    <button 
                      type="button"
                      onClick={() => sectionCantidadesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 flex items-center gap-2 group"
                    >
                      <span className="text-base group-hover:rotate-12 transition-transform">📈</span> Predicción Cantidades
                    </button>

                    <button 
                      type="button"
                      onClick={() => sectionVencimientosRef.current?.scrollIntoView({ behavior: 'smooth' })}
                      className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-700 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-emerald-600/20 hover:scale-105 active:scale-95 flex items-center gap-2 group"
                    >
                      <span className="text-base group-hover:animate-pulse transition-transform">📅</span> Alertas Vencimiento
                    </button>

                    <div className="px-5 py-3 bg-violet-400/10 backdrop-blur-sm border border-violet-400/20 rounded-2xl text-[9px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2 italic">
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse"></span> Neural Link Ready
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
                <div className="bg-white/5 backdrop-blur-md p-6 rounded-[32px] border border-white/10 text-center">
                    <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest block mb-1">Potencial de Venta</span>
                    <div className="text-indigo-300 font-medium text-xl">
                        {resumen ? formatCurrency(resumen.potencialIngresosProximoMes) : '$0'}
                    </div>
                </div>
                <div className="bg-emerald-500/10 backdrop-blur-md p-6 rounded-[32px] border border-emerald-500/20 text-center">
                    <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-widest block mb-1">Estado de Datos</span>
                    <div className="text-emerald-400 font-medium text-xl italic uppercase tracking-tighter">
                        Privado
                    </div>
                </div>
            </div>
        </div>
        
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:20px_20px]"></div>
      </div>

      {loading ? (
        <div className="py-40 text-center flex flex-col items-center gap-6">
            <div className="relative w-20 h-20">
                <div className="absolute inset-0 border-2 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-lg font-medium text-slate-900 tracking-tight uppercase italic opacity-60">Optimizando Reporte...</h2>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* NEW SECTION: IA PREDICTIVE ANALYSIS (EXPIRATION ALERTS) */}
          {proximosVencer.length > 0 && (
            <div ref={sectionVencimientosRef} className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 p-10 rounded-[48px] shadow-2xl relative overflow-hidden group scroll-mt-10">
               <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-indigo-500/20 transition-all duration-1000"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
               
               <div className="relative z-10 flex flex-col xl:flex-row gap-10">
                  <div className="xl:w-1/3 space-y-6">
                     <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-400/20 animate-pulse">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full"></span> IA & Análisis Predictivo
                     </span>
                     <h2 className="text-4xl font-black text-white leading-tight">Alertas de <span className="text-indigo-400">Vencimiento</span> Próximo</h2>
                     <p className="text-indigo-200/60 font-medium">Nuestro motor de análisis ha detectado productos que requieren rotación inmediata. Planifica promociones para evitar pérdidas de inventario.</p>
                     
                     <div className="grid grid-cols-2 gap-4 pt-4 text-center">
                        <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
                           <div className="text-3xl font-black text-white">{proximosVencer.length}</div>
                           <div className="text-[9px] text-indigo-300 uppercase font-black mt-1">Alertas Críticas</div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-3xl border border-white/10 backdrop-blur-sm">
                           <div className="text-3xl font-black text-white">{Math.min(...proximosVencer.map(p => p.dias_faltantes))}d</div>
                           <div className="text-[9px] text-indigo-300 uppercase font-black mt-1">Vencimiento más Cercano</div>
                        </div>
                     </div>

                     <button 
                        onClick={handleDownloadVencimientos}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-3 active:scale-95 italic"
                     >
                        <span>📥</span> Descargar Reporte para Cambios (.xlsx)
                     </button>
                  </div>

                  <div className="flex-1 space-y-3">
                     {proximosVencer.slice((currentPageVenc - 1) * itemsPerPageVenc, currentPageVenc * itemsPerPageVenc).map((p, idx) => (
                        <div key={idx} className="bg-white/5 p-5 rounded-[2rem] border border-white/10 flex items-center justify-between group/item hover:bg-white/10 transition-all">
                           <div className="flex items-center gap-6">
                              <div className="w-12 h-12 bg-indigo-600/30 rounded-2xl flex items-center justify-center text-xl text-indigo-300 border border-indigo-500/30">📅</div>
                              <div>
                                 <h4 className="text-white font-black uppercase tracking-tight text-sm">{p.nombre}</h4>
                                 <span className="text-indigo-300/40 text-[10px] font-bold block mt-0.5 uppercase tracking-widest">{p.referencia} • {p.categoria}</span>
                              </div>
                           </div>
                           <div className="flex items-center gap-8">
                              <div className="text-right">
                                 <span className="text-[9px] font-black text-white/40 uppercase block mb-1">Stock Disponible</span>
                                 <p className="text-white font-black text-lg">{p.cantidad} <span className="text-xs opacity-50 font-medium">UND</span></p>
                              </div>
                              <div className={`px-5 py-2 rounded-2xl flex flex-col items-center justify-center border ${
                                 p.dias_faltantes < 7 ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                              }`}>
                                 <span className="text-[9px] font-black uppercase mb-0.5">Vence en</span>
                                 <p className="text-xl font-black leading-none">{p.dias_faltantes} <span className="text-[10px]">días</span></p>
                              </div>
                           </div>
                        </div>
                     ))}

                     {/* Pagination Vencimientos */}
                     {proximosVencer.length > itemsPerPageVenc && (
                        <div className="flex items-center justify-center gap-4 pt-4">
                           <button 
                              disabled={currentPageVenc === 1}
                              onClick={() => setCurrentPageVenc(p => p - 1)}
                              className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all border border-white/10"
                           >
                              ←
                           </button>
                           <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                              Página {currentPageVenc} de {Math.ceil(proximosVencer.length / itemsPerPageVenc)}
                           </span>
                           <button 
                              disabled={currentPageVenc >= Math.ceil(proximosVencer.length / itemsPerPageVenc)}
                              onClick={() => setCurrentPageVenc(p => p + 1)}
                              className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white disabled:opacity-20 hover:bg-white/10 transition-all border border-white/10"
                           >
                              →
                           </button>
                        </div>
                     )}
                  </div>
               </div>
            </div>
          )}
          
          <div className="bg-white p-6 md:p-10 rounded-[48px] border border-slate-100 shadow-sm relative overflow-hidden group">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                <div className="space-y-1">
                    <h2 className="text-xl font-medium text-slate-900 tracking-tight flex items-center gap-3 italic">
                        <span className="w-1.5 h-6 bg-sky-500 rounded-full"></span> Análisis Macro de Rotación
                    </h2>
                    <p className="text-slate-400 font-medium text-[9px] uppercase tracking-widest pl-4 opacity-70">Tendencia de Unidades Vendidas</p>
                </div>
             </div>

             <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tendenciaGeneral}>
                    <defs>
                        <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPredict" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="mes" stroke="#94a3b8" fontSize={9} fontWeight={500} axisLine={false} tickLine={false} dy={10} />
                    <YAxis stroke="#94a3b8" fontSize={9} fontWeight={500} axisLine={false} tickLine={false} dx={-10} />
                    <Tooltip content={(props: any) => <CustomTooltip {...props} />} />
                    <Area type="monotone" dataKey="real" name="Histórico" stroke="#6366f1" strokeWidth={4} fill="url(#colorReal)" animationDuration={1500} />
                    <Area type="monotone" dataKey="proyectado" name="Predicción" stroke="#0ea5e9" strokeWidth={3} strokeDasharray="8 8" fill="url(#colorPredict)" animationDuration={2000} />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div ref={sectionCantidadesRef} className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-100 shadow-sm overflow-hidden scroll-mt-10">
            <div className="mb-10 space-y-2">
                <h2 className="text-2xl font-medium text-slate-900 tracking-tight italic">
                    Inteligencia de Abastecimiento (Pareto)
                </h2>
                <p className="text-slate-500 font-medium text-sm opacity-80">
                    Clasificamos tus productos mediante Análisis ABC para priorizar inversiones y capital.
                </p>
            </div>

            {rankingIA.length === 0 ? (
                <div className="py-24 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium uppercase tracking-widest text-[10px] italic">Datos insuficientes. Registra más ventas.</p>
                </div>
            ) : (
                <div className="overflow-x-auto -mx-8 md:-mx-12">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[9px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/50">
                                <th className="px-8 md:px-12 py-4">Producto / Categoria</th>
                                <th className="px-6 py-4 text-center">Proveedor Sugerido</th>
                                <th className="px-6 py-4 text-center">ABC</th>
                                <th className="px-6 py-4 text-center">Stock</th>
                                <th className="px-8 py-4 text-right">Demanda Proyectada</th>
                                <th className="px-8 md:px-12 py-4 text-right">Impacto Fin.</th>
                                <th className="px-8 md:px-12 py-4 text-right">Estado AI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rankingIA.slice((currentPageIA - 1) * itemsPerPageIA, currentPageIA * itemsPerPageIA).map((prod) => (
                                <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 md:px-12 py-4">
                                        <div className="font-medium text-slate-900 uppercase tracking-tight text-xs">{prod.nombre}</div>
                                        <div className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">{prod.categoria}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg inline-block max-w-[150px] truncate">
                                            {prod.proveedor_sugerido}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-medium uppercase tracking-widest ${
                                            prod.clase_abc.startsWith('A') ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                                            prod.clase_abc.startsWith('B') ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                            'bg-slate-50 text-slate-500 border border-slate-100'
                                        }`}>
                                            {prod.clase_abc}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className={`text-sm font-medium ${prod.stock_disponible < prod.proyeccion_demanda ? 'text-rose-500' : 'text-slate-900'}`}>
                                            {prod.stock_disponible}
                                        </div>
                                    </td>
                                    <td className="px-8 py-4 text-right font-medium text-indigo-700 text-sm">
                                        {prod.proyeccion_demanda} uds.
                                    </td>
                                    <td className="px-8 md:px-12 py-4 text-right font-medium text-slate-600 text-[11px]">
                                        {formatCurrency(prod.oportunidad_venta_usd)}
                                    </td>
                                    <td className="px-8 md:px-12 py-4 text-right">
                                        <div className={`inline-flex px-3 py-1 rounded-xl text-[8px] font-medium uppercase tracking-widest border ${
                                            prod.status.includes('REABASTECER') ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' :
                                            prod.status.includes('EXCESO') ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            prod.status.includes('MUERTO') ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                            'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        }`}>
                                            {prod.status}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination IA Pareto */}
                    {rankingIA.length > itemsPerPageIA && (
                        <div className="p-8 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                           <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                              Mostrando {((currentPageIA - 1) * itemsPerPageIA) + 1} - {Math.min(currentPageIA * itemsPerPageIA, rankingIA.length)} de {rankingIA.length} resultados
                           </div>
                           <div className="flex items-center gap-2">
                              <button 
                                 disabled={currentPageIA === 1}
                                 onClick={() => setCurrentPageIA(p => p - 1)}
                                 className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-600 hover:bg-indigo-600 hover:text-white disabled:opacity-50 transition-all shadow-sm"
                              >
                                 Anterior
                              </button>
                              <div className="flex gap-1">
                                 {Array.from({ length: Math.ceil(rankingIA.length / itemsPerPageIA) }).map((_, i) => (
                                    <button
                                       key={i}
                                       onClick={() => setCurrentPageIA(i + 1)}
                                       className={`w-8 h-8 rounded-xl text-[10px] font-bold transition-all ${
                                          currentPageIA === i + 1 
                                             ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                                             : 'bg-white text-slate-400 hover:bg-slate-100 border border-slate-100'
                                       }`}
                                    >
                                       {i + 1}
                                    </button>
                                 ))}
                              </div>
                              <button 
                                 disabled={currentPageIA >= Math.ceil(rankingIA.length / itemsPerPageIA)}
                                 onClick={() => setCurrentPageIA(p => p + 1)}
                                 className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold uppercase text-slate-600 hover:bg-indigo-600 hover:text-white disabled:opacity-50 transition-all shadow-sm"
                              >
                                 Siguiente
                              </button>
                           </div>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PrediccionesAI;
