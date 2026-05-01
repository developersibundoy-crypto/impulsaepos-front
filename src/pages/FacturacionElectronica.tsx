// Soft Tones Update
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { useReactToPrint } from "react-to-print";
import PrintReceipt from "../components/PrintReceipt";

function FacturacionElectronica() {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState(false);

  // Tabs / In-waiting factoras
  const [tabs, setTabs] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("feTabs");
      const parsed = saved ? JSON.parse(saved) : null;
      return (Array.isArray(parsed) && parsed.length > 0) ? parsed : [{ id: 1, carrito: [], clienteId: "", clienteSearch: "" }];
    } catch {
      return [{ id: 1, carrito: [], clienteId: "", clienteSearch: "" }];
    }
  });

  const [activeTabId, setActiveTabId] = useState(() => (tabs && tabs[0].id) || 1);

  const activeTab = (tabs && tabs.find((t: any) => t.id === activeTabId)) || (tabs && tabs[0]) || { id: 1, carrito: [], clienteId: "", clienteSearch: "" };
  const { carrito, clienteId, clienteSearch } = activeTab;

  const setCarrito = (newCarrito: any[]) => {
    setTabs((prev: any[]) => prev.map((t: any) => t.id === activeTabId ? { ...t, carrito: newCarrito } : t));
  };
  const setClienteId = (id: string) => {
    setTabs((prev: any[]) => prev.map((t: any) => t.id === activeTabId ? { ...t, clienteId: id } : t));
  };
  const setClienteSearch = (val: string) => {
    setTabs((prev: any[]) => prev.map((t: any) => t.id === activeTabId ? { ...t, clienteSearch: val } : t));
  };

  useEffect(() => {
    localStorage.setItem("feTabs", JSON.stringify(tabs));
  }, [tabs]);

  // Payment States
  const [metodoPago, setMetodoPago] = useState("Transferencia");
  const [pagoCliente, setPagoCliente] = useState("");
  const [pagoEfectivoMixto, setPagoEfectivoMixto] = useState("");
  const [pagoTransferenciaMixto, setPagoTransferenciaMixto] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);

  // ERP States
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>({});
  const [resolucionActiva, setResolucionActiva] = useState<any>(null);

  // Cajero ID derived from user session
  const [cajeroId, setCajeroId] = useState(() => {
    return localStorage.getItem("adminCajeroId") || "";
  });

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Scanner Optimization Refs
  const lastKeystrokeTime = useRef(0);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Receipt Print State
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [feExitoData, setFeExitoData] = useState<any>(null);
  const [itemsParaRecibo, setItemsParaRecibo] = useState<any[]>([]);
  const [totalesRecibo, setTotalesRecibo] = useState<any>(null);
  const [phoneWS, setPhoneWS] = useState("");
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    nombre: "",
    documento: "",
    tipo_documento: "13",
    dv: "",
    telefono: "",
    correo: ""
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  useEffect(() => {
    fetchInventory(1);
    API.get("/cajeros").then(res => setCajeros(res.data)).catch(console.error);
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/empresa").then(res => {
      setEmpresa(res.data);
      // Socket Sync for Real-time Price updates
      if (res.data.id) {
        import("../utils/socket").then(({ joinEmpresaRoom, socket }) => {
          joinEmpresaRoom(res.data.id);
          socket.on("product_updated", (updatedProd: any) => {
            console.log("[SOCKET FE]: Producto actualizado:", updatedProd);
            // 1. Update Catalog
            setProductos(prev => prev.map(p => p.id === updatedProd.id ? { ...p, ...updatedProd } : p));
            // 2. Update all active carts in all tabs
            setTabs((prev: any[]) => (prev || []).map(tab => ({
              ...tab,
              carrito: (tab.carrito || []).map((item: any) =>
                item.id === updatedProd.id
                  ? { ...item, ...updatedProd }
                  : item
              )
            })));
          });
          socket.on("inventory_batch_updated", () => fetchInventory(1));
        });
      }
    }).catch(console.error);
    API.get("/dian/resoluciones").then(res => {
      const activa = res.data.find((r: any) => r.activa);
      setResolucionActiva(activa);
    }).catch(console.error);

    return () => {
      import("../utils/socket").then(({ socket }) => {
        socket.off("product_updated");
      });
    };
  }, []);

  const fetchInventory = (p: number = page, searchVal: string = search) => {
    setLoading(true);
    API.get(`/productos?page=${p}&limit=50&search=${searchVal}`)
      .then(res => {
        const dataArr = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setProductos(dataArr);
        setTotalPages(res.data.last_page || 1);
        setTotalRecords(res.data.total || dataArr.length);
        setPage(res.data.page || 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    
    const now = Date.now();
    const isFast = now - lastKeystrokeTime.current < 50;
    lastKeystrokeTime.current = now;

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    if (isFast && val.length > 2) {
      scanTimeoutRef.current = setTimeout(() => {
        handleSearchKeyPress({ key: 'Enter', preventDefault: () => {} } as any);
      }, 150);
    } else {
      scanTimeoutRef.current = setTimeout(() => {
        fetchInventory(1, val);
      }, 300);
    }
  };

  const agregarAlCarrito = (producto: any) => {
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

  const actualizarCantidad = (id: number, val: string) => {
    if (val === "") {
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: 0 } : x));
      return;
    }
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 0) return;
    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
  };

  const eliminarDelCarrito = (producto: any) => {
    setCarrito(carrito.filter((x: any) => x.id !== producto.id));
  };

  const handleSearchKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (search.trim() !== '') {
        e.preventDefault();
        const barcode = search.trim();
        
        // 1. Búsqueda local
        const matchedProduct = productos.find(p =>
          p.referencia && p.referencia.trim().toLowerCase() === barcode.toLowerCase()
        );

        if (matchedProduct) {
          agregarAlCarrito(matchedProduct);
          setSearch("");
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        } else {
          // 2. Búsqueda remota
          try {
            const res = await API.get(`/productos/buscar/${encodeURIComponent(barcode)}`);
            if (res.data && res.data.id) {
              agregarAlCarrito(res.data);
              setSearch("");
              if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            } else {
              throw new Error("No encontrado");
            }
          } catch (err) {
            setScanError(true);
            setTimeout(() => setScanError(false), 800);
          }
        }
      } else if (carrito.length > 0 && !showCheckout) {
        abrirCheckout();
      }
    }
  };

  const abrirCheckout = () => {
    if (carrito.length === 0) return alert("El carrito está vacío.");
    if (!clienteId || clienteId === "1") return alert("❌ Debes seleccionar un cliente específico para Facturación Electrónica (No se permite Cliente General).");
    if (!resolucionActiva) return alert("❌ No tienes una resolución DIAN activa.");
    setShowCheckout(true);
  };

  const granTotal = carrito.reduce((a: number, c: any) => a + (c.precio_venta * c.qty), 0);
  const totalItems = carrito.reduce((a: number, c: any) => a + (c.qty || 0), 0);
  const totalIva = carrito.reduce((a: number, c: any) => {
    const totalItem = c.precio_venta * c.qty;
    const ivaPerc = parseFloat(c.iva_porcentaje || 0);
    const base = totalItem / (1 + ivaPerc / 100);
    return a + (totalItem - base);
  }, 0);
  const subtotal = granTotal - totalIva;

  const cashPaga = parseFloat(pagoCliente) || 0;
  const vuelto = cashPaga - granTotal;
  const efMixto = parseFloat(pagoEfectivoMixto) || 0;
  const trMixto = parseFloat(pagoTransferenciaMixto) || 0;
  const sumMixto = efMixto + trMixto;

  const confirmarVenta = async () => {
    if (!showCheckout) return;

    // Validaciones de Pago
    if (metodoPago === "Efectivo" && cashPaga < granTotal) {
      return alert("El efectivo ingresado es insuficiente.");
    }
    if (metodoPago === "Mixto" && sumMixto !== granTotal) {
      return alert("El pago mixto debe sumar exactamente el total de la factura.");
    }

    // Validaciones de Empresa
    const camposEmpresaFaltantes = [];
    if (!empresa.nit) camposEmpresaFaltantes.push("NIT");
    if (!empresa.direccion) camposEmpresaFaltantes.push("Dirección");
    if (!empresa.tipo_persona) camposEmpresaFaltantes.push("Tipo de Persona");
    if (!empresa.tipo_responsabilidad) camposEmpresaFaltantes.push("Responsabilidad Fiscal");
    if (!empresa.municipio_codigo) camposEmpresaFaltantes.push("Código de Municipio");

    if (camposEmpresaFaltantes.length > 0) {
      return alert(`❌ Faltan datos legales de la empresa: ${camposEmpresaFaltantes.join(", ")}. Por favor configure la Identidad Corporativa.`);
    }

    // Validaciones de Cliente
    const clientFound = clientes.find(c => c.id.toString() === clienteId);
    if (clientFound) {
      if (!clientFound.correo_electronico_facturacion && !clientFound.email) {
        return alert("❌ El cliente seleccionado no tiene correo electrónico configurado.");
      }
      setPhoneWS(clientFound.telefono?.replace(/\D/g, '') || "");
    }

    setIsProcessing(true);
    try {
      const res = await API.post("/facturacion-electronica/emitir", {
        items: carrito,
        metodoPago,
        total: granTotal,
        iva: totalIva,
        vuelto: (metodoPago === "Efectivo" && vuelto > 0) ? vuelto : 0,
        efectivoEntregado: metodoPago === "Mixto" ? efMixto : (metodoPago === "Efectivo" ? cashPaga : 0),
        transferenciaEntregada: metodoPago === "Mixto" ? trMixto : (metodoPago === "Transferencia" ? granTotal : 0),
        cajeroId: cajeroId ? parseInt(cajeroId) : null,
        clienteId: parseInt(clienteId),
        notas: "Facturación Electrónica DIAN"
      });
      setFeExitoData(res.data);
      setItemsParaRecibo([...carrito]);
      setTotalesRecibo({
        granTotal,
        totalIva,
        efectivoRecibido: metodoPago === "Mixto" ? efMixto : (metodoPago === "Efectivo" ? cashPaga : 0),
        vuelto: (metodoPago === "Efectivo" && vuelto > 0) ? vuelto : 0,
        pagoEfectivoMixto: metodoPago === "Mixto" ? efMixto : undefined,
        pagoTransferenciaMixto: metodoPago === "Mixto" ? trMixto : undefined,
        metodoPago
      });
      setVentaExitosa(true);
      setShowCheckout(false);
      setCarrito([]);
      fetchInventory(page);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al emitir factura electrónica");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetVenta = () => {
    setVentaExitosa(false);
    setClienteId("");
    setClienteSearch("");
    setPagoCliente("");
    setPagoEfectivoMixto("");
    setPagoTransferenciaMixto("");
    setFeExitoData(null);
    setItemsParaRecibo([]);
    setTotalesRecibo(null);
  };

  const compartirWhatsApp = () => {
    if (!feExitoData) return;

    // 1. Encabezado
    const header = `🏪 *${empresa?.nombre_empresa || "MI EMPRESA"}*\n` +
      (empresa?.nit ? `NIT: ${empresa.nit}\n` : "") +
      (empresa?.direccion ? `📍 ${empresa.direccion}\n` : "") +
      (empresa?.telefono ? `📞 Tel: ${empresa.telefono}\n` : "") +
      `--------------------------------\n`;

    // 2. Info de Venta
    const saleInfo = `📄 *Factura Electrónica # ${feExitoData.numero_completo}*\n` +
      `📅 Fecha: ${new Date().toLocaleString('es-CO')}\n` +
      `👤 Cliente: ${clientes.find(c => c.id.toString() === clienteId.toString())?.nombre || "Consumidor Final"}\n` +
      `👤 Vendedor: ${cajeros.find(c => c.id.toString() === cajeroId.toString())?.nombre || "Cajero Principal"}\n` +
      `--------------------------------\n`;

    // 3. Ítems
    const itemsStr = itemsParaRecibo.map((i: any) => {
      const qty = i.qty || i.cantidad || 1;
      return `• ${i.nombre} (x${qty})\n  Subtotal: ${formatCOP(i.precio_venta * qty)}`;
    }).join('\n');

    // 4. Totales
    const t_granTotal = totalesRecibo?.granTotal || 0;
    const t_totalIva = totalesRecibo?.totalIva || 0;
    const t_metodoPago = totalesRecibo?.metodoPago || metodoPago;

    const totalsStr = `\n--------------------------------\n` +
      `Subtotal: ${formatCOP(t_granTotal - t_totalIva)}\n` +
      (t_totalIva > 0 ? `IVA: ${formatCOP(t_totalIva)}\n` : "") +
      `💰 *TOTAL A PAGAR: ${formatCOP(t_granTotal)}*\n` +
      `Método: ${t_metodoPago}\n`;

    // 5. Pie de Página
    const footer = `--------------------------------\n` +
      `🙏 ¡Gracias por su compra!\n` +
      (empresa?.resolucion ? `\n${empresa.resolucion}` : "");

    const mensaje = `${header}${saleInfo}🛒 *Resumen:*\n${itemsStr}${totalsStr}${footer}`;

    const cleanPhone = phoneWS.replace(/\D/g, '');
    let waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    if (cleanPhone && cleanPhone.length >= 7) {
      const fullNum = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
      waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    }

    window.open(waUrl, '_blank');
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-6 animate-in fade-in duration-500 p-2">

      {/* Catalog */}
      <div className="flex-1 flex flex-col bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="p-8 border-b border-slate-100 space-y-4 bg-slate-50/50">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/facturas")}
                className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:shadow-lg transition-all group"
                title="Historial de facturas"
              >
                <div className="flex flex-col gap-1">
                  <span className="w-5 h-0.5 bg-current rounded-full"></span>
                  <span className="w-5 h-0.5 bg-current rounded-full"></span>
                  <span className="w-5 h-0.5 bg-current rounded-full"></span>
                </div>
              </button>
              <button
                onClick={() => navigate("/separados")}
                className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-emerald-500 hover:text-emerald-600 hover:border-emerald-200 hover:shadow-lg transition-all"
                title="Módulo de Separados / Apartados"
              >
                <span className="text-xl">📋</span>
              </button>
              <div>
                <h2 className="text-3xl text-slate-800 font-medium tracking-tighter uppercase italic">
                  <span className="text-blue-600 underline decoration-blue-500/20 underline-offset-8">DIAN:</span> Facturación Electrónica
                </h2>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/30"></span>
                  Terminal de Cumplimiento Legal
                </p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-slate-200 flex flex-col gap-1 min-w-[200px] shadow-sm">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Resolución Activa:</span>
              {resolucionActiva ? (
                <span className="text-sm font-medium text-blue-600 uppercase tracking-tight">{resolucionActiva.prefijo} - {resolucionActiva.consecutivo_actual}</span>
              ) : (
                <span className="text-sm font-medium text-rose-500 uppercase tracking-tight">SIN RESOLUCIÓN</span>
              )}
            </div>
          </div>

          <div className="relative group mt-6">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-xl group-focus-within:text-blue-500 transition-colors">🔍</span>
            <input
              type="text"
              placeholder="Escribe el nombre del producto o escanea código..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className={`w-full pl-16 pr-6 py-5 bg-white border rounded-3xl outline-none transition-all duration-300 font-semibold text-slate-700 placeholder:text-slate-300 ${scanError ? 'border-red-500 ring-4 ring-red-50 bg-red-50 shadow-inner' : 'border-slate-200 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5'}`}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {productos.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarAlCarrito(p)}
                  className="group flex flex-col p-5 bg-white border border-blue-100 rounded-[32px] text-left transition-all duration-300 hover:bg-blue-50/50 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/50 active:scale-95 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>

                  <h3 className="text-xs font-bold text-slate-700 uppercase line-clamp-2 min-h-[2.5rem] tracking-tight group-hover:text-blue-700 transition-colors relative z-10">{p.nombre}</h3>
                  <div className="mt-auto space-y-3 pt-4 relative z-10">
                    <span className="text-2xl font-black text-blue-600 italic tracking-tighter block drop-shadow-sm">{formatCOP(p.precio_venta)}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[8px] font-black text-blue-700 uppercase tracking-widest block bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 shadow-sm">REF: {p.referencia || 'S/R'}</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 shadow-sm">📦 {p.cantidad}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination Console */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between no-print">
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => fetchInventory(page - 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-medium hover:bg-slate-700 hover:text-white hover:shadow-sm disabled:opacity-30 transition-all">←</button>
            <button disabled={page >= totalPages || loading} onClick={() => fetchInventory(page + 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-800 border border-slate-700 text-slate-400 font-medium hover:bg-slate-700 hover:text-white hover:shadow-sm disabled:opacity-30 transition-all">→</button>
          </div>
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-slate-800 px-4 py-2 rounded-full border border-slate-700 shadow-sm">
            Catálogo: {((page - 1) * 50) + 1} - {Math.min(page * 50, totalRecords)} de {totalRecords}
          </div>
        </div>
      </div>

      {/* Cart side */}
      <div className="w-full lg:w-[450px] flex flex-col bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="p-8 border-b border-slate-100 flex flex-col gap-6 bg-slate-50/30">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Titular de la Factura</label>
            <div className="relative">
              <input
                list="fe-clientes-list"
                type="text"
                placeholder="Documento o Nombre del Cliente..."
                value={clienteSearch}
                onChange={e => {
                  const val = e.target.value;
                  setClienteSearch(val);
                  const match = clientes.find(c => c.documento === val || `${c.nombre} (${c.documento})` === val);
                  if (match) { setClienteId(match.id.toString()); setClienteSearch(`${match.nombre} (${match.documento})`); }
                }}
                className="w-full pl-6 pr-14 py-5 bg-slate-50 border border-slate-200 rounded-3xl text-xs font-medium uppercase outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/5 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all z-10"
                title="Registrar nuevo cliente"
              >
                ＋
              </button>
              <datalist id="fe-clientes-list">
                {clientes.map(c => (
                  <option key={c.id} value={c.documento}>{c.nombre}</option>
                ))}
              </datalist>
              <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-4">
          {carrito.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20">
              <span className="text-6xl mb-4">📑</span>
              <p className="text-[10px] font-medium uppercase tracking-widest">Carrito Electrónico Vacío</p>
            </div>
          ) : (
            carrito.map((item: any) => (
              <div
                key={item.id}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "+" || e.key === "Add") {
                    e.preventDefault();
                    agregarAlCarrito(item);
                  } else if (e.key === "-" || e.key === "Subtract") {
                    e.preventDefault();
                    removerDelCarrito(item);
                  }
                }}
                className="flex items-center gap-4 p-4 bg-white rounded-3xl border border-blue-50 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-bold text-slate-800 uppercase truncate leading-tight">{item.nombre}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest italic">{formatCOP(item.precio_venta)} c/u</span>
                    {parseFloat(item.iva_porcentaje) > 0 && (
                      <span className="text-[7px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">+ {item.iva_porcentaje}% IVA</span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls - Style aligned with POS */}
                <div className="flex items-center bg-blue-50/50 rounded-2xl p-1 border border-blue-100 shadow-inner shrink-0">
                  <button onClick={() => removerDelCarrito(item)} className="w-10 h-10 flex items-center justify-center text-lg text-slate-400 bg-white hover:text-rose-600 rounded-xl transition-all shadow-sm active:scale-90 select-none font-bold">－</button>
                  <input
                    type="number"
                    value={item.qty === 0 ? "" : item.qty}
                    onChange={(e) => actualizarCantidad(item.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "+" || e.key === "Add") {
                        e.preventDefault();
                        agregarAlCarrito(item);
                      } else if (e.key === "-" || e.key === "Subtract") {
                        e.preventDefault();
                        removerDelCarrito(item);
                      }
                    }}
                    className="w-10 text-center text-sm bg-transparent outline-none text-blue-900 font-black"
                  />
                  <button onClick={() => agregarAlCarrito(item)} className="w-10 h-10 flex items-center justify-center text-lg text-slate-400 bg-white hover:text-blue-600 rounded-xl transition-all shadow-sm active:scale-90 select-none font-bold">＋</button>
                </div>
              </div>
            ))
          )}
        </div>

        {carrito.length > 0 && (
          <div className="p-8 bg-white border-t border-slate-100 space-y-6">
            <div className="flex justify-between items-center px-2">
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block mb-1">Total a Reportar</span>
                <span className="text-4xl font-medium text-slate-900 tracking-tighter italic block leading-none">{formatCOP(granTotal)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-medium text-blue-600 uppercase tracking-widest block mb-1">{totalItems} Ítems</span>
                <span className="text-[9px] font-medium text-rose-600 uppercase tracking-widest block">Total IVA</span>
                <span className="text-lg font-medium text-slate-500 italic tracking-tighter">{formatCOP(totalIva)}</span>
              </div>
            </div>

            <button
              onClick={abrirCheckout}
              disabled={isProcessing}
              className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white rounded-[24px] font-semibold text-xs uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:brightness-110 transition-all flex items-center justify-center gap-4 group"
            >
              Confirmar Venta ⚡
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white group-hover:text-blue-600 transition-all border border-white/10">
                <span className="text-sm">→</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* 💳 Payment Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowCheckout(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-400">

            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-500 px-8 py-8 text-white text-center relative">
              <button onClick={() => setShowCheckout(false)} className="absolute right-4 top-4 text-white/50 hover:text-white transition-colors text-2xl font-semibold">✕</button>
              <h2 className="text-2xl font-medium tracking-tight uppercase italic">Forma de Pago DIAN</h2>
              <div className="text-4xl font-medium mt-4 tracking-tighter italic">{formatCOP(granTotal)}</div>
            </div>

            <div className="px-8 py-8 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setMetodoPago("Efectivo")}
                  className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all ${metodoPago === "Efectivo"
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-blue-200'}`}
                >
                  <span className="text-xl">💵</span>
                  <span className="text-[9px] font-semibold uppercase">Efectivo</span>
                </button>
                <button
                  onClick={() => setMetodoPago("Transferencia")}
                  className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all ${metodoPago === "Transferencia"
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg'
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-indigo-200'}`}
                >
                  <span className="text-xl">🏦</span>
                  <span className="text-[9px] font-semibold uppercase">Transf.</span>
                </button>
                <button
                  onClick={() => setMetodoPago("Mixto")}
                  className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all ${metodoPago === "Mixto"
                    ? 'bg-sky-600 border-sky-500 text-white shadow-lg'
                    : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-sky-200'}`}
                >
                  <span className="text-xl">🔀</span>
                  <span className="text-[9px] font-semibold uppercase">Mixto</span>
                </button>
              </div>

              <div className="min-h-[140px]">
                {metodoPago === "Efectivo" && (
                  <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 space-y-4 animate-in fade-in">
                    <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest block text-center italic">💵 Efectivo Recibido</label>
                    <input
                      autoFocus
                      type="number"
                      value={pagoCliente}
                      onChange={e => setPagoCliente(e.target.value)}
                      className="w-full py-4 bg-white border-2 border-blue-200 rounded-xl text-3xl font-semibold text-slate-900 outline-none focus:border-blue-500 text-center tracking-tighter"
                      placeholder="0"
                    />
                    {vuelto > 0 && <div className="bg-emerald-500 text-white py-3 rounded-xl text-center font-semibold animate-in zoom-in">Cambio: {formatCOP(vuelto)}</div>}
                  </div>
                )}

                {metodoPago === "Mixto" && (
                  <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 space-y-4 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-semibold text-slate-500 uppercase text-center block italic">💵 Efectivo</label>
                        <input type="number" value={pagoEfectivoMixto} onChange={e => setPagoEfectivoMixto(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center font-semibold" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-semibold text-slate-500 uppercase text-center block italic">🏦 Transf.</label>
                        <input type="number" value={pagoTransferenciaMixto} onChange={e => setPagoTransferenciaMixto(e.target.value)} className="w-full p-3 bg-white border border-slate-200 rounded-xl text-center font-semibold" />
                      </div>
                    </div>
                    <div className={`py-3 rounded-xl text-[10px] font-semibold text-center italic ${sumMixto === granTotal ? 'bg-emerald-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                      {sumMixto === granTotal ? "✓ Monto Cuadrado" : `Pendiente: ${formatCOP(granTotal - sumMixto)}`}
                    </div>
                  </div>
                )}

                {metodoPago === "Transferencia" && (
                  <div className="bg-indigo-50 rounded-2xl p-8 border border-indigo-100 flex flex-col items-center justify-center text-center animate-in fade-in">
                    <span className="text-4xl mb-2">🏦</span>
                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest italic leading-tight">Transferencia Electrónica Directa</p>
                    <p className="text-[10px] text-slate-400 mt-2 uppercase italic font-medium">Se reportará el total a la DIAN como pago digitalizado</p>
                  </div>
                )}
              </div>

              <button
                onClick={confirmarVenta}
                disabled={isProcessing}
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white rounded-2xl font-semibold text-xs uppercase tracking-[0.2em] shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 italic"
              >
                {isProcessing ? "Transmitiendo a DIAN..." : "Emitir Factura Electrónica ⚡"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🎉 Success Modal */}
      {ventaExitosa && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-2xl no-print">
          <div className="bg-white rounded-[50px] p-10 max-w-md w-full text-center shadow-3xl animate-in zoom-in duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"></div>

            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 rotate-12 shadow-lg shadow-emerald-100 italic font-medium">✓</div>
            <h2 className="text-3xl font-medium text-slate-900 uppercase tracking-tighter italic mb-1">¡Éxito Legal!</h2>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-8 italic">La factura electrónica DIAN ha sido generada</p>

            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-8">
              <span className="text-[9px] font-semibold text-indigo-400 uppercase tracking-widest mb-1 block italic text-center">Consecutivo Oficial</span>
              <span className="text-3xl font-medium text-slate-900 tracking-tighter uppercase italic">{feExitoData?.numero_completo}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button onClick={reactToPrintFn} className="py-4 bg-slate-900 text-white rounded-2xl font-semibold text-[10px] uppercase tracking-widest hover:bg-black transition-all flex flex-col items-center gap-2 group">
                <span className="text-xl group-hover:scale-110 transition-transform">🖨️</span> Imprimir
              </button>
              <button onClick={compartirWhatsApp} className="py-4 bg-emerald-600 text-white rounded-2xl font-semibold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex flex-col items-center gap-2 group">
                <span className="text-xl group-hover:scale-110 transition-transform">📲</span> WhatsApp
              </button>
            </div>

            <button
              onClick={resetVenta}
              className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-medium text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-100 transition-all border border-indigo-100 italic"
            >
              Cerrar y Nueva Venta
            </button>
          </div>
        </div>
      )}

      {/* Hidden Print Component */}
      <div style={{ display: "none" }}>
        {feExitoData && (
          <PrintReceipt
            ref={contentRef}
            empresa={empresa}
            numero={feExitoData.numero_completo}
            fecha={new Date()}
            cliente={clientes.find(c => c.id.toString() === clienteId.toString())?.nombre || "Cliente"}
            cajero={cajeros.find(c => c.id.toString() === cajeroId.toString())?.nombre || "Cajero"}
            metodoPago={totalesRecibo?.metodoPago || metodoPago}
            items={itemsParaRecibo}
            total={totalesRecibo?.granTotal || 0}
            iva={totalesRecibo?.totalIva || 0}
            efectivoRecibido={totalesRecibo?.efectivoRecibido}
            vuelto={totalesRecibo?.vuelto}
            pagoEfectivoMixto={totalesRecibo?.pagoEfectivoMixto}
            pagoTransferenciaMixto={totalesRecibo?.pagoTransferenciaMixto}
          />
        )}
      </div>

      {/* Quick Customer Registration Modal */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowQuickCustomerModal(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[40px] shadow-3xl p-10 animate-in zoom-in duration-300 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 font-semibold">Registro Rápido</h2>
              <button onClick={() => setShowQuickCustomerModal(false)} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:text-rose-500 transition-all font-semibold">×</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCustomer.nombre) return alert("El nombre es obligatorio");
              setIsCreatingCustomer(true);
              try {
                const res = await API.post("/clientes", newCustomer);
                const created = res.data;
                // Add to local list
                setClientes((prev: any[]) => [...prev, created]);
                // Select it
                setClienteId(created.id.toString());
                setClienteSearch(`${created.nombre} (${created.documento || 'S/D'})`);
                setShowQuickCustomerModal(false);
                setNewCustomer({ nombre: "", documento: "", tipo_documento: "13", dv: "", telefono: "", correo: "" });
              } catch (err: any) {
                alert("Error creando cliente: " + (err.response?.data?.error || err.message));
              } finally {
                setIsCreatingCustomer(false);
              }
            }} className="space-y-4">

              <div className="grid grid-cols-1 gap-4">
                <div className="flex gap-2">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">NIT / Cédula</label>
                    <input
                      type="text"
                      value={newCustomer.documento}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setNewCustomer({
                          ...newCustomer,
                          documento: val,
                          dv: newCustomer.tipo_documento === "31" ? calcularDV(val) : ""
                        });
                      }}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                      placeholder="Nro Identificación"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newCustomer.documento) return alert("Ingrese el NIT");
                      setIsCreatingCustomer(true);
                      try {
                        // Intento de consulta a API pública (V-Pro o similar)
                        const resp = await fetch(`https://api.v-pro.org/nit/${newCustomer.documento}`);
                        if (resp.ok) {
                          const data = await resp.json();
                          if (data && data.razon_social) {
                            setNewCustomer(prev => ({
                              ...prev,
                              nombre: data.razon_social.toUpperCase(),
                              dv: data.dv?.toString() || calcularDV(prev.documento),
                              tipo_documento: "31"
                            }));
                          } else {
                            setNewCustomer(prev => ({ ...prev, dv: calcularDV(prev.documento) }));
                          }
                        } else {
                          setNewCustomer(prev => ({ ...prev, dv: calcularDV(prev.documento) }));
                        }
                      } catch {
                        setNewCustomer(prev => ({ ...prev, dv: calcularDV(prev.documento) }));
                      } finally {
                        setIsCreatingCustomer(false);
                      }
                    }}
                    className="mt-6 px-4 bg-slate-100 text-slate-600 rounded-2xl font-semibold text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all border border-slate-200"
                  >
                    Consultar ✨
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">Nombre Completo / Razón Social</label>
                <input
                  type="text"
                  value={newCustomer.nombre}
                  onChange={e => setNewCustomer({ ...newCustomer, nombre: e.target.value.toUpperCase() })}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                  placeholder="Se llena automáticamente al consultar"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">Tipo Identificación</label>
                  <select
                    value={newCustomer.tipo_documento}
                    onChange={e => {
                      const val = e.target.value;
                      setNewCustomer({
                        ...newCustomer,
                        tipo_documento: val,
                        dv: val === "31" ? calcularDV(newCustomer.documento) : ""
                      });
                    }}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold text-xs"
                  >
                    <option value="13">Cédula de Ciudadanía</option>
                    <option value="31">NIT (Número Id. Tributaria)</option>
                    <option value="11">Registro Civil</option>
                    <option value="12">Tarjeta de Identidad</option>
                    <option value="22">Cédula de Extranjería</option>
                    <option value="41">Pasaporte</option>
                    <option value="50">NIT de otro país</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">DV</label>
                  <input
                    type="text"
                    value={newCustomer.dv}
                    readOnly
                    className="w-full px-5 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl text-center font-medium text-indigo-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">WhatsApp</label>
                  <input
                    type="text"
                    value={newCustomer.telefono}
                    onChange={e => setNewCustomer({ ...newCustomer, telefono: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">Email</label>
                  <input
                    type="email"
                    value={newCustomer.correo}
                    onChange={e => setNewCustomer({ ...newCustomer, correo: e.target.value })}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold text-xs"
                    placeholder="factura@email.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreatingCustomer}
                className="w-full py-5 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-[10px] font-medium mt-4"
              >
                {isCreatingCustomer ? "⏳ Procesando..." : "✅ Registrar y Seleccionar"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Colombian DV Calculation (Algoritmo DIAN)
function calcularDV(nit: string) {
  if (!nit || isNaN(nit as any)) return "";
  const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let x = 0;
  let y = 0;
  let z = nit.length;
  for (let i = 0; i < z; i++) {
    y = parseInt(nit.substr(i, 1));
    x += (y * vpri[z - i - 1]);
  }
  y = x % 11;
  return (y > 1) ? (11 - y).toString() : y.toString();
}

export default FacturacionElectronica;
