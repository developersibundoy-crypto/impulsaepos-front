import React, { useEffect, useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP, formatDateTime } from "../utils/format";
import PrintReceipt from "../components/PrintReceipt";

function VentasMayoristas() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // POS States (Multi-Tab Core)
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem("posMayoristaTabs");
    return savedTabs ? JSON.parse(savedTabs) : [{ id: 1, carrito: [], clienteId: "1", clienteSearch: "" }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const savedActiveTab = localStorage.getItem("posMayoristaActiveTab");
    return savedActiveTab ? JSON.parse(savedActiveTab) : 1;
  });
  const activeTab = tabs.find((t: any) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    localStorage.setItem("posMayoristaTabs", JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem("posMayoristaActiveTab", JSON.stringify(activeTabId));
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
  const efMixto = parseFloat(pagoEfectivoMixto) || 0;
  const trMixto = parseFloat(pagoTransferenciaMixto) || 0;
  const sumMixto = efMixto + trMixto;

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
    if (window.confirm("¿Descartar este lote mayorista?")) {
      const newTabs = tabs.filter((t: any) => t.id !== id);
      setTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[0].id);
      }
    }
  };

  useEffect(() => {
    fetchInventory();
    API.get("/cajeros")
      .then(res => {
        setCajeros(res.data);
        if (cajeroId && !res.data.find((c: any) => c.id.toString() === cajeroId)) {
          setCajeroId("");
        }
      })
      .catch(console.error);
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/empresa").then(res => setEmpresa(res.data)).catch(console.error);
  }, [cajeroId]);

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

  const filteredProducts = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.referencia && p.referencia.toLowerCase().includes(search.toLowerCase()))
  );

  // Global Stock Calculation Helper (across all wholesale tabs)
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
        setCarrito([...carrito, { ...producto, qty: 1, descuento: 30 }]);
      }
      return;
    }

    const currentCommitted = getCommittedQty(producto.id);
    const available = producto.cantidad - currentCommitted;

    // Validar bloqueo de stock
    const isBlocked = (!empresa.permitir_venta_negativa || !producto.permitir_venta_negativa) && available <= 0;

    if (isBlocked) {
      alert(`🚛 Bloqueo Mayorista: Stock insuficiente de "${producto.nombre}". Se han agotado las unidades disponibles en todos los lotes actuales.`);
      return;
    }

    const exist = carrito.find((x: any) => x.id === producto.id);
    if (exist) {
      setCarrito(carrito.map((x: any) => x.id === producto.id ? { ...exist, qty: exist.qty + 1 } : x));
    } else {
      setCarrito([...carrito, { ...producto, qty: 1, descuento: 30 }]);
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
    if (window.confirm("¿Vaciar despacho actual?")) setCarrito([]);
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

  const handleDescuentoChange = (id: number, valor: string) => {
    let desc = parseFloat(valor) || 0;
    if (desc < 0) desc = 0;
    if (desc > 100) desc = 100;
    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, descuento: desc } : x));
  };

  const subtotalOriginal = carrito.reduce((a: number, c: any) => a + c.precio_venta * c.qty, 0);
  const granTotal = carrito.reduce((a: number, c: any) => a + (c.precio_venta * (1 - (c.descuento || 0) / 100)) * c.qty, 0);
  const valorDescuento = subtotalOriginal - granTotal;

  const cashPaga = parseFloat(pagoCliente) || 0;
  const vuelto = cashPaga - granTotal;

  const confirmarVenta = async () => {
    if (carrito.length === 0) return;
    if (carrito.some((i: any) => !i.qty || i.qty <= 0)) {
      return alert("❌ Error: Una o más cantidades no son válidas. Asegúrate de que todos los productos tengan una cantidad mayor a 0.");
    }
    if (!cajeroId) return alert("Selecciona cajero de despacho.");
    if (metodoPago === "Efectivo" && cashPaga < granTotal) {
      return alert("Efectivo insuficiente.");
    }
    if (metodoPago === "Mixto" && sumMixto !== granTotal) {
      return alert("La suma de valores en pago mixto debe ser EXACTAMENTE el total de la factura.");
    }

    setIsProcessing(true);
    try {
      const discountedCart = carrito.map((item: any) => ({
        ...item,
        precio_venta: item.precio_venta * (1 - (item.descuento || 0) / 100)
      }));

      const response = await API.post("/ventas", {
        items: discountedCart,
        metodoPago,
        efectivoEntregado: metodoPago === "Mixto" ? efMixto : cashPaga,
        transferenciaEntregada: metodoPago === "Mixto" ? trMixto : (metodoPago === "Tarjeta" ? granTotal : 0),
        vuelto: vuelto > 0 ? vuelto : 0,
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
      alert(err.response?.data?.error || "Error procesando despacho.");
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
    const mensaje = `¡Hola! 👋\n📦 *Entrega Mayorista Confirmada.*\n\n🌿 Gracias por preferir nuestra factura digital de *${empresa.nombre_empresa || 'nuestra empresa'}*\n\n📑 *Lote # ${facturaIdImpresion}*\n💰 *Total:* ${formatCOP(granTotal)}\n\n🛒 *Resumen del Pedido:*\n${itemsStr}\n\n¡Muchas gracias por tu negocio! 🚀`;

    // Abrir en nueva pestaña directamente
    const fullNum = num.startsWith('57') ? num : `57${num}`;
    const waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    window.open(waUrl, '_blank');
  };

  const clienteSeleccionado = clientes.find(c => c.id === parseInt(clienteId)) || { nombre: "Distribuidor Casual" };
  const cajeroSeleccionado = cajeros.find(c => c.id === parseInt(cajeroId)) || { nombre: "Cajero Principal" };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-4 lg:gap-6 overflow-y-auto lg:overflow-hidden animate-in fade-in duration-500">

      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl lg:rounded-3xl border border-slate-200 shadow-sm overflow-hidden no-print min-h-[400px]">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl text-slate-900 tracking-tight flex items-center gap-2">
              <span className="text-sky-600">🚛</span> Distribución Mayorista
            </h2>
            <div className="flex gap-2">
              <span className="px-2.5 py-0.5 bg-sky-50 text-sky-700 text-[9px] font-black rounded-full border border-sky-100 uppercase tracking-widest leading-none">
                Modo Mayorista
              </span>
            </div>
          </div>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors text-xs">🔍</span>
            <input
              type="text"
              placeholder="Escanea SKU o localiza ítems..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className={`w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-xl outline-none transition-all duration-300 font-bold text-xs ${scanError ? 'border-red-500 ring-2 ring-red-50 bg-red-50' : 'border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-50 focus:bg-white '
                }`}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-8 h-8 border-3 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Sincronizando Almacén...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {filteredProducts.map(p => {
                const committed = getCommittedQty(p.id);
                const available = p.cantidad - committed;
                const isOutOfStock = (!empresa.permitir_venta_negativa || !p.permitir_venta_negativa) && available <= 0 && !p.es_servicio;

                return (
                  <button
                    key={p.id}
                    onClick={() => agregarAlCarrito(p)}
                    disabled={isOutOfStock}
                    title={isOutOfStock ? `Sin existencias de ${p.nombre}` : `Agregar ${p.nombre} al lote`}
                    className={`group relative flex flex-col p-2.5 bg-white rounded-xl border border-slate-200 text-left transition-all duration-300 hover:shadow-lg hover:shadow-sky-100 hover:border-sky-200 active:scale-95 disabled:grayscale disabled:opacity-60 disabled:cursor-not-allowed ${isOutOfStock ? 'bg-slate-50 border-slate-100' : ''
                      }`}
                  >
                    <div className="mb-2">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-[11px] text-slate-800 line-clamp-2 leading-tight min-h-[2rem] uppercase font-medium">{p.nombre}</h3>
                        {isOutOfStock && (
                          <span className="text-[8px] bg-sky-600 text-white px-1.5 py-0.5 rounded-md font-medium animate-pulse">AGOTADO</span>
                        )}
                      </div>
                      {p.referencia && <p className="text-[9px] text-slate-950 mt-1 tracking-tighter font-mono">{p.referencia}</p>}
                    </div>
                    <div className="mt-auto space-y-1.5">
                      <div className="text-base text-sky-600 font-medium leading-none">{formatCOP(p.precio_venta)}</div>
                      <div className={`text-[9px] px-2 py-1 rounded-lg w-fit font-medium border ${available <= 0 && !p.es_servicio ? 'bg-red-50 text-red-500 border-red-100' :
                        available < 5 && !p.es_servicio ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {p.es_servicio ? '⚡ SERVICIO' : `🚛 DISP: ${Math.max(0, available)}`}
                      </div>
                    </div>

                    {/* Hover Decoration */}
                    {!isOutOfStock && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 bg-sky-600 text-white rounded-full flex items-center justify-center text-xs shadow-lg">+</div>
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
      <div className="w-full lg:w-[450px] bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden printable-receipt">

        {/* Receipt Header (Print Only) */}
        <div className="hidden text-center p-6 space-y-2">
          <h2 className="text-xl font-black">{empresa.nombre_empresa || "MI EMPRESA"}</h2>
          <p className="text-sm font-black uppercase tracking-widest text-slate-500 mt-2">Facturación Mayorista</p>
          {empresa.nit && <p className="text-xs font-bold mt-4">NIT: {empresa.nit}</p>}
          <div className="py-4 border-y border-dashed border-slate-300 my-6 uppercase font-black text-sm tracking-widest">
            Lote Mayorista No. {facturaIdImpresion || '000000'}
          </div>
        </div>

        {/* Tab System (no-print) */}
        <div className="p-2.5 no-print border-b border-slate-100">
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="font-black text-slate-900 tracking-tight text-[10px] uppercase flex items-center gap-1.5">
              <span className="w-1 h-3 bg-sky-600 rounded-full"></span> Lotes de Distribución
            </h3>
            <button onClick={nuevaTab} className="px-1.5 py-0.5 bg-sky-50 text-sky-600 text-[9px] rounded-md hover:bg-sky-100 transition-colors font-black uppercase tracking-tight" title="Nuevo Lote">
              + Nuevo
            </button>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {tabs.map((tab: any, idx: number) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`relative px-3 py-1 rounded-lg text-[10px] font-black whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 ${activeTabId === tab.id
                  ? "bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-100"
                  : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                  }`}
              >
                LOTE {idx + 1}
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); cerrarTab(tab.id); }}
                    className={`hover:bg-black/10 rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none ${activeTabId === tab.id ? 'text-sky-200' : 'text-slate-300'}`}
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
              <div className="text-4xl mb-3 opacity-10">📦</div>
              <p className="text-slate-300 font-black text-[10px] uppercase tracking-widest leading-relaxed">Sin productos</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {carrito.map((item: any) => (
                <div key={item.id} className={`group flex items-center p-2 py-2.5 transition-all duration-300 ${!empresa.permitir_venta_negativa && !item.permitir_venta_negativa && item.qty > item.cantidad && !item.es_servicio ? 'bg-red-50/50' : 'bg-white hover:bg-sky-50/30'
                  }`}>
                  <div className="flex-1 min-w-0 pr-3">
                    <h4 className="text-[10px] text-slate-800 uppercase truncate leading-none mb-1">{item.nombre}</h4>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-sky-600">{formatCOP(item.precio_venta)}</span>
                      {item.descuento > 0 && (
                        <span className="text-[8px] text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">-{item.descuento}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-100">
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

                  <div className="flex flex-col items-end min-w-[35px] no-print">
                    <input
                      type="number"
                      className="w-10 px-0.5 py-0.5 bg-white border border-slate-100 rounded text-center text-[9px] text-sky-600 outline-none"
                      value={item.descuento || 0}
                      onChange={e => handleDescuentoChange(item.id, e.target.value)}
                    />
                  </div>

                  <div className="text-right min-w-[80px]">
                    <span className="text-[11px] text-slate-900 block leading-none">
                      {formatCOP((item.precio_venta * (1 - (item.descuento || 0) / 100)) * item.qty)}
                    </span>
                  </div>
                  <button
                    onClick={() => eliminarDelCarrito(item)}
                    className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all text-[10px] no-print"
                    title="Quitar"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configuration Area (Moved to Bottom) */}
        {carrito.length > 0 && (
          <div className="px-3 py-1.5 bg-slate-50/50 border-t border-slate-100 no-print">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="🔍 Buscar distribuidor..."
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
                      const match = clientes.find(c => `${c.nombre} ${c.documento ? `(${c.documento})` : ''}` === val);
                      if (match) setClienteId(match.id.toString());
                      else setClienteId("");
                    }
                  }}
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold focus:ring-4 focus:ring-sky-50 focus:border-sky-400 outline-none transition-all"
                />
                {clienteSearch && !clientes.find(c => `${c.nombre} ${c.documento ? `(${c.documento})` : ''}` === clienteSearch) && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                    <div
                      onClick={() => { setClienteSearch("Distribuidor Casual"); setClienteId("1"); }}
                      className="p-2 hover:bg-sky-50 cursor-pointer text-[10px] font-bold text-slate-400 border-b border-slate-50 uppercase"
                    >
                      👤 Distribuidor Casual
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
                        className="p-2 hover:bg-sky-50 cursor-pointer text-[10px] font-bold text-slate-700 border-b border-slate-50 uppercase flex justify-between"
                      >
                        <span>{c.nombre}</span>
                        <span className="opacity-50 text-[8px]">{c.documento}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <select
                  value={cajeroId}
                  onChange={e => setCajeroId(e.target.value)}
                  className={`w-full px-2 py-1 bg-white border rounded-lg text-[10px] font-bold focus:ring-2 focus:ring-sky-100 outline-none appearance-none transition-all duration-300 ${!cajeroId && carrito.length > 0 ? "border-amber-400 ring-4 ring-amber-50 bg-amber-50/20" : "border-slate-200"
                    }`}
                >
                  <option value="">-- Cajero --</option>
                  {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Totals Section */}
        {carrito.length > 0 && (
          <div className="p-3 bg-white border-t border-slate-100 space-y-2 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-slate-400 text-[8px] font-bold uppercase tracking-widest">
                <span>Avalúo Comercial</span>
                <span className="line-through">{formatCOP(subtotalOriginal)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 text-[8px] font-black uppercase tracking-widest">
                <span>Incentivos Aplicados</span>
                <span className="">-{formatCOP(valorDescuento)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-sky-50 p-2 rounded-lg border border-sky-100">
              <div>
                <span className="text-[9px] text-sky-500 uppercase tracking-widest">Total Mayorista</span>
                <p className="text-lg text-sky-700 leading-none mt-0.5">{formatCOP(granTotal)}</p>
              </div>
            </div>

            <div className="no-print">
              <button
                onClick={() => {
                  if (!cajeroId) {
                    alert("⚠️ Auditoría Mayorista: Selecciona al responsable del despacho antes de finalizar.");
                    return;
                  }
                  setShowCheckout(true);
                }}
                className={`w-full py-4 rounded-xl shadow-xl transition-all duration-500 flex items-center justify-center gap-3 text-xs uppercase tracking-[0.2em] ${!cajeroId
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
                  : 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-sky-100 hover:shadow-sky-300 hover:-translate-y-1 active:scale-95'
                  }`}
              >
                {cajeroId ? `FINALIZAR DESPACHO ${formatCOP(granTotal)}` : 'SELECCIONAR RESPONSABLE'}
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
            items={carrito.map((c: any) => ({
              ...c,
              precio_unitario: c.precio_venta * (1 - (c.descuento || 0) / 100)
            }))}
            total={granTotal}
            subtotal={subtotalOriginal}
            efectivoRecibido={metodoPago === "Mixto" ? efMixto : cashPaga}
            vuelto={vuelto}
            pagoEfectivoMixto={metodoPago === "Mixto" ? efMixto : undefined}
            pagoTransferenciaMixto={metodoPago === "Mixto" ? trMixto : undefined}
          />
        )}
      </div>

      {/* MODAL: Checkout */}
      {showCheckout && !ventaExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowCheckout(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-900/40 overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
            <div className="bg-sky-600 p-8 text-center space-y-2">
              <h2 className="text-white text-2xl font-black tracking-tight">Cierre General Mayorista</h2>
              <div className="inline-block px-4 py-2 bg-white/20 backdrop-blur-md rounded-2xl text-white font-bold">
                Monto: {formatCOP(granTotal)}
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Método de Pago</label>
                <div className="flex gap-4 p-1.5 bg-slate-100 rounded-3xl">
                  <button
                    onClick={() => setMetodoPago("Efectivo")}
                    className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${metodoPago === "Efectivo" ? "bg-white text-sky-600 shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    💵 Efectivo
                  </button>
                  <button
                    onClick={() => setMetodoPago("Tarjeta")}
                    className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${metodoPago === "Tarjeta" ? "bg-white text-sky-600 shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    💳 Tarjeta / Transfer
                  </button>
                  <button
                    onClick={() => setMetodoPago("Mixto")}
                    className={`flex-1 py-3 px-4 rounded-2xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${metodoPago === "Mixto" ? "bg-white text-sky-600 shadow-xl shadow-slate-200" : "text-slate-500 hover:text-slate-700"
                      }`}
                  >
                    🔄 Mixto
                  </button>
                </div>
              </div>

              {metodoPago === "Efectivo" && (
                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Efectivo Desembolsado</label>
                  <input
                    type="number"
                    autoFocus
                    value={pagoCliente}
                    onChange={(e) => setPagoCliente(e.target.value)}
                    placeholder="Monto entregado..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-sky-50 focus:border-sky-600 outline-none text-xl font-black transition-all"
                  />

                  {cashPaga > 0 && (
                    <div className={`p-4 rounded-2xl font-bold text-center border animate-in zoom-in duration-300 ${vuelto >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                      {vuelto >= 0 ? (
                        <>
                          <span className="text-[10px] uppercase block mb-1">Cambio de Caja</span>
                          <span className="text-2xl">{formatCOP(vuelto)}</span>
                        </>
                      ) : (
                        `Monto Insuficiente: ${formatCOP(Math.abs(vuelto))}`
                      )}
                    </div>
                  )}
                </div>
              )}

              {metodoPago === "Mixto" && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Efectivo</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                        <input
                          type="number"
                          value={pagoEfectivoMixto}
                          onChange={(e) => setPagoEfectivoMixto(e.target.value)}
                          className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-sky-50 focus:border-sky-600 outline-none font-black text-slate-700 transition-all"
                        />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Transferencia</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                        <input
                          type="number"
                          value={pagoTransferenciaMixto}
                          onChange={(e) => setPagoTransferenciaMixto(e.target.value)}
                          className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-sky-50 focus:border-sky-600 outline-none font-black text-slate-700 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  {sumMixto > 0 && (
                    <div className="mt-2">
                      {(() => {
                        const dif = sumMixto - granTotal;
                        return (
                          <div className={`p-4 rounded-2xl font-bold text-center border animate-in zoom-in duration-300 ${dif === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                            }`}>
                            <span className="text-[10px] uppercase block mb-1">Monto Mixto Consolidado</span>
                            <span className="text-2xl">{formatCOP(sumMixto)}</span>
                            {dif !== 0 && (
                              <p className="text-xs font-bold opacity-80 mt-1">Diferencia: {formatCOP(dif)} (Debe ser exacto)</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 py-4 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                >
                  Regresar
                </button>
                <button
                  onClick={confirmarVenta}
                  disabled={isProcessing || (metodoPago === "Efectivo" && cashPaga < granTotal) || (metodoPago === "Mixto" && sumMixto !== granTotal)}
                  className="flex-[2] py-4 bg-sky-600 text-white font-black rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : "Confirmar Venta 🚀"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Success */}
      {ventaExitosa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-sky-900/70 backdrop-blur-lg animate-in fade-in duration-300"></div>
          <div className="relative w-full max-w-sm bg-white rounded-[40px] shadow-3xl p-10 text-center animate-in zoom-in duration-500 box-content">
            <div className="w-24 h-24 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-5xl mx-auto mb-8 animate-bounce">
              📦
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">¡Despacho Exitoso!</h2>
            <p className="text-slate-500 font-medium mb-8">El lote mayorista fue registrado y descontado del inventario general.</p>

            {metodoPago === "Efectivo" && vuelto > 0 && (
              <div className="bg-emerald-50 rounded-3xl p-6 mb-8 border border-emerald-100">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Devolver Cambio</span>
                <strong className="text-3xl text-emerald-700 font-black">{formatCOP(vuelto)}</strong>
              </div>
            )}

            <div className="space-y-4">
              <div className="relative mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block text-center">WhatsApp del Distribuidor</label>
                <div className="flex gap-2">
                  <span className="flex items-center justify-center bg-slate-100 px-4 rounded-2xl text-slate-500 font-bold text-sm">+57</span>
                  <input
                    type="text"
                    placeholder="Número de Celular"
                    value={phoneWS}
                    onChange={(e) => setPhoneWS(e.target.value)}
                    className="flex-1 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-sky-50 outline-none font-bold text-slate-700 text-center text-lg"
                  />
                </div>
              </div>

              <button
                onClick={imprimirYTerminar}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 group"
              >
                <span className="text-xl group-hover:rotate-12 transition-transform">🖨️</span> Imprimir Recibo
              </button>
              <button
                onClick={compartirWhatsApp}
                className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-100 hover:shadow-emerald-300 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-3 group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">📱</span> Enviar WhatsApp
              </button>
              <button
                onClick={() => {
                  setVentaExitosa(false);
                  setShowCheckout(false);
                  setPagoCliente("");
                  setPagoEfectivoMixto("");
                  setPagoTransferenciaMixto("");
                  setFacturaIdImpresion(null);
                  if (tabs.length > 1) {
                    const newTabs = tabs.filter((t: any) => t.id !== activeTabId);
                    setTabs(newTabs);
                    setActiveTabId(newTabs[0].id);
                  } else {
                    setCarrito([]);
                    setClienteId("1");
                    setClienteSearch("");
                  }
                }}
                className="w-full py-5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
              >
                Continuar Despachando
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default VentasMayoristas;
