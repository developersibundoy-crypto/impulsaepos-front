import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';

function Reportes() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [filtroCajero, setFiltroCajero] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroTipo, setFiltroTipo] = useState(""); // "" | "1" | "0"
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleHoy = () => {
    const d = new Date();
    const todayLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setStartDate(todayLocal);
    setEndDate(todayLocal);
  };

  const [categoriasTienda, setCategoriasTienda] = useState<string[]>([]);

  const fetchSoldCategories = () => {
    const params = new URLSearchParams();
    if (filtroCajero) params.append("cajeroId", filtroCajero);
    if (filtroTipo) params.append("es_servicio", filtroTipo);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    API.get(`/reportes/categorias-vendidas?${params.toString()}`).then(res => {
      const cats = res.data;
      setCategoriasTienda(cats);
      // Si la categoría seleccionada ya no tiene ventas en este rango/cajero, la reseteamos
      if (filtroCategoria && !cats.includes(filtroCategoria)) {
        setFiltroCategoria("");
      }
    }).catch(console.error);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    API.get("/cajeros").then(res => setCajeros(res.data)).catch(console.error);
    fetchSoldCategories();
  }, []);

  const [paginatedProducts, setPaginatedProducts] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const fetchDetailedReport = (page = 1) => {
    const params = new URLSearchParams();
    if (filtroCajero) params.append("cajeroId", filtroCajero);
    if (filtroCategoria) params.append("categoria", filtroCategoria);
    if (filtroTipo) params.append("es_servicio", filtroTipo);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    params.append("page", page.toString());
    params.append("limit", "10");

    API.get(`/reportes/productos-vendidos?${params.toString()}`)
      .then(res => {
        setPaginatedProducts(res.data.data);
        setTotalPages(res.data.last_page);
        setTotalItems(res.data.total);
        setCurrentPage(res.data.page);
      })
      .catch(console.error);
  };

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroCajero) params.append("cajeroId", filtroCajero);
    if (filtroCategoria) params.append("categoria", filtroCategoria);
    if (filtroTipo) params.append("es_servicio", filtroTipo);
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);

    API.get(`/reportes/dashboard?${params.toString()}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
    
    fetchDetailedReport(1);
    fetchSoldCategories();
  }, [filtroCajero, filtroCategoria, filtroTipo, startDate, endDate]);

  const handleExportVentasExcel = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroCajero) params.append("cajeroId", filtroCajero);
      if (filtroCategoria) params.append("categoria", filtroCategoria);
      if (filtroTipo) params.append("es_servicio", filtroTipo);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("limit", "5000"); // Obtenemos un lote grande para el reporte global

      const res = await API.get(`/reportes/productos-vendidos?${params.toString()}`);
      const allData = res.data.data || [];

      if (allData.length === 0) return alert("No hay datos para exportar.");

      // 1. Mapeo profesional de datos
      const excelData = allData.map((p: any) => ({
        "FECHA": new Date(p.fecha).toLocaleDateString(),
        "HORA": new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        "PRODUCTO / SERVICIO": p.producto,
        "CATEGORÍA": p.categoria || "N/A",
        "TIPO": p.es_servicio ? "⚡ SERVICIO" : "📦 PRODUCTO",
        "CLIENTE": p.cliente_id === 1 ? "MOSTRADOR" : (p.cliente || "GENERAL"),
        "CAJERO / ASESOR": p.cajero,
        "CANTIDAD": p.cantidad,
        "VENTA UNITARIA ($)": p.precio_unitario,
        "VENTA TOTAL ($)": p.subtotal,
        "COMISIÓN ($)": p.comision || 0,
        "UTILIDAD (GANANCIA) ($)": p.utilidad,
        "ESTADO": "CONFIRMADO"
      }));

      // 2. Crear Libro
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ventas Detalladas");

      // 3. Ajustar Columnas
      const columnWidths = [
        { wch: 15 }, // Fecha
        { wch: 12 }, // Hora
        { wch: 45 }, // Producto
        { wch: 20 }, // Categoria
        { wch: 15 }, // Tipo
        { wch: 25 }, // Cliente
        { wch: 20 }, // Cajero
        { wch: 10 }, // Cantidad
        { wch: 20 }, // Venta Unit
        { wch: 20 }, // Venta Total
        { wch: 18 }, // Comision
        { wch: 20 }, // Utilidad
        { wch: 15 }  // Estado
      ];
      worksheet['!cols'] = columnWidths;

      XLSX.writeFile(workbook, `REPORTE_VENTAS_DETALLADAS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Error generando reporte de ventas.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCajaExcel = () => {
    if (reportesCaja.length === 0) return alert("No hay datos de caja para exportar.");

    const excelData = reportesCaja.map(r => ({
      "ID SESIÓN": r.id,
      "CAJERO": r.username,
      "FECHA APERTURA": new Date(r.fecha_apertura).toLocaleString(),
      "FECHA CIERRE": r.fecha_cierre ? new Date(r.fecha_cierre).toLocaleString() : "ABIERTA",
      "EFECTIVO RECAUDADO": r.total_efectivo || 0,
      "BASE INICIAL": r.base_caja,
      "DIGITAL / APPS": r.total_transferencia || 0,
      "INGRESOS MANUALES": r.total_ingresos || 0,
      "SALIDAS MANUALES": r.total_salidas || 0,
      "DINERO REPORTADO": r.dinero_reportado,
      "DIFERENCIA (FALTANTE/SOBRANTE)": r.diferencia,
      "ESTADO CIERRE": r.estado,
      "BALANCE FINAL EN CAJA": (r.total_efectivo || 0) + r.base_caja + (r.total_ingresos || 0) - (r.total_salidas || 0)
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Control de Caja");

    const columnWidths = [
      { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 25 },
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 25 }
    ];
    worksheet['!cols'] = columnWidths;

    XLSX.writeFile(workbook, `REPORTE_CONTROL_CAJA_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const [activeTab, setActiveTab] = useState<"general" | "caja">("general");

  // Caja Report States
  const [reportesCaja, setReportesCaja] = useState<any[]>([]);
  const [loadingCaja, setLoadingCaja] = useState(false);
  const [filtrosCaja, setFiltrosCaja] = useState({ desde: '', hasta: '', usuarioId: '', estado: '' });
  const [expandedCajaRow, setExpandedCajaRow] = useState<number | null>(null);
  const [movimientosDetalle, setMovimientosDetalle] = useState<any[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  const toggleDetails = async (sesionId: number) => {
    if (expandedCajaRow === sesionId) {
      setExpandedCajaRow(null);
      return;
    }
    
    setExpandedCajaRow(sesionId);
    setLoadingMovs(true);
    try {
      const res = await API.get(`/caja/movimientos/${sesionId}`);
      setMovimientosDetalle(res.data);
    } catch (error) {
      console.error(error);
      setMovimientosDetalle([]);
    } finally {
      setLoadingMovs(false);
    }
  };

  const fetchReportesCaja = async () => {
    setLoadingCaja(true);
    try {
      let url = '/caja/reportes?';
      if (filtrosCaja.desde) url += `desde=${filtrosCaja.desde}&`;
      if (filtrosCaja.hasta) url += `hasta=${filtrosCaja.hasta}&`;
      if (filtrosCaja.usuarioId) url += `usuario_id=${filtrosCaja.usuarioId}&`;
      if (filtrosCaja.estado) url += `estado=${filtrosCaja.estado}&`;
      const res = await API.get(url);
      setReportesCaja(res.data);
    } catch (error) {
      console.error("Error fetching reportes caja:", error);
    } finally {
      setLoadingCaja(false);
    }
  };

  useEffect(() => {
    if (activeTab === "caja") {
      fetchReportesCaja();
    }
  }, [activeTab, filtrosCaja]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      {/* Tab Switcher */}
      <div className="flex gap-4 mb-8 no-print">
        <button 
          onClick={() => setActiveTab("general")}
          className={`px-8 py-3 rounded-2xl font-medium text-xs uppercase tracking-widest transition-all ${activeTab === "general" ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
        >
          📈 Analítica General
        </button>
        <button 
          onClick={() => setActiveTab("caja")}
          className={`px-8 py-3 rounded-2xl font-medium text-xs uppercase tracking-widest transition-all ${activeTab === "caja" ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
        >
          💰 Control de Caja
        </button>
      </div>

      {activeTab === "general" ? (
        <>
          {/* Header & Filters Section */}
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-12 pb-8 border-b border-slate-200">
            <div className="space-y-1">
              <h1 className="text-4xl tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
                Inteligencia de Negocios
              </h1>
              <p className="text-slate-500 font-medium text-lg">Reportes financieros avanzados y análisis de recaudación en tiempo real.</p>
            </div>

            <div className="w-full xl:w-auto bg-white p-6 rounded-[32px] border border-slate-200 shadow-xl shadow-slate-100/50 flex flex-col md:flex-row gap-6 no-print">
              <div className="flex flex-wrap md:flex-nowrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Rango de Fechas</label>
                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent px-3 py-2 text-sm outline-none text-slate-700" />
                    <span className="text-slate-300">→</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent px-3 py-2 text-sm outline-none text-slate-700" />
                    <button onClick={handleHoy} className="px-4 py-2 bg-white text-indigo-600 text-[10px] rounded-xl shadow-sm border border-slate-100 hover:bg-indigo-50 transition-colors uppercase">Hoy</button>
                  </div>
                </div>
                
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Cajero</label>
                  <select value={filtroCajero} onChange={e => setFiltroCajero(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-700 focus:bg-white outline-none">
                    <option value="">TODOS LOS CAJEROS</option>
                    {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>

                <div className="space-y-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                  <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-700 focus:bg-white outline-none">
                    <option value="">TODAS LAS CATEGORÍAS</option>
                    {categoriasTienda.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div className="space-y-1 flex-1 min-w-[150px]">
                  <label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Clasificación</label>
                  <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-700 focus:bg-white outline-none">
                    <option value="">📦 TODOS LOS ÍTEMS</option>

                    <option value="0">🛒 SOLO PRODUCTOS</option>
                    <option value="1">⚡ SOLO SERVICIOS</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {loading || !data ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
              <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-xs">Extrayendo métricas millonarias...</p>
            </div>
          ) : (
            <div className="space-y-12">
          
          {/* Main Metric Cards - Executive Suite */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-rose-500 mb-2 block">IVA Recaudado</span>
                  <div className="text-3xl text-rose-600 tracking-tighter truncate">{formatCOP(data.general.total_iva || 0)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] uppercase italic">Impuestos Indirectos</span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 select-none">🏦</div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2 block">Ventas Netas (Sin IVA)</span>
                  <div className="text-3xl text-slate-900 tracking-tighter truncate">{formatCOP(data.general.total_ingresos)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] uppercase italic">Base Grabable</span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 select-none">💰</div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-500 mb-2 block">Utilidad Neta</span>
                  <div className="text-3xl text-emerald-600 tracking-tighter truncate">{formatCOP(data.general.total_utilidad_global || 0)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] uppercase italic">
                      Margen: {data.general.total_ingresos > 0 ? ((data.general.total_utilidad_global / data.general.total_ingresos) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 select-none">📈</div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-sky-500 mb-2 block">Transacciones</span>
                  <div className="text-3xl text-sky-600 tracking-tighter truncate">{data.general.total_ventas}</div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 italic">
                    Tickets emitidos con éxito
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 select-none">🧾</div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500 mb-2 block">Ticket Promedio</span>
                  <div className="text-3xl text-amber-600 tracking-tighter truncate">
                    {formatCOP(data.general.total_ventas > 0 ? (data.general.total_ingresos / data.general.total_ventas) : 0)}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 italic">
                    Gasto medio por cliente
                  </div>
                </div>
                <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700 select-none">⚖️</div>
            </div>

          </div>

          {/* Section Removed - Moved to AI Predictions */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
            {/* Chart Section */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-shadow duration-500">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl text-slate-900 tracking-tight flex items-center gap-2">
                  <span className="w-2 h-6 bg-emerald-500 rounded-full"></span> Rendimiento por Categoría
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 tracking-widest bg-slate-50 px-4 py-2 rounded-full uppercase border border-slate-100">Ventas en Volúmen COP</div>
              </div>
              <div className="h-[400px] w-full">
                {data.ingresosCategorias.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 font-normal italic">
                    Sin ventas registradas bajo estos filtros.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.ingresosCategorias.map((c: any) => ({
                        categoria: c.categoria,
                        recaudado: Number(c.total_recaudado) || 0,
                        utilidad: Number(c.total_utilidad) || 0
                      })).filter((c: any) => c.recaudado > 0)}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="categoria" 
                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <RechartsTooltip 
                        cursor={{ fill: '#f8fafc' }}
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const dataPoint = payload[0].payload;
                            return (
                              <div className="bg-white p-5 shadow-2xl rounded-3xl border border-slate-100 min-w-[220px]">
                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">{dataPoint.categoria}</p>
                                <div className="space-y-3">
                                  <div>
                                    <span className="text-[9px] font-medium text-slate-400 uppercase block">Venta Bruta</span>
                                    <p className="text-slate-900 font-medium text-lg">{formatCOP(dataPoint.recaudado)}</p>
                                  </div>
                                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                                    <span className="text-[9px] font-medium text-emerald-600 uppercase block">Utilidad Real (Ganancia)</span>
                                    <p className="text-emerald-700 font-medium text-lg">{formatCOP(dataPoint.utilidad)}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="recaudado" radius={[12, 12, 0, 0]} barSize={50}>
                        {data.ingresosCategorias.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Top Products Card */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-shadow duration-500">
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <h3 className="text-2xl text-indigo-600 tracking-tight flex items-center gap-3">
                      <span className="w-2.5 h-8 bg-indigo-600 rounded-full"></span> Top Best Sellers
                    </h3>
                    <p className="text-slate-400 text-sm font-medium ml-5">Análisis de productos con mayor frecuencia de salida.</p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 px-4 py-2 rounded-2xl border border-indigo-100 shadow-sm shadow-indigo-100/20">Top 5 Estrellas</span>
                </div>
                
                <div className="flex-1 overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[600px]">
                    <thead>
                      <tr className="text-[11px] text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                        <th className="pb-4 pl-4">Producto Estrella</th>
                        <th className="pb-4 text-center">Frecuencia</th>
                        <th className="pb-4 text-right pr-4">Nivel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.topProductos.length === 0 ? (
                        <tr><td colSpan={3} className="py-24 text-center font-normal text-slate-300 italic uppercase text-xs tracking-widest">Sin registro de movimientos.</td></tr>
                      ) : (
                        data.topProductos.map((p: any, i: number) => (
                          <tr key={i} className="group hover:bg-slate-50/80 transition-all duration-300">
                            <td className="py-4 pl-4">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors duration-500">📦</div>
                                  <div className="flex flex-col text-left">
                                    <span className="text-base text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight uppercase leading-tight font-normal">{p.nombre}</span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-mono mt-1">{p.categoria || "S / CAT"}</span>
                                  </div>
                               </div>
                            </td>
                            <td className="py-4 text-center">
                               <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl tracking-tighter border border-indigo-100/50">
                                  <span className="text-lg font-medium">{p.total_vendido}</span>
                                  <span className="text-[10px] opacity-60 font-medium">UNIDADES</span>
                                </div>
                            </td>
                            <td className="py-4 text-right pr-4">
                               <div className="flex flex-col items-end">
                                  <div className="px-3 py-1 bg-slate-900 text-white rounded-xl text-[10px] tracking-widest uppercase shadow-lg shadow-slate-200 group-hover:bg-indigo-900 transition-colors font-medium italic">Rank {i+1}</div>
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

          <div className="space-y-12">
            
            {/* Cajero Ranking Card Mejorado */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col h-full hover:shadow-xl transition-shadow duration-500">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-2xl text-slate-900 tracking-tight flex items-center gap-3">
                    <span className="w-2.5 h-8 bg-amber-500 rounded-full"></span> Rendimiento de Personal
                  </h3>
                  <p className="text-slate-400 text-sm font-medium ml-5">Productividad y ventas por cada cajero.</p>
                </div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-amber-600 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100/50 shadow-sm shadow-amber-100/20">Clasificación de Ventas</span>
              </div>
              
              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="text-[11px] text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                      <th className="pb-4 pl-4">Cajero / Asesor</th>
                      <th className="pb-4 text-center">Tickets</th>
                      <th className="pb-4 text-center">Ticket Promedio</th>
                      <th className="pb-4 text-center">Utilidad Generada</th>
                      <th className="pb-4 text-right pr-4">Total Recaudado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.rendimientoCajeros.length === 0 ? (
                      <tr><td colSpan={5} className="py-24 text-center font-normal text-slate-300 italic uppercase text-xs tracking-widest">Sin datos suficientes para proyectar.</td></tr>
                    ) : (
                      data.rendimientoCajeros.map((c: any, i: number) => (
                        <tr key={i} className="group hover:bg-slate-50/80 transition-all duration-300">
                          <td className="py-4 pl-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-md transition-transform group-hover:scale-110 duration-500 ${
                                    i === 0 ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700 ring-2 ring-amber-50' : 
                                    i === 1 ? 'bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 ring-2 ring-slate-50' : 
                                    'bg-gradient-to-br from-orange-50 to-orange-100 text-orange-700 ring-2 ring-orange-50'
                                }`}>
                                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-base text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight font-normal">{c.nombre || "Asesor General"}</span>
                                  <span className="text-[10px] text-slate-400 uppercase tracking-widest">Auditoría de Venta</span>
                                </div>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            <div className="inline-flex flex-col items-center">
                               <span className="text-lg text-slate-900 tracking-tighter leading-none font-medium">{c.cantidad_facturas}</span>
                               <span className="text-[9px] text-slate-400 uppercase mt-1 tracking-tighter">Tickets</span>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                             <div className="inline-flex flex-col items-center">
                               <span className="text-base text-indigo-600 tracking-tighter leading-none font-normal">
                                  {formatCOP(c.cantidad_facturas > 0 ? (c.dinero_recaudado / c.cantidad_facturas) : 0)}
                               </span>
                               <span className="text-[9px] text-indigo-400 uppercase mt-1 tracking-tighter">Promedio</span>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            <div className="inline-block px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100/50">
                               <span className="text-base tracking-tighter italic font-medium">{formatCOP(c.total_utilidad || 0)}</span>
                            </div>
                          </td>
                          <td className="py-4 text-right pr-4">
                            <div className="text-xl text-slate-900 tracking-tighter font-medium">{formatCOP(c.dinero_recaudado)}</div>
                            <div className="flex gap-2 justify-end mt-2">
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl">
                                   <span className="text-[8px] text-slate-400 uppercase tracking-widest">Efectivo:</span>
                                   <span className="text-[10px] text-slate-700 font-normal">{formatCOP(c.dinero_efectivo)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-xl">
                                   <span className="text-[8px] text-slate-400 uppercase tracking-widest">Digital:</span>
                                   <span className="text-[10px] text-slate-700 font-normal">{formatCOP(c.dinero_transferencia)}</span>
                                </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DETALLE DE PRODUCTOS VENDIDOS CON PAGINACIÓN */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in duration-500">
               <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                  <div className="space-y-1">
                    <h3 className="text-2xl text-slate-950 font-medium tracking-tighter flex items-center gap-3 uppercase italic">
                      <span className="w-3 h-8 bg-indigo-600 rounded-full"></span> Detalle de Ventas por Producto
                    </h3>
                    <p className="text-slate-400 text-xs font-normal uppercase tracking-widest ml-6">Auditoría completa de movimientos de inventario ({totalItems} registros).</p>
                  </div>
                  <button 
                    onClick={handleExportVentasExcel}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-2xl font-medium text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 flex items-center gap-3 italic active:scale-95"
                  >
                    <span>📊</span> Descargar Reporte Ventas (.xlsx)
                  </button>
               </div>

               <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[800px]">
                    <thead>
                      <tr className="text-[10px] text-slate-400 uppercase tracking-[0.3em] border-b border-slate-100 font-medium italic">
                        <th className="pb-4 pl-4">Fecha / Hora</th>
                        <th className="pb-4">Producto</th>
                        <th className="pb-4">Cliente</th>
                        <th className="pb-4">Cajero</th>
                        <th className="pb-4 text-center">Cantidad</th>
                        <th className="pb-4 text-center">Comisión</th>
                        <th className="pb-4 text-right pr-4">Venta Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedProducts.length === 0 ? (
                        <tr><td colSpan={6} className="py-20 text-center text-slate-300 font-medium uppercase italic tracking-widest">Sin movimientos registrados.</td></tr>
                      ) : (
                        paginatedProducts.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 pl-4">
                               <div className="flex flex-col">
                                  <span className="text-xs text-slate-700 font-normal">{new Date(p.fecha).toLocaleDateString()}</span>
                                  <span className="text-[9px] text-slate-400 uppercase font-medium italic">{new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                               </div>
                            </td>
                            <td className="py-4">
                               <div className="flex flex-col">
                                  <span className="text-sm text-slate-900 font-normal uppercase tracking-tight leading-none">{p.producto}</span>
                                  <span className="text-[10px] text-indigo-500 font-medium uppercase tracking-widest mt-1 italic">{p.categoria}</span>
                               </div>
                            </td>
                            <td className="py-4">
                               <div className="flex flex-col">
                                  <span className={`text-xs font-normal uppercase ${p.cliente_id === 1 ? 'text-slate-300 italic' : 'text-slate-700'}`}>
                                    {p.cliente_id === 1 ? "Fca. General" : (p.cliente || "Consumidor")}
                                  </span>
                               </div>
                            </td>
                            <td className="py-4">
                               <span className="text-xs text-slate-500 font-normal uppercase italic">{p.cajero}</span>
                            </td>
                            <td className="py-4 text-center">
                               <span className="px-3 py-1 bg-slate-100 text-slate-900 rounded-lg text-sm font-medium italic">{p.cantidad}</span>
                            </td>
                            <td className="py-4 text-center">
                               <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold italic border border-amber-100">{formatCOP(p.comision || 0)}</span>
                            </td>
                            <td className="py-4 text-right pr-4">
                               <div className="flex flex-col items-end">
                                  <span className="text-sm text-slate-950 font-medium tracking-tighter">{formatCOP(p.subtotal)}</span>
                                  <span className="text-[9px] text-emerald-600 font-medium italic uppercase">UT: {formatCOP(p.utilidad)}</span>
                               </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
               </div>

               {/* Pagination Controls */}
               {totalPages > 1 && (
                 <div className="mt-8 flex items-center justify-between bg-slate-50 p-4 rounded-3xl border border-slate-100 no-print">
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => fetchDetailedReport(currentPage - 1)}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-400 rounded-2xl font-medium text-[10px] uppercase tracking-widest hover:text-indigo-600 hover:shadow-xl transition-all disabled:opacity-30 disabled:hover:shadow-none italic active:scale-95"
                    >
                      ← Anterior
                    </button>
                    <div className="text-[10px] font-medium text-slate-900 uppercase tracking-[0.4em] italic bg-white px-8 py-3 rounded-full border border-slate-100 shadow-sm shadow-slate-200/50">
                       Página {currentPage} de {totalPages}
                    </div>
                    <button 
                      disabled={currentPage === totalPages}
                      onClick={() => fetchDetailedReport(currentPage + 1)}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-400 rounded-2xl font-medium text-[10px] uppercase tracking-widest hover:text-indigo-600 hover:shadow-xl transition-all disabled:opacity-30 disabled:hover:shadow-none italic active:scale-95"
                    >
                      Siguiente →
                    </button>
                 </div>
               )}
            </div>

          </div>
        </div>
      )}
      </>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-[40px] shadow-sm border border-slate-200">
            <div>
              <h2 className="text-3xl font-medium text-slate-900 tracking-tighter uppercase italic">Control de Caja</h2>
              <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mt-1">Historial ejecutivo de aperturas y cierres</p>
            </div>
            
            <div className="flex flex-wrap gap-3 no-print">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">Cajero</label>
                <select 
                  value={filtrosCaja.usuarioId}
                  onChange={(e) => setFiltrosCaja({...filtrosCaja, usuarioId: e.target.value})}
                  className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:bg-white outline-none transition-all shadow-inner uppercase"
                >
                  <option value="">TODOS</option>
                  {cajeros.filter(c => c.usuario_id).map(c => (
                    <option key={c.usuario_id} value={c.usuario_id}>{c.username || c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                <select 
                  value={filtrosCaja.estado}
                  onChange={(e) => setFiltrosCaja({...filtrosCaja, estado: e.target.value})}
                  className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:bg-white outline-none transition-all shadow-inner"
                >
                  <option value="">TODOS</option>
                  <option value="Abierta">ABIERTA</option>
                  <option value="Cerrada">CERRADA</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">Desde</label>
                <input 
                  type="date" 
                  value={filtrosCaja.desde}
                  onChange={(e) => setFiltrosCaja({...filtrosCaja, desde: e.target.value})}
                  className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:bg-white outline-none transition-all shadow-inner"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-normal text-slate-400 uppercase tracking-widest ml-1">Hasta</label>
                <input 
                  type="date" 
                  value={filtrosCaja.hasta}
                  onChange={(e) => setFiltrosCaja({...filtrosCaja, hasta: e.target.value})}
                  className="px-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium focus:bg-white outline-none transition-all shadow-inner"
                />
              </div>

              <button 
                onClick={handleExportCajaExcel}
                className="self-end px-6 py-3 bg-emerald-600 text-white rounded-2xl font-medium text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 flex items-center gap-3 active:scale-95 italic no-print"
              >
                <span>📥</span> Exportar Caja (.xlsx)
              </button>
            </div>
          </div>

          {loadingCaja ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-400">Recuperando registros históricos...</p>
            </div>
          ) : (
            <div className="bg-white rounded-[40px] shadow-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 italic">
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest">Cajero</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest">Apertura / Cierre</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Efectivo (+Base)</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">App / Digital</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Ingresos (+)</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Salidas (-)</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Reportado</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-right">Diferencia</th>
                      <th className="px-6 py-5 text-[10px] font-medium text-slate-400 uppercase tracking-widest text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reportesCaja.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-8 py-32 text-center text-slate-300 font-normal uppercase italic text-xs tracking-widest">No se encontraron registros de caja en este periodo.</td>
                      </tr>
                    ) : (
                      Object.entries(reportesCaja.reduce((acc: any, curr: any) => {
                        const user = curr.username || 'General';
                        if (!acc[user]) acc[user] = { sessions: [], totals: { efectivo: 0, base: 0, digital: 0, ingresos: 0, salidas: 0, reportado: 0, diferencia: 0 } };
                        acc[user].sessions.push(curr);
                        acc[user].totals.efectivo += parseFloat(curr.total_efectivo || 0);
                        acc[user].totals.base += parseFloat(curr.base_caja || 0);
                        acc[user].totals.digital += parseFloat(curr.total_transferencia || 0);
                        acc[user].totals.ingresos += parseFloat(curr.total_ingresos || 0);
                        acc[user].totals.salidas += parseFloat(curr.total_salidas || 0);
                        acc[user].totals.reportado += parseFloat(curr.dinero_reportado || 0);
                        acc[user].totals.diferencia += parseFloat(curr.diferencia || 0);
                        return acc;
                      }, {})).map(([username, group]: [string, any]) => (
                        <React.Fragment key={username}>
                          {/* User Header Row */}
                          <tr className="bg-slate-100/50">
                            <td colSpan={9} className="px-6 py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Cajero:</span>
                                  <span className="text-sm font-black text-slate-900 uppercase italic">{username}</span>
                                  <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-lg text-[8px] font-bold uppercase ml-2">{group.sessions.length} Turnos</span>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">Total Recaudado (Ef + Base)</span>
                                    <span className="text-xs font-black text-indigo-600">{formatCOP(group.totals.efectivo + group.totals.base)}</span>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] text-slate-400 uppercase font-bold">Total Diferencia</span>
                                    <span className={`text-xs font-black ${group.totals.diferencia < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCOP(group.totals.diferencia)}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Sessions for this user */}
                          {group.sessions.map((r: any) => (
                            <React.Fragment key={r.id}>
                              <tr 
                                onClick={() => toggleDetails(r.id)}
                                className="hover:bg-slate-50/30 transition-all duration-300 group cursor-pointer"
                              >
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-medium text-[10px] shadow-sm group-hover:scale-110 transition-transform">
                                      #{r.id}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-medium text-slate-600 uppercase tracking-tight italic">Sesión de Caja</span>
                                      <span className="text-[8px] text-slate-400 uppercase font-normal tracking-widest">Audit ID</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex flex-col gap-1">
                                     <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-medium text-emerald-600 uppercase">A</span>
                                        <span className="text-[11px] font-medium text-slate-900 uppercase tracking-tighter">{new Date(r.fecha_apertura).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                     </div>
                                     {r.fecha_cierre && (
                                       <div className="flex items-center gap-2">
                                          <span className="text-[9px] font-medium text-rose-600 uppercase">C</span>
                                          <span className="text-[11px] font-medium text-slate-900 uppercase tracking-tighter">{new Date(r.fecha_cierre).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                       </div>
                                     )}
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <div className="flex flex-col">
                                     <span className="text-xs font-medium text-slate-900">{formatCOP(r.total_efectivo || 0)}</span>
                                     <span className="text-[8px] text-slate-400 font-normal uppercase">Base: {formatCOP(r.base_caja)}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">{formatCOP(r.total_transferencia || 0)}</span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <span className="text-xs font-medium text-emerald-600">+{formatCOP(r.total_ingresos || 0)}</span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                   <span className="text-xs font-medium text-rose-600">-{formatCOP(r.total_salidas || 0)}</span>
                                </td>
                                <td className="px-6 py-5 text-sm font-medium text-slate-900 text-right tracking-tight">
                                  {formatCOP(r.dinero_reportado)}
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-medium text-[10px] italic ${r.diferencia < 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : r.diferencia > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                    {formatCOP(r.diferencia)}
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className={`px-3 py-1.5 rounded-xl text-[8px] font-medium uppercase tracking-widest border ${r.estado === 'Abierta' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 shadow-sm' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                    {r.estado} {expandedCajaRow === r.id ? '▲' : '▼'}
                                  </span>
                                </td>
                              </tr>

                              {expandedCajaRow === r.id && (
                                <tr className="bg-slate-50/50">
                                  <td colSpan={9} className="px-10 py-6">
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-top duration-300">
                                      <div className="bg-slate-900 px-6 py-3 flex justify-between items-center">
                                        <h4 className="text-[10px] font-medium text-white uppercase tracking-widest">Movimientos de Caja Manuales</h4>
                                        <span className="text-[9px] text-slate-400 font-normal uppercase italic">Detalle Auditado</span>
                                      </div>
                                      
                                      {loadingMovs ? (
                                        <div className="p-10 text-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div></div>
                                      ) : movimientosDetalle.length === 0 ? (
                                        <div className="p-10 text-center text-xs text-slate-400 font-normal uppercase italic tracking-widest">No se registraron movimientos manuales en este turno.</div>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left">
                                            <thead>
                                              <tr className="text-[9px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                                <th className="px-6 py-4">Tipo</th>
                                                <th className="px-6 py-4">Descripción / Motivo</th>
                                                <th className="px-6 py-4">Hora</th>
                                                <th className="px-6 py-4 text-right">Monto</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                              {movimientosDetalle.map((m: any) => (
                                                <tr key={m.id}>
                                                  <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-lg text-[8px] font-medium uppercase ${m.tipo === 'Ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                      {m.tipo === 'Ingreso' ? '📥 Entra' : '📤 Sale'}
                                                    </span>
                                                  </td>
                                                  <td className="px-6 py-4 text-[11px] font-medium text-slate-600">{m.descripcion}</td>
                                                  <td className="px-6 py-4 text-[10px] text-slate-400 font-normal uppercase">{new Date(m.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                                                  <td className={`px-6 py-4 text-xs font-medium text-right ${m.tipo === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {m.tipo === 'Ingreso' ? '+' : '-'}{formatCOP(m.monto)}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


export default Reportes;
