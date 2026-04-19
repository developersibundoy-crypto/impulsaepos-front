import React, { useState, useEffect } from "react";
import API from "../api/api";
import { Producto } from "../types";

function AjustesInventario() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Mantenemos un estado local con las cantidades que el usuario teclea
  const [cantidadesCambiadas, setCantidadesCambiadas] = useState<Record<number, number | string>>({});

  useEffect(() => {
    fetchProductos(1);
  }, []);

  const fetchProductos = (p: number = page, search: string = searchTerm) => {
    setLoading(true);
    API.get(`/productos?tipo=producto&page=${p}&limit=50&search=${search}`)
      .then(res => {
        const data = res.data.data;
        setProductos(data);
        setTotalPages(res.data.last_page);
        setTotalRecords(res.data.total);
        setPage(res.data.page);

        const initialCant: Record<number, number | string> = {};
        data.forEach((prod: Producto) => initialCant[prod.id as number] = prod.cantidad);
        setCantidadesCambiadas(initialCant);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSearchChange = (val: string) => {
      setSearchTerm(val);
      fetchProductos(1, val);
  };

  const handleCantChange = (id: number, newValor: string | number) => {
    setCantidadesCambiadas({...cantidadesCambiadas, [id]: newValor});
  };

  const handleSum = (id: number, amount: number) => {
    const val = cantidadesCambiadas[id];
    let current = 0;
    if (val !== undefined && val !== null && val !== '') {
        current = parseInt(String(val), 10);
    }
    setCantidadesCambiadas({...cantidadesCambiadas, [id]: current + amount});
  };

  const handleGuardar = (producto: Producto) => {
    const rawLocal = cantidadesCambiadas[producto.id as number];
    let nuevaCantidad = 0;

    if (typeof rawLocal === 'string' && rawLocal.trim().startsWith('+')) {
      const delta = parseInt(rawLocal.replace('+', ''), 10);
      if (isNaN(delta)) return alert("Número inválido.");
      nuevaCantidad = producto.cantidad + delta;
    } else {
      nuevaCantidad = parseInt(String(rawLocal), 10);
    }
    
    if (isNaN(nuevaCantidad)) return alert("Número inválido.");
    if (nuevaCantidad === producto.cantidad) return;

    if (!window.confirm(`¿Ajustar stock de ${producto.nombre} a ${nuevaCantidad} unidades?`)) return;

    const motivo = window.prompt(`Motivo del ajuste para ${producto.nombre} (Obligatorio):`, "Corrección de inventario físico");
    if (!motivo || motivo.trim() === "") return alert("El motivo es obligatorio para registrar el movimiento en el Kardex.");

    const responsable = window.prompt(`¿Quién realiza este ajuste? (Nombre del Vendedor/Responsable):`, "");
    if (!responsable || responsable.trim() === "") return alert("Es obligatorio indicar quién realiza el ajuste para la auditoría.");

    setUpdatingId(producto.id as number);
    API.put(`/productos/${producto.id}/ajustar`, { 
      nueva_cantidad: nuevaCantidad, 
      motivo: motivo.trim(),
      responsable: responsable.trim()
    })
      .then(() => {
        // alert("✅ Ajuste realizado con éxito.");
        fetchProductos(page); // Recargar página actual
      })
      .catch(console.error)
      .finally(() => setUpdatingId(null));
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20 px-4">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
            Ajustes de Inventario
          </h1>
          <p className="text-slate-500 font-medium text-lg italic">Corrección manual de existencias por arqueo, mermas o sobrantes.</p>
        </div>
      </div>

      {/* Search Zone */}
      <div className="relative group mb-10">
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors text-xl">🔍</span>
        <input 
          type="text" 
          placeholder="Localizar producto por nombre, categoría o SKU..." 
          value={searchTerm}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-[32px] font-medium text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all shadow-md"
        />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-lg font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span> Panel de Nivelación
            </h3>
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full">{totalRecords} Items Totales</span>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full">Pág {page} / {totalPages}</span>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                        <th className="px-8 py-5">Control SKU</th>
                        <th className="px-8 py-5">Descripción del Artículo</th>
                        <th className="px-8 py-5 text-center">Stock Contable</th>
                        <th className="px-8 py-5 text-center">Muestreo Físico</th>
                        <th className="px-8 py-5 text-center">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading && productos.length === 0 ? (
                        <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">Sincronizando almacén...</td></tr>
                    ) : productos.length === 0 ? (
                        <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-bold italic opacity-50">No se encontraron productos para ajustar en esta página.</td></tr>
                    ) : (
                        productos.map((p: Producto) => {
                            const valorLocal = cantidadesCambiadas[p.id as number];
                            const hasChanged = parseInt(String(valorLocal)) !== p.cantidad;

                            return (
                                <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6 font-bold text-slate-900 text-xs font-mono">{(p.referencia || "SIN-SKU")}</td>
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-slate-900 uppercase leading-tight group-hover:text-indigo-600 transition-colors">{p.nombre}</div>
                                        <div className="text-[10px] font-bold text-slate-900 mt-1 uppercase tracking-tighter italic">REF: {p.referencia || 'SIN REF'}</div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                            p.cantidad <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                            p.cantidad < 10 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-200'
                                        }`}>
                                            {p.cantidad} UND
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center justify-center gap-3">
                                            <button 
                                                onClick={() => handleSum(p.id as number, -1)}
                                                className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 font-bold hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all flex items-center justify-center shadow-sm"
                                            >-</button>
                                            <input 
                                                type="text" 
                                                value={valorLocal !== undefined ? valorLocal : ''}
                                                onChange={(e) => handleCantChange(p.id as number, e.target.value)}
                                                className={`w-20 text-center font-black py-2 rounded-2xl border outline-none focus:ring-4 transition-all ${
                                                    hasChanged ? 'bg-indigo-50 border-indigo-200 text-indigo-700 focus:ring-indigo-100' : 'bg-slate-50 border-slate-100 text-slate-400 focus:ring-slate-100'
                                                }`}
                                            />
                                            <button 
                                                onClick={() => handleSum(p.id as number, 1)}
                                                className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 font-bold hover:bg-emerald-50 hover:text-emerald-500 hover:border-emerald-100 transition-all flex items-center justify-center shadow-sm"
                                            >+</button>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <button 
                                            onClick={() => handleGuardar(p)}
                                            disabled={!hasChanged || updatingId === p.id}
                                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                hasChanged ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:-translate-y-1 active:translate-y-0' : 'bg-slate-100 text-slate-300 pointer-events-none'
                                            }`}
                                        >
                                            {updatingId === p.id ? "⏳..." : "Sincronizar"}
                                        </button>
                                    </td>
                                </tr>
                            )
                        })
                    )}
                </tbody>
            </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-8 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <button 
                disabled={page <= 1 || loading}
                onClick={() => fetchProductos(page - 1)}
                className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                Anterior
              </button>
              <button 
                disabled={page >= totalPages || loading}
                onClick={() => fetchProductos(page + 1)}
                className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                Siguiente
              </button>
           </div>
           <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              Mostrando página {page} de {totalPages}
           </div>
        </div>
      </div>

    </div>
  );
}

export default AjustesInventario;
