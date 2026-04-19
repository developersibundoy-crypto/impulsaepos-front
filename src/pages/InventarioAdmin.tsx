import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import * as XLSX from 'xlsx';

function InventarioAdmin() {
  const [productos, setProductos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tipo, setTipo] = useState<"producto" | "servicio">("producto");
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProductos(1);
  }, [tipo]);

  const fetchProductos = (p: number = page, search: string = searchTerm) => {
    setLoading(true);
    API.get(`/productos?tipo=${tipo}&page=${p}&limit=50&search=${search}`)
      .then(res => {
        // Backend now returns { data: [], total: X, last_page: Y, ... }
        setProductos(res.data.data);
        setTotalPages(res.data.last_page);
        setTotalRecords(res.data.total);
        setPage(res.data.page);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    // Fetch immediately or we could debounce, but let's fetch for better experience
    fetchProductos(1, val);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("¿Estás seguro de eliminar este producto permanentemente? Se registrará en el Kardex.")) return;
    
    const usuario_nombre = window.prompt("Por favor, ingresa tu NOMBRE para el registro de auditoría:");
    if (!usuario_nombre) return alert("Operación cancelada: El nombre es obligatorio.");

    const motivo = window.prompt("Ingresa el MOTIVO de la eliminación:");
    if (!motivo) return alert("Operación cancelada: El motivo es obligatorio.");

    API.delete(`/productos/${id}`, { data: { usuario_nombre, motivo } })
      .then(() => {
        alert("✅ Producto eliminado y registrado en el historial de seguridad.");
        fetchProductos();
      })
      .catch(err => alert("Error eliminando producto: " + (err.response?.data?.error || err.message)));
  };

  const handleEdit = (producto: any) => {
    setEditingProduct({ ...producto });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    API.put(`/productos/${editingProduct.id}`, editingProduct)
      .then(() => {
        alert("✅ Producto actualizado exitosamente");
        setEditingProduct(null);
        fetchProductos();
      })
      .catch(err => alert("Error actualizando producto: " + (err.response?.data?.error || err.message)))
      .finally(() => setIsSaving(false));
  };

  const handleExportExcel = async () => {
    setLoading(true);
    try {
      // Obtenemos todos los registros (sin paginación para el reporte global)
      const res = await API.get(`/productos?tipo=${tipo}&limit=5000`);
      const allData = res.data.data || res.data;

      if (!allData || allData.length === 0) {
        return alert("No hay datos para exportar.");
      }

      // 1. Preparar datos legibles
      const excelData = allData.map((p: any) => ({
        "ESTADO": p.es_servicio ? "⚡ SERVICIO" : (p.cantidad <= 0 ? "🛑 AGOTADO" : "📦 DISPONIBLE"),
        "REFERENCIA / SKU": p.referencia || "SIN REF",
        "NOMBRE DEL PRODUCTO": p.nombre,
        "CATEGORÍA": p.categoria || "SIN CATEGORIA",
        "STOCK ACTUAL": p.es_servicio ? "ILIMITADO" : p.cantidad,
        "COSTO UNITARIO ($)": p.precio_compra,
        "PRECIO VENTA AL PÚBLICO ($)": p.precio_venta,
        "IVA (%)": p.iva_porcentaje || 0,
        "VENCIMIENTO": p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString() : "N/A"
      }));

      // 2. Crear libro
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario Global");

      // 3. Ajustar anchos
      const columnWidths = [
        { wch: 15 }, // Estado
        { wch: 20 }, // SKU
        { wch: 45 }, // Nombre
        { wch: 20 }, // Categoria
        { wch: 15 }, // Stock
        { wch: 20 }, // Costo
        { wch: 25 }, // Precio
        { wch: 10 }, // IVA
        { wch: 15 }  // Vencimiento
      ];
      worksheet['!cols'] = columnWidths;

      // 4. Descargar
      XLSX.writeFile(workbook, `INVENTARIO_GLOBAL_${tipo.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error(err);
      alert("Error generando el reporte de inventario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 font-bold">
            Inventario Global
          </h1>
          <p className="text-slate-500 font-medium text-lg italic">Búsqueda, edición y gestión maestra de productos y servicios.</p>
        </div>

        <button 
          onClick={handleExportExcel}
          className="px-8 py-4 bg-emerald-600 text-white rounded-[24px] font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 flex items-center gap-3 active:scale-95 italic no-print"
        >
          <span>📊</span> Descargar Reporte Excel (.xlsx)
        </button>
      </div>

      <div className="flex gap-4 mb-8 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setTipo("producto")}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${tipo === 'producto' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          📦 Mercancía (Productos)
        </button>
        <button 
          onClick={() => setTipo("servicio")}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${tipo === 'servicio' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ⚡ Servicios Profesionales
        </button>
      </div>

      <div className="relative group mb-10">
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors text-xl">🔍</span>
        <input 
          type="text" 
          placeholder={`Buscar ${tipo === 'producto' ? 'productos físicos' : 'servicios'}...`} 
          value={searchTerm}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-[32px] text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all shadow-md font-medium"
        />
      </div>

      <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-lg text-slate-900 uppercase tracking-widest flex items-center gap-2 font-bold">
                <span className="w-2 h-6 bg-indigo-500 rounded-full"></span> 
                {tipo === 'producto' ? 'Inventario de Bodega' : 'Portafolio de Servicios'}
            </h3>
            <div className="flex items-center gap-4">
               <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">{totalRecords} Registros Totales</span>
               <span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">Página {page} de {totalPages}</span>
            </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-slate-400 font-black uppercase tracking-widest border-b border-slate-100 bg-white">
                <th className="px-8 py-5">Tipo</th>
                <th className="px-8 py-5">SKU / Ref</th>
                <th className="px-8 py-5">Nombre Ítem</th>
                <th className="px-8 py-5">Categoría</th>
                <th className="px-8 py-5 text-center">Stock</th>
                <th className="px-8 py-5 text-right">Precio Venta</th>
                <th className="px-8 py-5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="py-24 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">Cargando inventario...</td></tr>
              ) : productos.length === 0 ? (
                <tr><td colSpan={7} className="py-24 text-center text-slate-300 font-bold italic opacity-50">No hay ítems que coincidan.</td></tr>
              ) : (
                productos.map(p => (
                  <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      {p.es_servicio ? (
                        <span className="bg-blue-50 text-blue-600 text-[9px] px-2 py-0.5 rounded-lg border border-blue-100 font-black">SERVICIO</span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-600 text-[9px] px-2 py-0.5 rounded-lg border border-emerald-100 font-black">PRODUCTO</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-slate-900 text-xs font-mono font-bold">{(p.referencia || "—")}</td>
                    <td className="px-8 py-6">
                      <div className="text-slate-900 uppercase leading-tight group-hover:text-indigo-600 transition-colors font-bold">{p.nombre}</div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] text-slate-900 font-bold uppercase tracking-widest bg-slate-100 px-2.5 py-1 rounded-lg">REF: {p.referencia || 'S/R'}</span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      {p.es_servicio ? (
                        <span className="text-slate-300 text-[10px] italic font-medium">Ilimitado</span>
                      ) : (
                        <span className={`px-4 py-1 rounded-full text-[10px] items-center gap-2 uppercase tracking-widest font-black flex justify-center mx-auto w-fit ${
                          p.cantidad <= 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-500 border border-slate-200'
                        }`}>
                          <span className={`w-1 h-1 rounded-full ${p.cantidad <= 0 ? 'bg-rose-600 animate-pulse' : 'bg-slate-400'}`}></span>
                          {p.cantidad} UND
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-right text-indigo-600 font-black text-lg">
                      {formatCOP(p.precio_venta)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(p)}
                          className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center shadow-sm"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
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
           
           <div className="hidden sm:flex gap-1">
              {[...Array(totalPages)].map((_, i) => {
                 const pNum = i + 1;
                 // Mostrar solo algunas páginas si son muchas
                 if (totalPages > 10 && Math.abs(pNum - page) > 2 && pNum !== 1 && pNum !== totalPages) {
                    if (Math.abs(pNum - page) === 3) return <span key={pNum} className="px-2 self-center text-slate-300">...</span>;
                    return null;
                 }

                 return (
                   <button
                     key={pNum}
                     onClick={() => fetchProductos(pNum)}
                     className={`w-10 h-10 rounded-xl font-black text-[10px] transition-all ${page === pNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'}`}
                   >
                     {pNum}
                   </button>
                 );
              })}
           </div>

           <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
              Mostrando página {page} de {totalPages}
           </div>
        </div>
      </div>

      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEditingProduct(null)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-3xl p-10 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto border border-slate-100">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl text-slate-900 flex items-center gap-3 font-bold">
                  <span className="w-2 h-8 bg-indigo-600 rounded-full"></span> Editar Ítem
               </h2>
               <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">¿Es un Servicio?</span>
                  <button 
                    type="button"
                    onClick={() => {
                        const nextVal = editingProduct.es_servicio ? 0 : 1;
                        setEditingProduct({
                            ...editingProduct, 
                            es_servicio: nextVal,
                            cantidad: nextVal === 1 ? 0 : editingProduct.cantidad
                        });
                    }}
                    className={`relative w-12 h-6 rounded-full transition-colors ${editingProduct.es_servicio ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingProduct.es_servicio ? 'left-7' : 'left-1'}`}></div>
                  </button>
               </div>
            </div>

            <form onSubmit={handleUpdate} className="grid grid-cols-2 gap-6">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Nombre</label>
                <input 
                  type="text" 
                  value={editingProduct.nombre} 
                  onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-bold uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Referencia / SKU</label>
                <input 
                  type="text" 
                  value={editingProduct.referencia} 
                  onChange={e => setEditingProduct({...editingProduct, referencia: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-mono font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Categoría</label>
                <input 
                  type="text" 
                  value={editingProduct.categoria} 
                  onChange={e => setEditingProduct({...editingProduct, categoria: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-bold uppercase"
                />
              </div>

              {!editingProduct.es_servicio && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Stock Actual (UND)</label>
                  <input 
                    type="number" 
                    value={editingProduct.cantidad} 
                    onChange={e => setEditingProduct({...editingProduct, cantidad: parseInt(e.target.value)})}
                    className="w-full px-5 py-4 bg-amber-50/30 border border-amber-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-amber-100 transition-all font-black text-amber-700 text-xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={editingProduct.precio_compra} 
                  onChange={e => {
                    const pc = parseFloat(e.target.value) || 0;
                    const gan = editingProduct.porcentaje_ganancia || 0;
                    const iva = parseFloat(editingProduct.iva_porcentaje || 0);
                    const base = pc + (pc * gan) / 100;
                    setEditingProduct({
                      ...editingProduct, 
                      precio_compra: pc,
                      precio_venta: Math.round(base * (1 + iva / 100))
                    });
                  }}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-black text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">% Margen Ganancia</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={editingProduct.porcentaje_ganancia} 
                  onChange={e => {
                    const gan = parseFloat(e.target.value) || 0;
                    const pc = editingProduct.precio_compra || 0;
                    const iva = parseFloat(editingProduct.iva_porcentaje || 0);
                    const base = pc + (pc * gan) / 100;
                    setEditingProduct({
                      ...editingProduct, 
                      porcentaje_ganancia: gan,
                      precio_venta: Math.round(base * (1 + iva / 100))
                    });
                  }}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-black text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest ml-1">PV Sugerido (Con IVA)</label>
                <input 
                  type="number" 
                  value={editingProduct.precio_venta} 
                  onChange={e => {
                    const pvConIva = parseFloat(e.target.value) || 0;
                    const pc = editingProduct.precio_compra || 0;
                    const ivaPerc = parseFloat(editingProduct.iva_porcentaje || 0);
                    
                    const base = pvConIva / (1 + ivaPerc / 100);
                    setEditingProduct({
                      ...editingProduct, 
                      precio_venta: pvConIva,
                      porcentaje_ganancia: pc > 0 ? Math.round(((base - pc) / pc) * 100) : editingProduct.porcentaje_ganancia
                    });
                  }}
                  className="w-full px-5 py-4 bg-indigo-50 border border-indigo-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-black text-indigo-700 text-xl"
                />
                <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1 ml-1 self-end">
                   Base Gravable (Sin IVA): 
                   <span className="text-indigo-600 ml-1">
                      {formatCOP(Math.round(editingProduct.precio_venta / (1 + (parseFloat(editingProduct.iva_porcentaje || 0) / 100))))}
                   </span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-rose-500 font-black uppercase tracking-widest ml-1">IVA (%) (Opcional)</label>
                <input 
                  type="number" 
                  value={editingProduct.iva_porcentaje} 
                  onChange={e => {
                      const ivaPerc = parseFloat(e.target.value) || 0;
                      const pc = editingProduct.precio_compra || 0;
                      const gan = editingProduct.porcentaje_ganancia || 0;
                      const base = pc + (pc * gan) / 100;
                      setEditingProduct({
                        ...editingProduct,
                        iva_porcentaje: e.target.value,
                        precio_venta: Math.round(base * (1 + ivaPerc / 100))
                      });
                  }}
                  className="w-full px-5 py-4 bg-rose-50/30 border border-rose-100 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-rose-50 transition-all font-black text-rose-600"
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-amber-500 font-black uppercase tracking-widest ml-1">Vencimiento (Opcional)</label>
                <input 
                  type="date" 
                  value={editingProduct.fecha_vencimiento ? editingProduct.fecha_vencimiento.split('T')[0] : ""} 
                  onChange={e => setEditingProduct({...editingProduct, fecha_vencimiento: e.target.value})}
                  className="w-full px-5 py-4 bg-amber-50/30 border border-amber-100 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-amber-50 transition-all font-black text-amber-700 text-sm"
                />
              </div>
              
              <div className="col-span-2 space-y-2 p-6 bg-slate-100/50 rounded-3xl border border-slate-200">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1 mb-2 block tracking-widest">Política de Disponibilidad</label>
                <div className="flex bg-white p-1 rounded-2xl border border-slate-200">
                  <button 
                    type="button"
                    onClick={() => setEditingProduct({ ...editingProduct, permitir_venta_negativa: 1 })}
                    className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${editingProduct.permitir_venta_negativa ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      🔓 Venta Libre
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingProduct({ ...editingProduct, permitir_venta_negativa: 0 })}
                    className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!editingProduct.permitir_venta_negativa ? 'bg-rose-600 text-white shadow-xl shadow-rose-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                      🔒 Solo Stock
                  </button>
                </div>
              </div>

              <div className="col-span-2 flex gap-4 pt-6">
                <button 
                  type="button" 
                  onClick={() => setEditingProduct(null)}
                  className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-3xl uppercase tracking-widest text-[10px] font-black hover:bg-slate-200 transition-all font-bold"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="flex-[2] py-5 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-[10px] font-black"
                >
                  {isSaving ? "⏳ Guardando..." : "💾 Sincronizar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventarioAdmin;
