import React, { useState, useEffect, useRef } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { useReactToPrint } from "react-to-print";

export default function DocumentoSoporte() {
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [showNewModal, setShowNewModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [productosBusqueda, setProductosBusqueda] = useState<any[]>([]);
  const [busquedaProd, setBusquedaProd] = useState("");
  const [busquedaProv, setBusquedaProv] = useState("");

  const [cajeroId, setCajeroId] = useState(localStorage.getItem('adminCajeroId') || "");

  const [nuevoDoc, setNuevoDoc] = useState({
    proveedor_nombre: "",
    proveedor_documento: "",
    afecta_inventario: true,
    prefijo: "DS",
    numero_documento: 1,
    archivo_adjunto: ""
  });

  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualItem, setManualItem] = useState({
    referencia: "",
    nombre: "",
    categoria: "General",
    cantidad: 1,
    impuesto: 0,
    fecha_vencimiento: "",
    precio_compra: 0,
    porcentaje_ganancia: 40,
    precio_venta: 0,
    es_servicio: false
  });

  const [cart, setCart] = useState<any[]>([]);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const fetchDocumentos = async () => {
    setLoading(true);
    try {
      const res = await API.get("/documentos-soporte");
      setDocumentos(res.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchConsecutivo = async () => {
    try {
      const res = await API.get("/documentos-soporte/consecutivo");
      setNuevoDoc(prev => ({ ...prev, numero_documento: res.data.consecutivo }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDocumentos();
    API.get("/proveedores").then(res => setProveedores(res.data)).catch(console.error);
    API.get("/productos?limit=99999").then(res => setProductosBusqueda(Array.isArray(res.data) ? res.data : (res.data.data || []))).catch(console.error);
  }, []);

  const handleOpenModal = () => {
    fetchConsecutivo();
    setCart([]);
    setNuevoDoc(prev => ({
      ...prev,
      proveedor_nombre: "",
      proveedor_documento: "",
      afecta_inventario: true,
      archivo_adjunto: ""
    }));
    setBusquedaProv("");
    setShowNewModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("El archivo es demasiado grande. Máximo 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNuevoDoc(prev => ({ ...prev, archivo_adjunto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectProv = (prov: any) => {
    setNuevoDoc(prev => ({ ...prev, proveedor_nombre: prov.nombre_comercial || prov.nombre, proveedor_documento: prov.nit || prov.contacto }));
    setBusquedaProv("");
  };

  const handleAddCustomProd = () => {
    setManualItem({
      referencia: "",
      nombre: "",
      categoria: "General",
      cantidad: 1,
      impuesto: 0,
      fecha_vencimiento: "",
      precio_compra: 0,
      porcentaje_ganancia: 40,
      precio_venta: 0,
      es_servicio: false
    });
    setShowManualItemModal(true);
  };

  const confirmAddManualItem = () => {
    if (!manualItem.nombre) return alert("El nombre es obligatorio");
    setCart([...cart, { ...manualItem, id: Date.now(), isNew: true }]);
    setShowManualItemModal(false);
  };

  const handleManualItemChange = (field: string, value: any) => {
    setManualItem(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'precio_compra' || field === 'porcentaje_ganancia') {
         next.precio_venta = next.precio_compra + (next.precio_compra * (next.porcentaje_ganancia / 100));
      }
      if (field === 'precio_venta') {
         if (next.precio_compra > 0) {
            next.porcentaje_ganancia = ((next.precio_venta - next.precio_compra) / next.precio_compra) * 100;
         }
      }
      return next;
    });
  };

  const handleAddExistingProd = (prod: any) => {
    const exist = cart.find(x => x.id === prod.id && !x.isNew);
    if (exist) {
      setCart(cart.map(x => x.id === prod.id && !x.isNew ? { ...x, cantidad: x.cantidad + 1 } : x));
    } else {
      setCart([...cart, { ...prod, cantidad: 1, precio_compra: prod.precio_compra || 0 }]);
    }
    setBusquedaProd("");
  };

  const updateCartItem = (index: number, field: string, value: any) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], [field]: value };
    setCart(newCart);
  };

  const removeCartItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((acc, c) => acc + (parseFloat(c.precio_compra || 0) * (c.cantidad || 1)), 0);
  const impuestos = 0; // Se puede agregar lógica de IVA/ReteFuente después
  const total = subtotal + impuestos;

  const handleCreate = async () => {
    if (!nuevoDoc.proveedor_nombre) return alert("El nombre del proveedor/tercero es obligatorio.");
    if (cart.length === 0) return alert("Debes agregar al menos un ítem al documento.");
    
    // Validación de nombres en productos nuevos
    for (const c of cart) {
      if (!c.nombre) return alert("Todos los ítems deben tener un nombre/descripción.");
      if (c.precio_compra < 0) return alert("El valor unitario no puede ser negativo.");
    }

    try {
      await API.post("/documentos-soporte", {
        ...nuevoDoc,
        cajero_id: cajeroId ? parseInt(cajeroId) : null,
        subtotal,
        impuestos,
        total,
        datos_json: cart
      });
      alert("✅ Documento Soporte creado exitosamente.");
      setShowNewModal(false);
      fetchDocumentos();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al crear el documento.");
    }
  };

  const handleAnular = async (id: number, afectaInv: boolean) => {
    if (!window.confirm("¿Estás seguro de anular este Documento Soporte? Esta acción no se puede deshacer y revertirá los movimientos de inventario si los hubo.")) return;
    
    try {
      await API.put(`/documentos-soporte/${id}/anular`, { afecta_inventario: afectaInv });
      alert("✅ Documento anulado correctamente.");
      fetchDocumentos();
      setShowViewModal(false);
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al anular.");
    }
  };

  const filteredDocs = documentos.filter(d => 
    d.proveedor_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.numero_documento.toString().includes(searchTerm) ||
    d.proveedor_documento?.includes(searchTerm)
  );

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl tracking-tight text-blue-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 font-black flex items-center gap-3">
            🧾 Documento Soporte <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200">Electrónico</span>
          </h1>
          <p className="text-blue-400 font-medium text-lg italic">Compras y adquisiciones a sujetos no obligados a facturar.</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-blue-300 hover:-translate-y-1 transition-all active:scale-95"
        >
          + Nuevo Documento
        </button>
      </div>

      {/* Tarjetas Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 text-2xl border border-emerald-100">💰</div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Compras</div>
            <div className="text-2xl font-black text-slate-800 tracking-tighter">
              {formatCOP(documentos.filter(d => d.estado !== 'Anulado').reduce((acc, d) => acc + parseFloat(d.total), 0))}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl border border-blue-100">📝</div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Documentos Emitidos</div>
            <div className="text-2xl font-black text-slate-800 tracking-tighter">
              {documentos.filter(d => d.estado !== 'Anulado').length}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 text-2xl border border-rose-100">❌</div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Anulados</div>
            <div className="text-2xl font-black text-slate-800 tracking-tighter">
              {documentos.filter(d => d.estado === 'Anulado').length}
            </div>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="mt-8 relative group">
        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-400 group-focus-within:text-blue-600 transition-colors text-xl">🔍</span>
        <input
          type="text"
          placeholder="Buscar documento por número, proveedor o nit..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate-100 rounded-[32px] text-slate-700 outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all shadow-sm"
        />
      </div>

      {/* Tabla */}
      <div className="mt-8 bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-blue-50 flex items-center justify-between bg-blue-50/20">
          <h3 className="text-lg text-blue-900 uppercase tracking-widest flex items-center gap-2 font-black">
            <span className="w-2 h-6 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></span> Historial de Documentos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                <th className="px-8 py-5">Documento</th>
                <th className="px-8 py-5">Proveedor / Tercero</th>
                <th className="px-8 py-5">Fecha</th>
                <th className="px-8 py-5 text-center">Total</th>
                <th className="px-8 py-5 text-center">Estado</th>
                <th className="px-8 py-5 text-center">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cargando documentos...</td></tr>
              ) : filteredDocs.length === 0 ? (
                <tr><td colSpan={6} className="py-24 text-center text-slate-300 font-bold italic opacity-50">No hay documentos registrados.</td></tr>
              ) : (
                filteredDocs.map(d => (
                  <tr key={d.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-700">{d.prefijo}-{d.numero_documento.toString().padStart(4, '0')}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="text-slate-900 font-bold uppercase leading-tight">{d.proveedor_nombre}</div>
                      <div className="text-[10px] text-slate-400 mt-1">CC/NIT: {d.proveedor_documento || 'N/A'}</div>
                    </td>
                    <td className="px-8 py-6 text-xs text-slate-500 font-medium">
                      {new Date(d.fecha).toLocaleString()}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="text-sm font-black text-blue-700">{formatCOP(d.total)}</div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        d.estado === 'Anulado' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                        'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {d.estado}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button 
                        onClick={() => { setViewDoc(d); setShowViewModal(true); }}
                        className="px-5 py-2 bg-white border border-slate-200 text-[10px] text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest font-bold"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Nuevo */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowNewModal(false)}></div>
          <div className="relative w-full max-w-5xl bg-white rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-400 flex flex-col max-h-[95vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  Nuevo Documento Soporte <span className="bg-blue-600 text-white text-[10px] px-3 py-1 rounded-full tracking-widest">{nuevoDoc.prefijo}-{nuevoDoc.numero_documento}</span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">Registro de compra a sujetos no obligados a facturar.</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-colors">&times;</button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto scrollbar-none space-y-8 bg-white">
              
              {/* Sección Proveedor */}
              <div className="bg-blue-50/30 p-6 rounded-[32px] border border-blue-50 space-y-4">
                <h3 className="text-xs font-black text-blue-800 uppercase tracking-widest">1. Datos del Tercero</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 relative">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre o Razón Social</label>
                    <input 
                      type="text" 
                      value={nuevoDoc.proveedor_nombre}
                      onChange={(e) => {
                        setNuevoDoc({...nuevoDoc, proveedor_nombre: e.target.value});
                        setBusquedaProv(e.target.value);
                      }}
                      className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Ej. Juan Pérez"
                    />
                    {busquedaProv && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 max-h-40 overflow-y-auto">
                        {proveedores.filter(p => p.nombre_comercial?.toLowerCase().includes(busquedaProv.toLowerCase())).map(p => (
                          <div key={p.id} onClick={() => handleSelectProv(p)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 text-xs font-bold text-slate-700 uppercase">
                            {p.nombre_comercial} <span className="text-[9px] text-slate-400 ml-2">NIT/CC: {p.nit}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">NIT / Cédula</label>
                    <input 
                      type="text" 
                      value={nuevoDoc.proveedor_documento}
                      onChange={(e) => setNuevoDoc({...nuevoDoc, proveedor_documento: e.target.value})}
                      className="w-full px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="123456789"
                    />
                  </div>
                </div>
              </div>

              {/* Sección Opciones Generales */}
              <div className="bg-emerald-50/30 p-6 rounded-[32px] border border-emerald-50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-emerald-800 uppercase tracking-widest">2. Comportamiento en Sistema</h3>
                  <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-tighter leading-tight max-w-sm">Si se activa, los ítems sumarán existencias al inventario y se registrarán en el Kardex.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" checked={nuevoDoc.afecta_inventario} onChange={e => setNuevoDoc({...nuevoDoc, afecta_inventario: e.target.checked})} className="sr-only peer" />
                  <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                  <span className="ml-3 text-[10px] font-black uppercase tracking-widest text-emerald-700">{nuevoDoc.afecta_inventario ? 'Afecta Inventario' : 'Sólo Registro Contable'}</span>
                </label>
              </div>

              {/* Sección Archivo Adjunto */}
              <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">3. Factura o Soporte Físico (Opcional)</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter leading-tight max-w-sm">Adjunta el archivo PDF o imagen (JPG/PNG) entregado por el proveedor. Máximo 5MB.</p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <label className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 cursor-pointer shadow-sm transition-all flex items-center gap-2">
                    📎 {nuevoDoc.archivo_adjunto ? 'Cambiar Archivo' : 'Cargar Archivo'}
                    <input type="file" accept=".pdf,image/jpeg,image/png" className="hidden" onChange={handleFileChange} />
                  </label>
                  {nuevoDoc.archivo_adjunto && (
                    <button onClick={() => setNuevoDoc(prev => ({...prev, archivo_adjunto: ""}))} className="text-rose-500 hover:text-rose-600 font-bold text-lg" title="Quitar Archivo">&times;</button>
                  )}
                </div>
              </div>

              {/* Sección Ítems */}
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">4. Detalle de Ítems / Servicios</h3>
                  <div className="flex gap-2 relative">
                    {/* Búsqueda de producto existente */}
                    <input 
                      type="text" 
                      placeholder="Buscar producto existente..." 
                      value={busquedaProd}
                      onChange={e => setBusquedaProd(e.target.value)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none w-64 focus:ring-2 focus:ring-blue-100"
                    />
                    {busquedaProd && (
                      <div className="absolute top-full left-0 w-64 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl z-20 max-h-40 overflow-y-auto">
                        {productosBusqueda.filter(p => p.nombre?.toLowerCase().includes(busquedaProd.toLowerCase()) || p.referencia?.toLowerCase().includes(busquedaProd.toLowerCase())).slice(0,20).map(p => (
                          <div key={p.id} onClick={() => handleAddExistingProd(p)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 text-[10px] font-bold text-slate-700 uppercase">
                            {p.nombre} <span className="text-blue-500 ml-1">({p.cantidad} disp.)</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      onClick={handleAddCustomProd}
                      className="px-4 py-2 bg-blue-100 text-blue-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-200 transition-colors"
                    >
                      + Ítem Manual
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100/50">
                      <tr className="text-[9px] text-slate-500 uppercase tracking-widest">
                        <th className="px-4 py-3">Código/Ref</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3 w-20">Es Servicio</th>
                        <th className="px-4 py-3 w-24">Cant.</th>
                        <th className="px-4 py-3 w-32">V. Unitario</th>
                        <th className="px-4 py-3 w-32">Subtotal</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {cart.length === 0 ? (
                        <tr><td colSpan={7} className="py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Añade ítems para facturar</td></tr>
                      ) : (
                        cart.map((c, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-4 py-2">
                              <input type="text" value={c.referencia || ''} onChange={e => updateCartItem(i, 'referencia', e.target.value)} disabled={!c.isNew} className="w-full bg-transparent outline-none text-xs font-bold text-slate-700 disabled:opacity-50" placeholder="Opcional" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="text" value={c.nombre || ''} onChange={e => updateCartItem(i, 'nombre', e.target.value)} disabled={!c.isNew} className="w-full bg-transparent outline-none text-xs font-bold text-slate-900 uppercase disabled:opacity-70" placeholder="Nombre del ítem" />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <input type="checkbox" checked={!!c.es_servicio} onChange={e => updateCartItem(i, 'es_servicio', e.target.checked)} disabled={!c.isNew} className="accent-blue-600" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="1" value={c.cantidad || 1} onChange={e => updateCartItem(i, 'cantidad', parseFloat(e.target.value) || 1)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-xs font-bold text-center" />
                            </td>
                            <td className="px-4 py-2">
                              <input type="number" min="0" value={c.precio_compra || 0} onChange={e => updateCartItem(i, 'precio_compra', parseFloat(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none text-xs font-bold text-right text-blue-700" />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="text-xs font-black text-slate-800">{formatCOP((c.cantidad || 1) * (c.precio_compra || 0))}</div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <button onClick={() => removeCartItem(i)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4">
                  <div className="bg-slate-900 rounded-3xl p-6 text-white min-w-[300px] space-y-3 shadow-2xl">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2">
                      <span>Subtotal</span>
                      <span>{formatCOP(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xl font-black tracking-tighter pt-1">
                      <span className="text-blue-400">TOTAL</span>
                      <span>{formatCOP(total)}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0 gap-3">
              <button onClick={() => setShowNewModal(false)} className="px-8 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 rounded-2xl transition-colors">Cancelar</button>
              <button onClick={handleCreate} className="px-12 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all">Emitir Documento</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ítem Manual */}
      {showManualItemModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setShowManualItemModal(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/50">
              <h2 className="text-xl font-black text-blue-900 tracking-tight">Agregar Ítem Manual</h2>
              <button onClick={() => setShowManualItemModal(false)} className="text-slate-400 hover:text-rose-500 text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Código / Ref</label>
                  <input type="text" value={manualItem.referencia} onChange={e => handleManualItemChange('referencia', e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. REF-01" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Categoría</label>
                  <input type="text" value={manualItem.categoria} onChange={e => handleManualItemChange('categoria', e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="General" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre / Descripción *</label>
                <input type="text" value={manualItem.nombre} onChange={e => handleManualItemChange('nombre', e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" placeholder="Ej. Teclado Mecánico" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Cantidad</label>
                  <input type="number" min="1" value={manualItem.cantidad} onChange={e => handleManualItemChange('cantidad', parseFloat(e.target.value) || 1)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 text-center" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Impuesto %</label>
                  <input type="number" min="0" value={manualItem.impuesto} onChange={e => handleManualItemChange('impuesto', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 text-center" />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fecha Vencimiento (Opcional)</label>
                  <input type="date" value={manualItem.fecha_vencimiento} onChange={e => handleManualItemChange('fecha_vencimiento', e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-700 uppercase ml-1">Costo Unit. (Base)</label>
                  <input type="number" min="0" value={manualItem.precio_compra} onChange={e => handleManualItemChange('precio_compra', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500/20 text-right" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-700 uppercase ml-1">Margen Ganancia %</label>
                  <input type="number" min="0" value={manualItem.porcentaje_ganancia} onChange={e => handleManualItemChange('porcentaje_ganancia', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-xl text-sm font-bold text-emerald-900 outline-none focus:ring-2 focus:ring-emerald-500/20 text-center" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-700 uppercase ml-1">Precio Sugerido Venta</label>
                  <input type="number" min="0" value={manualItem.precio_venta} onChange={e => handleManualItemChange('precio_venta', parseFloat(e.target.value) || 0)} className="w-full px-4 py-2 bg-emerald-600 border border-emerald-700 rounded-xl text-sm font-black text-white outline-none focus:ring-2 focus:ring-emerald-500/20 text-right" />
                </div>
              </div>

              <label className="flex items-center gap-2 mt-2 cursor-pointer bg-slate-50 p-3 rounded-xl border border-slate-200 w-fit">
                <input type="checkbox" checked={manualItem.es_servicio} onChange={e => handleManualItemChange('es_servicio', e.target.checked)} className="accent-blue-600 w-4 h-4" />
                <span className="text-[10px] font-bold text-slate-700 uppercase">Es un Servicio (No mueve stock)</span>
              </label>

            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowManualItemModal(false)} className="px-6 py-2 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-200 rounded-xl">Cancelar</button>
              <button onClick={confirmAddManualItem} className="px-8 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700">Agregar Ítem</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver / Imprimir Documento */}
      {showViewModal && viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowViewModal(false)}></div>
          <div className="relative w-full max-w-3xl bg-white rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-400 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                Consulta de Documento <span className={`text-[10px] px-3 py-1 rounded-full uppercase tracking-widest ${viewDoc.estado === 'Anulado' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{viewDoc.estado}</span>
              </h2>
              <div className="flex gap-2">
                {viewDoc.archivo_adjunto && (
                   <button 
                     onClick={() => {
                       const win = window.open();
                       if (win) {
                         if (viewDoc.archivo_adjunto.startsWith('data:application/pdf')) {
                           win.document.write(`<iframe src="${viewDoc.archivo_adjunto}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                         } else {
                           win.document.write(`<img src="${viewDoc.archivo_adjunto}" style="max-width:100%; height:auto;" />`);
                         }
                       }
                     }} 
                     className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-700 font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors flex items-center gap-2"
                   >
                     📎 Ver Soporte
                   </button>
                )}
                <button onClick={() => {setTimeout(()=>handlePrint(), 200)}} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm" title="Imprimir">🖨️</button>
                <button onClick={() => setShowViewModal(false)} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-500 hover:border-rose-200 transition-colors">&times;</button>
              </div>
            </div>

            <div className="p-8 flex-1 overflow-y-auto bg-slate-50/50">
              {/* Contenedor imprimible */}
              <div ref={printRef} className="bg-white p-8 border border-slate-200 rounded-sm shadow-sm max-w-[800px] mx-auto print:shadow-none print:border-none print:p-0 font-mono text-sm text-slate-800">
                <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                  <h1 className="text-2xl font-bold uppercase tracking-widest mb-1">DOCUMENTO SOPORTE</h1>
                  <h2 className="text-sm font-semibold uppercase tracking-wider">En adquisiciones efectuadas a sujetos no obligados a expedir factura o documento equivalente</h2>
                  <div className="mt-4 text-lg font-bold">N° {viewDoc.prefijo} - {viewDoc.numero_documento.toString().padStart(6, '0')}</div>
                  <div className="text-xs mt-1 text-slate-500">Fecha de Generación: {new Date(viewDoc.fecha).toLocaleString('es-CO')}</div>
                </div>

                <div className="mb-6 border border-slate-800 p-4 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    <div className="font-bold col-span-1">Adquiriente:</div>
                    <div className="col-span-3">SU EMPRESA S.A.S (Configurado en DIAN)</div>
                    <div className="font-bold col-span-1">Proveedor:</div>
                    <div className="col-span-3 uppercase">{viewDoc.proveedor_nombre}</div>
                    <div className="font-bold col-span-1">NIT/CC:</div>
                    <div className="col-span-3">{viewDoc.proveedor_documento || 'No registrado'}</div>
                  </div>
                </div>

                <table className="w-full text-left mb-6 border-collapse border border-slate-800">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-800 px-3 py-2">Ref</th>
                      <th className="border border-slate-800 px-3 py-2">Descripción</th>
                      <th className="border border-slate-800 px-3 py-2 text-center">Cant.</th>
                      <th className="border border-slate-800 px-3 py-2 text-right">V. Unit</th>
                      <th className="border border-slate-800 px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(typeof viewDoc.datos_json === 'string' ? JSON.parse(viewDoc.datos_json) : viewDoc.datos_json).map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-slate-800 px-3 py-2 text-xs">{item.referencia || '-'}</td>
                        <td className="border border-slate-800 px-3 py-2 text-xs uppercase">{item.nombre}</td>
                        <td className="border border-slate-800 px-3 py-2 text-xs text-center">{item.cantidad}</td>
                        <td className="border border-slate-800 px-3 py-2 text-xs text-right">{formatCOP(item.precio_compra)}</td>
                        <td className="border border-slate-800 px-3 py-2 text-xs text-right">{formatCOP(item.cantidad * item.precio_compra)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-64 border border-slate-800">
                    <div className="flex justify-between border-b border-slate-800 p-2">
                      <span className="font-bold">Subtotal:</span>
                      <span>{formatCOP(viewDoc.subtotal)}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800 p-2">
                      <span className="font-bold">Impuestos:</span>
                      <span>{formatCOP(viewDoc.impuestos)}</span>
                    </div>
                    <div className="flex justify-between bg-slate-100 p-2 text-lg">
                      <span className="font-bold">TOTAL:</span>
                      <span className="font-bold">{formatCOP(viewDoc.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-12 text-center text-xs text-slate-500 italic">
                  Documento generado electrónicamente por Impulsa POS<br/>
                  (Firma electrónica pendiente de integración con PT)
                </div>
              </div>
            </div>

            {viewDoc.estado === 'Emitido' && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-start">
                <button 
                  onClick={() => handleAnular(viewDoc.id, true)} 
                  className="px-6 py-2.5 bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-200 transition-colors flex items-center gap-2"
                >
                  ⚠️ Anular Documento (Revierte Inventario)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
