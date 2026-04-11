import React, { useEffect, useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP, formatDateTime } from "../utils/format";
import PrintReceipt from "../components/PrintReceipt";

function Productos() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // POS States (Multi-Tab Core)
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem("posGeneralTabs");
    return savedTabs ? JSON.parse(savedTabs) : [{ id: 1, carrito: [], clienteId: "1", clienteSearch: "" }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const savedActiveTab = localStorage.getItem("posGeneralActiveTab");
    return savedActiveTab ? JSON.parse(savedActiveTab) : 1;
  });
  const fallbackTab = { id: 1, carrito: [], clienteId: "1", clienteSearch: "" };
  const getSafeTabs = () => Array.isArray(tabs) && tabs.length > 0 ? tabs : [fallbackTab];
  const activeTab = getSafeTabs().find((t: any) => t.id === activeTabId) || getSafeTabs()[0];

  useEffect(() => {
    localStorage.setItem("posGeneralTabs", JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem("posGeneralActiveTab", JSON.stringify(activeTabId));
  }, [activeTabId]);

  const carrito = activeTab.carrito;
  const clienteId = activeTab.clienteId;
  const clienteSearch = activeTab.clienteSearch;

  const updateActiveTab = (updates: any) => {
    setTabs((prev: any[]) => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };

  const setCarrito = (newCarrito: any[]) => updateActiveTab({ carrito: newCarrito });
  const setClienteId = (newId: string) => updateActiveTab({ clienteId: newId });
  const setClienteSearch = (newSearch: string) => updateActiveTab({ clienteSearch: newSearch });
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [pagoCliente, setPagoCliente] = useState("");
  const [pagoEfectivoMixto, setPagoEfectivoMixto] = useState("");
  const [pagoTransferenciaMixto, setPagoTransferenciaMixto] = useState("");

  // ERP States
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>({});
  const [cajeroId, setCajeroId] = useState(() => {
    return localStorage.getItem("posCajeroId") || "";
  });

  useEffect(() => {
    localStorage.setItem("posCajeroId", cajeroId);
  }, [cajeroId]);

  // Receipt Print State
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [facturaIdImpresion, setFacturaIdImpresion] = useState<number | null>(null);
  const [phoneWS, setPhoneWS] = useState("");

  // Tab Handlers
  const nuevaTab = () => {
    const newId = Math.max(...tabs.map((t: any) => t.id), 0) + 1;
    setTabs([...tabs, { id: newId, carrito: [], clienteId: "1", clienteSearch: "" }]);
    setActiveTabId(newId);
  };

  const cerrarTab = (id: number) => {
    if (tabs.length === 1) return;
    if (window.confirm("¿Seguro que deseas descartar esta factura en espera?")) {
      const newTabs = tabs.filter((t: any) => t.id !== id);
      setTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[0].id);
      }
    }
  };

  // Alertas Inteligentes States
  const [saasState, setSaasState] = useState<any>(null);
  const [maintenanceData, setMaintenanceData] = useState<{ active: boolean, time?: string }>({
    active: false,
    time: "22:00" // Ejemplo de mantenimiento
  });

  useEffect(() => {
    fetchInventory();
    fetchSaaS();
    API.get("/cajeros")
      .then(res => {
        setCajeros(res.data);
        // Validar que el cajero de localStorage aún existe
        if (cajeroId && !res.data.find((c: any) => c.id.toString() === cajeroId)) {
          setCajeroId("");
        }
      })
      .catch(console.error);
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/empresa").then(res => setEmpresa(res.data)).catch(console.error);
  }, [cajeroId]);

  const fetchSaaS = () => {
    API.get("/suscripciones/estado")
      .then(res => setSaasState(res.data))
      .catch(err => console.log("Trial Status Check failed", err));
  };

  const fetchInventory = () => {
    API.get("/productos")
      .then(res => {
        setProductos(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const filteredProducts = (Array.isArray(productos) ? productos : []).filter(p =>
    (p?.nombre || "").toLowerCase().includes(search.toLowerCase()) ||
    (p?.referencia && p.referencia.toLowerCase().includes(search.toLowerCase()))
  );

  // Global Stock Calculation Helper
  const getCommittedQty = (productoId: number) => {
    return tabs.reduce((acc: number, tab: any) => {
      const item = tab.carrito.find((x: any) => x.id === productoId);
      return acc + (item ? item.qty : 0);
    }, 0);
  };

  const agregarAlCarrito = (producto: any) => {
    if (producto.es_servicio) {
      const exist = carrito.find((x: any) => x.id === producto.id);
      if (exist) {
        setCarrito(carrito.map((x: any) => x.id === producto.id ? { ...exist, qty: exist.qty + 1 } : x));
      } else {
        setCarrito([...carrito, { ...producto, qty: 1 }]);
      }
      return;
    }

    const currentCommitted = getCommittedQty(producto.id);
    const available = producto.cantidad - currentCommitted;

    // 1. Validar política de venta negativa
    const isNegativeBlocked = !empresa.permitir_venta_negativa || !producto.permitir_venta_negativa;

    if (isNegativeBlocked && available <= 0) {
      alert(`⚠️ Stock Agotado: No quedan unidades disponibles de "${producto.nombre}" en inventario.`);
      return;
    }

    // 2. Si hay stock o se permite negativo, proceder
    const exist = carrito.find((x: any) => x.id === producto.id);
    if (exist) {
      setCarrito(carrito.map((x: any) => x.id === producto.id ? { ...exist, qty: exist.qty + 1 } : x));
    } else {
      setCarrito([...carrito, { ...producto, qty: 1 }]);
    }
  };

  const removerDelCarrito = (producto: any) => {
    const exist = carrito.find((x: any) => x.id === producto.id);
    if (exist.qty === 1) {
      setCarrito(carrito.filter((x: any) => x.id !== producto.id));
    } else {
      setCarrito(carrito.map((x: any) => x.id === producto.id ? { ...exist, qty: exist.qty - 1 } : x));
    }
  };

  const eliminarDelCarrito = (producto: any) => {
    setCarrito(carrito.filter((x: any) => x.id !== producto.id));
  };

  const actualizarCantidad = (id: number, val: string) => {
    if (val === "") {
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: 0 } : x));
      return;
    }

    const qty = parseInt(val);
    if (isNaN(qty) || qty < 0) return;

    const producto = productos.find(p => p.id === id);
    if (!producto) return;

    if (producto.es_servicio) {
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
      return;
    }

    const currentItem = carrito.find((x: any) => x.id === id);
    const currentlyInThisCart = currentItem ? currentItem.qty : 0;
    const totalCommitted = getCommittedQty(id);
    const committedInOtherTabs = totalCommitted - currentlyInThisCart;
    const available = producto.cantidad - committedInOtherTabs;

    const isNegativeBlocked = !empresa.permitir_venta_negativa || !producto.permitir_venta_negativa;

    if (isNegativeBlocked && qty > available) {
      alert(`⚠️ Stock Insuficiente: Solo puedes agregar hasta ${Math.max(0, available)} unidades de "${producto.nombre}".`);
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: Math.max(0, available) } : x));
      return;
    }

    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
  };

  const vaciarCarrito = () => {
    if (window.confirm("¿Seguro que deseas vaciar el carrito actual?")) setCarrito([]);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim() !== '') {
      e.preventDefault();
      const matchedProduct = productos.find(p =>
        p.referencia && p.referencia.trim().toLowerCase() === search.trim().toLowerCase()
      );

      if (matchedProduct) {
        agregarAlCarrito(matchedProduct);
        setSearch("");
      } else {
        setScanError(true);
        setTimeout(() => setScanError(false), 800);
      }
    }
  };

  const subtotal = carrito.reduce((a: number, c: any) => a + c.precio_venta * c.qty, 0);
  const granTotal = subtotal;

  const cashPaga = parseFloat(pagoCliente) || 0;
  const vuelto = cashPaga - granTotal;

  const efMixto = parseFloat(pagoEfectivoMixto) || 0;
  const trMixto = parseFloat(pagoTransferenciaMixto) || 0;
  const sumMixto = efMixto + trMixto;

  const confirmarVenta = async () => {
    if (carrito.length === 0) return;
    if (carrito.some((i: any) => !i.qty || i.qty <= 0)) {
      return alert("❌ Error: Una o más cantidades no son válidas. Asegúrate de que todos los productos tengan una cantidad mayor a 0.");
    }
    if (!cajeroId) return alert("❌ Seguridad: Selecciona tu Cajero en Turno antes de operar la caja.");
    if (metodoPago === "Efectivo" && cashPaga < granTotal) {
      return alert("El efectivo ingresado es insuficiente para cubrir el total de la compra.");
    }
    if (metodoPago === "Mixto" && sumMixto !== granTotal) {
      return alert("La suma de valores en pago mixto debe ser EXACTAMENTE el total de la factura.");
    }

    setIsProcessing(true);
    try {
      const response = await API.post("/ventas", {
        items: carrito,
        metodoPago,
        efectivoEntregado: metodoPago === "Mixto" ? efMixto : cashPaga,
        transferenciaEntregada: metodoPago === "Mixto" ? trMixto : (metodoPago === "Tarjeta" ? granTotal : 0),
        vuelto: metodoPago === "Efectivo" && vuelto > 0 ? vuelto : 0,
        cajeroId: cajeroId ? parseInt(cajeroId) : null,
        clienteId: clienteId ? parseInt(clienteId) : null,
        total: granTotal
      });
      setFacturaIdImpresion(response.data.factura_id);

      const clientObj = clientes.find(c => c.id === parseInt(clienteId));
      setPhoneWS(clientObj?.telefono?.replace(/\D/g, '') || "");

      setVentaExitosa(true);
      fetchInventory();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Error procesando la venta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  const imprimirYTerminar = () => {
    reactToPrintFn();
  };

  const compartirWhatsApp = () => {
    if (!facturaIdImpresion) return;

    let targetPhone = phoneWS.replace(/\D/g, '');

    if (!targetPhone || targetPhone === '0') {
      const manualPhone = window.prompt("📱 Ingresa el número de WhatsApp (ej: 300...):");
      if (!manualPhone) return;
      targetPhone = manualPhone.replace(/\D/g, '');
      setPhoneWS(targetPhone);
    }

    enviarWS(targetPhone);
  };

  const enviarWS = (num: string) => {
    const itemsStr = carrito.map((i: any) => `• ${i.nombre} (x${i.qty})`).join('\n');
    const mensaje = `¡Hola! 👋\n🌿 *Gracias por cuidar el planeta con nosotros.*\n\nEsta es tu factura digital de *${empresa.nombre_empresa || 'nuestra tienda'}*\n\n📄 *Factura # ${facturaIdImpresion}*\n💰 *Total:* ${formatCOP(granTotal)}\n\n🛒 *Resumen:*\n${itemsStr}\n\n¡Te esperamos de nuevo! ✨`;

    // Abrir en nueva pestaña directamente
    const fullNum = num.startsWith('57') ? num : `57${num}`;
    const waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, '_blank');
  };

  const clienteSeleccionado = clientes.find(c => c.id === parseInt(clienteId)) || { nombre: "Cliente General (Mostrador)" };
  const cajeroSeleccionado = cajeros.find(c => c.id === parseInt(cajeroId)) || { nombre: "Cajero Principal" };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-4 lg:gap-6 overflow-y-auto lg:overflow-hidden animate-in fade-in duration-500">

      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="p-4 lg:p-6 border-b border-slate-100 space-y-3 lg:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg lg:text-2xl text-slate-900 tracking-tight flex items-center gap-2 uppercase">
              <span className="text-indigo-600">🏪</span> Terminal
            </h2>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 lg:px-3 lg:py-1 bg-indigo-50 text-indigo-700 text-[10px] rounded-full border border-indigo-100 flex items-center gap-1.5 uppercase tracking-widest leading-none">
                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></span>
                En Línea
              </span>
            </div>
          </div>

          <div className="animate-in slide-in-from-top-2 duration-500">
            {saasState && saasState.diasRestantes <= 5 ? (
              <div className="flex items-center justify-between py-1.5 px-4 bg-amber-50 border border-amber-100 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-amber-600 text-white rounded-lg flex items-center justify-center text-[10px] shadow-md">⏳</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-900 uppercase tracking-widest">Renovación:</span>
                    <p className="text-xs text-amber-700">Vence en <span className="underline decoration-2">{saasState.diasRestantes} días</span>.</p>
                  </div>
                </div>
              </div>
            ) : maintenanceData.active ? (
              <div className="flex items-center justify-between py-1.5 px-4 bg-sky-50 border border-sky-100 rounded-xl shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-sky-600 text-white rounded-lg flex items-center justify-center text-[10px] shadow-md">🔧</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-sky-900 uppercase tracking-widest">Mantenimiento:</span>
                    <p className="text-xs text-sky-700">Hoy a las <span className="underline">{maintenanceData.time}</span>. Sin impacto.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between py-1.5 px-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm transition-all hover:bg-emerald-100/30">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 bg-emerald-600 text-white rounded-lg flex items-center justify-center text-[10px] shadow-md animate-pulse">✨</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-emerald-900 uppercase tracking-widest leading-none">Sistema:</span>
                    <p className="text-xs text-emerald-800">¡Muchos éxitos! Impulsa POS opera al 100%.</p>
                  </div>
                </div>
                <span className="text-[9px] text-emerald-400 uppercase tracking-[0.2em] italic hidden sm:block">Activo</span>
              </div>
            )}
          </div>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors text-xs">🔍</span>
            <input
              type="text"
              placeholder="Escanea o busca por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl outline-none transition-all duration-300 font-bold text-xs lg:text-sm ${scanError ? 'border-red-500 ring-4 ring-red-50 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 focus:bg-white '
                }`}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 lg:p-4 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 lg:h-full gap-4">
              <div className="w-8 h-8 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Cargando...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 lg:gap-3">
              {filteredProducts.map(p => {
                const committed = getCommittedQty(p.id);
                const available = p.cantidad - committed;
                const isOutOfStock = (!empresa.permitir_venta_negativa || !p.permitir_venta_negativa) && available <= 0 && !p.es_servicio;

                return (
                  <button
                    key={p.id}
                    onClick={() => agregarAlCarrito(p)}
                    disabled={isOutOfStock}
                    title={isOutOfStock ? `Sin existencias de ${p.nombre}` : `Agregar ${p.nombre}`}
                    className={`group relative flex flex-col p-3 bg-white rounded-xl border border-slate-200 text-left transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100 hover:border-indigo-200 active:scale-95 disabled:grayscale disabled:opacity-60 disabled:cursor-not-allowed ${isOutOfStock ? 'bg-slate-50 border-slate-100' : ''
                      }`}
                  >
                    <div className="mb-2">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-[11px] text-slate-800 line-clamp-2 leading-tight min-h-[2rem] uppercase font-medium">{p.nombre}</h3>
                        {isOutOfStock && (
                          <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.5 rounded-md font-medium animate-pulse">AGOTADO</span>
                        )}
                      </div>
                      {p.referencia && <p className="text-[9px] text-slate-950 mt-0.5 tracking-tighter font-mono">{p.referencia}</p>}
                    </div>
                    <div className="mt-auto space-y-1.5">
                      <div className="text-base text-indigo-600 font-medium leading-none">{formatCOP(p.precio_venta)}</div>
                      <div className={`text-[9px] px-2 py-1 rounded-lg w-fit transition-all font-medium border ${available <= 0 && !p.es_servicio ? 'bg-rose-50 text-rose-600 border-rose-100' :
                          available < 5 && !p.es_servicio ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {p.es_servicio ? (
                          <span className="flex items-center gap-1">⚡ SERVICIO</span>
                        ) : (
                          <span>📦 DISP: {Math.max(0, available)}</span>
                        )}
                      </div>
                    </div>

                    {/* Hover Effect Layer */}
                    {!isOutOfStock && (
                      <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/5 transition-colors rounded-xl flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 px-3 py-1 rounded-full text-[9px] font-black shadow-xl translate-y-2 group-hover:translate-y-0 duration-300">
                          + AGREGAR
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart / Checkout */}
      <div className="w-full lg:w-[420px] min-h-[500px] lg:min-h-0 bg-white rounded-2xl lg:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden printable-receipt">

        {/* Receipt Header (Print Only) */}
        {/* We moved printing logic to react-to-print so this can be removed or kept hidden, but let's hide it completely */}
        <div className="hidden text-center p-6 space-y-2">
          <h2 className="text-xl font-black">{empresa.nombre_empresa || "MERCADO PRO"}</h2>
          {empresa.nit && <p className="text-sm font-bold">NIT: {empresa.nit}</p>}
          <p className="text-xs">No responsable de IVA</p>
          {empresa.direccion && <p className="text-xs">Dir: {empresa.direccion}</p>}
          <div className="text-[10px] space-x-2">
            {empresa.telefono && <span>Cel: {empresa.telefono}</span>}
            {empresa.correo && <span>| {empresa.correo}</span>}
          </div>
          <div className="py-2 border-y border-dashed border-slate-300 my-4 uppercase font-bold text-xs">
            Ticket No. {facturaIdImpresion || '000000'}
          </div>
        </div>

        {/* Tab System Style Header */}
        <div className="p-2.5 bg-white border-b border-slate-100">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-slate-900 tracking-tight text-[10px] uppercase flex items-center gap-1.5">
              <span className="w-1 h-3 bg-indigo-600 rounded-full"></span> Cuentas Abiertas
            </h3>
            <button onClick={nuevaTab} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] rounded-md hover:bg-indigo-100 transition-colors uppercase tracking-tight" title="Nueva Cuenta">
              + Nueva
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {tabs.map((tab: any, idx: number) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`relative px-3 py-1 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 ${activeTabId === tab.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                    : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                  }`}
              >
                CTA {idx + 1}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); cerrarTab(tab.id); }}
                    className={`hover:bg-black/10 rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none ${activeTabId === tab.id ? 'text-indigo-200' : 'text-slate-300'}`}
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Cart Items Area (Now at the top) */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center no-print">
              <div className="text-4xl mb-3 opacity-10">🛒</div>
              <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest leading-relaxed">Terminal en espera</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {carrito.map((item: any) => (
                <div key={item.id} className={`group flex items-center p-2 py-3 transition-all duration-300 ${!empresa.permitir_venta_negativa && !item.permitir_venta_negativa && item.qty > item.cantidad && !item.es_servicio ? 'bg-red-50/50' : 'bg-white hover:bg-indigo-50/30'
                  }`}>
                  <div className="flex-1 min-w-0 pr-3">
                    <h4 className="text-[10px] text-slate-800 uppercase truncate leading-none mb-1">{item.nombre}</h4>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-indigo-600">{formatCOP(item.precio_venta)}</span>
                    </div>
                  </div>

                  <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100 mr-3">
                    <button onClick={() => removerDelCarrito(item)} className="w-6 h-6 rounded-md hover:bg-white text-slate-500 transition-all text-xs">-</button>
                    <input
                      type="number"
                      value={item.qty === 0 ? "" : item.qty}
                      onChange={(e) => actualizarCantidad(item.id, e.target.value)}
                      className="w-10 text-center text-[10px] text-slate-900 bg-transparent outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => agregarAlCarrito(item)}
                      disabled={(!empresa.permitir_venta_negativa || !item.permitir_venta_negativa) && (item.cantidad - getCommittedQty(item.id)) <= 0 && !item.es_servicio}
                      className="w-6 h-6 rounded-md hover:bg-white text-slate-500 transition-all text-xs disabled:opacity-30"
                    >+</button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right min-w-[70px]">
                      <span className="text-[11px] text-slate-900 block leading-none">{formatCOP(item.precio_venta * item.qty)}</span>
                    </div>
                    <button
                      onClick={() => eliminarDelCarrito(item)}
                      className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all text-[10px] no-print"
                      title="Quitar"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configuration Area (Moved to Bottom) */}
        {carrito.length > 0 && (
          <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 space-y-1.5 no-print">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder="🔍 Buscar o vincular cliente..."
                    value={clienteSearch}
                    onFocus={() => {
                      // Sincronizar clientes al entrar al buscador para ver registros nuevos
                      API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
                    }}
                    onChange={e => {
                      const val = e.target.value;
                      setClienteSearch(val);
                      if (val === "") {
                        setClienteId("1");
                      } else {
                        // Si borra o escribe algo que no coincide exactamente, reseteamos el ID a 1 (General)
                        const match = clientes.find(c => `${c.nombre} ${c.documento ? `(${c.documento})` : ''}` === val);
                        if (match) setClienteId(match.id.toString());
                        else setClienteId("");
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all"
                  />
                  {clienteSearch && !clientes.find(c => `${c.nombre} ${c.documento ? `(${c.documento})` : ''}` === clienteSearch) && (
                    <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                      <div
                        onClick={() => { setClienteSearch("Cliente General (Mostrador)"); setClienteId("1"); }}
                        className="p-3 hover:bg-indigo-50 cursor-pointer text-[10px] font-bold text-slate-400 border-b border-slate-50 uppercase"
                      >
                        👤 Cliente General (Mostrador)
                      </div>
                      {clientes.filter(c =>
                        c.id !== 1 && (
                          c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
                          (c.documento && c.documento.includes(clienteSearch))
                        )
                      ).map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            const label = `${c.nombre} ${c.documento ? `(${c.documento})` : ''}`;
                            setClienteSearch(label);
                            setClienteId(c.id.toString());
                          }}
                          className="p-3 hover:bg-indigo-50 cursor-pointer text-[10px] font-bold text-slate-700 border-b border-slate-50 uppercase flex justify-between"
                        >
                          <span>{c.nombre}</span>
                          <span className="opacity-50 text-[8px]">{c.documento}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <select
                  value={cajeroId}
                  onChange={e => setCajeroId(e.target.value)}
                  className={`w-full px-2 py-1.5 bg-white border rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-indigo-100 outline-none appearance-none transition-all duration-300 ${!cajeroId && carrito.length > 0 ? "border-amber-400 ring-4 ring-amber-50 bg-amber-50/20" : "border-slate-200"
                    }`}
                >
                  <option value="">-- Cajero --</option>
                  {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Cart Totals */}
        {carrito.length > 0 && (
          <div className="p-4 bg-white border-t border-slate-100 space-y-3 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center bg-indigo-50 p-2.5 rounded-xl border border-indigo-100">
              <div>
                <span className="text-[9px] text-indigo-400 uppercase tracking-widest">Total a Pagar</span>
                <p className="text-lg text-indigo-700 leading-none mt-0.5">{formatCOP(granTotal)}</p>
              </div>
              <div className="text-indigo-200 text-2xl">💰</div>
            </div>

            <div className="hidden pt-6 border-t border-dashed border-slate-300">
              <div className="space-y-1 text-[10px] font-medium text-slate-600">
                <p><span className="font-bold">Fecha:</span> {formatDateTime(new Date())}</p>
                <p><span className="font-bold">Método:</span> {metodoPago}</p>
                <p><span className="font-bold">Cliente:</span> {clienteSeleccionado.nombre}</p>
                <p><span className="font-bold">Vendedor:</span> {cajeroSeleccionado.nombre}</p>
              </div>
              <div className="mt-6 text-center text-[10px] italic border-t border-dashed pt-4">
                ¡Gracias por preferir {empresa.nombre_empresa || "nuestra tienda"}!
              </div>
            </div>

            <div className="no-print">
              <button
                onClick={() => {
                  if (!cajeroId) {
                    alert("⚠️ Auditoría Requerida: Por favor selecciona un CAJERO antes de procesar la venta.");
                    return;
                  }
                  setShowCheckout(true);
                }}
                className={`w-full py-4 rounded-xl shadow-xl transition-all duration-500 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] ${!cajeroId
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-300'
                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-100 hover:shadow-emerald-300 hover:-translate-y-1 active:scale-95'
                  }`}
              >
                {cajeroId ? `FINALIZAR COBRO ${formatCOP(granTotal)}` : 'SELECCIONAR VENDEDOR'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'none' }}>
        {ventaExitosa && (
          <PrintReceipt
            ref={contentRef}
            empresa={empresa}
            numero={facturaIdImpresion || ""}
            fecha={new Date()}
            cliente={clienteSeleccionado.nombre}
            cajero={cajeroSeleccionado.nombre}
            metodoPago={metodoPago}
            items={carrito}
            total={granTotal}
            subtotal={subtotal}
            efectivoRecibido={metodoPago === "Mixto" ? efMixto : cashPaga}
            vuelto={metodoPago === "Efectivo" ? vuelto : undefined}
            pagoEfectivoMixto={metodoPago === "Mixto" ? efMixto : undefined}
            pagoTransferenciaMixto={metodoPago === "Mixto" ? trMixto : undefined}
          />
        )}
      </div>

      {/* MODAL: Checkout (Professional Style Sync) */}
      {showCheckout && !ventaExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowCheckout(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-3xl shadow-slate-900/40 overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
            <div className="bg-indigo-600 p-10 text-center space-y-2">
              <h2 className="text-white text-2xl tracking-tight uppercase">Liquidación de Venta</h2>
              <div className="inline-block px-5 py-2 bg-white/20 backdrop-blur-md rounded-2xl text-white text-2xl border border-white/20">
                {formatCOP(granTotal)}
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest ml-1">Modalidad de Pago</label>
                <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[1.5rem]">
                  {["Efectivo", "Tarjeta", "Mixto"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMetodoPago(m)}
                      className={`flex-1 py-3.5 px-2 rounded-2xl text-[10px] uppercase transition-all duration-300 flex items-center justify-center gap-2 ${metodoPago === m ? "bg-white text-indigo-600 shadow-xl shadow-indigo-100/50" : "text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      {m === "Efectivo" ? "💵" : m === "Tarjeta" ? "💳" : "🔄"} {m}
                    </button>
                  ))}
                </div>
              </div>

              {metodoPago === "Efectivo" && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                  <label className="block text-xs text-slate-400 uppercase tracking-widest ml-1">Monto Entregado</label>
                  <input
                    type="number"
                    autoFocus
                    value={pagoCliente}
                    onChange={(e) => setPagoCliente(e.target.value)}
                    placeholder="Ingrese dinero recibido..."
                    className="w-full px-8 py-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] focus:bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 outline-none text-2xl transition-all"
                  />

                  {cashPaga > 0 && (
                    <div className={`p-5 rounded-[1.5rem] text-center border animate-in zoom-in duration-300 ${vuelto >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                      {vuelto >= 0 ? (
                        <>
                          <span className="text-[10px] uppercase block mb-1">Cambio para el Cliente</span>
                          <span className="text-3xl">{formatCOP(vuelto)}</span>
                        </>
                      ) : (
                        `Faltan Liquidar: ${formatCOP(Math.abs(vuelto))}`
                      )}
                    </div>
                  )}
                </div>
              )}

              {metodoPago === "Mixto" && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300 font-medium">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">💵 Efectivo</label>
                      <input
                        type="number"
                        value={pagoEfectivoMixto}
                        onChange={(e) => setPagoEfectivoMixto(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none font-black text-slate-700"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">📱 App / Banco</label>
                      <input
                        type="number"
                        value={pagoTransferenciaMixto}
                        onChange={(e) => setPagoTransferenciaMixto(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none font-black text-slate-700"
                      />
                    </div>
                  </div>
                  {sumMixto > 0 && (
                    <div className={`p-5 rounded-2xl font-black text-center border animate-in zoom-in duration-300 ${Math.abs(sumMixto - granTotal) < 1 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                      <span className="text-[10px] uppercase block mb-1">Monto Mixto Consolidado</span>
                      <span className="text-2xl">{formatCOP(sumMixto)}</span>
                      {Math.abs(sumMixto - granTotal) >= 1 && (
                        <p className="text-[10px] mt-1 opacity-70">
                          {sumMixto > granTotal ? `Exceso de: ${formatCOP(sumMixto - granTotal)}` : `Faltan: ${formatCOP(granTotal - sumMixto)}`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 py-5 text-slate-500 font-bold hover:text-slate-700 transition-colors uppercase text-[10px] tracking-widest"
                >
                  Regresar
                </button>
                <button
                  onClick={confirmarVenta}
                  disabled={isProcessing || (metodoPago === "Efectivo" && cashPaga < granTotal) || (metodoPago === "Mixto" && Math.abs(sumMixto - granTotal) > 1)}
                  className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2 uppercase text-xs tracking-widest"
                >
                  {isProcessing ? "Procesando..." : "Confirmar Venta ✅"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Success (Centrado Perfecto Tailwind) */}
      {ventaExitosa && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div
            className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 text-center flex flex-col items-center justify-center transition-all duration-300 transform scale-100"
          >
            {/* Icono de Éxito */}
            <div className="mb-6">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-4xl shadow-inner">
                ✅
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-1">¡Venta Exitosa!</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Factura generada con éxito</p>
            </div>

            {metodoPago === "Efectivo" && vuelto > 0 && (
              <div className="w-full bg-emerald-50 border border-emerald-100 rounded-3xl p-6 mb-8">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Cambio a entregar</span>
                <strong className="text-3xl text-emerald-700 font-bold">{formatCOP(vuelto)}</strong>
              </div>
            )}

            <div className="w-full space-y-6">
              {/* Sección WhatsApp Agile */}
              <div className="space-y-3">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-bold">WS</span>
                  <input
                    type="text"
                    placeholder="Número de celular"
                    value={phoneWS}
                    onChange={(e) => setPhoneWS(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:bg-white focus:ring-4 focus:ring-emerald-50 focus:border-emerald-200 outline-none transition-all text-center"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={imprimirYTerminar}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-slate-800 active:scale-95 transition-all shadow-lg"
                  >
                    <span className="text-xl">🖨️</span>
                    <span className="text-[9px] uppercase tracking-wider">Imprimir</span>
                  </button>
                  <button
                    onClick={compartirWhatsApp}
                    className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg shadow-emerald-100"
                  >
                    <span className="text-xl">📱</span>
                    <span className="text-[9px] uppercase tracking-wider">WhatsApp</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setVentaExitosa(false);
                  setShowCheckout(false);
                  setPagoCliente("");
                  setPagoEfectivoMixto("");
                  setPagoTransferenciaMixto("");
                  setFacturaIdImpresion(null);
                  setCarrito([]);
                  setClienteId("1");
                  setClienteSearch("");
                }}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-sky-500 text-white font-black rounded-[2rem] shadow-xl shadow-blue-100 hover:shadow-blue-200 hover:-translate-y-0.5 active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
              >
                ✨ COMENZAR NUEVA COMPRA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Productos;
