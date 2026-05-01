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
  iva_porcentaje: string | number;
  fecha_vencimiento: string;
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
    iva_porcentaje: 0,
    fecha_vencimiento: "",
  });

  const [proveedor, setProveedor] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [productosIngresados, setProductosIngresados] = useState<ProductoIngresado[]>([]);
  const [proveedoresDB, setProveedoresDB] = useState<Proveedor[]>([]);
  const [productosDB, setProductosDB] = useState<any[]>([]); // This will now hold search results
  const [categoriasDB, setCategoriasDB] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Draft System State
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [draftsList, setDraftsList] = useState<Borrador[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  // States
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState("");
  const lastSearchedRef = React.useRef("");



  const fetchDrafts = React.useCallback(async () => {
    try {
      const res = await API.get("/borradores");
      setDraftsList(res.data);
    } catch (e) {
      console.error("Error fetching drafts:", e);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
    API.get("/proveedores").then(res => setProveedoresDB(res.data)).catch(console.error);
    API.get("/productos/categorias").then(res => setCategoriasDB(res.data)).catch(console.error);
    // REMOVED: API.get("/productos") to avoid massive data load
  }, [fetchDrafts]);

  const fillFormData = (p: any, source: 'lote' | 'db' | 'new' = 'db') => {
    const exists = categoriasDB.includes(p.categoria);
    setFormData({
      referencia: p.referencia || "",
      nombre: p.nombre || "",
      categoria: exists ? p.categoria : (p.categoria ? "Otra" : ""),
      nuevaCategoria: exists ? "" : (p.categoria || ""),
      cantidad: 1,
      precio_compra: p.precio_compra || "",
      porcentaje_ganancia: p.porcentaje_ganancia || 60,
      precio_venta: p.precio_venta || "",
      es_servicio: !!p.es_servicio,
      permitir_venta_negativa: p.permitir_venta_negativa !== undefined ? !!p.permitir_venta_negativa : true,
      iva_porcentaje: p.iva_porcentaje || 0,
      fecha_vencimiento: (p.fecha_vencimiento && typeof p.fecha_vencimiento === 'string') 
        ? p.fecha_vencimiento.split('T')[0] 
        : ""
    });
    
    if (source === 'lote') {
      setMensajeEstado("📦 PRODUCTO EN LOTE ACTUAL");
    } else if (source === 'db') {
      setMensajeEstado("✅ PRODUCTO EXISTENTE CARGADO");
    } else {
      setMensajeEstado("⚠️ CREAR NUEVO PRODUCTO");
    }
    
    setTimeout(() => setMensajeEstado(""), 4000);
    lastSearchedRef.current = p.referencia || "";
  };

  const buscarProductoPorReferencia = async (codigo: string) => {
    if (!codigo) return;
    const cleanCodigo = codigo.trim();
    
    // 1. Prioridad: Buscar en el lote temporal (productosIngresados)
    const enLote = productosIngresados.find(p => p.referencia === cleanCodigo);
    if (enLote) {
      fillFormData(enLote, 'lote');
      return;
    }

    // 2. Si no está en el lote, buscar en Base de Datos
    try {
      const res = await API.get(`/productos/buscar/${encodeURIComponent(cleanCodigo)}`);
      const productData = res.data.data || res.data;

      if (!productData || (!productData.nombre && !productData.referencia)) {
        throw { response: { status: 404 } };
      }

      fillFormData(productData, 'db');
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        fillFormData({ referencia: cleanCodigo }, 'new');
      } else {
        console.error("Search Error Details:", error);
        setMensajeEstado("❌ ERROR EN LA BÚSQUEDA");
        setTimeout(() => setMensajeEstado(""), 3000);
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
    if (formData.referencia.trim() !== '' && formData.referencia.trim() !== lastSearchedRef.current) {
      buscarProductoPorReferencia(formData.referencia.trim());
    } else if (formData.referencia.trim() === '') {
      setMensajeEstado("");
    }
  };

  // Optimized Dynamic Search: Fetches suggestions as user types
  useEffect(() => {
    const term = formData.referencia.trim().toLowerCase();
    if (term.length >= 2) {
      const delayDebounceFn = setTimeout(async () => {
        setIsSearching(true);
        try {
          // 1. Buscar en el lote temporal (Local)
          const localMatches = productosIngresados
            .filter(p => 
              (p.referencia && p.referencia.toLowerCase().includes(term)) || 
              (p.nombre && p.nombre.toLowerCase().includes(term))
            )
            .map(p => ({ ...p, source: 'lote' }));

          // 2. Buscar en Base de Datos (Remoto)
          const res = await API.get(`/productos?search=${encodeURIComponent(term)}&limit=15`);
          const remoteResults = (res.data.data || res.data || []).map((p: any) => ({ ...p, source: 'db' }));

          // 3. Combinar y Priorizar (Lote primero)
          // Evitamos duplicar si el producto del lote ya viene del DB (por referencia)
          const combined = [...localMatches];
          remoteResults.forEach((rp: any) => {
            if (!combined.some(lp => lp.referencia === rp.referencia && lp.referencia !== "")) {
              combined.push(rp);
            }
          });

          setProductosDB(combined.slice(0, 15));
          setShowSugerencias(combined.length > 0);
        } catch (err) {
          console.error("Error buscando sugerencias:", err);
        } finally {
          setIsSearching(false);
        }
      }, 350); 
      return () => clearTimeout(delayDebounceFn);
    } else {
      setProductosDB([]);
      setShowSugerencias(false);
    }
  }, [formData.referencia, productosIngresados]);

  const seleccionarProducto = (p: any) => {
    fillFormData(p, p.source === 'lote' ? 'lote' : 'db');
    setShowSugerencias(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => {
      let newState = { ...prev, [name]: val };

      // Helper para obtener valores numéricos seguros
      const getNum = (field: keyof FormDataState) => {
        const v = newState[field];
        if (typeof v === 'boolean') return 0;
        return parseFloat(String(v || 0)) || 0;
      };

      const pc = getNum('precio_compra');
      const gan = getNum('porcentaje_ganancia');
      const iva = getNum('iva_porcentaje');
      const pv = getNum('precio_venta');

      // Caso 1: Si cambia Costo, Ganancia o IVA -> Recalcular Precio de Venta (PVP)
      if (['precio_compra', 'porcentaje_ganancia', 'iva_porcentaje'].includes(name)) {
        const base = pc * (1 + gan / 100);
        newState.precio_venta = Math.round(base * (1 + iva / 100)).toString();
      }

      // Caso 2: Si cambia el PVP -> Recalcular Margen de Ganancia (Markup)
      if (name === 'precio_venta' && val !== "" && val !== "0") {
        if (pc > 0) {
          const baseSinIva = pv / (1 + iva / 100);
          // Calculamos el markup: ((VentaSinIVA - Costo) / Costo) * 100
          const markup = ((baseSinIva - pc) / pc) * 100;
          newState.porcentaje_ganancia = markup.toFixed(2);
        }
      }

      return newState;
    });
  };

  const handleEditItem = (index: number) => {
    const p = productosIngresados[index];
    setFormData({
      referencia: p.referencia || "",
      nombre: p.nombre,
      categoria: categoriasDB.includes(p.categoria) ? p.categoria : "Otra",
      nuevaCategoria: categoriasDB.includes(p.categoria) ? "" : p.categoria,
      cantidad: p.cantidad,
      precio_compra: p.precio_compra.toString(),
      porcentaje_ganancia: p.porcentaje_ganancia.toString(),
      precio_venta: p.precio_venta.toString(),
      es_servicio: p.es_servicio || false,
      permitir_venta_negativa: p.permitir_venta_negativa !== false,
      iva_porcentaje: p.iva_porcentaje || 0,
      fecha_vencimiento: p.fecha_vencimiento ? p.fecha_vencimiento.split('T')[0] : "",
    });
    setEditIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToList = (e: React.FormEvent) => {
    e.preventDefault();
    let categoriaFinal = formData.categoria;
    if (categoriaFinal === "Otra") {
      if (!formData.nuevaCategoria.trim()) return alert("Ingresa el nombre de la nueva categoría.");
      categoriaFinal = formData.nuevaCategoria.trim().toUpperCase();
      // Update local categories list to allow immediate reuse
      if (!categoriasDB.includes(categoriaFinal)) {
        setCategoriasDB(prev => [...prev, categoriaFinal].sort());
      }
    }
    if (!formData.nombre || !categoriaFinal || formData.precio_compra === "") {
      return alert("Datos incompletos.");
    }
    const parsedCantidad = formData.es_servicio ? 0 : (parseInt(String(formData.cantidad), 10) || 0);
    const parsedPrecioCompra = parseFloat(String(formData.precio_compra)) || 0;
    const parsedPrecioVenta = Math.round(parseFloat(String(formData.precio_venta)) || 0);
    const parsedIva = parseFloat(String(formData.iva_porcentaje)) || 0;
    const parsedGanancia = parseFloat(String(formData.porcentaje_ganancia)) || 0;

    // Construimos el objeto respetando estrictamente la interfaz ProductoIngresado
    const nuevoProducto: ProductoIngresado = {
      referencia: formData.referencia,
      nombre: formData.nombre,
      categoria: categoriaFinal,
      cantidad: parsedCantidad,
      precio_compra: parsedPrecioCompra,
      porcentaje_ganancia: parsedGanancia,
      precio_venta: parsedPrecioVenta,
      es_servicio: formData.es_servicio,
      permitir_venta_negativa: formData.permitir_venta_negativa,
      iva_porcentaje: parsedIva,
      fecha_vencimiento: formData.fecha_vencimiento || undefined,
      inyectado: false,
      cantidad_inyectada: 0
    };

    if (editIndex !== null) {
      setProductosIngresados(prev => {
        const updatedList = [...prev];
        const existingItem = updatedList[editIndex];
        updatedList[editIndex] = {
          ...existingItem,
          ...nuevoProducto,
          inyectado: existingItem.inyectado,
          cantidad_inyectada: existingItem.cantidad_inyectada || 0
        };
        return updatedList;
      });
      setEditIndex(null);
    } else {
      const existingIndex = productosIngresados.findIndex(p =>
        (p.referencia && p.referencia === nuevoProducto.referencia) ||
        (!p.referencia && p.nombre === nuevoProducto.nombre)
      );

      if (existingIndex !== -1) {
        // Actualización inmutable: fusionamos el nuevo registro con el existente sumando cantidades
        setProductosIngresados(prev => {
          const updatedList = [...prev];
          const existingItem = updatedList[existingIndex];
          
          updatedList[existingIndex] = {
            ...existingItem,
            ...nuevoProducto, // Los precios y metadata nuevos sobrescriben los anteriores
            cantidad: (Number(existingItem.cantidad) || 0) + nuevoProducto.cantidad,
            inyectado: existingItem.inyectado, // Mantenemos el flag de inyección original
            cantidad_inyectada: existingItem.cantidad_inyectada || 0
          };
          return updatedList;
        });
      } else {
        // Agregar al inicio de la lista (Estado inmutable y funcional)
        setProductosIngresados(prev => [nuevoProducto, ...prev]);
      }
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
      iva_porcentaje: 0,
      fecha_vencimiento: "",
    });
    lastSearchedRef.current = "";
  };

  const handleSaveDraft = async () => {
    if (productosIngresados.length === 0) return alert("Añade al menos un producto a la lista temporal.");
    
    setIsSavingDraft(true);
    try {
      // 1. Identificar ítems que necesitan inyección de stock (incremental)
      const itemsParaInyectar = productosIngresados.map(p => {
        const cantInyectada = p.cantidad_inyectada || 0;
        const delta = p.cantidad - cantInyectada;
        return delta > 0 ? { ...p, delta } : null;
      }).filter(Boolean);

      if (itemsParaInyectar.length > 0) {
        // Enviar al backend para sumar al inventario en tiempo real
        await API.post("/productos/inyectar-stock", { items: itemsParaInyectar });
        setMensajeEstado("🚀 STOCK ACTUALIZADO EN TIEMPO REAL");
      }

      // 2. Marcar todos como inyectados localmente
      const itemsActualizados = productosIngresados.map(p => ({
        ...p,
        cantidad_inyectada: p.cantidad,
        inyectado: true
      }));

      // 3. Guardar el borrador con el estado actualizado
      if (currentDraftId) await API.delete(`/borradores/${currentDraftId}`);
      const res = await API.post("/borradores", {
        proveedor: proveedor,
        numero_factura: numeroFactura,
        datos_json: itemsActualizados
      });

      setProductosIngresados(itemsActualizados);
      setCurrentDraftId(res.data.id);
      fetchDrafts();
      alert("📝 Borrador guardado. Los productos ya están disponibles para la venta.");
    } catch (e: any) {
      alert("Error guardando el borrador incremental: " + (e.response?.data?.error || e.message));
    } finally {
      setIsSavingDraft(false);
      setTimeout(() => setMensajeEstado(""), 3000);
    }
  };

  const handleSaveBatch = async () => {
    if (productosIngresados.length === 0) return;
    setIsSavingBatch(true);
    try {
      // 1. Inyectar cualquier delta pendiente antes de finalizar
      const itemsParaInyectar = productosIngresados.map(p => {
        const cantInyectada = p.cantidad_inyectada || 0;
        const delta = p.cantidad - cantInyectada;
        return delta > 0 ? { ...p, delta } : null;
      }).filter(Boolean);

      if (itemsParaInyectar.length > 0) {
        await API.post("/productos/inyectar-stock", { items: itemsParaInyectar });
      }

      const itemsFinales = productosIngresados.map(p => ({
        ...p,
        cantidad_inyectada: p.cantidad,
        inyectado: true
      }));

      // 2. Calcular gran total
      const granTotal = itemsFinales.reduce((acc, curr) => {
        const subtotal = (parseFloat(String(curr.precio_compra)) || 0) * (curr.cantidad || 0);
        return acc + subtotal;
      }, 0);

      // 3. Crear Compra Central
      await API.post("/compras", {
        proveedor,
        numero_factura: numeroFactura,
        total: granTotal,
        productos: itemsFinales
      });

      alert("✅ Factura completada. Proceso cerrado.");

      if (currentDraftId) {
        await API.delete(`/borradores/${currentDraftId}`);
      }
      resetWorkspace();
      fetchDrafts();
    } catch (error: any) {
      console.error(error);
      alert("❌ Error al finalizar: " + (error.response?.data?.error || error.message));
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
    lastSearchedRef.current = "";
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
      iva_porcentaje: 0,
      fecha_vencimiento: "",
    });
  };

  const removeItem = async (index: number) => {
    const item = productosIngresados[index];
    if (item.cantidad_inyectada && item.cantidad_inyectada > 0) {
      const confirm = window.confirm(`⚠️ Se han inyectado ${item.cantidad_inyectada} unidades al inventario. ¿Deseas descontarlas para eliminar el ítem?`);
      if (confirm) {
        try {
          await API.post("/productos/revertir-stock", { 
            referencia: item.referencia, 
            nombre: item.nombre, 
            cantidad: item.cantidad_inyectada 
          });
          alert("✅ Stock revertido exitosamente.");
        } catch (e: any) {
          console.error(e);
          return alert("❌ Error al revertir stock: " + (e.response?.data?.error || e.message));
        }
      } else {
        return;
      }
    }
    const list = [...productosIngresados];
    list.splice(index, 1);
    setProductosIngresados(list);
  };

  // Cálculos de resumen del lote
  const valorTotalIngresados = productosIngresados.reduce((total, p) => {
    return total + ((parseFloat(String(p.precio_compra)) || 0) * (p.cantidad || 0));
  }, 0);

  const valorVentaTotal = productosIngresados.reduce((total, p) => {
    return total + ((parseFloat(String(p.precio_venta)) || 0) * (p.cantidad || 0));
  }, 0);

  const allItemsCompleted = productosIngresados.length > 0 && productosIngresados.every(p => (p.cantidad_inyectada || 0) >= p.cantidad);



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
              className="px-3 py-1.5 bg-blue-600 text-white font-black text-[9px] rounded-lg shadow-md shadow-blue-200 hover:bg-blue-700 transition-all uppercase tracking-tight flex items-center gap-1.5"
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col justify-center">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">Clasificación</label>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, es_servicio: false }))}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${!formData.es_servicio ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    📦 Producto
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, es_servicio: true }))}
                    className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${formData.es_servicio ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-slate-400 hover:text-slate-600'}`}
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
                    className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-tight transition-all ${formData.permitir_venta_negativa ? 'bg-green-700 text-white shadow-lg shadow-green-200' : 'text-slate-400 hover:text-slate-600'}`}
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

              <div className="space-y-1.5 flex-1 relative">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">🔍 Código de Barras / SKU / Nombre — Autocompletado</label>
                <div className="relative">
                  <input
                    type="text"
                    name="referencia"
                    autoComplete="off"
                    value={formData.referencia}
                    onChange={handleChange}
                    onKeyDown={handleKeyDownReferencia}
                    onBlur={() => setTimeout(() => setShowSugerencias(false), 200)}
                    onFocus={() => formData.referencia.length >= 2 && setShowSugerencias(true)}
                    placeholder="Escribe para buscar..."
                    className="w-full px-5 py-2.5 bg-blue-50/40 border border-blue-200 rounded-xl font-black text-blue-700 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all text-sm uppercase"
                  />
                  {isSearching && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>

                {/* Custom Suggestions Dropdown */}
                {showSugerencias && productosDB.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 divide-y divide-slate-50">
                    {productosDB.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        onClick={() => seleccionarProducto(p)}
                        className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex justify-between items-center group relative overflow-hidden"
                      >
                        {p.source === 'lote' && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600"></div>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-900 uppercase group-hover:text-indigo-600 transition-colors">{p.nombre}</span>
                            {p.source === 'lote' ? (
                              <span className="text-[7px] font-black bg-indigo-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">En Lote</span>
                            ) : (
                              <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">En DB</span>
                            )}
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">REF: {p.referencia || 'S/R'} | {p.categoria}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{formatCOP(p.precio_venta)}</span>
                          <div className="text-[7px] font-black text-slate-400 uppercase mt-1">Stock: {p.cantidad}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  {categoriasDB.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
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
                    formData.es_servicio 
                      ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' 
                      : 'bg-slate-50 border-slate-200 text-slate-900 group-hover:bg-white'
                  }`}
                />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-[9px] font-black text-rose-500 uppercase tracking-widest ml-1">IVA (%) (Opcional)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="iva_porcentaje"
                    value={formData.iva_porcentaje}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-rose-50/30 border border-rose-100 rounded-xl font-black text-rose-600 text-center outline-none focus:bg-white transition-all text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest ml-1">Vencimiento (Opcional)</label>
                <div className="relative group">
                  <input
                    type="date"
                    name="fecha_vencimiento"
                    value={formData.fecha_vencimiento}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 bg-amber-50/30 border border-amber-100 rounded-xl font-black text-amber-600 text-center outline-none focus:bg-white focus:ring-4 focus:ring-amber-50 transition-all text-xs appearance-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">📅</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
              <div className="space-y-1 py-3 px-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-center">
                <label className="text-[9px] font-black text-blue-700 uppercase tracking-widest ml-1">Costo Unitario ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-blue-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    name="precio_compra"
                    value={formData.precio_compra}
                    onChange={handleChange}
                    required
                    className="w-full pl-8 pr-4 py-2 bg-white border border-blue-200 rounded-xl font-black text-blue-800 text-lg outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1 py-3 px-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-center">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Margen de Ganancia (%)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    step="0.1"
                    name="porcentaje_ganancia"
                    value={formData.porcentaje_ganancia}
                    onChange={handleChange}
                    className="w-28 px-3 py-1.5 bg-white border border-blue-200 rounded-xl font-black text-blue-700 text-center outline-none focus:ring-4 focus:ring-blue-100"
                  />
                  <div className="h-1.5 flex-1 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, Number(formData.porcentaje_ganancia)))}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="space-y-0.5 py-3 px-4 bg-green-900/5 rounded-2xl border border-green-800/20 flex flex-col justify-center">
                <label className="text-[9px] font-black text-green-800 uppercase tracking-widest ml-1 mb-0.5">PVP Sugerido al Público</label>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-black text-green-700">$</span>
                  <input
                    type="number"
                    name="precio_venta"
                    value={formData.precio_venta}
                    onChange={handleChange}
                    className="w-full bg-transparent text-2xl font-black text-green-900 outline-none appearance-none"
                    required
                  />
                </div>
                <p className="text-[8px] font-black text-green-700/60 uppercase tracking-widest">
                  Base Sin IVA:
                  <span className="text-green-800 ml-1">
                    {formatCOP(Math.round((parseFloat(String(formData.precio_venta)) || 0) / (1 + (parseFloat(String(formData.iva_porcentaje)) || 0) / 100)))}
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                className={`w-full py-3.5 ${editIndex !== null ? 'bg-gradient-to-r from-amber-500 to-amber-600 shadow-amber-200 hover:from-amber-400 hover:to-amber-500 border-amber-500' : 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-blue-200 hover:from-blue-500 hover:to-blue-600 border-blue-500'} text-white rounded-2xl font-black shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all uppercase tracking-[0.1em] text-[11px] flex items-center justify-center gap-3 group border`}
              >
                <span className="text-xl group-hover:rotate-12 transition-transform">{editIndex !== null ? '📝' : '➕'}</span> 
                {editIndex !== null ? 'Guardar Cambios' : 'Cargar al Lote Temporal'}
              </button>
              {editIndex !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditIndex(null);
                    setFormData({
                      referencia: "", nombre: "", categoria: "", nuevaCategoria: "",
                      cantidad: 1, precio_compra: "", porcentaje_ganancia: 60,
                      precio_venta: "", es_servicio: false, permitir_venta_negativa: true,
                      iva_porcentaje: 0, fecha_vencimiento: "",
                    });
                  }}
                  className="w-full py-2.5 bg-slate-100 text-slate-500 rounded-2xl font-bold uppercase tracking-widest text-[9px] hover:bg-slate-200 transition-all"
                >
                  Cancelar Edición
                </button>
              )}
            </div>
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
              <p className="font-black uppercase tracking-[0.3em] text-[9px] text-slate-500 italic">Terminal en espera...<br />Agregue productos para iniciar.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {productosIngresados.map((p, index) => (
                <div 
                  key={index} 
                  onClick={() => handleEditItem(index)}
                  className={`bg-white p-5 rounded-xl border ${editIndex === index ? 'border-amber-400 shadow-amber-100/50' : 'border-slate-200 hover:border-indigo-300 hover:shadow-indigo-100/50'} hover:shadow-2xl transition-all relative group/item animate-in fade-in slide-in-from-right-4 duration-500 cursor-pointer`} 
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-col gap-4">
                    {/* Header: Name and Remove Action */}
                    <div className="flex justify-between items-start gap-4 ">
                      <div className="flex-1">
                        <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight leading-tight group-hover/item:text-indigo-600 transition-colors">
                          {p.nombre}
                        </h4>
                        
                        {/* Status Badge */}
                        <div className="flex items-center gap-2 mt-1.5">
                          {p.cantidad_inyectada && p.cantidad_inyectada >= p.cantidad ? (
                            <span className="text-[7px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 uppercase tracking-tighter">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                              En Inventario: {p.cantidad_inyectada} Un.
                            </span>
                          ) : p.cantidad_inyectada && p.cantidad_inyectada > 0 ? (
                            <span className="text-[7px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1 uppercase tracking-tighter">
                              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                              Parcial: {p.cantidad_inyectada} / {p.cantidad}
                            </span>
                          ) : (
                            <span className="text-[7px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100 flex items-center gap-1 uppercase tracking-tighter">
                              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
                              Pendiente de Guardar
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(index); }}
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
                        <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                          UNIDAD: {formatCOP(p.precio_venta)}
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

          <div className="flex justify-center gap-4 py-1">
            <button
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="py-2.5 px-6 bg-blue-50 text-blue-700 font-black rounded-xl hover:bg-blue-100 transition-all border border-blue-200 uppercase tracking-widest text-[8px] flex items-center justify-center gap-2 shadow-sm min-w-[120px]"
            >
              {isSavingDraft ? "..." : <>📋 Borrador</>}
            </button>
            <button
              onClick={handleSaveBatch}
              disabled={isSavingBatch || productosIngresados.length === 0}
              className={`py-2.5 px-8 font-black rounded-xl shadow-lg transition-all disabled:opacity-30 disabled:grayscale uppercase tracking-widest text-[8px] flex items-center justify-center gap-2 group min-w-[160px] ${
                allItemsCompleted 
                ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-emerald-900/40 border border-emerald-400 hover:scale-105' 
                : 'bg-gradient-to-br from-green-600 to-green-800 text-white shadow-green-900/20 hover:from-green-500 hover:to-green-700 hover:-translate-y-0.5'
              }`}
            >
              {isSavingBatch ? "..." : (
                <>
                  <span className="text-base group-hover:scale-110 transition-transform">
                    {allItemsCompleted ? "✨" : "✅"}
                  </span> 
                  {allItemsCompleted ? "Lote Completado" : "Finalizar"}
                  <span className={`px-1.5 py-0.5 rounded-md text-[7px] border ${
                    allItemsCompleted ? 'bg-white/30 border-white/20' : 'bg-white/20 border-white/10'
                  }`}>
                    {productosIngresados.length}
                  </span>
                </>
              )}
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
