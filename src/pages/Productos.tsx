import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { useReactToPrint } from "react-to-print";
import PrintReceipt from "../components/PrintReceipt";
import { Producto } from "../types";
import { useCaja } from "../components/CajaContext";
import { hasAccess } from "../utils/auth";
import IngresoProductos from "./IngresoProductos";
import Separados from "./Separados";

// CartItem extiende Producto pero fuerza id a ser requerido (los productos del carrito SIEMPRE tienen ID del backend)
interface CartItem extends Omit<Producto, 'id'> {
  id: number;
  qty: number;
}

interface Tab {
  id: number;
  carrito: CartItem[];
  clienteId: string;
  clienteSearch: string;
}

function Productos() {
  const navigate = useNavigate();
  const { verificarEstado } = useCaja();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Tabs / In-waiting factoras
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem("posTabs");
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ id: 1, carrito: [], clienteId: "1", clienteSearch: "Cliente general" }];
      }
    } catch (e) {
      console.error("Error parsing posTabs", e);
    }
    return [{ id: 1, carrito: [], clienteId: "1", clienteSearch: "Cliente general" }];
  });
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || 1);

  const activeTab = tabs.find((t: Tab) => t.id === activeTabId) || tabs[0] || { id: 1, carrito: [], clienteId: "1", clienteSearch: "Cliente general" };
  const { carrito, clienteId, clienteSearch } = activeTab;

  const setCarrito = useCallback((newCarrito: CartItem[]) => {
    setTabs((prevTabs: Tab[]) => prevTabs.map((t: Tab) => t.id === activeTabId ? { ...t, carrito: newCarrito } : t));
  }, [activeTabId]);

  const setClienteId = useCallback((id: string) => {
    setTabs((prevTabs: Tab[]) => prevTabs.map((t: Tab) => t.id === activeTabId ? { ...t, clienteId: id } : t));
  }, [activeTabId]);

  const setClienteSearch = useCallback((val: string) => {
    setTabs((prevTabs: Tab[]) => prevTabs.map((t: Tab) => t.id === activeTabId ? { ...t, clienteSearch: val } : t));
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem("posTabs", JSON.stringify(tabs));
  }, [tabs]);

  // Payment States
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [pagoCliente, setPagoCliente] = useState("");
  const [pagoEfectivoMixto, setPagoEfectivoMixto] = useState("");
  const [pagoTransferenciaMixto, setPagoTransferenciaMixto] = useState("");
  const [pagoTarjeta, setPagoTarjeta] = useState("");

  // ERP States
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>({});

  // Cajero ID derived from user session
  const [cajeroId, setCajeroId] = useState(() => {
    return localStorage.getItem("adminCajeroId") || localStorage.getItem("posCajeroId") || "";
  });

  // --- SELECTORES MEMORIZADOS (deben ir DESPUÉS de cajeros, clientes y cajeroId) ---
  const cajeroSeleccionado = useMemo(() =>
    cajeros.find((c: any) => c.id.toString() === cajeroId.toString()),
    [cajeros, cajeroId]
  );

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    localStorage.setItem("posCajeroId", cajeroId);
  }, [cajeroId]);

  // Receipt Print State
  const [ventaExitosa, setVentaExitosa] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [scanError, setScanError] = useState(false);
  const [facturaIdImpresion, setFacturaIdImpresion] = useState<number | null>(null);
  const [itemsParaRecibo, setItemsParaRecibo] = useState<CartItem[]>([]);
  const trMixtoRef = useRef<HTMLInputElement>(null);

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

  // Separados logic inside POS
  const [showCreateSeparadoModal, setShowCreateSeparadoModal] = useState(false);
  const [abonoInicial, setAbonoInicial] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [metodoPagoAbono, setMetodoPagoAbono] = useState("Efectivo");
  const [isProcessingSeparado, setIsProcessingSeparado] = useState(false);
  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [showSeparadosHistoryModal, setShowSeparadosHistoryModal] = useState(false);


  // Tab Handlers
  const nuevaTab = () => {
    const newId = Math.max(...tabs.map((t: any) => t.id), 0) + 1;
    setTabs([...tabs, { id: newId, carrito: [], clienteId: "1", clienteSearch: "Cliente general" }]);
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


  useEffect(() => {
    fetchInventory(1);
    API.get("/cajeros")
      .then(res => {
        setCajeros(res.data);
        const fixedId = localStorage.getItem("adminCajeroId");
        if (fixedId) {
          setCajeroId(fixedId);
        } else if (cajeroId && !res.data.find((c: any) => c.id.toString() === cajeroId)) {
          setCajeroId("");
        }
      })
      .catch(console.error);
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/empresa").then(res => {
      setEmpresa(res.data);
      // Unirse a la sala de la empresa para recibir actualizaciones
      if (res.data.id) {
        import("../utils/socket").then(({ joinEmpresaRoom, socket }) => {
          joinEmpresaRoom(res.data.id);

          // Escuchar actualizaciones de productos
          socket.on("product_updated", (updatedProd: any) => {
            console.log("[SOCKET]: Producto actualizado recibido:", updatedProd);

            // 1. Actualizar en la lista de productos visible (si está cargada)
            setProductos(prev => prev.map(p =>
              p.id === updatedProd.id ? { ...p, ...updatedProd } : p
            ));

            // 2. Actualizar en TODOS los carritos de TODAS las pestañas
            setTabs((prevTabs: any[]) => prevTabs.map(tab => ({
              ...tab,
              carrito: tab.carrito.map((item: any) =>
                item.id === updatedProd.id
                  ? { ...item, ...updatedProd }
                  : item
              )
            })));
          });

          socket.on("inventory_batch_updated", () => {
            console.log("[SOCKET]: Actualización masiva de inventario detectada.");
            fetchInventory();
          });
        });
      }
    }).catch(console.error);

    return () => {
      import("../utils/socket").then(({ socket }) => {
        socket.off("product_updated");
        socket.off("inventory_batch_updated");
      });
    };
  }, []);

  const iniciarNuevaVenta = useCallback(() => {
    setVentaExitosa(false);
    setShowCheckoutModal(false);

    if (tabs.length > 1) {
      const newTabs = tabs.filter((t: any) => t.id !== activeTabId);
      setTabs(newTabs);
      setActiveTabId(newTabs[0]?.id || 1);
    } else {
      setTabs((prev: any[]) => prev.map((t: any) =>
        t.id === activeTabId
          ? { ...t, carrito: [], clienteId: "1", clienteSearch: "Cliente general" }
          : t
      ));
    }
    setItemsParaRecibo([]);
    setPagoCliente("");
    setPagoTarjeta("");
    setPagoEfectivoMixto("");
    setPagoTransferenciaMixto("");
    setMetodoPago("Efectivo");
    setSearch("");
    setFacturaIdImpresion(null);
  }, [activeTabId, tabs]);

  const successBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (ventaExitosa && successBtnRef.current) {
      setTimeout(() => successBtnRef.current?.focus(), 100);
    }
  }, [ventaExitosa]);

  // Keyboard shortcut for New Sale after Success
  const successTimeRef = useRef<number>(0);
  useEffect(() => {
    if (ventaExitosa) {
      successTimeRef.current = Date.now();
    }
  }, [ventaExitosa]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Allow Enter to work globally in the success modal
      if (ventaExitosa && e.key === "Enter") {
        const timeSinceSuccess = Date.now() - successTimeRef.current;
        if (timeSinceSuccess > 600) {
          iniciarNuevaVenta();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [ventaExitosa, iniciarNuevaVenta]);

  // Global listener for opening Checkout with Enter
  useEffect(() => {
    const handlePOSKeyDown = (e: KeyboardEvent) => {
      // If we are in the main POS view (no modals) and press Enter
      if (!showCheckoutModal && !ventaExitosa && e.key === "Enter" && carrito.length > 0) {
        // Check if focus is NOT in an input (except the main search bar or if it's empty)
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

        // If it's an input, we only allow if it's the search bar and it's empty (handled in handleSearchKeyPress)
        // or if it's some other non-functional element.
        // Actually, if it's any input, let the input handle it unless it's not the search.
        if (!isInput) {
          if (!cajeroId) return alert("⚠️ Identificación Requerida: Seleccione al vendedor responsable.");
          setShowCheckoutModal(true);
        }
      }
    };

    window.addEventListener("keydown", handlePOSKeyDown);
    return () => window.removeEventListener("keydown", handlePOSKeyDown);
  }, [showCheckoutModal, ventaExitosa, carrito, cajeroId]);



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

  const handleSearchChange = (val: string) => {
    setSearch(val);
    fetchInventory(1, val);
  };

  // --- Sincronización de Precios en Tiempo Real ---
  // Cuando los productos del catálogo cambian (ej. tras una edición o recarga),
  // buscamos si alguno de esos productos está en los carritos activos y actualizamos su precio.
  useEffect(() => {
    if (productos.length === 0) return;

    let hasChanges = false;
    const newTabs = tabs.map((tab: any) => {
      const newCarrito = tab.carrito.map((item: any) => {
        const catalogItem = productos.find(p => p.id === item.id);
        // Si el producto está en la página actual y su precio es distinto al del carrito
        if (catalogItem && catalogItem.precio_venta !== item.precio_venta) {
          hasChanges = true;
          return { ...item, precio_venta: catalogItem.precio_venta, nombre: catalogItem.nombre };
        }
        return item;
      });

      if (hasChanges) {
        return { ...tab, carrito: newCarrito };
      }
      return tab;
    });

    if (hasChanges) {
      setTabs(newTabs);
      // Opcional: Notificación silenciosa o log
      console.log("Precios en carrito sincronizados con catálogo.");
    }
  }, [productos, tabs]); // Se dispara cada vez que cambia el catálogo visualizado o las pestañas

  // Global Stock Calculation Helper
  const getCommittedQty = (productoId: number): number => {
    return tabs.reduce((acc: number, tab: Tab) => {
      const item = tab.carrito.find((x: CartItem) => x.id === productoId);
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
    const isNegativeBlocked = !empresa.permitir_venta_negativa || !producto.permitir_venta_negativa;

    if (isNegativeBlocked && available <= 0) {
      let pNombre = String(producto?.nombre || "este producto");
      // Sanitizar si el nombre contiene el error de borrador incremental reportado
      if (pNombre.includes("Error guardando el borrador")) {
        pNombre = "Producto Seleccionado";
      }
      alert(`🏷️ ¡Lo sentimos! Por el momento no contamos con más existencias de "${pNombre}" en el inventario. 📦`);
      return;
    }

    const exist = carrito.find((x: any) => x.id === producto.id);
    if (exist) {
      setCarrito(carrito.map((x: any) => x.id === producto.id ? { ...exist, qty: exist.qty + 1 } : x));
    } else {
      setCarrito([...carrito, { ...producto, qty: 1 }]);
    }
  };

  const removerDelCarrito = (producto: any) => {
    const exist = carrito.find((x: any) => x.id === producto.id);
    if (!exist) return;
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

    const totalCommitted = getCommittedQty(id);
    const currentlyInThisCart = currentItem.qty;
    const committedInOtherTabs = totalCommitted - currentlyInThisCart;
    const available = (currentItem.cantidad || 0) - committedInOtherTabs;

    const isNegativeBlocked = !empresa.permitir_venta_negativa || !currentItem.permitir_venta_negativa;

    if (isNegativeBlocked && qty > available) {
      let pNombre = String(currentItem?.nombre || "este producto");
      if (pNombre.includes("Error guardando el borrador")) {
        pNombre = "Producto Seleccionado";
      }
      alert(`⚠️ ¡Atención! Solo es posible agregar hasta ${Math.max(0, available)} unidades de "${pNombre}" según el stock disponible en este momento. 📊`);
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: Math.max(0, available) } : x));
      return;
    }

    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
  };

  const vaciarCarrito = () => {
    if (window.confirm("¿Seguro que deseas vaciar el carrito actual?")) setCarrito([]);
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (search.trim() !== '') {
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
      } else if (carrito.length > 0 && !showCheckoutModal && !ventaExitosa) {
        // Trigger Checkout if search is empty and Enter is pressed
        if (!cajeroId) return alert("⚠️ Identificación Requerida: Seleccione al vendedor responsable.");
        setShowCheckoutModal(true);
      }
    }
  };

  const granTotal = carrito.reduce((a: number, c: any) => a + (c.precio_venta * c.qty), 0);
  const totalItems = carrito.reduce((a: number, c: any) => a + (c.qty || 0), 0);
  const totalIva = carrito.reduce((a: number, c: CartItem) => {
    const totalItem = c.precio_venta * c.qty;
    const ivaPerc = parseFloat(String(c.iva_porcentaje ?? 0));
    const base = totalItem / (1 + ivaPerc / 100);
    return a + (totalItem - base);
  }, 0);

  const parseCurrency = (val: string | number) => {
    if (typeof val === 'number') return val;
    return parseFloat(val.replace(/\./g, '')) || 0;
  };

  const cashPaga = parseCurrency(pagoCliente);
  const vuelto = cashPaga - granTotal;

  const efMixto = parseCurrency(pagoEfectivoMixto);
  const trMixto = parseCurrency(pagoTransferenciaMixto);
  const sumMixto = efMixto + trMixto;

  const handleCurrencyInputChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val === '') {
      setter('');
    } else {
      const formatted = new Intl.NumberFormat('de-DE').format(parseInt(val));
      setter(formatted);
    }
  };

  const confirmarVenta = async () => {
    if (carrito.length === 0) return;
    if (carrito.some((i: any) => !i.qty || i.qty <= 0)) {
      return alert("❌ Error: Una o más cantidades no son válidas.");
    }
    if (!cajeroId) return alert("❌ Seguridad: Selecciona tu Cajero en Turno.");
    if (metodoPago === "Efectivo" && cashPaga < granTotal) {
      return alert("El efectivo ingresado es insuficiente.");
    }
    if (metodoPago === "Mixto" && sumMixto !== granTotal) {
      return alert("La suma de valores en pago mixto debe ser EXACTAMENTE el total.");
    }

    // --- OPTIMIZACIÓN: VALIDACIÓN DE STOCK REAL-TIME ---
    for (const item of carrito) {
      if (item.es_servicio) continue;
      const isNegativeBlocked = !empresa.permitir_venta_negativa || !item.permitir_venta_negativa;

      // Calculamos cuánto hay "comprometido" en otras pestañas de este mismo terminal
      const totalCommittedThisTerminal = getCommittedQty(item.id);
      const otherTabsQty = totalCommittedThisTerminal - item.qty;
      const realAvailable = item.cantidad - otherTabsQty;

      if (isNegativeBlocked && item.qty > realAvailable) {
        setIsProcessing(false);
        return alert(`🏷️ ¡Ups! El stock de "${item.nombre}" cambió recientemente y solo quedan ${Math.max(0, realAvailable)} unidades disponibles. Por favor, ajusta las cantidades para continuar con la venta. 🔄`);
      }
    }
    // --------------------------------------------------

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
        total: granTotal,
        iva: totalIva
      });
      setFacturaIdImpresion(response.data.factura_id);
      setItemsParaRecibo([...carrito]);



      setVentaExitosa(true);
      // Limpiar tab actual inmediatamente tras éxito
      setTabs((prev: any[]) => prev.map((t: any) =>
        t.id === activeTabId
          ? { ...t, carrito: [], clienteId: "1", clienteSearch: "Cliente general" }
          : t
      ));
      setSearch("");
      setPagoCliente("");
      setPagoTarjeta("");
      setPagoEfectivoMixto("");
      setPagoTransferenciaMixto("");

      fetchInventory(page);

      // Sincronizar estado de caja reactivamente si estamos en una sesión
      if (typeof verificarEstado === 'function') {
        verificarEstado();
      }
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
    const rawPhone = clienteId !== "1" ? (clientes.find(c => c.id.toString() === clienteId)?.telefono || "") : "";
    const cleanPhone = rawPhone.replace(/\D/g, '');
    enviarWS(cleanPhone);
  };

  const enviarWS = (num: string) => {
    // 1. Encabezado
    const header = `🏪 *${empresa?.nombre_empresa || "MI EMPRESA"}*\n` +
      (empresa?.nit ? `NIT: ${empresa.nit}\n` : "") +
      (empresa?.direccion ? `📍 ${empresa.direccion}\n` : "") +
      (empresa?.telefono ? `📞 Tel: ${empresa.telefono}\n` : "") +
      `--------------------------------\n`;

    // 2. Info de Venta
    const saleInfo = `📄 *Factura No: ${facturaIdImpresion}*\n` +
      `📅 Fecha: ${new Date().toLocaleString('es-CO')}\n` +
      `👤 Cliente: ${clienteSearch || 'Consumidor Final'}\n` +
      (cajeroSeleccionado?.nombre ? `👤 Vendedor: ${cajeroSeleccionado.nombre}\n` : "") +
      `--------------------------------\n`;

    // 3. Ítems
    const itemsStr = itemsParaRecibo.map((i: CartItem) => {
      const qty = i.qty || 1;
      return `• ${i.nombre} (x${qty})\n  Subtotal: ${formatCOP(i.precio_venta * qty)}`;
    }).join('\n');

    // 4. Totales
    const totalsStr = `\n--------------------------------\n` +
      `Subtotal: ${formatCOP(granTotal - totalIva)}\n` +
      (totalIva > 0 ? `IVA: ${formatCOP(totalIva)}\n` : "") +
      `💰 *TOTAL A PAGAR: ${formatCOP(granTotal)}*\n` +
      `Método: ${metodoPago}\n`;

    // 5. Pie de Página
    const footer = `--------------------------------\n` +
      `🙏 ¡Gracias por su compra!\n` +
      (empresa?.resolucion ? `\n${empresa.resolucion}` : "");

    const mensaje = `${header}${saleInfo}🛒 *Resumen:*\n${itemsStr}${totalsStr}${footer}`;

    let waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    if (num && num.length >= 7) {
      const fullNum = num.startsWith('57') ? num : `57${num}`;
      waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    }
    window.open(waUrl, '_blank');
  };

  const isUserFixedCajero = !!localStorage.getItem("adminCajeroId");

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-4 lg:gap-6 lg:overflow-hidden animate-in fade-in duration-500 p-2">

      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="p-4 lg:p-6 border-b border-slate-100 space-y-4 bg-slate-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
                <Link
                  to={hasAccess("facturas_venta") ? "/facturas" : "#"}
                  onClick={(e) => {
                    if (!hasAccess("facturas_venta")) {
                      e.preventDefault();
                      alert("🚫 No tienes permiso para ver el historial de ventas.");
                    }
                  }}
                  className={`w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:text-blue-600 hover:bg-blue-50 transition-all group ${!hasAccess("facturas_venta") ? "opacity-50 grayscale" : ""}`}
                  title="Historial de Ventas"
                >
                  <div className="flex flex-col gap-1">
                    <span className="w-4 h-0.5 bg-current rounded-full"></span>
                    <span className="w-4 h-0.5 bg-current rounded-full"></span>
                    <span className="w-4 h-0.5 bg-current rounded-full"></span>
                  </div>
                </Link>

                <div className="w-px h-6 bg-slate-100 mx-1"></div>
                <div className="relative group/sep">
                  <button 
                    onClick={() => {
                      if (!hasAccess("separados")) {
                        alert("🚫 No tienes permiso para acceder al módulo de separados.");
                      }
                    }}
                    className={`h-10 px-4 bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all font-medium text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 ${!hasAccess("separados") ? "opacity-50 grayscale" : ""}`}
                  >
                    <span className="text-lg">📋</span> SEPARADOS
                  </button>
                  <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover/sep:opacity-100 group-hover/sep:visible transition-all z-[60] p-2 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                    <button
                      onClick={() => {
                        if (hasAccess("separados")) {
                          setShowSeparadosHistoryModal(true);
                        } else {
                          alert("🚫 No tienes permiso para ver el historial de separados.");
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-[10px] font-semibold text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all uppercase text-left group/item ${!hasAccess("separados") ? "opacity-50" : ""}`}
                    >
                      <span className="text-base group-hover/item:scale-110 transition-transform">📋</span>
                      Historial y Abonos
                    </button>
                  </div>
                </div>

                <div className="w-px h-6 bg-slate-100 mx-1"></div>
                <button
                  onClick={() => {
                    if (hasAccess("ingreso")) {
                      setShowIngresoModal(true);
                    } else {
                      alert("🚫 No tienes permiso para realizar ingresos de mercancía.");
                    }
                  }}
                  className={`h-10 px-4 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all font-medium text-[10px] uppercase tracking-widest shadow-lg shadow-blue-100 ${!hasAccess("ingreso") ? "opacity-50 grayscale" : ""}`}
                  title="Ingresar Mercancía"
                >
                  <span className="text-lg">📥</span> INGRESO
                </button>
              </div>
              <h2 className="text-xl lg:text-3xl text-slate-800 tracking-tight flex items-center gap-3 font-medium uppercase italic ml-2">
                <span className="text-indigo-600">⚡</span> Terminal POS
              </h2>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-medium rounded-full border border-emerald-100 flex items-center gap-2 uppercase tracking-widest leading-none">
                <span className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse shadow-lg shadow-emerald-400"></span>
                Sincronizado
              </span>
            </div>
          </div>

          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors text-lg">🔍</span>
            <input
              type="text"
              placeholder="Escanea o busca por nombre..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              className={`w-full pl-12 pr-4 py-4 bg-white border rounded-2xl outline-none transition-all duration-300 font-medium text-sm shadow-sm ${scanError ? 'border-red-500 ring-4 ring-red-50 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50'}`}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium uppercase tracking-widest text-[10px]">Actualizando Almacén...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {productos.map(p => {
                const pid = p.id ?? 0; // Los productos del API siempre tienen ID
                const committed = getCommittedQty(pid);
                const available = p.cantidad - committed;
                const isOutOfStock = (!empresa.permitir_venta_negativa || !p.permitir_venta_negativa) && available <= 0 && !p.es_servicio;

                return (
                  <button
                    key={pid}
                    onClick={() => agregarAlCarrito(p)}
                    disabled={isOutOfStock}
                    className={`group relative flex flex-col p-4 bg-white rounded-2xl border border-slate-200 text-left transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100 hover:border-indigo-300 active:scale-95 disabled:opacity-50 ${isOutOfStock ? 'bg-slate-50 border-slate-100' : ''}`}
                  >
                    <div className="mb-3">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-[12px] text-slate-900 line-clamp-2 leading-tight min-h-[2.4rem] uppercase font-medium">{p.nombre}</h3>
                      </div>
                      <p className="text-[10px] text-slate-900 font-bold mt-2 uppercase tracking-tighter">{p.referencia || 'SIN REFERENCIA'}</p>
                    </div>
                    <div className="mt-auto space-y-2">
                      <div className="text-lg text-indigo-600 font-medium leading-none">{formatCOP(p.precio_venta)}</div>
                      <div className={`text-[9px] px-2 py-1 rounded-lg w-fit font-medium border uppercase tracking-widest ${available <= 0 && !p.es_servicio ? 'bg-rose-50 text-rose-600 border-rose-100' :
                        available < 5 && !p.es_servicio ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                        {p.es_servicio ? "⚡ SERVICIO" : `📦 STOCK: ${Math.max(0, available)}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Console */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-2">
            <button disabled={page <= 1 || loading} onClick={() => fetchInventory(page - 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 font-medium hover:bg-white hover:text-indigo-600 hover:shadow-sm disabled:opacity-30 transition-all">←</button>
            <button disabled={page >= totalPages || loading} onClick={() => fetchInventory(page + 1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 font-medium hover:bg-white hover:text-indigo-600 hover:shadow-sm disabled:opacity-30 transition-all">→</button>
          </div>
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
            Explorando ítem {((page - 1) * 50) + 1} - {Math.min(page * 50, totalRecords)} de {totalRecords}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart / Checkout */}
      <div className="w-full lg:w-[500px] h-full bg-white rounded-[40px] border border-slate-200 shadow-2xl flex flex-col overflow-hidden relative">

        {/* Header: Tab System */}
        <div className="p-2 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex flex-col">
              <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em] italic">Terminal de Venta</h3>
              <p className="text-[9px] font-medium text-indigo-400 uppercase">SaaS Enterprise Edition</p>
            </div>
            <button onClick={nuevaTab} className="bg-white px-5 py-2 rounded-full border border-slate-200 text-[10px] font-medium text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm hover:shadow-indigo-100">+ Nueva Cuenta</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map((tab: Tab, idx: number) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`relative flex items-center gap-3 px-1 py-3.5 rounded-2xl text-[10px] font-medium uppercase tracking-widest cursor-pointer transition-all border-2 ${activeTabId === tab.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xl shadow-indigo-100 scale-105 z-10"
                  : "bg-white text-slate-400 border-slate-100 hover:border-indigo-200"
                  }`}
              >
                Cuenta {idx + 1}
                <span className={`w-2 h-2 rounded-full ${tab.carrito.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}></span>
                {tabs.length > 1 && (
                  <span onClick={(e) => { e.stopPropagation(); cerrarTab(tab.id); }} className="ml-2 hover:text-rose-300 transition-colors text-base font-normal">×</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Unified Session Context (Seller & Client) */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-white border-b border-slate-50">
          {/* Seller Card */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Vendedor Responsable</label>
            <div className="relative group">
              <select
                disabled={isUserFixedCajero}
                value={cajeroId}
                onChange={e => setCajeroId(e.target.value)}
                className={`w-full px-5 py-2.5 bg-slate-50 border rounded-2xl text-[10px] font-medium focus:ring-4 transition-all appearance-none uppercase shadow-inner ${isUserFixedCajero ? 'border-indigo-50 bg-indigo-50/30 text-indigo-600/60' : 'border-slate-100 focus:bg-white focus:ring-indigo-50 focus:border-indigo-300 outline-none'}`}
              >
                <option value="">-- Usuario --</option>
                {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none opacity-40">👤</span>
            </div>
          </div>

          {/* Client Card */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Cliente / Titular</label>
            <div className="relative group">
              <input
                type="text"
                placeholder="Buscar cliente por nombre o NIT..."
                value={clienteSearch}
                onChange={e => {
                  const val = e.target.value;
                  setClienteSearch(val);
                  if (val === "") {
                    setClienteId("1");
                  }
                }}
                onFocus={() => {
                  if (clienteSearch === "Cliente general") {
                    setClienteSearch("");
                  }
                }}
                onBlur={() => {
                  // Pequeño delay para permitir el clic en los resultados antes de limpiar
                  setTimeout(() => {
                    if (clienteSearch.trim() === "") {
                      setClienteSearch("Cliente general");
                      setClienteId("1");
                    }
                  }, 200);
                }}
                className="w-full pl-5 pr-12 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-medium focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 outline-none transition-all uppercase placeholder:text-slate-300 shadow-inner"
              />

              {/* Resultados de búsqueda de clientes */}
              {clienteSearch !== "" && clienteSearch !== "Cliente general" && !clienteSearch.includes("(") && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[210] max-h-48 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {clientes
                    .filter(c => 
                      c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) || 
                      c.documento?.includes(clienteSearch)
                    )
                    .slice(0, 5)
                    .map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setClienteId(c.id.toString());
                          setClienteSearch(`${c.nombre} (${c.documento || 'S/D'})`);
                        }}
                        className="w-full px-5 py-3 text-left hover:bg-indigo-50 flex flex-col transition-colors border-b border-slate-50 last:border-0"
                      >
                        <span className="text-[10px] font-black text-slate-800 uppercase leading-none">{c.nombre}</span>
                        <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mt-1">ID: {c.documento || 'S/D'}</span>
                      </button>
                    ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowQuickCustomerModal(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all z-10"
                title="Registrar nuevo cliente"
              >
                ＋
              </button>
            </div>
          </div>
        </div>

        {/* Cart Items Area */}
        <div className="flex-1 overflow-y-auto px-6 py-3 scrollbar-thin scrollbar-thumb-indigo-50 scrollbar-track-transparent">
          {carrito.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none">
              <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-5xl mb-6 shadow-inner animate-pulse">🍱</div>
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-slate-400">Canasta Vacía</p>
              <p className="text-[9px] text-slate-300 mt-2 uppercase italic max-w-[200px]">Seleccione productos del catálogo para procesar la venta</p>
            </div>
          ) : (
            <div className="space-y-1">
              {carrito.map((item: CartItem) => (
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
                  className="group relative flex items-center py-1.5 px-3 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300 animate-in slide-in-from-right-4 ring-1 ring-slate-50 gap-3 outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {/* Name & ID - Left side */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[11px] text-slate-700 uppercase truncate leading-tight">{item.nombre}</h4>
                    <p className="text-[11px] font-medium text-slate-800 uppercase tracking-tighter mt-0.5">REF: {item.referencia || 'NO REF'}</p>
                    {/* Alerta de Stock Real-Time */}
                    {!item.es_servicio && (!empresa.permitir_venta_negativa || !item.permitir_venta_negativa) && (item.qty > (item.cantidad - (getCommittedQty(item.id) - item.qty))) && (
                      <div className="text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 py-1 rounded-lg inline-block mt-2 animate-pulse border border-rose-100 uppercase tracking-tighter shadow-sm">
                        ⚠️ Agotado (Stock: {Math.max(0, item.cantidad - (getCommittedQty(item.id) - item.qty))})
                      </div>
                    )}
                  </div>

                  {/* Quantity Controls - Center */}
                  <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100 shadow-inner shrink-0">
                    <button onClick={() => removerDelCarrito(item)} className="w-8 h-8 flex items-center justify-center text-lg text-slate-400 bg-white hover:text-rose-600 rounded-xl transition-all shadow-sm active:scale-90 select-none font-bold">－</button>
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
                      className="w-10 text-center text-sm bg-transparent outline-none text-slate-800 font-bold"
                    />
                    <button onClick={() => agregarAlCarrito(item)} className="w-8 h-8 flex items-center justify-center text-lg text-slate-400 bg-white hover:text-indigo-600 rounded-xl transition-all shadow-sm active:scale-90 select-none font-bold">＋</button>
                  </div>

                  <div className="text-right shrink-0 min-w-[70px]">
                    <div className="text-xs text-slate-900 italic font-medium">{formatCOP(item.precio_venta * item.qty)}</div>
                    <div className="text-[8px] text-indigo-400 uppercase tracking-tighter">
                      {formatCOP(item.precio_venta)}/u
                      {parseFloat(String(item.iva_porcentaje ?? 0)) > 0 && ` (+${item.iva_porcentaje}%)`}
                    </div>
                  </div>

                  {/* Delete - Far Right */}
                  <button onClick={() => eliminarDelCarrito(item)} className="w-6 h-6 items-center justify-center rounded-lg bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-all text-lg shrink-0 flex">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: Ultra-Compact Totals & Master Action */}
        {carrito.length > 0 && (
          <div className="p-3 bg-white border-t border-slate-100 space-y-2 shadow-[0_-15px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-[32px] animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-end px-2">
              <div className="flex flex-col">
                <h2 className="text-[10px] text-slate-900 font-bold uppercase tracking-[0.3em] mb-0.5 italic">Total Neto</h2>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-indigo-600 font-medium uppercase bg-indigo-50 px-5 py-2 rounded-full border border-indigo-500">{totalItems} Ítems seleccionados</span>
                  {totalIva > 0 && <span className="text-[9px] text-rose-600 font-medium uppercase bg-rose-50 px-3 py-1 rounded-full border border-rose-100">IVA: {formatCOP(totalIva)}</span>}
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xl text-slate-950 font-medium tracking-tighter leading-none italic block">{formatCOP(granTotal)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  if (!hasAccess("venta")) {
                    return alert("🚫 No tienes permiso para realizar ventas.");
                  }
                  if (!cajeroId) return alert("⚠️ Identificación Requerida: Seleccione al vendedor responsable.");
                  
                  // Validación previa de stock antes de abrir checkout
                  const hasStockError = carrito.some((item: any) => {
                    if (item.es_servicio) return false;
                    const isNegativeBlocked = !empresa.permitir_venta_negativa || !item.permitir_venta_negativa;
                    const available = item.cantidad - (getCommittedQty(item.id) - item.qty);
                    return isNegativeBlocked && item.qty > available;
                  });

                  if (hasStockError) {
                    return alert("🛑 ¡Venta bloqueada! Algunos productos en el carrito han superado el stock disponible debido a movimientos de inventario en tiempo real. Por favor revisa las cantidades antes de facturar. 🔍");
                  }

                  setShowCheckoutModal(true);
                }}
                className="w-full py-4 rounded-xl font-medium text-[11px] uppercase tracking-[0.2em] shadow-lg shadow-blue-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:brightness-110 group whitespace-nowrap"
              >
                Facturar Venta 🚀
              </button>
              <div className="flex items-center gap-5 justify-center">
                <button onClick={vaciarCarrito} className="text-[9px] font-medium text-slate-300 uppercase tracking-widest hover:text-rose-500 transition-all">Limpiar</button>
                <div className="w-1 h-1 bg-slate-100 rounded-full"></div>
                <button onClick={() => window.print()} className="text-[9px] font-medium text-slate-300 uppercase tracking-widest hover:text-indigo-500 transition-all">Pre-Factura</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium Payment Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-blue-950/50 to-slate-950/70 backdrop-blur-xl animate-in fade-in duration-500" onClick={() => setShowCheckoutModal(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-400">

            {/* Header con gradiente vibrante */}
            <div className="bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-500 px-8 py-6 text-white text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent_70%)]"></div>
              <button onClick={() => setShowCheckoutModal(false)} className="absolute right-4 top-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white/80 hover:bg-white/30 hover:text-white transition-all text-lg">×</button>
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

                  {/* Tarjeta - Verde medio */}
                  <button
                    onClick={() => setMetodoPago("Tarjeta")}
                    className={`group flex flex-col items-center gap-2 py-3 rounded-2xl border-2 transition-all duration-300 ${metodoPago === "Tarjeta"
                      ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 border-indigo-500 text-white shadow-lg shadow-indigo-200 scale-105'
                      : 'bg-indigo-50 border-indigo-100 text-indigo-400 hover:border-indigo-300 hover:bg-indigo-100 hover:scale-[1.02]'}`}
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">💳</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Tarjeta</span>
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
                    {pagoCliente !== "" && (
                      <div className={`rounded-xl p-4 text-white text-center animate-in zoom-in duration-300 shadow-lg ${vuelto >= 0
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-200'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-200'}`}>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] block opacity-90">{vuelto >= 0 ? "Cambio a Devolver" : "Faltante"}</span>
                        <span className="text-3xl font-semibold tracking-tighter block mt-1">{formatCOP(Math.abs(vuelto))}</span>
                      </div>
                    )}
                  </div>
                )}

                {metodoPago === "Tarjeta" && (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-6 border border-emerald-100 space-y-4 animate-in fade-in duration-300">
                    <label className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest block text-center">💳 Monto en Tarjeta</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-semibold text-emerald-300">$</span>
                      <input
                        autoFocus
                        type="text"
                        value={pagoTarjeta}
                        onChange={e => handleCurrencyInputChange(e, setPagoTarjeta)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && parseFloat(pagoTarjeta) >= granTotal && !isProcessing) {
                            e.preventDefault();
                            confirmarVenta();
                          }
                        }}
                        className="w-full pl-14 pr-6 py-4 bg-white border-2 border-emerald-200 rounded-xl text-3xl font-semibold text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all text-center tracking-tighter"
                        placeholder="0"
                      />
                    </div>
                    {pagoTarjeta !== "" && (
                      <div className={`rounded-xl p-4 text-white text-center animate-in zoom-in duration-300 shadow-lg ${parseFloat(pagoTarjeta) >= granTotal
                        ? 'bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-200'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-200'}`}>
                        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] block opacity-90">{parseCurrency(pagoTarjeta) >= granTotal ? "Monto Completo" : "Diferencia con Total"}</span>
                        <span className="text-3xl font-semibold tracking-tighter block mt-1">{formatCOP(Math.abs(granTotal - parseCurrency(pagoTarjeta)))}</span>
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
                              if (sumMixto >= granTotal && !isProcessing) {
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
                        <label className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block text-center">💳 Digital</label>
                        <input
                          ref={trMixtoRef}
                          type="text"
                          value={pagoTransferenciaMixto}
                          onChange={e => handleCurrencyInputChange(e, setPagoTransferenciaMixto)}
                          onKeyDown={e => {
                            if (e.key === "Enter" && sumMixto >= granTotal && !isProcessing) {
                              e.preventDefault();
                              confirmarVenta();
                            }
                          }}
                          className="w-full px-4 py-3 bg-white border-2 border-emerald-200 rounded-xl text-xl font-semibold text-emerald-700 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 text-center"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className={`py-3 rounded-xl text-xs font-semibold uppercase tracking-wider text-center border-2 transition-all ${sumMixto >= granTotal
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      {sumMixto >= granTotal ? "✅ Monto Completo" : `⚠️ Faltan: ${formatCOP(granTotal - sumMixto)}`}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Confirmación */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => confirmarVenta()}
                  disabled={isProcessing || (metodoPago === "Mixto" && sumMixto < granTotal) || (metodoPago === "Efectivo" && (pagoCliente === "" || cashPaga < granTotal)) || (metodoPago === "Tarjeta" && (pagoTarjeta === "" || parseCurrency(pagoTarjeta) < granTotal))}
                  className={`w-full py-3 rounded-2xl font-semibold text-sm uppercase tracking-wider shadow-xl transition-all duration-300 flex items-center justify-center gap-3 ${isProcessing
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : ((metodoPago === "Mixto" && sumMixto >= granTotal) || (metodoPago === "Efectivo" && cashPaga >= granTotal) || (metodoPago === "Tarjeta" && parseCurrency(pagoTarjeta) >= granTotal))
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white hover:shadow-2xl hover:shadow-blue-300 hover:-translate-y-0.5 active:translate-y-0 active:shadow-lg'
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
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
                  onClick={() => setShowCheckoutModal(false)}
                  className="w-full py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal: Compact & Premium with Bright Blue Theme */}
      {ventaExitosa && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-2xl animate-in fade-in duration-500"></div>
          <div className="relative w-full max-w-md bg-white rounded-[48px] shadow-3xl p-10 text-center animate-in zoom-in slide-in-from-bottom-10 duration-500 border border-slate-100">

            {/* Pulsing Success Indicator: Bright Blue */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 bg-blue-500/20 rounded-[32px] animate-ping opacity-40"></div>
              <div className="relative bg-blue-600 text-white rounded-[32px] w-full h-full flex items-center justify-center text-5xl shadow-2xl shadow-blue-200">
                ✓
              </div>
            </div>

            <h2 className="text-3xl font-normal text-slate-900 mb-2 uppercase tracking-tighter italic leading-none">Venta Exitosa</h2>
            <p className="text-slate-400 font-medium uppercase text-[9px] tracking-[0.2em] mb-8 italic">Transacción Registrada</p>

            {/* Reconciliation Detail */}
            {(metodoPago === "Efectivo" && vuelto > 0) || (metodoPago === "Tarjeta" && pagoTarjeta !== "") || (metodoPago === "Mixto" && sumMixto > granTotal) ? (
              <div className="bg-slate-50 rounded-[32px] p-6 mb-8 border border-slate-100 shadow-inner">
                <span className="text-[8px] font-medium text-slate-400 uppercase tracking-[0.4em] block mb-2">
                  {metodoPago === "Efectivo" ? "Efectivo Recibido" : metodoPago === "Tarjeta" ? "Cierre Tarjeta" : "Total Recaudado"}
                </span>
                <strong className="text-4xl text-slate-900 font-medium italic tracking-tighter leading-none">
                  {metodoPago === "Tarjeta" ? formatCOP(parseCurrency(pagoTarjeta)) : formatCOP(vuelto >= 0 ? vuelto : Math.max(0, sumMixto - granTotal))}
                </strong>
                {vuelto > 0 && metodoPago === "Efectivo" && (
                  <span className="text-[8px] font-medium text-blue-600 uppercase tracking-widest block mt-3">Devolver Cambio</span>
                )}
              </div>
            ) : null}

            {/* Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => { imprimirYTerminar(); iniciarNuevaVenta(); }}
                className="py-5 bg-slate-900 text-white rounded-2xl font-medium text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl flex items-center justify-center gap-2 group"
              >
                <span className="group-hover:scale-110 transition-transform">🖨️</span> Ticket
              </button>
              <button
                onClick={() => { compartirWhatsApp(); iniciarNuevaVenta(); }}
                className="py-5 bg-blue-600 text-white rounded-2xl font-medium text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl flex items-center justify-center gap-2 group"
              >
                <span className="group-hover:scale-110 transition-transform">📱</span> WhatsApp
              </button>
            </div>

            {/* Final Navigation Action */}
            <div className="mt-10 space-y-4">
              <button
                ref={successBtnRef}
                onClick={iniciarNuevaVenta}
                className="w-full py-5 bg-blue-600 text-white rounded-3xl font-medium text-xs uppercase tracking-[0.5em] hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 italic outline-none focus:ring-4 focus:ring-blue-100"
              >
                <span>🏪</span> Iniciar Nueva Venta
              </button>
              <p className="text-[8px] font-medium text-slate-300 uppercase tracking-widest text-center">Transacción Finalizada y Archivada</p>
            </div>
          </div>
        </div>
      )}

      {/* Printer Component (HIDDEN) */}
      <div style={{ display: "none" }}>
        {facturaIdImpresion && (
          <PrintReceipt
            ref={contentRef}
            empresa={empresa}
            numero={facturaIdImpresion}
            fecha={new Date()}
            cliente={clienteSearch}
            cajero={cajeroSeleccionado?.nombre || "Vendedor"}
            metodoPago={metodoPago}
            items={itemsParaRecibo}
            total={granTotal}
            iva={totalIva}
            efectivoRecibido={cashPaga}
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
                setClientes(prev => [...prev, created]);
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
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">Nombre Completo / Razón Social</label>
                <input
                  type="text"
                  value={newCustomer.nombre}
                  onChange={e => setNewCustomer({ ...newCustomer, nombre: e.target.value.toUpperCase() })}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-semibold"
                  placeholder="Ej: JUAN PEREZ o EMPRESA SAS"
                  required
                  autoFocus
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
                <div className="flex gap-2">
                  <div className="space-y-1.5 flex-1">
                    <label className="text-[10px] text-slate-400 font-medium uppercase tracking-widest ml-1">Nro Documento</label>
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
                      placeholder="Sin puntos"
                    />
                  </div>
                  {newCustomer.tipo_documento === "31" && (
                    <div className="space-y-1.5 w-12 shrink-0">
                      <label className="text-[10px] text-indigo-500 font-medium uppercase tracking-widest text-center block">DV</label>
                      <div className="w-full px-1 py-3.5 bg-indigo-50 border border-indigo-200 rounded-2xl text-center font-medium text-indigo-700">{newCustomer.dv}</div>
                    </div>
                  )}
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
                {isCreatingCustomer ? "⏳ Creando..." : "✅ Registrar y Seleccionar"}
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
              <h2 className="text-3xl font-medium uppercase italic tracking-tighter">Crear Nuevo Separado</h2>
              <p className="text-[10px] uppercase font-semibold tracking-[0.3em] opacity-80 mt-1">Reserva de mercancía / Apartado</p>
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
                      className="w-full px-5 py-4 bg-slate-50 border-2 border-emerald-50 rounded-2xl text-xl font-medium text-emerald-700 outline-none focus:bg-white focus:border-emerald-500 focus:ring-8 focus:ring-emerald-50 transition-all"
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
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest block ml-1">Método de Pago del Abono</label>
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
                  if (carrito.length === 0) return alert("❌ Error: El carrito está vacío.");
                  if (!clienteId || clienteId === "1") return alert("⚠️ Atención: Los separados requieren un cliente específico. Por favor, seleccione o registre un cliente (no se permite Cliente General).");
                  if (!cajeroId) return alert("👤 Seguridad: Debe seleccionar al vendedor responsable antes de continuar.");
                  if (abonoInicial === "") return alert("💰 Dato Requerido: Ingrese el valor del abono inicial (mínimo 0).");

                  setIsProcessingSeparado(true);
                  try {
                    await API.post("/separados", {
                      cliente_id: parseInt(clienteId),
                      detalles: carrito.map(p => ({
                        id: p.id,
                        nombre: p.nombre,
                        qty: p.qty,
                        precio_venta: p.precio_venta
                      })),
                      total: granTotal,
                      abono_inicial: parseFloat(abonoInicial),
                      metodo_pago: metodoPagoAbono,
                      fecha_vencimiento: fechaVencimiento,
                      notas: "Creado desde Terminal de Ventas POS",
                      cajero_id: cajeroId ? parseInt(cajeroId) : null
                    });
                    alert("✅ Separado creado exitosamente");
                    // Limpiar estado completo del tab
                    setTabs((prev: any[]) => prev.map((t: any) =>
                      t.id === activeTabId
                        ? { ...t, carrito: [], clienteId: "1", clienteSearch: "Cliente General (Mostrador)" }
                        : t
                    ));
                    setShowCreateSeparadoModal(false);
                    setAbonoInicial("");
                    setPagoCliente("");
                    setSearch("");
                  } catch (err: any) {
                    alert("Error: " + (err.response?.data?.error || err.message));
                  } finally {
                    setIsProcessingSeparado(false);
                  }
                }}
                className={`w-full py-5 rounded-[24px] font-medium text-xs uppercase tracking-[0.5em] transition-all shadow-2xl ${isProcessingSeparado ? 'bg-slate-200 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.02] shadow-emerald-100 shadow-emerald-200/50'
                  } ${(!clienteId || clienteId === "1" || carrito.length === 0) ? 'brightness-90 saturate-50' : ''}`}
              >
                {isProcessingSeparado ? 'Procesando...' : 'Confirmar Separado 📋'}
              </button>
              {clienteId === "1" && <p className="text-[10px] text-rose-500 font-semibold text-center uppercase tracking-widest italic animate-bounce mt-2">⚠️ DEBES SELECCIONAR UN CLIENTE ESPECÍFICO (NO PERMITIDO PARA CLIENTE GENERAL)</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Acceso Rápido: Ingreso de Mercancía */}
      {showIngresoModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" onClick={() => setShowIngresoModal(false)}></div>
          <div className="relative w-[95vw] h-[90vh] bg-white rounded-[40px] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Acceso Rápido: Ingreso de Mercancía</h2>
              <button onClick={() => setShowIngresoModal(false)} className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center hover:text-rose-500 shadow-sm border border-slate-100 transition-all font-black text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              <IngresoProductos />
            </div>
          </div>
        </div>
      )}

      {/* Modal Acceso Rápido: Historial de Separados */}
      {showSeparadosHistoryModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl" onClick={() => setShowSeparadosHistoryModal(false)}></div>
          <div className="relative w-[95vw] h-[90vh] bg-white rounded-[40px] shadow-3xl overflow-hidden animate-in zoom-in duration-300 flex flex-col border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Historial General de Separados</h2>
              <button onClick={() => setShowSeparadosHistoryModal(false)} className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center hover:text-rose-500 shadow-sm border border-slate-100 transition-all font-black text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
              <Separados />
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
    y = parseInt(nit.substr(i, 1));
    x += (y * vpri[z - i - 1]);
  }
  y = x % 11;
  return (y > 1) ? (11 - y).toString() : y.toString();
}

export default Productos;
