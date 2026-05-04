import React, { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import PrintReceipt from "../components/PrintReceipt";

interface Producto {
  id: number;
  nombre: string;
  referencia: string;
  precio_venta: number;
  cantidad: number;
}

interface Cliente {
  id: number;
  nombre: string;
  documento: string;
  telefono?: string;
}

export default function Separados() {
  const [separados, setSeparados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [termSeparado, setTermSeparado] = useState("");

  // For New Separado
  const [showNewModal, setShowNewModal] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  
  const [empresa, setEmpresa] = useState<any>({});
  const [facturaPrintData, setFacturaPrintData] = useState<{cabecera: any, detalles: any[]} | null>(null);
  const [separadoPrintData, setSeparadoPrintData] = useState<{separado: any, abonos: any[]} | null>(null);

  const [newClienteId, setNewClienteId] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [prodSearch, setProdSearch] = useState("");
  const [initialPayment, setInitialPayment] = useState("");

  // For View/Abonar
  const [viewSeparado, setViewSeparado] = useState<any>(null);
  const [viewAbonos, setViewAbonos] = useState<any[]>([]);
  const [abonoInput, setAbonoInput] = useState("");

  const [cajeros, setCajeros] = useState<any[]>([]);
  const [cajeroId, setCajeroId] = useState(localStorage.getItem('adminCajeroId') || "");
  const [phoneWS, setPhoneWS] = useState("");

  const viewSeparadoRef = useRef<any>(null);
  useEffect(() => {
    viewSeparadoRef.current = viewSeparado;
  }, [viewSeparado]);

  // Payment Methods States
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [pagoEfectivo, setPagoEfectivo] = useState("");
  const [pagoTransferencia, setPagoTransferencia] = useState("");

  const facturaContentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFactura = useReactToPrint({ contentRef: facturaContentRef });

  const separadoContentRef = useRef<HTMLDivElement>(null);
  const reactToPrintSeparado = useReactToPrint({ contentRef: separadoContentRef });

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchSeparados();
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/productos?limit=1000").then(res => setProductos(Array.isArray(res.data) ? res.data : (res.data.data || []))).catch(console.error);
    API.get("/cajeros")
      .then(res => {
        setCajeros(res.data);
        if (cajeroId && !res.data.find((c: any) => c.id.toString() === cajeroId)) {
          setCajeroId("");
        }
      })
      .catch(console.error);
    
    API.get("/empresa").then(res => {
      setEmpresa(res.data);
      // Sincronización Real-time
      if (res.data.id) {
         import("../utils/socket").then(({ joinEmpresaRoom, socket }) => {
            joinEmpresaRoom(res.data.id);
            
            // Listener para nuevos creados o cambios de estado
            const handleGeneralUpdate = () => fetchSeparados();
            socket.on("separado_created", handleGeneralUpdate);
            socket.on("separado_updated", handleGeneralUpdate);

            // Listener para abonos (Afecta la vista interna si está abierta)
            socket.on("abono_added", ({ separado_id }) => {
               fetchSeparados();
               // Si la ventana abierta es la de este separado, refrescarla
               if (viewSeparadoRef.current?.id === separado_id) {
                 openView(separado_id);
               }
            });
         });
      }
    }).catch(console.error);

    return () => {
      import("../utils/socket").then(({ socket }) => {
        socket.off("separado_created");
        socket.off("separado_updated");
        socket.off("abono_added");
      });
    };
  }, []);

  const fetchSeparados = () => {
    setLoading(true);
    API.get("/separados")
      .then(res => { setSeparados(res.data); setLoading(false); })
      .catch(console.error);
  };

  const handleCreate = async () => {
    if (!newClienteId) return alert("Selecciona un cliente");
    if (cart.length === 0) return alert("Agrega al menos un producto");
    
    const total = cart.reduce((acc, c) => acc + (c.precio_venta * c.qty), 0);
    const abono = parseFloat(initialPayment) || 0;
    
    if (abono > total) return alert("El abono inicial no puede ser mayor al total");

    try {
      const payload = {
        cliente_id: parseInt(newClienteId),
        detalles: cart,
        total,
        abono_inicial: abono,
        metodo_pago: metodoPago,
        pago_efectivo: parseFloat(pagoEfectivo) || 0,
        pago_transferencia: parseFloat(pagoTransferencia) || 0,
        cajero_id: cajeroId ? parseInt(cajeroId) : null
      };

      await API.post("/separados", payload);
      alert("✅ Separado creado exitosamente");
      setShowNewModal(false);
      setCart([]);
      setNewClienteId("");
      setInitialPayment("");
      fetchSeparados();
    } catch (error) {
      console.error(error);
      alert("Error al crear el separado");
    }
  };

  const addProdToCart = (prod: Producto) => {
    const exist = cart.find(x => x.id === prod.id);
    const currentQty = exist ? exist.qty : 0;

    if (currentQty + 1 > prod.cantidad) {
      alert(`⚠️ PRODUCTO AGOTADO. Solo quedan ${prod.cantidad} unidades disponibles.`);
      return;
    }

    if (exist) {
      setCart(cart.map(x => x.id === prod.id ? { ...exist, qty: exist.qty + 1 } : x));
    } else {
      setCart([...cart, { ...prod, qty: 1 }]);
    }
    setProdSearch("");
  };

  const handleProdKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && prodSearch.trim() !== '') {
      const term = prodSearch.trim();
      const items = Array.isArray(productos) ? productos : [];
      
      // 1. Intentar match local por referencia exacta (rápido)
      let matched = items.find(p => 
        (p.referencia && String(p.referencia).toLowerCase() === term.toLowerCase())
      );

      // 2. Si no hay match por referencia, intentar match local por nombre
      if (!matched) {
        matched = items.find(p => 
          String(p.nombre).toLowerCase().includes(term.toLowerCase())
        );
      }

      if (matched) {
        addProdToCart(matched);
        setProdSearch("");
      } else {
        // 3. Búsqueda en backend por referencia/código de barras
        try {
          const res = await API.get(`/productos/buscar/${encodeURIComponent(term)}`);
          if (res.data && res.data.id) {
            const newProd = res.data;
            // Sincronizar con el estado local para que updateCartQty funcione
            if (!items.find(p => p.id === newProd.id)) {
              setProductos(prev => [...prev, newProd]);
            }
            addProdToCart(newProd);
            setProdSearch("");
          } else {
            console.log("Producto no encontrado por referencia exacta en backend.");
          }
        } catch (error) {
          console.error("Error al buscar producto por barcode:", error);
        }
      }
    }
  };

  const updateCartQty = (id: number, delta: number) => {
    const prodRef = productos.find(p => p.id === id);
    if (!prodRef) return;

    setCart(cart.map(x => {
      if (x.id === id) {
        const newQty = x.qty + delta;
        
        if (newQty > prodRef.cantidad) {
          alert(`⚠️ STOCK MÁXIMO ALCANZADO. Solo hay ${prodRef.cantidad} unidades.`);
          return x;
        }
        
        return { ...x, qty: Math.max(1, newQty) };
      }
      return x;
    }));
  };

  const setManualQty = (id: number, qtyStr: string) => {
    const prodRef = productos.find(p => p.id === id);
    if (!prodRef) return;

    const qty = parseInt(qtyStr) || 1;
    const finalQty = Math.max(1, qty);

    if (finalQty > prodRef.cantidad) {
      alert(`⚠️ STOCK INSUFICIENTE. Máximo disponible: ${prodRef.cantidad}`);
      setCart(cart.map(x => x.id === id ? { ...x, qty: prodRef.cantidad } : x));
      return;
    }

    setCart(cart.map(x => x.id === id ? { ...x, qty: finalQty } : x));
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(x => x.id !== id));
  };

  const openView = (id: number) => {
    API.get(`/separados/${id}`)
      .then(res => {
        setViewSeparado(res.data.separado);
        setViewAbonos(res.data.abonos);
        setAbonoInput("");
        
        // Cargar teléfono del cliente
        const objCliente = (clientes as any[]).find(c => c.nombre === res.data.separado.cliente_nombre);
        setPhoneWS(objCliente?.telefono?.replace(/\D/g, '') || "");
      })
      .catch(console.error);
  };

  const handleAbonar = async () => {
    const abono = parseFloat(abonoInput);
    if (!abono || abono <= 0) return alert("Ingresa un abono válido");
    if (abono > viewSeparado.saldo_pendiente) return alert("El abono no puede superar el saldo pendiente");

    if (metodoPago === "Mixto") {
      const sum = (parseFloat(pagoEfectivo) || 0) + (parseFloat(pagoTransferencia) || 0);
      if (Math.abs(sum - abono) > 1) return alert(`La suma (${formatCOP(sum)}) debe coincidir con el abono (${formatCOP(abono)})`);
    }

    try {
      await API.post(`/separados/${viewSeparado.id}/abonos`, { 
        monto: abono,
        metodo_pago: metodoPago,
        pago_efectivo: parseFloat(pagoEfectivo) || 0,
        pago_transferencia: parseFloat(pagoTransferencia) || 0,
        cajero_id: cajeroId ? parseInt(cajeroId) : null
      });
      setMetodoPago("Efectivo");
      setPagoEfectivo("");
      setPagoTransferencia("");
      openView(viewSeparado.id);
      fetchSeparados();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al abonar");
    }
  };

  const handleCompletar = async () => {
    if (!cajeroId) return alert("Selecciona el cajero vendedor");
    try {
      const resp = await API.put(`/separados/${viewSeparado.id}/completar`, { cajero_id: cajeroId ? parseInt(cajeroId) : null });
      
      if (window.confirm("¿Imprimir comprobante de entrega?")) {
        API.get(`/ventas/${resp.data.factura_id}`)
          .then(resVentas => {
            const cajeroName = cajeros.find(c => c.id.toString() === cajeroId)?.nombre || "Principal";
            setFacturaPrintData({
              cabecera: {
                id: resp.data.factura_id,
                cliente: viewSeparado.cliente_nombre || "Casual",
                fecha: new Date().toISOString(),
                total: viewSeparado.total,
                metodo_pago: "Efectivo",
                cajero: cajeroName
              },
              detalles: resVentas.data
            });
            setTimeout(() => reactToPrintFactura(), 200);
          })
          .catch(console.error);
      }
      openView(viewSeparado.id);
      fetchSeparados();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al completar venta");
    }
  };

  const handleAnular = async () => {
    if (!window.confirm("¿Anular este separado?")) return;
    try {
      await API.put(`/separados/${viewSeparado.id}/anular`);
      openView(viewSeparado.id);
      fetchSeparados();
    } catch (e: any) {
      alert(e.response?.data?.error || "Error al anular");
    }
  };

  const handlePrintSeparado = () => {
    setSeparadoPrintData({separado: viewSeparado, abonos: viewAbonos});
    setTimeout(() => {
      reactToPrintSeparado();
    }, 200);
  };

  const compartirWhatsApp = async () => {
    if (!viewSeparado) return;
    
    const itms = typeof viewSeparado.detalles_json === 'string' ? JSON.parse(viewSeparado.detalles_json) : viewSeparado.detalles_json;
    const itemsStr = itms.map((i: any) => `• ${i.nombre} (x${i.qty || i.cantidad})`).join('\n');
    
    const mensaje = `¡Hola! 👋\n📝 *Información de tu Separado # ${viewSeparado.id}*\n\n🌿 *Cliente:* ${viewSeparado.cliente_nombre}\n💰 *Total:* ${formatCOP(viewSeparado.total)}\n📉 *Saldo Pendiente:* ${formatCOP(viewSeparado.saldo_pendiente)}\n\n🛒 *Productos en Reserva:*\n${itemsStr}\n\n¡Gracias por tu confianza! ✨`;
    
    let targetPhone = phoneWS.replace(/\D/g, '');

    if (!targetPhone || targetPhone === '0') {
      const manualPhone = window.prompt("📱 Ingresa el número de WhatsApp (ej: 300...):");
      if (!manualPhone) return;
      targetPhone = manualPhone.replace(/\D/g, '');
      setPhoneWS(targetPhone);
    }

    const fullNum = targetPhone.startsWith('57') ? targetPhone : `57${targetPhone}`;
    const waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, '_blank');
  };

  const filteredSeparados = separados.filter(s => {
    const term = termSeparado.toLowerCase();
    const isIdMatch = s.id.toString().includes(term);
    const isNameMatch = s.cliente_nombre && s.cliente_nombre.toLowerCase().includes(term);
    const isDocMatch = s.cliente_documento && s.cliente_documento.toLowerCase().includes(term);
    return isIdMatch || isNameMatch || isDocMatch;
  });

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      <div className="no-print space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-200">
            <div className="space-y-1">
                <h1 className="text-4xl tracking-tight text-blue-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-cyan-500 font-black">
                    Sistema de Separados
                </h1>
                <p className="text-blue-400 font-medium text-lg italic">Créditos, abonos y reserva de inventario premium.</p>
            </div>
            <button 
                onClick={() => setShowNewModal(true)}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-[24px] text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(37,99,235,0.3)] hover:shadow-blue-300 hover:-translate-y-1 transition-all active:scale-95"
            >
                + Iniciar Nuevo Trámite
            </button>
        </div>

        {/* Search Bar */}
        <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-400 group-focus-within:text-blue-600 transition-colors text-xl">🔍</span>
            <input 
                type="text" 
                placeholder="Localizar separado por cliente, ID o documento..." 
                value={termSeparado} 
                onChange={e => setTermSeparado(e.target.value)} 
                className="w-full pl-16 pr-8 py-5 bg-white border-2 border-blue-50 rounded-[32px] text-slate-700 outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.05)]"
            />
        </div>

        {/* List Card */}
        <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-blue-50 flex items-center justify-between bg-blue-50/20">
                <h3 className="text-lg text-blue-900 uppercase tracking-widest flex items-center gap-2 font-black">
                    <span className="w-2 h-6 bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"></span> Cartera Activa
                </h3>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-widest px-4 py-1.5 bg-white border border-blue-100 rounded-full shadow-sm">
                    {filteredSeparados.length} Registros Activos
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white">
                            <th className="px-8 py-5">Control #</th>
                            <th className="px-8 py-5">Titular del Separado</th>
                            <th className="px-8 py-5 text-center">Valor Base</th>
                            <th className="px-8 py-5 text-center">Saldo Residual</th>
                            <th className="px-8 py-5 text-center">Progreso</th>
                            <th className="px-8 py-5 text-center">Estatus</th>
                            <th className="px-8 py-5 text-center">Opciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan={7} className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">Sincronizando estado de carteras...</td></tr>
                        ) : filteredSeparados.length === 0 ? (
                            <tr><td colSpan={7} className="py-24 text-center text-slate-300 font-bold italic opacity-50">No hay registros para mostrar.</td></tr>
                        ) : (
                            filteredSeparados.map(s => {
                                const pagado = parseFloat(s.total) - parseFloat(s.saldo_pendiente);
                                const pct = (pagado / parseFloat(s.total)) * 100;
                                return (
                                    <tr key={s.id} className="group hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openView(s.id)}>
                                        <td className="px-8 py-6 text-slate-400">#{(s.id).toString().padStart(4, '0')}</td>
                                        <td className="px-8 py-6">
                                            <div className="text-slate-900 group-hover:text-amber-600 transition-colors uppercase leading-tight">{s.cliente_nombre || "Cliente Casual"}</div>
                                            <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Desde: {new Date(s.fecha_creacion).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-8 py-6 text-center text-slate-600 text-xs">{formatCOP(s.total)}</td>
                                        <td className="px-8 py-6 text-center">
                                            <div className={`text-lg tracking-tighter ${parseFloat(s.saldo_pendiente) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {formatCOP(s.saldo_pendiente)}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="w-24 mx-auto h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className={`px-4 py-1 rounded-full text-[9px] uppercase tracking-widest ${
                                                s.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700' : 
                                                s.estado === 'Pagado' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {s.estado}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <button className="px-5 py-2 bg-white border border-slate-200 text-[10px] text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest">Abrir</button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* MODAL: New Separado */}
        {showNewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowNewModal(false)}></div>
                <div className="relative w-full max-w-2xl bg-white rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-400 flex flex-col max-h-[90vh]">
                    <div className="p-10 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Iniciar Nuevo Separado</h2>
                        <button onClick={() => setShowNewModal(false)} className="text-3xl text-slate-300 hover:text-slate-500 transition-colors">&times;</button>
                    </div>
                    
                    <div className="p-10 flex-1 overflow-y-auto space-y-8 scrollbar-none">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">Vincular Cliente</label>
                            {newClienteId ? (
                                <div className="flex items-center justify-between py-2 px-5 bg-blue-50 border border-blue-100 rounded-2xl">
                                    <span className="text-xs font-bold text-blue-800 uppercase tracking-tight">
                                        {clientes.find(c => c.id.toString() === newClienteId)?.nombre}
                                    </span>
                                    <button onClick={() => setNewClienteId("")} className="text-[10px] font-black text-red-400 hover:text-red-600">QUITAR</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        value={clienteSearch} 
                                        onChange={e => setClienteSearch(e.target.value)} 
                                        placeholder="Nombre o cédula del cliente..." 
                                        className="w-full px-5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10" 
                                    />
                                    {clienteSearch && (
                                        <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-xl shadow-xl z-20 mt-1 overflow-hidden max-h-40 overflow-y-auto">
                                            {(clientes as any[]).filter(c => 
                                        (c.nombre && String(c.nombre).toLowerCase().includes(clienteSearch.toLowerCase())) || 
                                        (c.documento && String(c.documento).includes(clienteSearch))
                                    ).map(c => (
                                                <div key={c.id} onClick={() => { setNewClienteId(c.id.toString()); setClienteSearch(""); }} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 text-[11px] font-bold text-slate-700 uppercase">
                                                    {c.nombre} <span className="text-[9px] text-slate-400 ml-2">ID: {c.documento}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-bold text-blue-600 uppercase tracking-widest ml-1">Ítems a Reservar</label>
                                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 italic">
                                    {cart.reduce((a,c) => a+c.qty, 0)} PRODUCTOS REGISTRADOS
                                </span>
                            </div>
                            <input 
                                type="text" 
                                value={prodSearch} 
                                onChange={e => setProdSearch(e.target.value)} 
                                onKeyDown={handleProdKeyPress}
                                placeholder="Escanea código o busca por nombre..." 
                                className="w-full px-5 py-3.5 bg-slate-50 border-2 border-blue-50 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/30 transition-all placeholder:text-slate-300" 
                            />
                            {prodSearch && (
                                <div className="bg-white border border-slate-100 rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto mt-1">
                                    {(Array.isArray(productos) ? productos : []).filter(p => 
                                        String(p.nombre).toLowerCase().includes(prodSearch.toLowerCase()) || 
                                        (p.referencia && String(p.referencia).toLowerCase().includes(prodSearch.toLowerCase()))
                                    ).map(p => (
                                        <div key={p.id} onClick={() => addProdToCart(p)} className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 flex justify-between items-center transition-colors">
                                            <div className="space-y-0.5">
                                                <div className="text-[11px] font-bold text-slate-800 uppercase leading-tight">{p.nombre}</div>
                                                <div className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">Stock: {p.cantidad}</div>
                                            </div>
                                            <div className="font-bold text-blue-600 text-[11px]">{formatCOP(p.precio_venta)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-1.5 mt-2">
                                {cart.map((c) => (
                                    <div key={c.id} className="flex justify-between items-center py-2 px-4 bg-blue-50/40 rounded-2xl border border-blue-100/50 hover:bg-blue-50 transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[11px] font-bold text-blue-900 uppercase truncate">{c.nombre}</div>
                                            <div className="text-[9px] text-blue-400 font-medium">{formatCOP(c.precio_venta)} c/u</div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-blue-100 shadow-sm">
                                            <button onClick={() => updateCartQty(c.id, -1)} className="w-5 h-5 flex items-center justify-center text-blue-400 hover:text-red-500 transition-colors text-xs font-black">－</button>
                                            <input 
                                                type="number" 
                                                value={c.qty} 
                                                onChange={e => setManualQty(c.id, e.target.value)}
                                                className="w-8 text-center text-[11px] font-black text-blue-700 outline-none bg-transparent"
                                            />
                                            <button onClick={() => updateCartQty(c.id, 1)} className="w-5 h-5 flex items-center justify-center text-blue-400 hover:text-blue-600 transition-colors text-xs font-black">＋</button>
                                        </div>
                                        <button 
                                            onClick={() => removeFromCart(c.id)} 
                                            className="ml-3 p-1.5 text-blue-200 hover:text-white hover:bg-red-500 rounded-lg transition-all active:scale-90"
                                            title="Eliminar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-50">
                                    <label className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-1 block">Total Separado</label>
                                    <div className="text-2xl font-black text-blue-900 tracking-tighter">
                                        {formatCOP(cart.reduce((a,c) => a + c.precio_venta*c.qty, 0))}
                                    </div>
                                </div>
                                <div className="bg-amber-50/30 p-3 rounded-xl border border-amber-50">
                                    <label className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1 block">Abono Inicial ($)</label>
                                    <input type="number" value={initialPayment} onChange={e => { setInitialPayment(e.target.value); setAbonoInput(e.target.value); }} placeholder="0.00" className="w-full bg-transparent font-black text-amber-700 text-xl outline-none" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">Forma de Pago del Abono</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {["Efectivo", "Transferencia", "Mixto"].map((m) => (
                                        <button key={m} onClick={() => setMetodoPago(m)} className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${metodoPago === m ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' : 'bg-white text-blue-400 border-blue-100 hover:border-blue-300'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>

                                {metodoPago === "Mixto" && (
                                    <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
                                        <input type="number" placeholder="Efectivo" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center text-blue-700" />
                                        <input type="number" placeholder="Transferencia" value={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center text-blue-700" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-center shrink-0">
                        <button 
                            onClick={handleCreate} 
                            className="px-12 py-3.5 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 transition-all uppercase tracking-widest text-[11px] active:scale-95"
                        >
                            Confirmar Separado
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODAL: View/Manage Separado */}
        {viewSeparado && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setViewSeparado(null)}></div>
                <div className="relative w-full max-w-xl bg-white rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-400">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="space-y-1">
                            <h2 className="text-xl font-medium text-slate-900 tracking-tight flex items-center gap-2">
                                Auditoría #{(viewSeparado.id).toString().padStart(4, '0')}
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{viewSeparado.estado}</span>
                            </h2>
                            <p className="text-slate-400 font-medium text-[10px] uppercase px-1 leading-none">Titular: {viewSeparado.cliente_nombre}</p>
                        </div>
                        <button onClick={() => setViewSeparado(null)} className="text-2xl text-slate-300 hover:text-slate-500 font-medium">&times;</button>
                    </div>

                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-none">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Paquete Bloqueado</h4>
                            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-100 space-y-3">
                                {(() => {
                                    const items = typeof viewSeparado.detalles_json === 'string' ? JSON.parse(viewSeparado.detalles_json) : viewSeparado.detalles_json;
                                    return (items || []).map((itm: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-xs text-slate-700 border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                                            <span>{itm.qty || itm.cantidad}x <span className="uppercase text-slate-400">{itm.nombre}</span></span>
                                            <span>{formatCOP((itm.precio_venta || itm.precio_final || 0) * (itm.qty || itm.cantidad))}</span>
                                        </div>
                                    ));
                                })()}
                                <div className="pt-3 flex justify-between items-end">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inversión Lote</span>
                                    <span className="text-xl font-black text-slate-900 tracking-tighter">{formatCOP(viewSeparado.total)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h4 className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">Trayectoria de Pagos</h4>
                            <div className="space-y-2">
                                {viewAbonos.length > 0 ? viewAbonos.map(a => (
                                    <div key={a.id} className="flex justify-between items-start p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl group transition-all hover:bg-emerald-50">
                                        <div className="space-y-0.5">
                                            <div className="text-[10px] font-medium text-emerald-700 uppercase tracking-widest italic">
                                                {a.fecha_abono ? new Date(a.fecha_abono).toLocaleDateString('es-CO') : 'Reciente'}
                                            </div>
                                            {a.cajero_nombre && (
                                                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Recibido por: {a.cajero_nombre}</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-emerald-600 text-sm">+{formatCOP(a.monto)}</div>
                                            <div className="text-[7px] font-bold text-slate-300 uppercase">{a.metodo_pago}</div>
                                        </div>
                                    </div>
                                )) : <p className="text-center py-4 text-slate-300 font-medium italic text-xs">Sin movimientos registrados.</p>}
                            </div>
                        </div>

                        {viewSeparado.estado === 'Pendiente' && (
                            <div className="pt-4 border-t border-slate-100 space-y-4">
                                {parseFloat(viewSeparado.saldo_pendiente) > 0 ? (
                                    <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Deuda Actual</span>
                                            <span className="text-xl font-black text-amber-600 tracking-tighter">{formatCOP(viewSeparado.saldo_pendiente)}</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-amber-200/50 pt-1">
                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest italic">Saldo proyectado</span>
                                            <span className="text-sm font-black text-emerald-700 tracking-tighter bg-emerald-50 px-2 rounded-lg">
                                                {formatCOP(Math.max(0, viewSeparado.saldo_pendiente - (parseFloat(abonoInput) || 0)))}
                                            </span>
                                        </div>
                                    </div>
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-3 gap-2">
                                                {["Efectivo", "Transferencia", "Mixto"].map((m) => (
                                                    <button key={m} onClick={() => setMetodoPago(m)} className={`py-2 rounded-lg text-[8px] font-bold uppercase tracking-widest transition-all border ${metodoPago === m ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-100 hover:border-amber-300'}`}>
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex gap-2">
                                                <input type="number" placeholder="Monto Total Abono..." value={abonoInput} onChange={e => setAbonoInput(e.target.value)} className="flex-1 px-4 py-2 bg-white border border-amber-200 rounded-xl font-bold text-amber-700 outline-none text-sm" />
                                                <button onClick={handleAbonar} className="px-6 py-2 bg-amber-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-widest shadow-lg shadow-amber-100">Registrar Abono</button>
                                            </div>

                                            {metodoPago === "Mixto" && (
                                                <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                                                    <input type="number" placeholder="Efectivo" value={pagoEfectivo} onChange={e => setPagoEfectivo(e.target.value)} className="w-full px-4 py-2 bg-white border border-amber-100 rounded-xl text-xs font-bold text-center" />
                                                    <input type="number" placeholder="Transferencia" value={pagoTransferencia} onChange={e => setPagoTransferencia(e.target.value)} className="w-full px-4 py-2 bg-white border border-amber-100 rounded-xl text-xs font-bold text-center" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 text-center space-y-3">
                                        <div className="space-y-1">
                                            <h4 className="font-medium text-emerald-800 text-sm uppercase">¡Total Liquidado!</h4>
                                            <p className="text-[9px] font-medium text-emerald-600 uppercase tracking-widest">Ya puedes entregar la mercancía.</p>
                                        </div>
                                        <select value={cajeroId} onChange={e => setCajeroId(e.target.value)} className="w-full px-4 py-2 bg-white border border-emerald-200 rounded-xl font-medium text-emerald-700 outline-none uppercase text-[10px]">
                                            <option value="">-- Seleccionar Vendedor --</option>
                                            {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                        <button onClick={handleCompletar} className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-medium shadow-lg uppercase tracking-widest text-[10px]">Finalizar y Descontar</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-slate-900 flex justify-between items-center gap-4">
                        {viewSeparado.estado === 'Pendiente' ? (
                            <button onClick={handleAnular} className="text-[10px] text-rose-400 hover:text-rose-300 uppercase tracking-widest transition-colors underline underline-offset-4">Anular</button>
                        ) : <div/>}
                        <div className="flex-1 flex gap-2">
                            <div className="flex-1 flex items-center bg-white/5 rounded-xl border border-white/10 px-3">
                                <span className="text-white/40 text-[9px] font-bold mr-2">+57</span>
                                <input 
                                    type="text" 
                                    placeholder="WhatsApp..." 
                                    value={phoneWS} 
                                    onChange={e => setPhoneWS(e.target.value)} 
                                    className="bg-transparent border-none outline-none text-white text-[11px] font-medium w-full"
                                />
                            </div>
                            <button onClick={handlePrintSeparado} className="px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all uppercase tracking-widest text-[9px] flex items-center gap-2 border border-white/10" title="Imprimir Recibo">
                                🖨️
                            </button>
                            <button onClick={compartirWhatsApp} className="px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all uppercase tracking-widest text-[9px] flex items-center gap-2 shadow-lg shadow-emerald-900/40" title="Compartir WhatsApp">
                                📱 WS
                            </button>
                            <button onClick={() => setViewSeparado(null)} className="px-5 py-3 bg-white text-slate-900 rounded-xl transition-all uppercase tracking-widest text-[9px]">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      <div style={{ display: 'none' }}>
        {facturaPrintData && (
          <PrintReceipt
            ref={facturaContentRef}
            empresa={empresa}
            numero={facturaPrintData.cabecera.id}
            fecha={facturaPrintData.cabecera.fecha}
            cliente={facturaPrintData.cabecera.cliente}
            cajero={facturaPrintData.cabecera.cajero}
            metodoPago="Efectivo"
            items={facturaPrintData.detalles}
            total={facturaPrintData.cabecera.total}
          />
        )}

        {separadoPrintData && (
          <PrintReceipt
            ref={separadoContentRef}
            empresa={empresa}
            numero={`SEP-${separadoPrintData.separado.id}`}
            fecha={separadoPrintData.separado.fecha_creacion}
            cliente={separadoPrintData.separado.cliente_nombre}
            cajero={separadoPrintData.separado.cajero_nombre || cajeros.find(c => c.id == separadoPrintData.separado.cajero_id)?.nombre || undefined}
            items={(() => {
                const items = typeof separadoPrintData.separado.detalles_json === 'string' ? JSON.parse(separadoPrintData.separado.detalles_json) : separadoPrintData.separado.detalles_json;
                return (items || []);
            })()}
            total={parseFloat(separadoPrintData.separado.total)}
            isSeparado={true}
            totalAbonado={parseFloat(separadoPrintData.separado.total || 0) - parseFloat(separadoPrintData.separado.saldo_pendiente || 0)}
            saldoPendiente={parseFloat(separadoPrintData.separado.saldo_pendiente || 0)}
            historialPagos={(separadoPrintData.abonos || []).map((a: any) => ({ ...a, fecha: a.fecha_abono || new Date() }))}
          />
        )}
      </div>

    </div>
  );
}
