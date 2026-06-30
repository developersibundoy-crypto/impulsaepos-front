import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { useReactToPrint } from "react-to-print";
import PrintReceipt from "../components/PrintReceipt";
import { Producto } from "../types";
import { hasAccess } from "../utils/auth";
import NotificationPanel from "../components/NotificationPanel";
import { QuickCustomerModal } from "../components/QuickCustomerModal";

interface CartItem extends Omit<Producto, 'id'> {
  id: number;
  qty: number;
  descuento: number;
}

function Cotizaciones() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [clienteId, setClienteId] = useState("1");
  const [clienteSearch, setClienteSearch] = useState("Cliente general");
  
  const [clientes, setClientes] = useState<any[]>([]);
  const [empresa, setEmpresa] = useState<any>({});
  
  const [cajeros, setCajeros] = useState<any[]>([]);
  const [cajeroId, setCajeroId] = useState(() => {
    return localStorage.getItem("adminCajeroId") || localStorage.getItem("posCajeroId") || "";
  });

  const cajeroSeleccionado = useMemo(() =>
    cajeros.find((c: any) => c.id.toString() === cajeroId.toString()),
    [cajeros, cajeroId]
  );

  const [scanError, setScanError] = useState(false);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeystrokeTime = useRef(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  useEffect(() => {
    fetchInventory(1);
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
    API.get("/cajeros").then(res => setCajeros(res.data)).catch(console.error);
    API.get("/empresa").then(res => setEmpresa(res.data)).catch(console.error);
  }, []);

  const fetchInventory = (page = 1, searchQuery = "") => {
    setLoading(true);
    let url = `/productos?page=${page}&limit=50`;
    if (searchQuery.trim()) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }
    API.get(url)
      .then(res => {
        const dataArr = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setProductos(dataArr);
        setTotalPages(res.data.last_page || 1);
        setTotalRecords(res.data.total || dataArr.length);
        setPage(res.data.page || page);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching inventory", err);
        setLoading(false);
      });
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    const now = Date.now();
    const isFast = now - lastKeystrokeTime.current < 50;
    lastKeystrokeTime.current = now;

    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);

    if (isFast && val.length > 2) {
      scanTimeoutRef.current = setTimeout(() => {
        handleSearchKeyPress({ key: 'Enter', preventDefault: () => { } } as any);
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
      setCarrito([...carrito, { ...producto, qty: 1, descuento: 0 }]);
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

  const actualizarCantidad = (id: number, val: string) => {
    if (val === "") {
      setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: 0 } : x));
      return;
    }
    const qty = parseInt(val);
    if (isNaN(qty) || qty < 0) return;
    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, qty: qty } : x));
  };

  const actualizarDescuento = (id: number, val: string) => {
    let desc = parseFloat(val);
    if (isNaN(desc)) desc = 0;
    if (desc < 0) desc = 0;
    if (desc > 100) desc = 100;
    setCarrito(carrito.map((x: any) => x.id === id ? { ...x, descuento: desc } : x));
  };

  const eliminarDelCarrito = (producto: any) => {
    setCarrito(carrito.filter((x: any) => x.id !== producto.id));
  };

  const handleSearchKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && search.trim() !== '') {
      e.preventDefault();
      const barcode = search.trim();
      const matchedProduct = productos.find(p => p.referencia && p.referencia.trim().toLowerCase() === barcode.toLowerCase());
      
      if (matchedProduct) {
        agregarAlCarrito(matchedProduct);
        setSearch("");
        if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      } else {
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
  };

  const granTotal = carrito.reduce((a: number, c: any) => {
    const pVenta = Number(c.precio_venta) || 0;
    const desc = c.descuento ? (pVenta * c.descuento) / 100 : 0;
    return a + ((pVenta - desc) * c.qty);
  }, 0);

  const totalIva = carrito.reduce((a: number, c: any) => {
    const pVenta = Number(c.precio_venta) || 0;
    const desc = c.descuento ? (pVenta * c.descuento) / 100 : 0;
    const totalItem = (pVenta - desc) * c.qty;
    const ivaPerc = parseFloat(c.iva_porcentaje || 0);
    const base = totalItem / (1 + ivaPerc / 100);
    return a + (totalItem - base);
  }, 0);

  const generarCotizacion = () => {
    if (carrito.length === 0) return alert("La cotización está vacía.");
    reactToPrintFn();
  };

  const limpiarCotizacion = () => {
    if (window.confirm("¿Seguro que deseas descartar esta cotización?")) {
      setCarrito([]);
      setClienteId("1");
      setClienteSearch("Cliente general");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-120px)] gap-4 lg:gap-6 lg:overflow-hidden animate-in fade-in duration-500 p-2">
      {/* LEFT: Product Catalog */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="p-4 lg:p-6 border-b border-slate-100 space-y-4 bg-slate-50/30 relative z-30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-xl lg:text-3xl text-slate-800 tracking-tight flex items-center gap-3 font-medium uppercase italic ml-2">
              <span className="text-amber-500">📝</span> Terminal de Cotización
            </h2>
          </div>
          <NotificationPanel />
          <div className="relative group z-20">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors text-lg z-10">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Escanea o busca producto por nombre o referencia..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyPress}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setTimeout(() => setIsInputFocused(false), 200)}
              className={`relative w-full pl-12 pr-4 py-4 bg-white border rounded-2xl outline-none transition-all duration-300 font-medium text-sm shadow-sm z-10 ${scanError ? 'border-red-500 ring-4 ring-red-50 bg-red-50' : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50'}`}
              autoFocus
            />

            {/* Lista desplegable de coincidencias (Autocomplete) */}
            {search.trim().length > 0 && productos.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-64 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                <ul className="py-1">
                  {productos.slice(0, 20).map(p => (
                    <li key={p.id}>
                      <button
                        onMouseDown={(e) => {
                          // Usar onMouseDown en lugar de onClick para evitar que el onBlur del input se dispare primero en algunos navegadores
                          e.preventDefault();
                          agregarAlCarrito(p);
                          setSearch("");
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0"
                      >
                        <div className="flex flex-col pr-4">
                          <span className="text-xs font-bold text-slate-800 line-clamp-1">{p.nombre}</span>
                          {p.referencia && <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase mt-0.5">REF: {p.referencia}</span>}
                        </div>
                        <span className="text-[11px] font-black text-indigo-600 bg-indigo-50/50 px-2 py-1 rounded-lg shrink-0">
                          {formatCOP(p.precio_venta)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium uppercase tracking-widest text-[10px]">Cargando Catálogo...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {productos.map(p => {
                const pid = p.id ?? 0;
                return (
                  <button
                    key={pid}
                    onClick={() => agregarAlCarrito(p)}
                    className={`group relative flex flex-col p-4 bg-white rounded-2xl border border-slate-200 text-left transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100 hover:border-indigo-300 active:scale-95`}
                  >
                    <div className="mb-3">
                      <div className="flex justify-between items-start gap-1">
                        <h3 className="text-[12px] text-slate-900 line-clamp-2 leading-tight min-h-[2.4rem] uppercase font-medium">{p.nombre}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {p.referencia ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-md border border-slate-200 truncate max-w-[100px]" title={p.referencia}>
                            {p.referencia}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-50 text-slate-300 text-[9px] font-black uppercase tracking-widest rounded-md border border-slate-100">
                            SIN REF
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest leading-none mb-1">Precio</span>
                          <span className="text-sm font-black text-indigo-600 leading-none">{formatCOP(p.precio_venta)}</span>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm">
                          <span className="text-sm">＋</span>
                        </div>
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

      {/* RIGHT: Cart & Actions */}
      <div className="w-full lg:w-[400px] xl:w-[450px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-4 lg:p-5 rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
          
          {/* CLIENT SELECTOR */}
          <div className="mb-4 space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                👤 CLIENTE DE COTIZACIÓN
              </label>
              <button
                onClick={() => setShowQuickCustomerModal(true)}
                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-black uppercase flex items-center gap-1 transition-colors bg-indigo-50 px-2 py-1 rounded-lg"
              >
                <span>➕</span> Novedad
              </button>
            </div>
            <div className="relative">
              <select
                value={clienteId}
                onChange={(e) => {
                  const val = e.target.value;
                  setClienteId(val);
                  const selectedClient = clientes.find((c: any) => c.id.toString() === val);
                  setClienteSearch(selectedClient ? selectedClient.nombre : "Cliente general");
                }}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-sm text-slate-700 transition-all appearance-none cursor-pointer"
              >
                <option value="1">Cliente General</option>
                {clientes.filter((c: any) => c.id !== 1).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nombre} - {c.documento || 'S/D'}</option>
                ))}
              </select>
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">👤</span>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</span>
            </div>
          </div>

          {/* CAJERO SELECTOR */}
          <div className="mb-4 relative">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">🧑‍💼 ASESOR COMERCIAL</label>
             <select
                 value={cajeroId}
                 onChange={(e) => setCajeroId(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-xs text-slate-700 transition-all appearance-none cursor-pointer"
             >
                 <option value="">-- Seleccionar Asesor --</option>
                 {cajeros.map((c: any) => (
                     <option key={c.id} value={c.id}>{c.nombre}</option>
                 ))}
             </select>
             <span className="absolute left-3 top-9 text-slate-400">🧑‍💼</span>
             <span className="absolute right-3 top-9 text-slate-400 pointer-events-none text-[10px]">▼</span>
          </div>

          <div className="flex-1 overflow-y-auto mb-4 bg-slate-50/50 rounded-2xl border border-slate-100 p-2 lg:p-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent space-y-2">
            {carrito.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                <span className="text-5xl">🛒</span>
                <p className="font-medium text-sm uppercase tracking-widest text-center px-4">Agrega productos para<br/>armar la cotización</p>
              </div>
            ) : (
              carrito.map((item, index) => {
                const precioOrig = Number(item.precio_venta) || 0;
                const desc = item.descuento ? (precioOrig * item.descuento) / 100 : 0;
                const precioFinal = precioOrig - desc;
                
                return (
                <div key={item.id} className="bg-white p-3 rounded-2xl border border-slate-200 flex flex-col gap-3 shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 uppercase truncate pr-2">{item.nombre}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">{formatCOP(precioFinal)}</span>
                        {item.descuento > 0 && <span className="text-[9px] text-slate-400 line-through">{formatCOP(precioOrig)}</span>}
                      </div>
                    </div>
                    <button onClick={() => eliminarDelCarrito(item)} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">✕</button>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                     <div className="flex items-center gap-1">
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desc %</span>
                         <input
                           type="number"
                           min="0"
                           max="100"
                           value={item.descuento === 0 ? "" : item.descuento}
                           onChange={(e) => actualizarDescuento(item.id, e.target.value)}
                           className="w-12 h-7 text-center font-bold text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                           placeholder="0"
                         />
                     </div>
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                      <button onClick={() => removerDelCarrito(item)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shadow-sm font-bold text-sm">−</button>
                      <input
                        type="number"
                        min="0"
                        value={item.qty === 0 ? "" : item.qty}
                        onChange={(e) => actualizarCantidad(item.id, e.target.value)}
                        className="w-10 h-7 text-center font-bold text-sm bg-transparent focus:outline-none"
                      />
                      <button onClick={() => agregarAlCarrito(item)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shadow-sm font-bold text-sm">＋</button>
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 lg:p-5 border border-slate-200 space-y-2 lg:space-y-3 mb-4">
            <div className="flex justify-between items-center text-slate-500 font-medium text-xs lg:text-sm">
              <span>Subtotal:</span>
              <span>{formatCOP(granTotal - totalIva)}</span>
            </div>
            {totalIva > 0 && (
              <div className="flex justify-between items-center text-slate-500 font-medium text-xs lg:text-sm">
                <span>IVA Incluido:</span>
                <span>{formatCOP(totalIva)}</span>
              </div>
            )}
            <div className="h-px w-full bg-slate-200 my-1"></div>
            <div className="flex justify-between items-center text-slate-900 font-black text-xl lg:text-2xl">
              <span>TOTAL:</span>
              <span className="text-indigo-600">{formatCOP(granTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
                onClick={limpiarCotizacion}
                disabled={carrito.length === 0}
                className="w-14 h-14 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-2xl flex items-center justify-center text-xl transition-all disabled:opacity-50 border border-rose-100 shrink-0"
                title="Limpiar Cotización"
            >
                🗑️
            </button>
            <button
              onClick={generarCotizacion}
              disabled={carrito.length === 0 || !cajeroId}
              className="flex-1 h-14 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-amber-200 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>📝</span> IMPRIMIR COTIZACIÓN
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'none' }}>
        <PrintReceipt
          ref={contentRef}
          empresa={empresa}
          numero={Math.floor(1000 + Math.random() * 9000).toString()} // random id for quotes as they are not saved in DB
          fecha={new Date()}
          cliente={clienteSearch}
          cajero={cajeroSeleccionado?.nombre || "Asesor"}
          items={carrito.map(c => ({
              nombre: c.nombre,
              cantidad: c.qty,
              precio_unitario: Number(c.precio_venta) - (c.descuento ? (Number(c.precio_venta) * c.descuento / 100) : 0),
              referencia: c.referencia
          }))}
          iva={totalIva}
          total={granTotal}
          isCotizacion={true}
        />
      </div>

      <QuickCustomerModal
        isOpen={showQuickCustomerModal}
        onClose={() => {
          setShowQuickCustomerModal(false);
        }}
        onCustomerCreated={(newClient: any) => {
          API.get("/clientes").then(res => {
            setClientes(res.data);
            if (newClient && newClient.id) {
              setClienteId(newClient.id.toString());
              setClienteSearch(newClient.nombre);
            }
          }).catch(console.error);
        }}
      />
    </div>
  );
}

export default Cotizaciones;
