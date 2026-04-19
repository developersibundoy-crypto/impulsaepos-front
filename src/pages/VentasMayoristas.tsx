import { useEffect, useState, useRef, useCallback, type ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import PrintReceipt from "../components/PrintReceipt";
import { useCaja } from "../components/CajaContext";
import { socket, joinEmpresaRoom } from "../utils/socket";
import { hasAccess } from "../utils/auth";

function VentasMayoristas() {
  const navigate = useNavigate();
  const { verificarEstado } = useCaja();
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // POS States (Multi-Tab Core)
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem("posMayoristaTabs");
    try {
      const parsed = savedTabs ? JSON.parse(savedTabs) : null;
      return (Array.isArray(parsed) && parsed.length > 0) ? parsed : [{ id: 1, carrito: [], clienteId: "1", clienteSearch: "" }];
    } catch {
      return [{ id: 1, carrito: [], clienteId: "1", clienteSearch: "" }];
    }
  });

  const [activeTabId, setActiveTabId] = useState(() => {
    const savedActiveTab = localStorage.getItem("posMayoristaActiveTab");
    try {
      return savedActiveTab ? JSON.parse(savedActiveTab) : 1;
    } catch {
      return 1;
    }
  });

  const activeTab = (tabs && tabs.find((t: any) => t.id === activeTabId)) || (tabs && tabs[0]) || { id: 1, carrito: [], clienteId: "1", clienteSearch: "" };

  useEffect(() => {
    localStorage.setItem("posMayoristaTabs", JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem("posMayoristaActiveTab", JSON.stringify(activeTabId));
  }, [activeTabId]);

  const carrito = activeTab?.carrito || [];
  const clienteId = activeTab?.clienteId || "1";
  const clienteSearch = activeTab?.clienteSearch || "";

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
    return localStorage.getItem("adminCajeroId") || localStorage.getItem("posCajeroId") || "";
  });

  useEffect(() => {
    localStorage.setItem("posCajeroId", cajeroId);
  }, [cajeroId]);

  // Receipt Print State
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [facturaIdImpresion, setFacturaIdImpresion] = useState<number | null>(null);
  const [itemsParaRecibo, setItemsParaRecibo] = useState<any[]>([]);
  const trMixtoRef = useRef<HTMLInputElement>(null);
  const successTimeRef = useRef(0);
  const [phoneWS, setPhoneWS] = useState("");

  // Quick Customer Registration
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

  // Separados logic inside Wholesale
  const [showCreateSeparadoModal, setShowCreateSeparadoModal] = useState(false);
  const [abonoInicial, setAbonoInicial] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [metodoPagoAbono, setMetodoPagoAbono] = useState("Efectivo");
  const [isProcessingSeparado, setIsProcessingSeparado] = useState(false);


  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Scanner Optimization Refs
  const lastKeystrokeTime = useRef(0);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab Handlers
  const nuevaTab = () => {
    const newId = Math.max(...tabs.map((t: any) => t.id), 0) + 1;
    setTabs([...tabs, { id: newId, carrito: [], clienteId: "1", clienteSearch: "" }]);
    setActiveTabId(newId);
  };

  const cerrarTab = (id: number) => {
    if (tabs.length === 1) return;
    if (window.confirm("¿Seguro que deseas descartar este despacho mayorista?")) {
      const newTabs = tabs.filter((t: any) => t.id !== id);
      setTabs(newTabs);
      if (activeTabId === id) {
        setActiveTabId(newTabs[0].id);
      }
    }
  };



  const fetchInventory = useCallback((p: number = page, searchVal: string = search) => {
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
      .catch(err => {
        console.error(err);
        setProductos([]);
        setLoading(false);
      });
  }, [page, search]);

  // 1. Cargar Datos Maestros (Estáticos)
  useEffect(() => {
    API.get("/cajeros")
      .then(res => {
        setCajeros(res.data);
        const fixedId = localStorage.getItem("adminCajeroId");
        if (fixedId) setCajeroId(fixedId);
      })
      .catch(console.error);

    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/empresa").then(res => setEmpresa(res.data)).catch(console.error);

    // Initial inventory fetch
    fetchInventory(1);
  }, []); // Solo al montar

  // 2. Sincronización en Tiempo Real (Sockets) - Profesional
  useEffect(() => {
    if (!empresa?.id) return;

    joinEmpresaRoom(empresa.id);

    const handleProductUpdate = (updatedProd: any) => {
      setProductos(prev => prev.map(p => p.id === updatedProd.id ? { ...p, ...updatedProd } : p));
    };
    const handleBatchUpdate = () => fetchInventory();

    socket.on("product_updated", handleProductUpdate);
    socket.on("inventory_batch_updated", handleBatchUpdate);

    return () => {
      socket.off("product_updated", handleProductUpdate);
      socket.off("inventory_batch_updated", handleBatchUpdate);
    };
  }, [empresa?.id, fetchInventory]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    
    const now = Date.now();
    const isFast = now - lastKeystrokeTime.current < 50;
    lastKeystrokeTime.current = now;

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    if (isFast && val.length > 2) {
      scanTimeoutRef.current = setTimeout(() => {
        handleSearchKeyPress({ key: 'Enter', preventDefault: () => {}, stopPropagation: () => {} } as any);
      }, 150);
    } else {
      scanTimeoutRef.current = setTimeout(() => {
        fetchInventory(1, val);
      }, 300);
    }
  };

  // --- Sincronización de Precios Mayoristas ---
  useEffect(() => {
    if (productos.length === 0) return;
    let hasChanges = false;
    const newTabs = tabs.map((tab: any) => {
      const newCarrito = tab.carrito.map((item: any) => {
        const catalogItem = productos.find(p => p.id === item.id);
        if (catalogItem && (catalogItem.precio_venta !== item.precio_venta || catalogItem.iva_porcentaje !== item.iva_porcentaje)) {
          hasChanges = true;
          return { ...item, ...catalogItem };
        }
        return item;
      });
      return hasChanges ? { ...tab, carrito: newCarrito } : tab;
    });
    if (hasChanges) setTabs(newTabs);
  }, [productos]);

  const filteredProducts = productos; // Pagination is now server-side

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
        setCarrito([...carrito, { ...producto, qty: 1, descuento: 10 }]);
      }
      return;
    }

    const currentCommitted = getCommittedQty(producto.id);
    const available = producto.cantidad - currentCommitted;
    const isNegativeBlocked = !empresa.permitir_venta_negativa || !producto.permitir_venta_negativa;

    if (isNegativeBlocked && available <= 0) {
      alert(`🏷️ ¡Bloqueo Mayorista! El producto "${producto.nombre}" ya no cuenta con existencias disponibles en el inventario general. 📦`);
      return;
    }

    const exist = carrito.find((x: any) => x.id === producto.id);
    if (exist) {
      setCarrito(carrito.map((x: any) => x.id === producto.id ? { ...exist, qty: exist.qty + 1 } : x));
    } else {
      setCarrito([...carrito, { ...producto, qty: 1, descuento: 10 }]);
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

    const currentItem = carrito.find((x: any) => x.id === id);
    if (!currentItem) return;

    if (currentItem.es_servicio) {
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
      return;
    }

    const currentlyInThisCart = currentItem.qty;
    const totalCommitted = getCommittedQty(id);
    const committedInOtherTabs = totalCommitted - currentlyInThisCart;
    const available = currentItem.cantidad - committedInOtherTabs;

    const isNegativeBlocked = !empresa.permitir_venta_negativa || !currentItem.permitir_venta_negativa;

    if (isNegativeBlocked && qty > available) {
      alert(`⚠️ ¡Stock Insuficiente! Para este despacho mayorista, solo es posible asignar hasta ${Math.max(0, available)} unidades de "${currentItem.nombre}". 📊`);
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: Math.max(0, available) } : x));
      return;
    }

    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
  };

  const vaciarCarrito = () => {
    if (window.confirm("¿Seguro que deseas anular este despacho?")) setCarrito([]);
  };

  const handleSearchKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (search.trim() !== '') {
        e.preventDefault();
        e.stopPropagation(); 
        const barcode = search.trim();
        
        // 1. Intentar buscar localmente
        const matchedProduct = productos.find(p =>
          p.referencia && p.referencia.trim().toLowerCase() === barcode.toLowerCase()
        );

        if (matchedProduct) {
          agregarAlCarrito(matchedProduct);
          setSearch("");
          if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
        } else {
          // 2. Buscar en el servidor por referencia exacta
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
      }
    }
  };

  const handleDescuentoChange = (id: number, valor: string) => {
    let desc = parseFloat(valor) || 0;
    if (desc < 0) desc = 0;
    if (desc > 100) desc = 100;
    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, descuento: desc } : x));
  };

  const subtotalOriginal = carrito.reduce((a: number, c: any) => a + (c.precio_venta * c.qty), 0);
  const totalItems = carrito.reduce((a: number, c: any) => a + (c.qty || 0), 0);
  const granTotal = carrito.reduce((a: number, c: any) => a + (c.precio_venta * (1 - (c.descuento || 0) / 100)) * c.qty, 0);
  const totalIva = carrito.reduce((a: number, c: any) => {
    const totalItem = (c.precio_venta * (1 - (c.descuento || 0) / 100)) * c.qty;
    const ivaPerc = parseFloat(c.iva_porcentaje || 0);
    const base = totalItem / (1 + ivaPerc / 100);
    return a + (totalItem - base);
  }, 0);
  const totalNeto = granTotal - totalIva;
  const valorDescuento = subtotalOriginal - granTotal;

  const parseCurrency = (val: string | number) => {
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/\./g, '')) || 0;
  };

  const cashPaga = parseCurrency(pagoCliente);
  const vuelto = cashPaga - granTotal;

  const handleCurrencyInputChange = (e: ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setter('');
    } else {
      const formatted = new Intl.NumberFormat('de-DE').format(parseInt(val));
      setter(formatted);
    }
  };

  const clienteSeleccionado = clientes.find(c => c.id === parseInt(clienteId)) || { nombre: "Sin Seleccionar" };
  const cajeroSeleccionado = cajeros.find(c => c.id === parseInt(cajeroId)) || { nombre: "Cajero Principal" };
  const isUserFixedCajero = !!localStorage.getItem("adminCajeroId");

  const resetVenta = useCallback(() => {
    setVentaExitosa(false);
    setPagoCliente("");
    setPagoEfectivoMixto("");
    setPagoTransferenciaMixto("");
    setFacturaIdImpresion(null);
    setItemsParaRecibo([]);

    if (activeTabId !== 1) {
      const newTabs = tabs.filter((t: any) => t.id !== activeTabId);
      setTabs(newTabs);
      setActiveTabId(newTabs[0]?.id || 1);
    } else {
      setCarrito([]);
      setClienteId("1");
      setClienteSearch("");
    }
  }, [activeTabId, tabs]);

  const confirmarVenta = useCallback(async () => {
    if (isProcessing) return;
    if (!showCheckout) return;
    if (carrito.length === 0) return;
    if (carrito.some((i: any) => !i.qty || i.qty <= 0)) {
      return alert("❌ Error: Una o más cantidades no son válidas.");
    }
    if (!cajeroId) return alert("❌ Seguridad: Selecciona al Responsable del Despacho.");
    if (metodoPago === "Efectivo" && cashPaga < granTotal) {
      return alert("Monto entregado insuficiente.");
    }
    if (metodoPago === "Mixto" && sumMixto !== granTotal) {
      return alert("El pago mixto debe sumar exactamente el total de la factura.");
    }

    setIsProcessing(true);
    successTimeRef.current = Date.now();
    try {
      const discountedCart = carrito.map((item: any) => ({
        ...item,
        precio_venta: item.precio_venta * (1 - (item.descuento || 0) / 100)
      }));

      const response = await API.post("/ventas", {
        items: discountedCart,
        metodoPago,
        efectivoEntregado: metodoPago === "Mixto" ? efMixto : (metodoPago === "Efectivo" ? cashPaga : 0),
        transferenciaEntregada: metodoPago === "Mixto" ? trMixto : (metodoPago === "Tarjeta" ? granTotal : 0),
        vuelto: vuelto > 0 ? vuelto : 0,
        cajeroId: cajeroId ? parseInt(cajeroId) : null,
        clienteId: clienteId ? parseInt(clienteId) : null,
        total: granTotal,
        iva: totalIva
      });
      setFacturaIdImpresion(response.data.factura_id);
      setItemsParaRecibo([...carrito]);

      const clientObj = clientes.find(c => c.id === parseInt(clienteId));
      setPhoneWS(clientObj?.telefono?.replace(/\D/g, '') || "");

      setVentaExitosa(true);
      setShowCheckout(false);
      setCarrito([]);
      fetchInventory();
      verificarEstado();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Error procesando el despacho mayorista.");
    } finally {
      setIsProcessing(false);
    }
  }, [showCheckout, isProcessing, carrito, cajeroId, metodoPago, cashPaga, granTotal, sumMixto, efMixto, trMixto, vuelto, clienteId, totalIva, clientes, fetchInventory, verificarEstado]);

  // --- High Performance Keyboard Listener using Refs ---
  const stateRef = useRef({
    isProcessing,
    ventaExitosa,
    showCheckout,
    carrito,
    search,
    cajeroId,
    showQuickCustomerModal,
    showCreateSeparadoModal
  });

  useEffect(() => {
    stateRef.current = {
      isProcessing,
      ventaExitosa,
      showCheckout,
      carrito,
      search,
      cajeroId,
      showQuickCustomerModal,
      showCreateSeparadoModal
    };
  }, [isProcessing, ventaExitosa, showCheckout, carrito, search, cajeroId, showQuickCustomerModal, showCreateSeparadoModal]);

  useEffect(() => {
    const handleGlobalEnter = (e: KeyboardEvent) => {
      if (ventaExitosa && e.key === 'Enter') {
        const timeSinceSuccess = Date.now() - successTimeRef.current;
        if (timeSinceSuccess > 600) {
          resetVenta();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalEnter);
    return () => window.removeEventListener('keydown', handleGlobalEnter);
  }, [ventaExitosa, resetVenta]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (s.isProcessing) return;

      if (e.key === 'Enter') {
        const activeEl = document.activeElement as HTMLElement;
        // Textareas still use Enter for new lines
        if (activeEl?.tagName === 'TEXTAREA') return;

        // 1. If sale successful, reset
        if (s.ventaExitosa) {
          e.preventDefault(); e.stopPropagation();
          resetVenta();
          return;
        }

        // 2. If checkout open, ALWAYS confirm (even if input is focused)
        if (s.showCheckout) {
          e.preventDefault(); e.stopPropagation();
          confirmarVenta();
          return;
        }

        // 3. If in main view and NOT in an input (except empty search), open checkout
        if (activeEl?.tagName === 'INPUT' && s.search.trim() !== "") return;

        if (!s.showCheckout && !s.ventaExitosa && !s.showQuickCustomerModal && !s.showCreateSeparadoModal && s.carrito.length > 0) {
          e.preventDefault(); e.stopPropagation();
          if (!s.cajeroId) {
            alert("⚠️ Identificación Requerida: Seleccione al responsable del despacho.");
          } else {
            setShowCheckout(true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [resetVenta, confirmarVenta]);

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  const imprimirYTerminar = () => {
    reactToPrintFn();
  };

  const enviarWS = useCallback((num: string) => {
    const header = `🏪 *${empresa?.nombre_empresa || "MI EMPRESA"}*\n` +
      (empresa?.nit ? `NIT: ${empresa.nit}\n` : "") +
      (empresa?.direccion ? `📍 ${empresa.direccion}\n` : "") +
      (empresa?.telefono ? `📞 Tel: ${empresa.telefono}\n` : "") +
      `--------------------------------\n`;

    const saleInfo = `📦 *Distribución Mayorista*\n` +
      `📄 *Lote # ${facturaIdImpresion}*\n` +
      `📅 Fecha: ${new Date().toLocaleString('es-CO')}\n` +
      `👤 Cliente: ${clienteSeleccionado.nombre}\n` +
      `👤 Vendedor: ${cajeroSeleccionado.nombre}\n` +
      `--------------------------------\n`;

    const itemsStr = itemsParaRecibo.map((i: any) => {
      const qty = i.qty || i.cantidad || 1;
      const unitPrice = i.precio_venta * (1 - (i.descuento || 0) / 100);
      return `• ${i.nombre} (x${qty})\n  Subtotal: ${formatCOP(unitPrice * qty)}`;
    }).join('\n');

    const totalsStr = `\n--------------------------------\n` +
      `Subtotal: ${formatCOP(granTotal - totalIva)}\n` +
      (totalIva > 0 ? `IVA: ${formatCOP(totalIva)}\n` : "") +
      `💰 *TOTAL LOTE: ${formatCOP(granTotal)}*\n` +
      `Método: ${metodoPago}\n`;

    const footer = `--------------------------------\n` +
      `🙏 ¡Gracias por su confianza comercial!\n` +
      (empresa?.resolucion ? `\n${empresa.resolucion}` : "");

    const mensaje = `${header}${saleInfo}🛒 *Resumen del Lote:*\n${itemsStr}${totalsStr}${footer}`;

    let waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    if (num && num.length >= 7) {
      const fullNum = num.startsWith('57') ? num : `57${num}`;
      waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    }
    window.open(waUrl, '_blank');
  }, [empresa, facturaIdImpresion, clienteSeleccionado, cajeroSeleccionado, itemsParaRecibo, granTotal, totalIva, metodoPago]);

  const compartirWhatsApp = () => {
    if (!facturaIdImpresion) return;
    const distFound = clientes.find(c => c.id.toString() === clienteId.toString());
    const rawPhone = distFound?.telefono || phoneWS || "";
    const cleanPhone = rawPhone.replace(/\D/g, '');
    enviarWS(cleanPhone);
  };


  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-125px)] gap-4 lg:overflow-hidden animate-in fade-in duration-500 p-0 -mt-2 sm:-mt-3 lg:-mt-4">



      {/* LEFT: Massive Catalog */}
      <div className="flex-1 flex flex-col bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                {hasAccess("facturas_venta") && (
                  <Link
                    to="/facturas"
                    className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:text-blue-600 hover:bg-blue-50 transition-all group"
                    title="Historial de Ventas"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="w-4 h-0.5 bg-current rounded-full"></span>
                      <span className="w-4 h-0.5 bg-current rounded-full"></span>
                      <span className="w-4 h-0.5 bg-current rounded-full"></span>
                    </div>
                  </Link>
                )}
                <div className="relative group/sep">
                  <button className="h-10 px-4 bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-medium text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100">
                    <span className="text-lg">📋</span> SEPARADOS
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover/sep:opacity-100 group-hover/sep:visible transition-all z-[60] p-2 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    <button
                      onClick={() => navigate("/separados")}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all uppercase text-left group/item"
                    >
                      <span className="text-base group-hover/item:scale-110 transition-transform">📋</span>
                      Historial Mayorista
                    </button>
                    <button
                      onClick={() => {
                        if (carrito.length === 0) return alert("⚠️ Lote Vacío: Agregue mercancía para iniciar un separado.");
                        setShowCreateSeparadoModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all uppercase text-left group/item"
                    >
                      <span className="text-base group-hover/item:scale-110 transition-transform">＋</span>
                      Separar Lote Actual
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col ml-1">
                <h2 className="text-2xl font-medium text-slate-800 uppercase tracking-tighter italic leading-none">Ventas Mayoristas</h2>
                <p className="text-[10px] font-medium text-sky-600 uppercase tracking-widest mt-1">Módulo de Alta Frecuencia / Lotes</p>
              </div>
            </div>
            <div className="hidden lg:flex px-5 py-2 bg-white rounded-full border border-sky-100 shadow-sm items-center gap-3">
              <span className="w-2.5 h-2.5 bg-sky-500 rounded-full animate-pulse shadow-lg shadow-sky-300"></span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none">Canal Mayorista Activo</span>
            </div>
          </div>

          <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-600 transition-colors text-xl">🚚</span>
            <input
              type="text"
              placeholder="Escanea SKU o localiza mercancía por nombre..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className={`w-full pl-16 pr-8 py-5 bg-white border rounded-[28px] outline-none transition-all duration-300 font-medium text-sm shadow-sm ${scanError ? 'border-red-500 ring-6 ring-red-50 bg-red-50 shadow-inner' : 'border-slate-200 focus:border-sky-500 focus:ring-8 focus:ring-sky-100/50'}`}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-white scrollbar-thin scrollbar-thumb-sky-50">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-6">
              <div className="w-12 h-12 border-4 border-sky-50 border-t-sky-600 rounded-full animate-spin"></div>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.4em]">Sincronizando Depósito...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              {filteredProducts.map(p => {
                const committed = getCommittedQty(p.id);
                const available = p.cantidad - committed;
                const isOutOfStock = (!empresa.permitir_venta_negativa || !p.permitir_venta_negativa) && available <= 0 && !p.es_servicio;

                return (
                  <button
                    key={p.id}
                    onClick={() => agregarAlCarrito(p)}
                    disabled={isOutOfStock}
                    className={`group relative flex flex-col p-5 bg-white rounded-[32px] border border-slate-200 text-left transition-all duration-500 hover:shadow-2xl hover:shadow-sky-100 hover:border-sky-400 disabled:opacity-40 select-none overflow-hidden ${isOutOfStock ? 'bg-slate-50' : ''}`}
                  >
                    <div className="mb-4">
                      <h3 className="text-[12px] text-slate-900 font-medium uppercase line-clamp-2 leading-tight min-h-[2.4rem] tracking-tight group-hover:text-sky-600 transition-colors">{p.nombre}</h3>
                      <p className="text-[10px] text-slate-900 font-bold mt-2 uppercase italic tracking-tighter">{p.referencia || 'SIN REFERENCIA'}</p>
                    </div>
                    <div className="mt-auto flex flex-col gap-3">
                      <div className="text-xl font-medium text-sky-600 italic tracking-tighter">{formatCOP(p.precio_venta)}</div>
                      <div className={`text-[9px] px-3 py-1.5 rounded-xl w-fit font-medium border uppercase tracking-widest ${available <= 0 && !p.es_servicio ? 'bg-rose-50 text-rose-500 border-rose-100' :
                        available < 10 && !p.es_servicio ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                        {p.es_servicio ? '⚡ SERVICIO' : `🚛 STOCK: ${Math.max(0, available)}`}
                      </div>
                    </div>
                    {/* Add effect */}
                    <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-sky-600 rounded-full flex items-center justify-center text-white scale-0 group-hover:scale-100 transition-all duration-500">
                      <span className="mb-1 mr-1 text-2xl">+</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Console */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between no-print">
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => fetchInventory(page - 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 font-medium hover:bg-white hover:text-indigo-600 hover:shadow-sm disabled:opacity-30 transition-all">←</button>
            <button disabled={page >= totalPages || loading} onClick={() => fetchInventory(page + 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 font-medium hover:bg-white hover:text-indigo-600 hover:shadow-sm disabled:opacity-30 transition-all">→</button>
          </div>
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            Catálogo: {totalRecords > 0 ? `${((page - 1) * 50) + 1} - ${Math.min(page * 50, totalRecords)} de ${totalRecords}` : "0 - 0 de 0"}
          </div>
        </div>
      </div>

      {/* RIGHT: Major Cart / Lote System */}
      <div className="w-full lg:w-[380px] xl:w-[440px] 2xl:w-[480px] h-full bg-white rounded-[30px] border border-slate-100 shadow-2xl flex flex-col overflow-hidden relative">

        {/* Lote Tabs */}
        <div className="p-5 bg-slate-100 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[12px] font-medium text-slate-400 uppercase tracking-[0.2em] italic">Lotes Activos</h3>
            <button onClick={nuevaTab} className="bg-white px-3 py-1.5 rounded-full border border-slate-200 text-[11px] font-medium text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">+ Nuevo Lote</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab: any, idx: number) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all border-2 ${activeTabId === tab.id
                  ? "bg-indigo-700 text-white border-indigo-700 shadow-md scale-105 z-10"
                  : "bg-white text-slate-400 border-slate-100 hover:border-indigo-200"
                  }`}
              >
                Caja {idx + 1}
                <span className={`w-1.5 h-1.5 rounded-full ${tab.carrito.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-200'}`}></span>
                {tabs.length > 1 && (
                  <span onClick={(e) => { e.stopPropagation(); cerrarTab(tab.id); }} className="ml-2 hover:text-rose-300 transition-colors text-lg font-light">×</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Unified Session Context */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-white border-b border-slate-50">
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-medium text-slate-400 uppercase tracking-widest ml-1">Responsable</label>
            <div className="relative">
              <select
                disabled={isUserFixedCajero}
                value={cajeroId}
                onChange={e => setCajeroId(e.target.value)}
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-[10px] font-medium transition-all appearance-none uppercase shadow-inner ${isUserFixedCajero ? 'border-indigo-50 bg-indigo-50/20 text-indigo-600/50' : 'border-slate-100 focus:bg-white outline-none'}`}
              >
                <option value="">-- Usuario --</option>
                {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none opacity-40">🧑‍💼</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[8px] font-medium text-slate-400 uppercase tracking-widest ml-1">Distribuidor</label>
            <div className="relative group">
              <input
                type="text"
                placeholder="Buscar distribuidor..."
                value={clienteSearch}
                onChange={e => {
                  const val = e.target.value;
                  setClienteSearch(val);
                  const match = clientes.find(c => `${c.nombre} ${c.documento ? `(${c.documento})` : ''}` === val);
                  if (match) setClienteId(match.id.toString());
                  else if (val === "") setClienteId("1");
                }}
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-medium focus:bg-white outline-none transition-all uppercase placeholder:text-slate-300 shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-indigo-600 text-white rounded-lg shadow-md shadow-indigo-100 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-10"
                title="Registrar nuevo distribuidor"
              >
                ＋
              </button>

              {/* Búsqueda Predictiva Profesional */}
              {(() => {
                const isExactMatch = clientes.some(c => `${c.nombre} ${c.documento ? `(${c.documento})` : ''}` === clienteSearch);
                const filtered = clienteSearch && !isExactMatch
                  ? clientes.filter(c =>
                    c.id !== 1 &&
                    (c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) ||
                      (c.documento && c.documento.includes(clienteSearch)))
                  )
                  : [];

                if (filtered.length === 0) return null;

                return (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-[20px] shadow-2xl max-h-64 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {filtered.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setClienteSearch(`${c.nombre} ${c.documento ? `(${c.documento})` : ''}`);
                          setClienteId(c.id.toString());
                        }}
                        className="p-2.5 hover:bg-indigo-50 cursor-pointer rounded-xl text-[10px] font-medium text-slate-700 uppercase border-b border-slate-50 last:border-0 flex justify-between items-center group transition-colors"
                      >
                        <span className="group-hover:text-indigo-600 truncate">{c.nombre}</span>
                        {c.documento && <span className="text-[8px] text-slate-300 font-normal">{c.documento}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none opacity-40">🎯</span>
            </div>
          </div>
        </div>

        {/* Lote Items Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-indigo-50 scrollbar-track-transparent">
          {carrito.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
              <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner animate-pulse">🚛</div>
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-slate-400">Lote Mayorista Vacío</p>
              <p className="text-[9px] text-slate-300 mt-2 uppercase italic max-w-[200px]">Seleccione mercancía industrial para procesar despacho</p>
            </div>
          ) : (
            <div className="space-y-2 p-1">
              {carrito.map((item: any) => (
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
                  className="group relative flex flex-col p-2 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {/* Fila 1: Todo el control operativo */}
                  <div className="flex items-center gap-2 min-h-[32px] py-1">
                    {/* Descripción */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[10px] font-medium text-slate-900 uppercase truncate">{item.nombre}</h4>
                    </div>

                    {/* Cantidad */}
                    <div className="flex items-center bg-slate-100/50 rounded-xl p-1 gap-1 border border-slate-200/50 shrink-0">
                      <button onClick={() => removerDelCarrito(item)} className="w-10 h-10 flex items-center justify-center text-lg text-slate-400 bg-white hover:text-rose-600 rounded-lg shadow-sm font-bold">－</button>
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
                        className="w-10 text-center text-sm font-bold bg-transparent outline-none text-slate-800"
                      />
                      <button onClick={() => agregarAlCarrito(item)} className="w-10 h-10 flex items-center justify-center text-lg text-slate-400 bg-white hover:text-indigo-600 rounded-lg shadow-sm font-bold">＋</button>
                    </div>

                    {/* Descuento */}
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[8px] font-medium text-slate-400">B:</span>
                      <input
                        type="number"
                        className="w-10 py-1 bg-white border border-indigo-100 rounded text-center text-sm font-semibold text-indigo-700 outline-none"
                        value={item.descuento || 10}
                        onChange={e => handleDescuentoChange(item.id, e.target.value)}
                      />
                    </div>

                    {/* Precio Final */}
                    <div className="text-right min-w-[80px] shrink-0">
                      <span className="text-sm font-semibold text-slate-950 tracking-tighter border-l border-slate-100 pl-2">
                        {formatCOP((item.precio_venta * (1 - (item.descuento || 0) / 100)) * item.qty)}
                      </span>
                    </div>

                    {/* Eliminar */}
                    <button onClick={() => eliminarDelCarrito(item)} className="text-slate-300 hover:text-rose-500 text-xl font-light px-1 leading-none">×</button>
                  </div>

                  {/* Fila 2: Referencia Bold */}
                  <div className="flex items-center h-5 mt-0.5 border-t border-slate-50 pt-0.5">
                    <span className="text-[11px] font-medium text-slate-950 uppercase tracking-tight truncate">REF: {item.referencia || 'SIN REFERENCIA'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Major Totals & Dispatch Action */}
        {carrito.length > 0 && (
          <div className="p-3 bg-white border-t border-slate-100 space-y-2 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] rounded-t-[24px] animate-in slide-in-from-bottom-2">
            <div className="space-y-1">
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] text-emerald-700 font-medium uppercase tracking-[0.2em]">Neto Original</span>
                <span className="text-[12px] text-emerald-800 line-through font-medium">{formatCOP(subtotalOriginal)}</span>
              </div>
              <div className="flex justify-between items-center px-2">
                <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-[0.2em] italic">Bonificación</span>
                <span className="text-sm text-emerald-600 font-medium italic">-{formatCOP(valorDescuento)}</span>
              </div>
              <div className="h-px bg-slate-50 my-1"></div>
              <div className="flex justify-between items-end px-2">
                <div className="flex flex-col">
                  <span className="text-[11px] text-indigo-700 font-medium uppercase bg-indigo-50 px-3 py-1.5 rounded-xl border-2 border-indigo-200 shadow-sm">{totalItems} Items Registrados</span>
                  {totalIva > 0 && <span className="text-[10px] text-rose-600 font-medium mt-1 ml-1">(IVA Inc. {formatCOP(totalIva)})</span>}
                </div>
                <div className="text-right">
                  <span className="text-3xl text-slate-900 font-medium tracking-tighter leading-none italic block">{formatCOP(granTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (!cajeroId) return alert("⚠️ Identificación Requerida: Seleccione al responsable del despacho mayorista.");
                  setShowCheckout(true);
                }}
                className="w-full py-4 rounded-xl font-medium text-[10px] uppercase tracking-[0.3em] shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3 bg-slate-900 text-white hover:bg-blue-600 group"
              >
                Confirmar Despacho 🚛
              </button>
              <div className="flex items-center gap-3 justify-center">
                <button onClick={vaciarCarrito} className="text-[8px] font-medium text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-all">Anular</button>
                <div className="w-1 h-1 bg-slate-100 rounded-full"></div>
                <button onClick={() => window.print()} className="text-[8px] font-medium text-slate-300 uppercase tracking-widest hover:text-indigo-500 transition-all italic">Pre-Visualizar 📄</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium Payment Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-blue-950/50 to-slate-950/70 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowCheckout(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-400">

            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-8 py-6 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]"></div>
              <button onClick={() => setShowCheckout(false)} className="absolute right-4 top-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white/80 hover:bg-white/30 hover:text-white transition-all text-lg">×</button>
              <h2 className="text-2xl font-semibold tracking-tight relative z-10">Cierre de Venta</h2>
              <p className="text-blue-100 text-xs font-medium mt-1 tracking-wide relative z-10">Total a Cobrar</p>
              <div className="text-4xl font-semibold mt-2 tracking-tighter relative z-10">{formatCOP(granTotal)}</div>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Método de Pago - Botones vibrantes */}
              <div className="space-y-3">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.15em] block text-center">Selecciona el Método de Pago</label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Efectivo - Azul */}
                  <button
                    onClick={() => setMetodoPago("Efectivo")}
                    className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-300 ${metodoPago === "Efectivo"
                      ? 'bg-gradient-to-b from-blue-600 to-blue-700 border-blue-500 text-white shadow-lg shadow-blue-200 scale-105'
                      : 'bg-blue-50 border-blue-100 text-blue-400 hover:border-blue-300 hover:bg-blue-100 hover:scale-[1.02]'}`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">💵</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Efectivo</span>
                  </button>

                  {/* Transferencia - Verde */}
                  <button
                    onClick={() => setMetodoPago("Tarjeta")}
                    className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-300 ${metodoPago === "Tarjeta"
                      ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 border-indigo-500 text-white shadow-lg shadow-indigo-200 scale-105'
                      : 'bg-indigo-50 border-indigo-100 text-indigo-400 hover:border-indigo-300 hover:bg-indigo-100 hover:scale-[1.02]'}`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">🏦</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Transferencia</span>
                  </button>

                  {/* Mixto - Naranja */}
                  <button
                    onClick={() => setMetodoPago("Mixto")}
                    className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-300 ${metodoPago === "Mixto"
                      ? 'bg-gradient-to-b from-sky-600 to-sky-700 border-sky-500 text-white shadow-lg shadow-sky-200 scale-105'
                      : 'bg-sky-50 border-sky-100 text-sky-400 hover:border-sky-300 hover:bg-sky-100 hover:scale-[1.02]'}`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">🔀</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Mixto</span>
                  </button>
                </div>
              </div>

              {/* Contenido dinámico según método */}
              <div className="min-h-[140px]">
                {metodoPago === "Efectivo" && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 space-y-4 animate-in fade-in duration-300">
                    <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest block text-center">💵 Efectivo Recibido</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-semibold text-blue-300">$</span>
                      <input
                        autoFocus
                        type="text"
                        value={pagoCliente}
                        onChange={e => handleCurrencyInputChange(e, setPagoCliente)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && cashPaga >= granTotal && !isProcessing) {
                            e.preventDefault();
                            confirmarVenta();
                          }
                        }}
                        className="w-full pl-14 pr-6 py-4 bg-white border-2 border-blue-200 rounded-xl text-3xl font-semibold text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-center tracking-tighter"
                        placeholder="0"
                      />
                    </div>
                    {vuelto > 0 && pagoCliente !== "" && (
                      <div className="bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl p-4 text-white text-center animate-in zoom-in duration-300 shadow-lg shadow-emerald-200">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] block opacity-90">Cambio a Devolver</span>
                        <span className="text-3xl font-semibold tracking-tighter block mt-1">{formatCOP(vuelto)}</span>
                      </div>
                    )}
                  </div>
                )}

                {metodoPago === "Mixto" && (
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100 space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider block text-center">💵 Efectivo</label>
                        <input
                          type="text"
                          value={pagoEfectivoMixto}
                          onChange={e => handleCurrencyInputChange(e, setPagoEfectivoMixto)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (sumMixto === granTotal && !isProcessing) {
                                confirmarVenta();
                              } else {
                                trMixtoRef.current?.focus();
                              }
                            }
                          }}
                          className="w-full px-4 py-3 bg-white border-2 border-blue-200 rounded-xl text-xl font-semibold text-blue-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-center"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block text-center">🏦 Transferencia</label>
                        <input
                          ref={trMixtoRef}
                          type="text"
                          value={pagoTransferenciaMixto}
                          onChange={e => handleCurrencyInputChange(e, setPagoTransferenciaMixto)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && sumMixto === granTotal && !isProcessing) {
                              e.preventDefault();
                              confirmarVenta();
                            }
                          }}
                          className="w-full px-4 py-3 bg-white border-2 border-emerald-200 rounded-xl text-xl font-semibold text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className={`py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-center border-2 transition-all ${sumMixto === granTotal
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      {sumMixto === granTotal ? "✅ Monto Completo" : `⚠️ Faltan: ${formatCOP(granTotal - sumMixto)}`}
                    </div>
                  </div>
                )}

                {metodoPago === "Tarjeta" && (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-8 border border-emerald-100 text-center animate-in fade-in duration-300">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-emerald-200">🏦</div>
                    <p className="text-sm font-semibold text-slate-800 mb-1">Transferencia Bancaria</p>
                    <p className="text-xs text-slate-500">Se registrará el pago por <span className="font-semibold text-emerald-600">{formatCOP(granTotal)}</span></p>
                  </div>
                )}
              </div>

              {/* Botón de Confirmación */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => { confirmarVenta(); setShowCheckout(false); }}
                  disabled={isProcessing || (metodoPago === "Mixto" && sumMixto !== granTotal) || (metodoPago === "Efectivo" && (pagoCliente === "" || cashPaga < granTotal))}
                  className={`w-full py-3 rounded-2xl font-semibold text-sm uppercase tracking-wider shadow-xl transition-all duration-300 flex items-center justify-center gap-3 ${isProcessing
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white hover:shadow-2xl hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg'
                    }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      Confirmar Venta
                      <span className="text-lg">✨</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="w-full py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🎉 Success Modal with Confetti */}
      {ventaExitosa && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-950/80 via-emerald-950/60 to-blue-950/80 backdrop-blur-xl animate-in fade-in duration-500"></div>

          {/* CSS Confetti Particles */}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
            @keyframes confetti-shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(15px); }
              75% { transform: translateX(-15px); }
            }
            .confetti-piece {
              position: absolute;
              width: 10px;
              height: 10px;
              top: -20px;
              animation: confetti-fall linear forwards, confetti-shake 0.5s ease-in-out infinite;
            }
            @keyframes success-pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
              50% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
            }
          `}</style>

          {/* Confetti particles */}
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'][i % 7],
                borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0',
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                animationDuration: `${2 + Math.random() * 3}s`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}

          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-500">

            {/* Header con gradiente y check animado */}
            <div className="bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 px-8 pt-10 pb-12 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.2),transparent_60%)]"></div>

              {/* Ícono de éxito con pulso */}
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 relative z-10" style={{ animation: 'success-pulse 2s ease-in-out infinite' }}>
                <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="animate-in slide-in-from-left duration-700" />
                </svg>
              </div>

              <h2 className="text-2xl font-semibold text-white tracking-tight relative z-10">¡Venta Exitosa!</h2>
              <p className="text-emerald-100 text-xs font-medium mt-2 max-w-[280px] mx-auto relative z-10">
                El despacho mayorista ha sido registrado correctamente
              </p>

              {/* Partículas decorativas del header */}
              <div className="absolute top-4 left-8 w-3 h-3 bg-white/20 rounded-full animate-ping"></div>
              <div className="absolute top-12 right-12 w-2 h-2 bg-white/30 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute bottom-8 left-16 w-2 h-2 bg-white/20 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Contenido */}
            <div className="px-8 py-8 space-y-6">

              {/* Info de Factura */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100 text-center">
                <span className="text-[9px] font-semibold text-blue-500 uppercase tracking-[0.2em] block mb-1">Factura N°</span>
                <span className="text-3xl font-semibold text-blue-700 tracking-tighter block">{facturaIdImpresion || "---"}</span>
                <span className="text-[9px] font-medium text-slate-400 mt-1 block">Total: <span className="text-emerald-600 font-semibold">{formatCOP(granTotal)}</span></span>
              </div>

              {/* Botones de acción */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={imprimirYTerminar}
                  className="group flex flex-col items-center gap-2 py-5 bg-gradient-to-b from-blue-500 to-blue-600 text-white rounded-2xl font-semibold text-[10px] uppercase tracking-wider shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 hover:-translate-y-0.5 transition-all active:translate-y-0"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">🖨️</span>
                  Imprimir Factura
                </button>
                <button
                  onClick={compartirWhatsApp}
                  className="group flex flex-col items-center gap-2 py-5 bg-gradient-to-b from-emerald-500 to-green-600 text-white rounded-2xl font-semibold text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5 transition-all active:translate-y-0"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">📲</span>
                  Enviar WhatsApp
                </button>
              </div>

              {/* Botón Nueva Venta - Premium */}
              <button
                onClick={resetVenta}
                className="w-full py-4 bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white rounded-2xl font-semibold text-sm uppercase tracking-wider shadow-xl shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 group"
              >
                <span className="text-xl group-hover:rotate-90 transition-transform duration-300">✨</span>
                Nueva Venta
                <span className="text-xl group-hover:-rotate-90 transition-transform duration-300">🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printer Component (HIDDEN) */}
      <div style={{ display: 'none' }}>
        {facturaIdImpresion && (
          <PrintReceipt
            ref={contentRef}
            empresa={empresa}
            numero={facturaIdImpresion || ""}
            fecha={new Date()}
            cliente={clienteSeleccionado.nombre}
            cajero={cajeroSeleccionado.nombre}
            metodoPago={metodoPago}
            items={itemsParaRecibo.map((c: any) => ({
              ...c,
              precio_unitario: c.precio_venta * (1 - (c.descuento || 0) / 100)
            }))}
            total={granTotal}
            iva={totalIva}
            efectivoRecibido={metodoPago === "Mixto" ? efMixto : cashPaga}
            vuelto={vuelto}
            pagoEfectivoMixto={metodoPago === "Mixto" ? efMixto : undefined}
            pagoTransferenciaMixto={metodoPago === "Mixto" ? trMixto : undefined}
          />
        )}
      </div>
      {/* Quick Customer Registration Modal */}
      {showQuickCustomerModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowQuickCustomerModal(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-3xl p-8 animate-in zoom-in duration-300 border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl text-slate-900 font-medium uppercase tracking-tighter italic">Nuevo Distribuidor</h2>
              <button onClick={() => setShowQuickCustomerModal(false)} className="w-8 h-8 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:text-rose-500 transition-all font-semibold">×</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCustomer.nombre) return alert("El nombre es obligatorio");
              setIsCreatingCustomer(true);
              try {
                const res = await API.post("/clientes", newCustomer);
                const created = res.data;
                setClientes(prev => [...prev, created]);
                setClienteId(created.id.toString());
                setClienteSearch(`${created.nombre} ${created.documento ? `(${created.documento})` : ''}`);
                setShowQuickCustomerModal(false);
                setNewCustomer({ nombre: "", documento: "", tipo_documento: "13", dv: "", telefono: "", correo: "" });
              } catch (err: any) {
                alert("Error creando distribuidor: " + (err.response?.data?.error || err.message));
              } finally {
                setIsCreatingCustomer(false);
              }
            }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[9px] text-slate-400 font-medium uppercase tracking-widest ml-1">Razón Social / Nombre</label>
                <input
                  type="text"
                  value={newCustomer.nombre}
                  onChange={e => setNewCustomer({ ...newCustomer, nombre: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                  placeholder="Ej: DISTRIBUIDORA ABC SAS"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-slate-400 font-medium uppercase tracking-widest ml-1">Tipo Documento</label>
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
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold text-[10px]"
                  >
                    <option value="13">Cédula de Ciudadanía</option>
                    <option value="31">NIT</option>
                    <option value="11">Registro Civil</option>
                    <option value="12">Tarjeta de Identidad</option>
                    <option value="22">Cédula de Extranjería</option>
                    <option value="41">Pasaporte</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[9px] text-slate-400 font-medium uppercase tracking-widest ml-1">Documento</label>
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
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                      placeholder="Nro identificación"
                    />
                  </div>
                  {newCustomer.tipo_documento === "31" && (
                    <div className="space-y-1.5 w-10 shrink-0">
                      <label className="text-[9px] text-indigo-500 font-medium uppercase tracking-widest text-center block">DV</label>
                      <div className="w-full px-1 py-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-center font-medium text-indigo-700">{newCustomer.dv}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] text-slate-400 font-medium uppercase tracking-widest ml-1">WhatsApp</label>
                  <input
                    type="text"
                    value={newCustomer.telefono}
                    onChange={e => setNewCustomer({ ...newCustomer, telefono: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] text-slate-400 font-medium uppercase tracking-widest ml-1">Email</label>
                  <input
                    type="email"
                    value={newCustomer.correo}
                    onChange={e => setNewCustomer({ ...newCustomer, correo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold text-[10px]"
                    placeholder="compras@proveedor.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreatingCustomer}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-[10px] font-medium mt-4"
              >
                {isCreatingCustomer ? "⏳ Creando..." : "✅ Registrar Distribuidor"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal para Crear Separado sin salir de ventas */}
      {showCreateSeparadoModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowCreateSeparadoModal(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[40px] shadow-3xl overflow-hidden animate-in zoom-in slide-in-from-bottom-10 duration-500">
            <div className="bg-emerald-600 p-8 text-white relative">
              <h2 className="text-3xl font-medium uppercase tracking-tighter italic">Crear Nuevo Separado</h2>
              <p className="text-[10px] uppercase font-semibold tracking-[0.3em] opacity-80 mt-1">Reserva Mayorista / Apartado</p>
              <button onClick={() => setShowCreateSeparadoModal(false)} className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center text-xl transition-all">✕</button>
            </div>

            <div className="p-8 space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 flex justify-between items-center">
                <div>
                  <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-widest mb-1">Total a Separar</p>
                  <h3 className="text-3xl font-medium text-emerald-700 tracking-tighter leading-none italic">{formatCOP(granTotal)}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Ítems</p>
                  <span className="text-xl font-semibold text-slate-700 italic">{totalItems}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block ml-1">Abono Inicial</label>
                    <input
                      type="number"
                      value={abonoInicial}
                      onChange={e => setAbonoInicial(e.target.value)}
                      placeholder="0"
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-emerald-50 rounded-2xl text-xl font-medium text-emerald-700 outline-none focus:bg-white focus:border-emerald-500 transition-all text-center"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block ml-1">Fecha Límite</label>
                    <input
                      type="date"
                      value={fechaVencimiento}
                      onChange={e => setFechaVencimiento(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-emerald-50 rounded-2xl text-sm font-semibold text-slate-700 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block ml-1">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Efectivo", "Transferencia", "Mixto"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setMetodoPagoAbono(m)}
                        className={`py-3 rounded-2xl text-[10px] font-medium uppercase tracking-widest border-2 transition-all ${metodoPagoAbono === m ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200'
                          }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (isProcessingSeparado) return;
                  if (carrito.length === 0) return alert("❌ Error: El lote de despacho está vacío.");
                  if (!clienteId || clienteId === "1") return alert("⚠️ Atención: La distribución mayorista requiere un distribuidor registrado. Seleccione uno de la lista o registre uno nuevo.");
                  if (!cajeroId) return alert("👤 Seguridad: Seleccione al responsable del despacho.");
                  if (abonoInicial === "") return alert("💰 Dato Requerido: Ingrese el monto del abono inicial del distribuidor.");

                  setIsProcessingSeparado(true);
                  try {
                    await API.post("/separados", {
                      cliente_id: parseInt(clienteId),
                      detalles: carrito.map((p: any) => ({
                        id: p.id,
                        nombre: p.nombre,
                        qty: p.qty,
                        precio_venta: p.precio_venta
                      })),
                      total: granTotal,
                      abono_inicial: parseFloat(abonoInicial),
                      metodo_pago: metodoPagoAbono,
                      fecha_vencimiento: fechaVencimiento,
                      notas: "Separado Mayorista POS",
                      cajero_id: cajeroId ? parseInt(cajeroId) : null
                    });
                    alert("✅ Separado mayorista creado exitosamente");
                    setCarrito([]);
                    setShowCreateSeparadoModal(false);
                    setAbonoInicial("");
                  } catch (err: any) {
                    alert("Error: " + (err.response?.data?.error || err.message));
                  } finally {
                    setIsProcessingSeparado(false);
                  }
                }}
                disabled={isProcessingSeparado || !clienteId || clienteId === "1" || carrito.length === 0}
                className={`w-full py-5 rounded-[24px] font-medium text-xs uppercase tracking-[0.5em] transition-all shadow-2xl 
                  ${isProcessingSeparado
                    ? 'bg-slate-200 text-slate-400'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.02] shadow-emerald-200/50'
                  } 
                  ${(!clienteId || clienteId === "1" || carrito.length === 0) ? 'brightness-90 saturate-50 cursor-not-allowed' : ''}`}
              >
                {isProcessingSeparado ? 'Procesando...' : 'Confirmar Separado 📋'}
              </button>
              {clienteId === "1" && <p className="text-[10px] text-rose-500 font-semibold text-center uppercase tracking-widest italic animate-bounce mt-2">⚠️ DEBES SELECCIONAR UN DISTRIBUIDOR ESPECÍFICO (NO PERMITIDO PARA CLIENTE GENERAL)</p>}
            </div>
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
    y = parseInt(nit.substring(i, i + 1));
    x += (y * vpri[z - i - 1]);
  }
  y = x % 11;
  return (y > 1) ? (11 - y).toString() : y.toString();
}

export default VentasMayoristas;
