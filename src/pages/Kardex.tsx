import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatDateTime, formatCOP } from "../utils/format";

function Kardex() {
  const [kardex, setKardex] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tipo, setTipo] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  useEffect(() => {
    API.get("/productos").then(res => {
        const dataArr = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setProductos(dataArr);
    }).catch(console.error);
    fetchKardex();
  }, []);

  const fetchKardex = (prodId?: number) => {
    setLoading(true);
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (tipo) params.tipo = tipo;
    if (prodId || selectedProduct?.id) params.productoId = prodId || selectedProduct?.id;

    API.get("/kardex", { params })
      .then(res => {
        setKardex(Array.isArray(res.data) ? res.data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchKardex();
  }, [startDate, endDate, tipo, selectedProduct]);

  const filteredKardex = (Array.isArray(kardex) ? kardex : []).filter(k => 
    (k.producto_nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (k.codigo_barras || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (k.referencia || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoEstilo = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'SALIDA': return 'bg-rose-50 text-rose-600 border-rose-100';
      case 'SERVICIO': return 'bg-sky-50 text-sky-600 border-sky-100';
      case 'AJUSTE': return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'ELIMINACIÓN': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const handleProductSelect = (id: string) => {
    if (!id) {
        setSelectedProduct(null);
        return;
    }
    const prod = productos.find(p => p.id.toString() === id);
    setSelectedProduct(prod);
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      {/* Header & Description */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-slate-100">
        <div className="space-y-1">
          <h1 className="text-4xl tracking-tight text-slate-900 flex items-center gap-4">
            <span className="w-3 h-10 bg-indigo-500 rounded-full"></span>
            Kardex de Inventario
          </h1>
          <p className="text-slate-500 text-lg italic ml-7 text-indigo-600/60">Trazabilidad absoluta y auditoría de movimientos de stock.</p>
        </div>
        
        {selectedProduct && (
          <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-6 py-4 rounded-[24px] shadow-sm flex items-center gap-6 animate-in slide-in-from-right-8 duration-500">
             <div className="text-center">
                <p className="text-[9px] uppercase opacity-70 tracking-widest">Stock Crítico</p>
                <p className="text-xl">{selectedProduct.cantidad}</p>
             </div>
             <div className="w-px h-8 bg-indigo-200"></div>
             <div>
                <p className="text-[9px] uppercase opacity-70 tracking-widest">Producto Seleccionado</p>
                <p className="text-sm uppercase truncate max-w-[200px]">{selectedProduct.nombre}</p>
             </div>
             <button 
               onClick={() => setSelectedProduct(null)}
               className="bg-indigo-100 hover:bg-indigo-200 p-2 rounded-xl transition-all"
             >
               ✕
             </button>
          </div>
        )}
      </div>

      {/* Advanced Filters Section */}
      <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-xl shadow-slate-100/50 mb-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end relative overflow-hidden">
        
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Filtro Rápido (Nombre/SKU)</label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:scale-110 transition-transform">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar en resultados..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-indigo-600 uppercase tracking-widest ml-1 bg-indigo-50 px-2 py-0.5 rounded-md w-fit mb-1">🔍 Auditoría por Producto Individual</label>
          <select 
            value={selectedProduct?.id || ""} 
            onChange={e => handleProductSelect(e.target.value)}
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none appearance-none transition-all cursor-pointer"
          >
            <option value="">TODOS LOS PRODUCTOS</option>
            {(Array.isArray(productos) ? productos : []).map(p => (
              <option key={p.id} value={p.id}>{p.nombre.toUpperCase()} {p.referencia ? `(${p.referencia})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between ml-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-widest">Intervalo Temporal</label>
            <button 
              onClick={() => {
                const now = new Date();
                const offset = now.getTimezoneOffset() * 60000;
                const localISODate = new Date(now.getTime() - offset).toISOString().split('T')[0];
                setStartDate(localISODate);
                setEndDate(localISODate);
              }}
              className="text-[9px] text-indigo-600 hover:underline"
            >
              HOY
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent px-3 py-2 text-xs outline-none text-slate-700" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent px-3 py-2 text-xs outline-none text-slate-700" />
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-widest ml-1">Cat. Movimiento</label>
            <select 
              value={tipo} 
              onChange={e => setTipo(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 focus:bg-white outline-none appearance-none cursor-pointer"
            >
              <option value="">FILTRAR TIPO</option>
              <option value="ENTRADA">📥 ENTRADA</option>
              <option value="SALIDA">📤 SALIDA</option>
              <option value="SERVICIO">🛠️ SERVICIO</option>
              <option value="AJUSTE">⚙️ AJUSTE</option>
              <option value="ELIMINACIÓN">🗑️ ELIMINACIÓN</option>
            </select>
          </div>
          <button 
              onClick={() => fetchKardex()}
              className="p-4 bg-slate-100 text-slate-600 rounded-2xl text-xs hover:bg-slate-200 transition-all active:scale-95 shadow-sm"
              title="Actualizar Datos"
          >
              🔄
          </button>
        </div>
      </div>

      {/* Data Visualization Table */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="py-3 px-8 text-[10px] text-slate-400 uppercase tracking-[0.25em]">Fecha Exacta</th>
                <th className="py-3 px-4 text-[10px] text-slate-400 uppercase tracking-[0.25em]">Detalle Producto</th>
                <th className="py-3 px-4 text-center text-[10px] text-slate-400 uppercase tracking-[0.25em]">Operación</th>
                <th className="py-3 px-4 text-center text-[10px] text-slate-400 uppercase tracking-[0.25em]">Antes</th>
                <th className="py-3 px-4 text-center text-[10px] text-slate-400 uppercase tracking-[0.25em]">Impacto</th>
                <th className="py-3 px-4 text-center text-[10px] text-slate-400 uppercase tracking-[0.25em]">Resultado</th>
                <th className="py-3 px-8 text-[10px] text-slate-400 uppercase tracking-[0.25em]">Doc / Auditoría</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-32 text-center">
                    <div className="inline-block w-12 h-12 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="mt-6 text-slate-400 uppercase text-[10px] tracking-[0.2em] animate-pulse">Analizando Registros del Servidor...</p>
                  </td>
                </tr>
              ) : filteredKardex.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-32 text-center text-slate-300 tracking-widest uppercase text-xs italic opacity-40">No se detectaron movimientos en el período.</td>
                </tr>
              ) : (
                filteredKardex.map((k, i) => (
                  <tr key={i} className="group hover:bg-slate-50/50 transition-all duration-300">
                    <td className="py-3 px-8 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-900 mb-0.5">{formatDateTime(k.fecha).split(' ')[0]}</span>
                        <span className="text-[11px] text-slate-400 uppercase font-mono">{formatDateTime(k.fecha).split(' ')[1]} {formatDateTime(k.fecha).split(' ')[2]}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col max-w-[200px]">
                        <span className="text-[12px] text-slate-800 uppercase leading-tight truncate">{k.producto_nombre}</span>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded border border-slate-200 uppercase tracking-tighter">{k.codigo_barras || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest border shadow-sm ${getTipoEstilo(k.tipo_movimiento)}`}>
                        {k.tipo_movimiento}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-slate-300 italic">
                      {k.cantidad_antes}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xl tracking-tighter ${
                        k.tipo_movimiento === 'ENTRADA' || k.tipo_movimiento === 'SERVICIO' ? 'text-emerald-600' : 
                        k.tipo_movimiento === 'SALIDA' ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                        {k.tipo_movimiento === 'SALIDA' ? '-' : '+'}{k.cantidad_modificada}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="inline-block px-4 py-2 bg-slate-100 text-slate-800 rounded-xl text-[13px] shadow-sm">
                        {k.cantidad_despues}
                      </div>
                    </td>
                    <td className="py-3 px-8">
                       <div className="flex flex-col gap-1.5 min-w-[200px]">
                          <span className="text-[11px] text-slate-700 italic leading-tight group-hover:text-indigo-600 transition-colors">"{k.motivo || 'Operación Manual'}"</span>
                          <div className="flex flex-wrap gap-2 items-center">
                            {k.referencia && (
                              <span className="text-[9px] text-indigo-500 bg-indigo-50/50 px-2 py-0.5 rounded-lg">📄 REF: {k.referencia}</span>
                            )}
                            <span className="text-[9px] text-slate-400 uppercase flex items-center gap-1">
                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span> {k.usuario_nombre || 'SISTEMA'}
                            </span>
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
    </div>
  );
}

export default Kardex;
