import React, { useState, useEffect, useMemo } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";

function FacturasCompra() {
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [selectedFactura, setSelectedFactura] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State for Editing
  const [editHeader, setEditHeader] = useState({ proveedor: "", numero_factura: "" });
  const [editProductos, setEditProductos] = useState<any[]>([]);
  
  const [newProd, setNewProd] = useState({
    referencia: "", nombre: "", categoria: "Sin Categoría", cantidad: 1, precio_compra: "", porcentaje_ganancia: 40, precio_venta: ""
  });
  const [scanMessage, setScanMessage] = useState({ text: "", type: "" });
  const [searchProvider, setSearchProvider] = useState("");
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const groupedFacturas = useMemo(() => {
    const filtered = facturas.filter((f: any) => {
      const pName = (f.proveedor || "Empresa Desconocida").toLowerCase();
      return pName.includes(searchProvider.toLowerCase());
    });

    const groups: Record<string, { proveedor: string, facturas: any[], totalInversion: number, count: number, maxFecha: string }> = {};
    
    filtered.forEach((f: any) => {
      const pName = f.proveedor || "Empresa Desconocida";
      if (!groups[pName]) {
        groups[pName] = {
          proveedor: pName,
          facturas: [],
          totalInversion: 0,
          count: 0,
          maxFecha: f.fecha
        };
      }
      groups[pName].facturas.push(f);
      groups[pName].totalInversion += parseFloat(f.total || 0);
      groups[pName].count += 1;
      if (new Date(f.fecha) > new Date(groups[pName].maxFecha)) {
        groups[pName].maxFecha = f.fecha;
      }
    });

    return Object.values(groups).sort((a, b) => a.proveedor.localeCompare(b.proveedor));
  }, [facturas, searchProvider]);

  useEffect(() => {
    fetchFacturas();
  }, []);

  const fetchFacturas = async () => {
    try {
      const res = await API.get("/compras");
      setFacturas(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const formatearFecha = (fechaISO: string) => {
    if (!fechaISO) return "Desconocida";
    return new Date(fechaISO).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const openModal = (factura: any) => {
    setSelectedFactura(factura);
    setIsEditing(false);
    setEditHeader({ proveedor: factura.proveedor || "", numero_factura: factura.numero_factura || "" });
    
    let parsedData = [];
    try {
        parsedData = typeof factura.datos_json === 'string' ? JSON.parse(factura.datos_json) : factura.datos_json;
    } catch(e) { parsedData = []; }
    
    setEditProductos(JSON.parse(JSON.stringify(parsedData)));
  };

  const closeModal = () => {
    setSelectedFactura(null);
    setIsEditing(false);
  };

  const removeEditItem = (index: number) => {
    const list = [...editProductos];
    list.splice(index, 1);
    setEditProductos(list);
  };

  const handleEditItemChange = (index: number, field: string, value: any) => {
    const list = [...editProductos];
    list[index][field] = value;
    
    if (field === "precio_compra" || field === "porcentaje_ganancia") {
      const costo = parseFloat(list[index].precio_compra) || 0;
      const ganancia = parseFloat(list[index].porcentaje_ganancia) || 0;
      list[index].precio_venta = costo + (costo * (ganancia / 100));
    }
    if (field === "precio_venta") {
      const costo = parseFloat(list[index].precio_compra) || 0;
      const venta = parseFloat(value) || 0;
      if (costo > 0) {
        list[index].porcentaje_ganancia = ((venta - costo) / costo) * 100;
      }
    }
    setEditProductos(list);
  };

  const buscarProductoPorReferencia = async (codigo: string) => {
    if (!codigo) return;
    try {
      const res = await API.get(`/productos/buscar/${encodeURIComponent(codigo)}`);
      if (res.data) {
        setNewProd({
          ...newProd,
          referencia: res.data.referencia || codigo,
          nombre: res.data.nombre,
          categoria: res.data.categoria,
          precio_compra: res.data.precio_compra,
          porcentaje_ganancia: res.data.porcentaje_ganancia,
          precio_venta: res.data.precio_venta
        });
        setScanMessage({ text: "✅ Producto Auto-completado", type: "success" });
      }
    } catch (err: any) {
      if (err.response && err.response.status === 404) {
        setScanMessage({ text: "⚠️ Código Nuevo. Digita su Información.", type: "error" });
      }
    }
  };

  const handleRefKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarProductoPorReferencia(newProd.referencia);
    }
  };

  const addNewProductToInvoice = () => {
    if (!newProd.nombre || newProd.precio_compra === "") return alert("Falta el nombre o costo.");
    
    const prodListo = {
      ...newProd,
      cantidad: parseInt(newProd.cantidad.toString(), 10) || 1,
      precio_compra: parseFloat(newProd.precio_compra.toString()) || 0,
      porcentaje_ganancia: parseFloat(newProd.porcentaje_ganancia.toString()) || 0,
      precio_venta: parseFloat(newProd.precio_venta.toString()) || 0
    };
    
    if (prodListo.precio_venta === 0 && prodListo.precio_compra > 0) {
      prodListo.precio_venta = prodListo.precio_compra + (prodListo.precio_compra * (prodListo.porcentaje_ganancia / 100));
    }

    setEditProductos([prodListo, ...editProductos]);
    setNewProd({ referencia: "", nombre: "", categoria: "Sin Categoría", cantidad: 1, precio_compra: "", porcentaje_ganancia: 40, precio_venta: "" });
    setScanMessage({ text: "", type: "" });
  };

  const saveEditedInvoice = async () => {
    if (editProductos.length === 0) return alert("No puede estar vacía.");
    if (!window.confirm("⚠️ Modificar el pasado re-calculará todo el inventario. ¿Continuar?")) return;
    
    setIsSaving(true);
    try {
      const granTotal = editProductos.reduce((acc, curr) => acc + (parseFloat(curr.precio_compra) * parseFloat(curr.cantidad)), 0);
      
      await API.put(`/compras/${selectedFactura.id}`, {
        proveedor: editHeader.proveedor,
        numero_factura: editHeader.numero_factura,
        total: granTotal,
        productos: editProductos
      });
      
      alert("✅ Factura histórica re-calculada con éxito.");
      fetchFacturas();
      closeModal();
    } catch (e) {
      console.error(e);
      alert("❌ Error sincronizando inventario.");
    } finally {
      setIsSaving(false);
    }
  };

  const granTotalCalculado = editProductos.reduce((acc, curr) => acc + (parseFloat(curr.precio_compra) * parseFloat(curr.cantidad)), 0);

  const handleViewFile = (e: React.MouseEvent, base64Data: string) => {
    e.stopPropagation();
    const win = window.open();
    if (win) {
      win.document.write(`
        <title>Vista Previa de Documento</title>
        <body style="margin:0; display:flex; justify-content:center; align-items:center; background:#0f172a; height:100vh;">
          ${base64Data.startsWith('data:image') 
            ? `<img src="${base64Data}" style="max-width:100%; max-height:100%; object-fit:contain;" />` 
            : `<iframe src="${base64Data}" style="width:100%; height:100%; border:none;"></iframe>`
          }
        </body>
      `);
      win.document.close();
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
            Libro de Compras
          </h1>
          <p className="text-slate-500 font-medium text-lg">Historial de entradas de mercancía y gestión de costos de proveedores.</p>
        </div>
        <div className="relative w-full md:w-96">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="Buscar por proveedor..."
            value={searchProvider}
            onChange={(e) => setSearchProvider(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 transition-all text-sm font-medium shadow-sm"
          />
        </div>
      </div>

      <div className="space-y-8">
        {loading ? (
             <div className="py-24 text-center space-y-4 bg-white rounded-[40px] border border-slate-200 shadow-sm">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                <p className="text-slate-400 font-semibold uppercase tracking-widest text-[10px]">Cargando libros contables...</p>
             </div>
        ) : groupedFacturas.length === 0 ? (
            <div className="py-24 text-center space-y-4 opacity-50 grayscale transition-all bg-white rounded-[40px] border border-slate-200 shadow-sm">
                <div className="text-6xl mb-4">📥</div>
                <p className="text-slate-400 font-medium italic">No se encontraron facturas o proveedores.</p>
            </div>
        ) : (
          groupedFacturas.map((group) => (
            <div key={group.proveedor} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              {/* Group Header */}
              <div 
                onClick={() => setExpandedProviders(prev => ({ ...prev, [group.proveedor]: !prev[group.proveedor] }))}
                className="bg-slate-50 border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer hover:bg-slate-100 transition-colors group/header"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                    🏢
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800 uppercase tracking-tight flex items-center gap-2">
                      {group.proveedor}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-1">Última compra: {formatearFecha(group.maxFecha)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex flex-col items-end justify-center">
                       <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">Facturas</span>
                       <span className="text-sm font-semibold text-slate-700">{group.count}</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex flex-col items-end justify-center">
                       <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest">Inversión Total</span>
                       <span className="text-sm font-semibold text-indigo-600">{formatCOP(group.totalInversion)}</span>
                    </div>
                  </div>
                  <div className={`w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-400 transition-transform duration-300 group-hover/header:text-indigo-600 ${expandedProviders[group.proveedor] ? 'rotate-180' : ''}`}>
                    ▼
                  </div>
                </div>
              </div>

              {/* Group Table */}
              {expandedProviders[group.proveedor] && (
                <div className="overflow-x-auto animate-in slide-in-from-top-2 fade-in duration-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Fecha Ingreso</th>
                      <th className="px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">ID / Factura Física</th>
                      <th className="px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center">Unds</th>
                      <th className="px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-right">Costo Factura</th>
                      <th className="px-6 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-widest text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {group.facturas.map((f: any) => {
                       let parsed = [];
                       try { parsed = typeof f.datos_json === 'string' ? JSON.parse(f.datos_json) : f.datos_json; } catch(e) { parsed = []; }
                       const piezas = Array.isArray(parsed) ? parsed.reduce((acc, curr) => acc + parseInt(curr.cantidad), 0) : 0;
                      return (
                        <tr key={f.id} className="group/row hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => openModal(f)}>
                          <td className="px-6 py-4 text-slate-500 font-medium text-xs">{formatearFecha(f.fecha)}</td>
                          <td className="px-6 py-4">
                              <div className="font-medium text-slate-900"># {f.id}</div>
                              <div className="text-[10px] font-medium text-indigo-400 uppercase tracking-wide">FE: {f.numero_factura || "S/N"}</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                              <span className="px-3 py-1 bg-slate-50 rounded-lg text-[10px] font-medium text-slate-500 border border-slate-100">{piezas} UND</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                              <span className="text-sm font-semibold text-slate-800 tracking-tight">{formatCOP(f.total)}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {f.archivo_factura && (
                                <>
                                  <button
                                    onClick={(e) => handleViewFile(e, f.archivo_factura)}
                                    className="px-3 py-2 bg-blue-50 border border-blue-200 text-[10px] font-bold text-blue-600 rounded-xl hover:bg-blue-100 transition-all uppercase tracking-widest shadow-sm flex items-center gap-1"
                                    title="Ver Archivo Adjunto"
                                  >
                                    <span>👁️</span> Ver
                                  </button>
                                  <a 
                                    href={f.archivo_factura} 
                                    download={`Factura_${f.numero_factura || f.id}`}
                                    className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all uppercase tracking-widest shadow-sm flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Descargar Archivo Adjunto"
                                  >
                                    <span>⬇️</span>
                                  </a>
                                </>
                              )}
                              <button className="px-4 py-2 bg-white border border-slate-200 text-[10px] font-medium text-slate-500 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all uppercase tracking-widest shadow-sm">Ver Detalle</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL: Detail & Edit */}
      {selectedFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300" onClick={closeModal}></div>
          <div className="relative w-full max-w-5xl bg-white rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-12 duration-500 flex flex-col max-h-[90vh]">
             
             <div className="p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shrink-0">
                <div className="space-y-1">
                   <h2 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
                      {isEditing ? '🛠️ Modificar Auditoría' : `📄 Ingreso # ${selectedFactura.id}`}
                      {isEditing && <span className="text-[10px] bg-red-100 text-red-600 px-3 py-1 rounded-full uppercase tracking-widest">Alerta de Inventario</span>}
                   </h2>
                   <p className="text-slate-400 font-medium text-sm">{formatearFecha(selectedFactura.fecha)}</p>
                </div>
                <div className="flex gap-4">
                   {!isEditing ? (
                     <button className="px-6 py-3 bg-amber-50 text-amber-600 font-semibold text-xs rounded-2xl hover:bg-amber-100 transition-all uppercase tracking-widest border border-amber-200" onClick={() => setIsEditing(true)}>
                       ✏️ Modificar lote
                     </button>
                   ) : (
                     <button className="px-6 py-3 bg-slate-100 text-slate-500 font-black text-xs rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest" onClick={() => setIsEditing(false)}>
                       🚫 Cancelar Edición
                     </button>
                   )}
                   <button onClick={closeModal} className="text-3xl text-slate-300 hover:text-slate-600 font-black transition-colors">&times;</button>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-none">
                {/* Header Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razon Social / Proveedor</label>
                        {isEditing ? (
                            <input type="text" value={editHeader.proveedor} onChange={e => setEditHeader({...editHeader, proveedor: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 border-indigo-200" />
                        ) : (
                            <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedFactura.proveedor || "N/A"}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento Soporte (Factura)</label>
                        {isEditing ? (
                            <input type="text" value={editHeader.numero_factura} onChange={e => setEditHeader({...editHeader, numero_factura: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold uppercase outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 border-indigo-200" />
                        ) : (
                            <div className="flex items-center gap-3">
                              <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedFactura.numero_factura || "— SIN SOPORTE —"}</p>
                              {selectedFactura.archivo_factura && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => handleViewFile(e, selectedFactura.archivo_factura)}
                                    className="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 border border-blue-100 transition-all shadow-sm"
                                  >
                                    👁️ Ver
                                  </button>
                                  <a 
                                    href={selectedFactura.archivo_factura} 
                                    download={`Factura_${selectedFactura.numero_factura || selectedFactura.id}`}
                                    className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-100 transition-all shadow-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    ⬇️ Descargar
                                  </a>
                                </div>
                              )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-slate-50 p-2 rounded-[40px] border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <th className="px-6 py-5">Item Ingresado</th>
                                    <th className="px-6 py-5 text-center">Cant</th>
                                    <th className="px-6 py-5 text-right">Costo Und</th>
                                    <th className="px-6 py-5 text-right">Subtotal</th>
                                    {isEditing && <th className="px-6 py-5 text-center"></th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-50">
                                {editProductos.map((prod, index) => (
                                    <tr key={index} className="group hover:bg-slate-50/50">
                                        <td className="px-6 py-5">
                                            <div className="font-black text-slate-900 uppercase text-xs leading-tight">{prod.nombre}</div>
                                            <div className="text-[9px] font-black text-slate-400 tracking-tighter uppercase mt-1">{prod.referencia || 'SIN REFERENCIA'}</div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {isEditing ? (
                                                <input type="number" value={prod.cantidad} onChange={e => handleEditItemChange(index, "cantidad", e.target.value)} className="w-16 bg-slate-100 border border-slate-200 rounded-lg text-center font-black py-2 focus:bg-white outline-none" />
                                            ) : (
                                                <span className="font-black text-slate-700">{prod.cantidad}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            {isEditing ? (
                                                <input type="number" value={prod.precio_compra} onChange={e => handleEditItemChange(index, "precio_compra", e.target.value)} className="w-32 bg-slate-100 border border-slate-200 rounded-lg text-right font-black py-2 pr-2 focus:bg-white outline-none" />
                                            ) : (
                                                <span className="font-bold text-slate-600">{formatCOP(prod.precio_compra)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <span className="font-black text-indigo-600">{formatCOP(parseFloat(prod.precio_compra) * parseFloat(prod.cantidad))}</span>
                                        </td>
                                        {isEditing && (
                                            <td className="px-6 py-5 text-center">
                                                <button onClick={() => removeEditItem(index)} className="w-8 h-8 rounded-full hover:bg-red-50 text-red-300 hover:text-red-500 transition-all font-black">&times;</button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                
                                {isEditing && (
                                    <tr className="bg-indigo-50/50">
                                        <td className="px-6 py-6" colSpan={2}>
                                            <input type="text" placeholder="Código Barras + Enter" value={newProd.referencia} onChange={e=>setNewProd({...newProd, referencia: e.target.value})} onKeyDown={handleRefKeyDown} className="w-full px-4 py-3 border border-indigo-100 rounded-xl text-xs font-black outline-none focus:ring-4 focus:ring-indigo-100" />
                                        </td>
                                        <td className="px-6 py-6" colSpan={2}>
                                            <div className="flex gap-2">
                                                <input type="text" placeholder="Nombre..." value={newProd.nombre} onChange={e=>setNewProd({...newProd, nombre: e.target.value})} className="flex-1 px-4 py-3 border border-indigo-100 rounded-xl text-xs font-bold outline-none" />
                                                <input type="number" placeholder="Costo" value={newProd.precio_compra} onChange={e=>setNewProd({...newProd, precio_compra: e.target.value})} className="w-32 px-4 py-3 border border-indigo-100 rounded-xl text-xs font-black outline-none" />
                                                <button onClick={addNewProductToInvoice} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap">+ Inyectar</button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6"></td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
             </div>

             <div className="p-10 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8 shrink-0">
                <div className="text-center md:text-left">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] block mb-2">Gran Total Invertido (Auditoría)</span>
                    <div className="text-5xl font-black text-white tracking-tighter">{formatCOP(granTotalCalculado)}</div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button className="flex-1 md:flex-none px-10 py-5 bg-slate-800 text-slate-400 font-black rounded-3xl hover:text-white transition-all uppercase tracking-widest text-xs border border-slate-700" onClick={closeModal} disabled={isSaving}>
                        {isEditing ? "Descartar" : "Regresar"}
                    </button>
                    {isEditing && (
                        <button className="flex-1 md:flex-none px-10 py-5 bg-indigo-600 text-white font-black rounded-3xl shadow-2xl shadow-indigo-500/20 hover:bg-indigo-500 hover:-translate-y-1 transition-all uppercase tracking-widest text-xs" onClick={saveEditedInvoice} disabled={isSaving}>
                            {isSaving ? "Impactando..." : "Sincronizar Almacén"}
                        </button>
                    )}
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FacturasCompra;
