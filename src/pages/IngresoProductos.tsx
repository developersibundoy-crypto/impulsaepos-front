import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { Proveedor, Borrador, ProductoIngresado } from "../types";

interface FormDataState {
  referencia: string;
  nombre: string;
  categoria: string;
  nuevaCategoria: string;
  cantidad: string | number;
  precio_compra: string | number;
  porcentaje_ganancia: string | number;
  precio_venta: string | number;
  es_servicio: boolean;
  permitir_venta_negativa: boolean;
}

function IngresoProductos() {
  const [formData, setFormData] = useState<FormDataState>({
    referencia: "",
    nombre: "",
    categoria: "",
    nuevaCategoria: "",
    cantidad: 1,
    precio_compra: "",
    porcentaje_ganancia: 60,
    precio_venta: "",
    es_servicio: false,
    permitir_venta_negativa: true,
  });

  const [proveedor, setProveedor] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [productosIngresados, setProductosIngresados] = useState<ProductoIngresado[]>([]);
  const [proveedoresDB, setProveedoresDB] = useState<Proveedor[]>([]);
  const [productosDB, setProductosDB] = useState<any[]>([]);

  // Draft System State
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [draftsList, setDraftsList] = useState<Borrador[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // States
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState("");

  const fetchDrafts = async () => {
    try {
      const res = await API.get("/borradores");
      setDraftsList(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDrafts();
    API.get("/proveedores").then(res => setProveedoresDB(res.data)).catch(console.error);
    API.get("/productos").then(res => setProductosDB(res.data)).catch(console.error);
  }, []);

  const buscarProductoPorReferencia = async (codigo: string) => {
    if (!codigo) return;
    try {
      const res = await API.get(`/productos/buscar/${encodeURIComponent(codigo)}`);
      setFormData(prev => ({
        ...prev,
        nombre: res.data.nombre || "",
        categoria: res.data.categoria || "",
        precio_compra: res.data.precio_compra || "",
        porcentaje_ganancia: res.data.porcentaje_ganancia || 60,
        precio_venta: res.data.precio_venta || "",
        es_servicio: !!res.data.es_servicio,
        permitir_venta_negativa: res.data.permitir_venta_negativa !== undefined ? !!res.data.permitir_venta_negativa : true
      }));
      setMensajeEstado("✅ PRODUCTO EXISTENTE CARGADO");
      setTimeout(() => setMensajeEstado(""), 4000);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        setMensajeEstado("⚠️ CREAR NUEVO PRODUCTO");
        setFormData(prev => ({
          ...prev,
          nombre: "",
          categoria: "",
          nuevaCategoria: "",
          precio_compra: "",
          precio_venta: ""
        }));
      }
    }
  };

  const handleKeyDownReferencia = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarProductoPorReferencia(formData.referencia.trim());
    }
  };

  const handleBlurReferencia = () => {
    if (formData.referencia.trim() !== '') {
      buscarProductoPorReferencia(formData.referencia.trim());
    } else {
      setMensajeEstado("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => {
      let newState = { ...prev, [name]: val };
      
      if (name === 'precio_compra' || name === 'porcentaje_ganancia') {
        const pcStr = name === 'precio_compra' ? value : prev.precio_compra;
        const ganStr = name === 'porcentaje_ganancia' ? value : prev.porcentaje_ganancia;
        const pc = parseFloat(pcStr.toString()) || 0;
        const ganancia = parseFloat(ganStr.toString()) || 0;
        newState.precio_venta = Math.round(pc + (pc * ganancia) / 100).toString();
      }
      
      if (name === 'precio_venta') {
        const pc = parseFloat(prev.precio_compra.toString()) || 0;
        const pv = parseFloat(value) || 0;
        if (pc > 0) {
          newState.porcentaje_ganancia = Math.round(((pv - pc) / pc) * 100);
        }
      }

      return newState;
    });
  };

  const handleAddToList = (e: React.FormEvent) => {
    e.preventDefault();
    let categoriaFinal = formData.categoria;
    if (categoriaFinal === "Otra") {
      if (!formData.nuevaCategoria.trim()) return alert("Ingresa el nombre de la nueva categoría.");
      categoriaFinal = formData.nuevaCategoria.trim();
    }
    if (!formData.nombre || !categoriaFinal || formData.precio_compra === "") {
      return alert("Datos incompletos.");
    }
    const nuevoProducto = {
      ...formData,
      categoria: categoriaFinal,
      cantidad: formData.es_servicio ? 0 : parseInt(formData.cantidad.toString(), 10),
      precio_compra: parseFloat(formData.precio_compra.toString()) || 0,
      porcentaje_ganancia: parseFloat(formData.porcentaje_ganancia.toString()) || 0,
      precio_venta: Math.round(parseFloat(formData.precio_venta.toString()) || 0),
      inyectado: false,
      permitir_venta_negativa: formData.permitir_venta_negativa
    };

    const existingIndex = productosIngresados.findIndex(p => 
      (p.referencia && p.referencia === nuevoProducto.referencia) || 
      (!p.referencia && p.nombre === nuevoProducto.nombre)
    );

    if (existingIndex !== -1) {
      const updatedList = [...productosIngresados];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        cantidad: updatedList[existingIndex].cantidad + nuevoProducto.cantidad,
      };
      setProductosIngresados(updatedList);
    } else {
      setProductosIngresados([nuevoProducto, ...productosIngresados]);
    }

    setFormData({
      referencia: "",
      nombre: "",
      categoria: "",
      nuevaCategoria: "",
      cantidad: 1,
      precio_compra: "",
      porcentaje_ganancia: 60,
      precio_venta: "",
      es_servicio: false,
      permitir_venta_negativa: true,
    });
  };

  const handleSaveDraft = async () => {
    if (productosIngresados.length === 0) return alert("Añade al menos un producto a la lista temporal.");
    setIsSavingDraft(true);
    try {
      if (currentDraftId) await API.delete(`/borradores/${currentDraftId}`);
      const res = await API.post("/borradores", {
        proveedor: proveedor,
        numero_factura: numeroFactura,
        datos_json: productosIngresados
      });
      alert("📝 Borrador guardado exitosamente.");
      let savedData = res.data.datos_json || res.data.detalles;
      if (typeof savedData === 'string') {
        try { savedData = JSON.parse(savedData); } catch (e) {}
      }
      setProductosIngresados(Array.isArray(savedData) ? savedData : productosIngresados);
      setCurrentDraftId(res.data.id);
      fetchDrafts();
    } catch (e) {
      alert("Error guardando el borrador.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveBatch = async () => {
    if (productosIngresados.length === 0) return;
    setIsSavingBatch(true);
    try {
      const granTotal = productosIngresados.reduce((acc, curr) => acc + (parseFloat(curr.precio_compra.toString()) * curr.cantidad), 0);

      await API.post("/compras", {
        proveedor,
        numero_factura: numeroFactura,
        total: granTotal,
        productos: productosIngresados
      });
      alert("✅ Factura completada y enviada a la Base de Datos central.");

      if (currentDraftId) {
        await API.delete(`/borradores/${currentDraftId}`);
      }
      resetWorkspace();
      fetchDrafts();
    } catch (error) {
      console.error(error);
      alert("❌ Hubo un error al guardar al inventario.");
    } finally {
      setIsSavingBatch(false);
    }
  };

  const loadDraft = (d: Borrador) => {
    setProveedor(d.proveedor || "");
    setNumeroFactura(d.numero_factura || "");
    
    let parsedProductos = [];
    try {
      const rawDatos = d.detalles || (d as any).datos_json;
      if (typeof rawDatos === 'string') {
        parsedProductos = JSON.parse(rawDatos);
      } else if (rawDatos) {
        parsedProductos = rawDatos;
      }
    } catch (e) {
      console.error("Error parsing borrador detalles:", e);
    }
    
    setProductosIngresados(Array.isArray(parsedProductos) ? parsedProductos : []);
    setCurrentDraftId(d.id);
    setShowDrafts(false);
  };

  const resetWorkspace = () => {
    setProductosIngresados([]);
    setProveedor("");
    setNumeroFactura("");
    setCurrentDraftId(null);
  };

  const removeItem = async (index: number) => {
    const item = productosIngresados[index];
    if (item.inyectado) {
       const confirm = window.confirm("⚠️ Este producto ya fue sumado al inventario general. ¿Deseas descontar su cantidad de la base de datos?");
       if (confirm) {
           try {
               await API.post("/productos/revertir-stock", { referencia: item.referencia, nombre: item.nombre, cantidad: item.cantidad });
               alert("✅ Stock descontado de la base de datos.");
           } catch(e) {
               console.error(e);
               return alert("❌ Error al descontar stock.");
           }
       } else {
           return;
       }
    }
    const list = [...productosIngresados];
    list.splice(index, 1);
    setProductosIngresados(list);
  };

  const valorTotalIngresados = productosIngresados.reduce((total, p) => total + (parseFloat(p.precio_compra.toString()) * parseFloat(p.cantidad.toString())), 0);
  const valorVentaTotal = productosIngresados.reduce((total, p) => total + (parseFloat(p.precio_venta.toString()) * parseFloat(p.cantidad.toString())), 0);

  const handleDownloadBackup = () => {
    const baseURL = API.defaults.baseURL || "https://redcograf-back.onrender.com";
    window.location.href = `${baseURL}/backup/download`;
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-4 lg:gap-6 animate-in fade-in duration-700 overflow-y-auto lg:overflow-hidden">
      
      {/* LEFT: Management & Form (Scrolling Content) */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-none pb-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-1">
                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-indigo-100">
                   📦 Centro de Suministros
                </span>
                <h1 className="text-xl font-black tracking-tight text-slate-900 mt-1 uppercase">
                    Ingreso de <span className="text-indigo-600">Inventario</span>
                </h1>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => setShowDrafts(!showDrafts)} 
                  className="px-3 py-1.5 bg-indigo-600 text-white font-black text-[9px] rounded-lg shadow-md hover:bg-indigo-700 transition-all uppercase tracking-tight flex items-center gap-1.5"
                >
                   📂 Pendientes <span className="bg-white/20 px-1.5 py-0.5 rounded-md">{draftsList.length}</span>
                </button>
            </div>
        </div>

        {/* Drafts Section */}
        {showDrafts && (
          <div className="bg-indigo-50/30 p-6 rounded-[2.5rem] border border-indigo-100/50 animate-in zoom-in duration-500">
            <h3 className="text-[10px] font-black text-indigo-900 mb-5 flex items-center gap-2 uppercase tracking-widest">
                <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span> Lotes en Espera
            </h3>
            {draftsList.length === 0 ? <p className="text-indigo-400 font-bold italic text-xs">No hay lotes temporales guardados.</p> : (
              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
                {draftsList.map(d => (
                  <button key={d.id} onClick={() => loadDraft(d)} className="min-w-[260px] bg-white p-5 rounded-3xl border border-indigo-100/50 shadow-sm text-left hover:shadow-xl hover:-translate-y-1 transition-all group">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">{new Date(d.fecha).toLocaleDateString()}</div>
                    <div className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase leading-tight text-xs truncate">{d.proveedor || "Carga Anónima"}</div>
                    {d.numero_factura && <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Doc: {d.numero_factura}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-4">
            
            {/* Step 1: Provider Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Empresa Proveedora</label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-xs">🏢</span>
                       <input 
                          list="lista-proveedores-sum"
                          type="text" 
                          value={proveedor} 
                          onChange={e => setProveedor(e.target.value)} 
                          placeholder="Nombre del proveedor..." 
                          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all uppercase text-xs"
                       />
                       <datalist id="lista-proveedores-sum">
                          {proveedoresDB.map(p => (
                             <option key={p.id} value={p.nombre_comercial}>{p.nit ? `NIT: ${p.nit}` : ''}</option>
                          ))}
                       </datalist>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1"># de Factura Física</label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-xs">📄</span>
                       <input 
                         type="text" 
                         value={numeroFactura} 
                         onChange={e => setNumeroFactura(e.target.value)} 
                         placeholder="Referencia de factura..." 
                         className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-900 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all uppercase text-xs" 
                       />
                    </div>
                </div>
            </div>

            {/* Step 2: Product Addition Form */}
            <form onSubmit={handleAddToList} className="space-y-6 relative">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                       <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span> Información del Artículo
                    </h4>
                    {mensajeEstado && (
                      <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full animate-in slide-in-from-right-4 duration-300 ${
                        mensajeEstado.includes("EXISTENTE") ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {mensajeEstado}
                      </span>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5 bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col justify-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Clasificación</label>
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                           <button 
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, es_servicio: false }))}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!formData.es_servicio ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                              📦 Producto
                           </button>
                           <button 
                            type="button"
                            onClick={() => setFormData(p => ({ ...p, es_servicio: true }))}
                            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.es_servicio ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                              ⚡ Servicio
                           </button>
                        </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col justify-center">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Logística de Venta</label>
                        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                           <button 
                             type="button"
                             onClick={() => setFormData(p => ({ ...p, permitir_venta_negativa: true }))}
                             className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-tight transition-all ${formData.permitir_venta_negativa ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                             title="Permitir vender sin stock físico"
                           >
                              Venta Libre
                           </button>
                           <button 
                             type="button"
                             onClick={() => setFormData(p => ({ ...p, permitir_venta_negativa: false }))}
                             className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-tight transition-all ${!formData.permitir_venta_negativa ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                             title="Bloquear venta si el stock llega a 0"
                           >
                              Solo Stock
                           </button>
                        </div>
                    </div>

                    <div className="space-y-1.5 flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Barras / SKU</label>
                        <input 
                            list="lista-referencias-sum"
                            type="text" 
                            name="referencia" 
                            value={formData.referencia} 
                            onChange={handleChange} 
                            onKeyDown={handleKeyDownReferencia}
                            onBlur={handleBlurReferencia}
                            placeholder="Escanea o escribe..." 
                            className="w-full px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-indigo-600 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all text-sm uppercase"
                        />
                        <datalist id="lista-referencias-sum">
                          {productosDB.map((p, idx) => (
                             <option key={idx} value={p.referencia || p.nombre}>{p.nombre}</option>
                          ))}
                        </datalist>
                    </div>

                    <div className="space-y-1.5 flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción del Producto</label>
                        <input 
                          type="text" 
                          name="nombre" 
                          value={formData.nombre} 
                          onChange={handleChange} 
                          placeholder="Nombre comercial del producto..." 
                          required 
                          className="w-full px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:bg-white focus:ring-4 focus:ring-slate-50 transition-all text-sm" 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5 col-span-2 md:col-span-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Categoría</label>
                        <select 
                          name="categoria" 
                          value={formData.categoria} 
                          onChange={handleChange} 
                          required 
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none appearance-none cursor-pointer text-xs uppercase"
                        >
                            <option value="">-- Escoger --</option>
                            <option value="PAPELERIA">PAPELERIA</option>
                            <option value="JOYERIA">JOYERIA</option>
                            <option value="MECATO">MECATO</option>
                            <option value="DETALLES">DETALLES</option>
                            <option value="PERFUMERIA">PERFUMERIA</option>
                            <option value="TECNOLOGIA">TECNOLOGIA</option>
                            <option value="IMPRESIONES-MAQUINAS">IMPRESIONES-MAQUINAS</option>
                            <option value="Otra">➕ Crear nueva...</option>
                        </select>
                        {formData.categoria === "Otra" && (
                          <input 
                            type="text" 
                            name="nuevaCategoria" 
                            value={formData.nuevaCategoria} 
                            onChange={handleChange} 
                            placeholder="Nombre categoría..." 
                            className="w-full px-4 py-2 mt-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 outline-none text-xs" 
                            required 
                          />
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cantidad</label>
                        <input 
                          type="text" 
                          name="cantidad" 
                          value={formData.es_servicio ? "♾️" : formData.cantidad} 
                          onChange={handleChange} 
                          disabled={formData.es_servicio}
                          required={!formData.es_servicio}
                          className={`w-full px-4 py-2.5 border rounded-xl font-black text-center text-sm transition-all ${
                            formData.es_servicio ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-900 group-hover:bg-white'
                          }`} 
                        />
                    </div>
                    <div className="space-y-1.5 col-span-2 md:col-span-2">
                        <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-indigo-400">$</span>
                           <input 
                              type="number" 
                              step="0.01" 
                              name="precio_compra" 
                              value={formData.precio_compra} 
                              onChange={handleChange} 
                              required 
                              className="w-full pl-8 pr-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl font-black text-indigo-700 text-xl outline-none focus:bg-white transition-all" 
                           />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                    <div className="space-y-1.5 p-5 bg-slate-50/80 rounded-3xl border border-slate-100">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Margen Operativo Sugerido (%)</label>
                        <div className="flex items-center gap-4">
                           <input 
                             type="number" 
                             step="0.1" 
                             name="porcentaje_ganancia" 
                             value={formData.porcentaje_ganancia} 
                             onChange={handleChange} 
                             className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-700 text-center outline-none" 
                           />
                           <div className="h-1 flex-1 bg-slate-200 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, Number(formData.porcentaje_ganancia)))}%` }}></div>
                           </div>
                        </div>
                    </div>

                    <div className="space-y-1.5 p-5 bg-emerald-50/50 rounded-3xl border border-emerald-100 flex flex-col justify-center">
                        <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1 mb-1">PVP Sugerido al Público</label>
                        <div className="flex items-baseline gap-2">
                           <span className="text-sm font-black text-emerald-600">$</span>
                           <input 
                              type="number" 
                              name="precio_venta" 
                              value={formData.precio_venta} 
                              onChange={handleChange} 
                              className="w-full bg-transparent text-3xl font-black text-emerald-700 outline-none appearance-none"
                              required 
                           />
                        </div>
                    </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full py-3 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-indigo-600 hover:-translate-y-1 active:scale-[0.98] transition-all uppercase tracking-[0.1em] text-[11px] flex items-center justify-center gap-3 group"
                >
                    <span className="text-xl group-hover:rotate-12 transition-transform">➕</span> Cargar al Lote Temporal
                </button>
            </form>
        </div>
      </div>

      {/* RIGHT: Clean Professional Batch View (Light Theme) */}
      <div className="w-full lg:w-[450px] bg-white rounded-[3rem] border border-slate-200 shadow-xl flex flex-col overflow-hidden text-slate-900 relative">
        
        {/* Sync Header */}
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 backdrop-blur-md">
            <h3 className="text-xl font-black tracking-tight flex items-center justify-between">
                <span className="flex items-center gap-3">
                   <div className="w-2 h-6 bg-indigo-600 rounded-full"></div>
                   Lote en Preparación
                </span>
                <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-200">
                  {productosIngresados.length} Items Listos
                </span>
            </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-none relative bg-slate-50/30">
            {productosIngresados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full opacity-20 py-20 text-center animate-in fade-in zoom-in duration-700">
                  <div className="text-7xl mb-4">📥</div>
                  <p className="font-black uppercase tracking-[0.3em] text-[9px] text-slate-500 italic">Terminal en espera...<br/>Agregue productos para iniciar.</p>
                </div>
            ) : (
                <div className="space-y-2.5">
                  {productosIngresados.map((p, index) => (
                      <div key={index} className="bg-white p-5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-2xl hover:shadow-indigo-100/50 transition-all relative group/item animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
                          <div className="flex flex-col gap-4">
                              {/* Header: Name and Remove Action */}
                              <div className="flex justify-between items-start gap-4 ">
                                  <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight leading-tight flex-1 group-hover/item:text-indigo-600 transition-colors">
                                      {p.nombre}
                                  </h4>
                                  <button 
                                    onClick={() => removeItem(index)} 
                                    className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center text-lg font-black border border-transparent hover:border-rose-100 shadow-sm shrink-0 -mt-2"
                                    title="Eliminar de la lista"
                                  >
                                    &times;
                                  </button>
                              </div>

                              {/* Footer: Metadata and Total */}
                              <div className="flex items-end justify-between gap-4 border-t border-slate-50">
                                  <div className="flex flex-wrap items-center gap-2">
                                      <span className="bg-indigo-600 text-white text-[8px] font-black px-2.5 py-1.5 rounded-xl shadow-lg shadow-indigo-100 uppercase tracking-widest">
                                          CANTIDAD: {p.cantidad}
                                      </span>
                                      <span className="text-[7px] font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-widest border border-indigo-100/50">
                                          {p.categoria}
                                      </span>
                                      {p.referencia && (
                                        <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter font-mono bg-slate-50/50 px-1.5 py-1 rounded border border-slate-100/50">
                                          SKU: {p.referencia}
                                      </span>
                                      )}
                                  </div>
                                  
                                  <div className="text-right">
                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-0.5">Inversión Lote</span>
                                      <span className="text-sm font-black text-indigo-700 leading-none block font-mono">
                                          {formatCOP(p.precio_venta * p.cantidad)}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
                </div>
            )}
        </div>

        {/* Action Totals Card */}
        <div className="p-4 bg-white border-t border-slate-100 space-y-3 relative shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-0.5">Inversión Costo</span>
                    <h3 className="text-base font-black text-indigo-700 leading-none">{formatCOP(valorTotalIngresados)}</h3>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-right">
                    <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest block mb-0.5">Venta Estimada</span>
                    <h3 className="text-base font-black text-emerald-700 leading-none">{formatCOP(valorVentaTotal)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleSaveDraft} 
                  disabled={isSavingDraft} 
                  className="py-3 bg-amber-50 text-amber-600 font-black rounded-xl hover:bg-amber-100 transition-all border border-amber-100 uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
                >
                    {isSavingDraft ? "..." : "📋 Borrador"}
                </button>
                <button 
                  onClick={handleSaveBatch} 
                  disabled={isSavingBatch || productosIngresados.length === 0} 
                  className="py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-30 disabled:grayscale uppercase tracking-widest text-[9px] flex items-center justify-center gap-2"
                >
                    {isSavingBatch ? "..." : `✅ Finalizar Lote`}
                </button>
            </div>
            
            <div className="flex items-center justify-center gap-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.4em] pb-1">
               <span>Punto de Suministro</span>
               <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
               <span>Redcograf v3</span>
            </div>
        </div>
      </div>
    </div>
  );
}

export default IngresoProductos;
