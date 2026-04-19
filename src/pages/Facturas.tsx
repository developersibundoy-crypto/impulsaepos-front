import React, { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP, formatDateTime } from "../utils/format";
import { FacturaVenta } from "../types";
import PrintReceipt from "../components/PrintReceipt";

function Facturas() {
  const [facturas, setFacturas] = useState<FacturaVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroRapido, setFiltroRapido] = useState("Todas");
  const [empresa, setEmpresa] = useState<any>({});
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const limit = 20;
  
  // Menu options state
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detallesFactura, setDetallesFactura] = useState<any[]>([]);
  const [phoneWS, setPhoneWS] = useState("");

  // Estado para Imprimir
  const [facturaPrintData, setFacturaPrintData] = useState<{cabecera: FacturaVenta, detalles: any[]} | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  useEffect(() => {
    if (facturaPrintData) {
      setTimeout(() => {
        reactToPrintFn();
      }, 100);
    }
  }, [facturaPrintData, reactToPrintFn]);

  const handleImprimirVenta = (f: FacturaVenta) => {
    API.get(`/ventas/${f.id}`)
      .then(res => {
        setFacturaPrintData({ cabecera: f, detalles: res.data });
        setMenuOpenId(null);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchFacturas(1);
    API.get("/empresa").then(res => setEmpresa(res.data)).catch(console.error);
  }, [filtroRapido, searchTerm]);

  const fetchFacturas = (p: number = page) => {
    setLoading(true);
    API.get(`/ventas?page=${p}&limit=${limit}&search=${searchTerm}&filtro=${filtroRapido}`)
      .then(res => {
        if (res.data && res.data.data) {
          setFacturas(res.data.data);
          setTotalPages(res.data.last_page || 1);
          setTotalRecords(res.data.total || 0);
          setPage(res.data.current_page || p);
        } else {
          setFacturas(Array.isArray(res.data) ? res.data : []);
          setTotalPages(1);
          setTotalRecords(Array.isArray(res.data) ? res.data.length : 0);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const procesarBorrado = (id: number) => {
    const motivo = window.prompt(`⚠️ ¿Anular factura #${id}? Se devolverá el stock.\n\nEscriba el motivo de la anulación:`);
    
    if (motivo === null) return; // Usuario canceló
    if (!motivo.trim()) return alert("Debe ingresar un motivo para anular la factura.");

    API.delete(`/ventas/${id}`, { data: { motivo_anulacion: motivo } })
      .then(res => {
        if (res.data.success) {
          fetchFacturas();
        }
      })
      .catch(err => {
          console.error(err);
          const msg = err.response?.data?.error || "Error al anular.";
          alert(msg);
      });
  };

  const verDetalles = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      API.get(`/ventas/${id}`)
        .then(res => {
          setDetallesFactura(Array.isArray(res.data) ? res.data : []);
          setMenuOpenId(null);
          // Cargar teléfono del cliente
          const f = facturas.find(fac => fac.id === id);
          setPhoneWS(f?.telefono?.replace(/\D/g, '') || "");
        })
        .catch(console.error);
    }
  };

  const facturasFiltradas = facturas; // Filtrado ahora se hace en backend o se mantiene local si es array plano

  const enviarWhatsAppTicket = (f: FacturaVenta, detalles: any[]) => {
    // 1. Encabezado
    const header = `🏪 *${empresa?.nombre_empresa || "MI EMPRESA"}*\n` +
                   (empresa?.nit ? `NIT: ${empresa.nit}\n` : "") +
                   (empresa?.direccion ? `📍 ${empresa.direccion}\n` : "") +
                   (empresa?.telefono ? `📞 Tel: ${empresa.telefono}\n` : "") +
                   `--------------------------------\n`;

    // 2. Info de Venta
    const saleInfo = `📄 *Factura No: ${f.id}*\n` +
                     `📅 Fecha: ${new Date(f.fecha).toLocaleString('es-CO')}\n` +
                     `👤 Cliente: ${Number(f.cliente_id) === 1 ? "Factura General / Mostrador" : (f.cliente || "Consumidor Final")}\n` +
                     (f.cajero ? `👤 Vendedor: ${f.cajero}\n` : "") +
                     `--------------------------------\n`;

    // 3. Ítems
    const itemsStr = detalles.map((d: any) => {
        const qty = d.qty || d.cantidad || 1;
        return `• ${d.nombre} (x${qty})\n  Subtotal: ${formatCOP(d.precio_unitario * qty)}`;
    }).join('\n');

    // 4. Totales
    const totalsStr = `\n--------------------------------\n` +
                      `Subtotal: ${formatCOP(f.total - (f.iva || 0))}\n` +
                      (f.iva && f.iva > 0 ? `IVA: ${formatCOP(f.iva)}\n` : "") +
                      `💰 *TOTAL A PAGAR: ${formatCOP(f.total)}*\n` +
                      `Método: ${f.metodo_pago}\n`;

    // 5. Pie de Página
    const footer = `--------------------------------\n` +
                   `🙏 ¡Gracias por su compra!\n` +
                   (empresa?.resolucion ? `\n${empresa.resolucion}` : "");

    const mensaje = `${header}${saleInfo}🛒 *Resumen:*\n${itemsStr}${totalsStr}${footer}`;
    
    // Obtener teléfono limpio
    const rawPhone = f.telefono || phoneWS || "";
    const cleanPhone = rawPhone.replace(/\D/g, '');
    
    let waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    if (cleanPhone && cleanPhone.length >= 7) {
        const fullNum = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
        waUrl = `https://api.whatsapp.com/send?phone=${fullNum}&text=${encodeURIComponent(mensaje)}`;
    }

    window.open(waUrl, '_blank');
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-700 pb-20" onClick={() => setMenuOpenId(null)}>
      
      <div className="no-print space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-200">
            <div className="space-y-1">
                <h1 className="text-4xl font-medium tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
                    Historial de Ventas
                </h1>
                <p className="text-slate-500 font-medium text-lg italic">Control total de comprobantes y auditoría de transacciones.</p>
            </div>
            <div className="w-full md:w-auto relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">🔍</span>
                <input 
                    type="text" 
                    placeholder="Buscar por ID o cliente..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full md:w-80 pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all font-medium text-slate-700"
                />
            </div>
        </div>

        {/* Filters & Stats */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                {["Todas", "Efectivo", "Transferencia"].map(f => (
                    <button 
                        key={f}
                        onClick={() => setFiltroRapido(f)}
                        className={`px-6 py-2 rounded-xl text-xs font-medium uppercase tracking-widest transition-all ${
                            filtroRapido === f ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {f === "Todas" ? "Todas" : f === "Efectivo" ? "Efectivo" : "Banco"}
                    </button>
                ))}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 bg-white border border-slate-200 px-4 py-2 rounded-full">
                {totalRecords} Facturas Registradas
            </div>
        </div>

        {/* Invoice List (Horizontal / Collapsible) */}
        <div className="space-y-3">
            {loading ? (
                <div className="py-20 text-center space-y-4 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-400 font-medium uppercase tracking-widest text-[10px]">Sincronizando auditoría...</p>
                </div>
            ) : facturasFiltradas.length === 0 ? (
                <div className="py-24 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                    <div className="text-6xl mb-4">📂</div>
                    <p className="text-slate-400 font-medium italic">No se encontraron comprobantes para esta búsqueda.</p>
                </div>
            ) : (
                facturasFiltradas.map((f: FacturaVenta) => {
                    const isExpanded = expandedId === f.id;
                    return (
                        <div 
                            key={f.id} 
                            className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden ${isExpanded ? 'border-indigo-500 shadow-xl shadow-indigo-100 scale-[1.01] z-10' : 'border-slate-100 hover:border-indigo-200 shadow-sm'}`}
                        >
                            {/* Main Row */}
                            <div 
                                className="p-4 flex flex-wrap items-center gap-4 cursor-pointer select-none"
                                onClick={() => {
                                    if (isExpanded) {
                                        setExpandedId(null);
                                    } else {
                                        setExpandedId(f.id);
                                        // Auto load details when expanded
                                        API.get(`/ventas/${f.id}`)
                                          .then(res => setDetallesFactura(Array.isArray(res.data) ? res.data : []))
                                          .catch(console.error);
                                    }
                                }}
                            >
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0">
                                    <span className="text-indigo-600 font-semibold text-xs">#{f.id}</span>
                                </div>
                                
                                <div className="flex-1 min-w-[200px]">
                                    <h3 className="text-sm font-semibold text-slate-900 uppercase truncate">
                                        {Number(f.cliente_id) === 1 ? "Cliente Mostrador" : (f.cliente || "Consumidor Final")}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{formatDateTime(f.fecha)}</p>
                                </div>

                                <div className="shrink-0 flex items-center gap-6">
                                    <div className="text-right">
                                        <p className={`text-[8px] font-semibold uppercase tracking-tighter mb-0.5 ${f.metodo_pago === 'Efectivo' ? 'text-emerald-500' : 'text-sky-500'}`}>{f.metodo_pago}</p>
                                        <p className="text-lg font-semibold text-slate-900 tracking-tighter leading-none">{formatCOP(f.total)}</p>
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                        <span className="text-xl">↓</span>
                                    </div>
                                </div>
                            </div>

                            {/* Collapsible Details */}
                            {isExpanded && (
                                <div className="px-6 pb-6 pt-2 bg-slate-50/50 animate-in slide-in-from-top-2 duration-300">
                                    <div className="h-px bg-slate-100 mb-6"></div>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Items List */}
                                        <div className="space-y-3 lg:col-span-2">
                                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em] mb-4">Detalle de Mercancía</h4>
                                            {detallesFactura.length === 0 ? (
                                                <div className="py-4 text-center text-[10px] text-slate-400 animate-pulse">Cargando detalles...</div>
                                            ) : (
                                                detallesFactura.map((d, i) => (
                                                    <div key={i} className="flex justify-between items-center p-4 bg-white border border-slate-100 rounded-[20px] shadow-sm">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-slate-900 uppercase truncate mb-0.5">{d.nombre}</p>
                                                            <p className="text-[11px] text-slate-500 font-medium">{d.cantidad} unidades x {formatCOP(d.precio_unitario)}</p>
                                                        </div>
                                                        <div className="text-right ml-4">
                                                            <span className="text-sm font-bold text-indigo-600 block">{formatCOP(d.cantidad * d.precio_unitario)}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Audit Actions */}
                                        <div className="space-y-4 lg:col-span-1 border-l border-slate-100 pl-0 lg:pl-6">
                                            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em] mb-4">Panel de Auditoría</h4>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                <button 
                                                    onClick={() => handleImprimirVenta(f)}
                                                    className="py-1.5 bg-slate-900 text-white rounded-xl text-[9px] font-medium uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>🖨️</span> Ticket
                                                </button>
                                                <button 
                                                    onClick={() => enviarWhatsAppTicket(f, detallesFactura)}
                                                    className="py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-medium uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <span>📲</span> WhatsApp
                                                </button>
                                            </div>

                                            <button 
                                                onClick={() => procesarBorrado(f.id)}
                                                className="w-full py-3 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span>🗑️</span> Anular este Comprobante
                                            </button>

                                            <div className="bg-white p-4 rounded-2xl border border-slate-100">
                                                <p className="text-[9px] font-medium text-slate-300 uppercase tracking-[0.2em] mb-3">Trazabilidad</p>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-slate-400 font-medium">Vendedor:</span>
                                                        <span className="text-slate-600 font-semibold uppercase">{f.cajero || "Cajero Principal"}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-slate-400 font-medium">IVA Reportado:</span>
                                                        <span className="text-rose-500 font-semibold">{formatCOP(f.iva || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-10 no-print">
                <button 
                    disabled={page === 1}
                    onClick={() => {
                        const newPage = page - 1;
                        setPage(newPage);
                        fetchFacturas(newPage);
                    }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${
                        page === 1 ? 'bg-slate-100 text-slate-300' : 'bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 shadow-sm'
                    }`}
                >
                    Anterior
                </button>
                <div className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-medium uppercase tracking-widest shadow-md">
                    Página {page} de {totalPages}
                </div>
                <button 
                    disabled={page === totalPages}
                    onClick={() => {
                        const newPage = page + 1;
                        setPage(newPage);
                        fetchFacturas(newPage);
                    }}
                    className={`px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${
                        page === totalPages ? 'bg-slate-100 text-slate-300' : 'bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 shadow-sm'
                    }`}
                >
                    Siguiente
                </button>
            </div>
        )}

        {/* Floating Button */}
        <button 
            onClick={() => window.location.href="/"}
            className="fixed bottom-10 right-10 w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-3xl font-semibold shadow-2xl hover:scale-110 active:scale-95 transition-all z-30"
        >+</button>
      </div>



      <div style={{ display: 'none' }}>
        {facturaPrintData && (
          <PrintReceipt
            ref={contentRef}
            empresa={empresa}
            numero={facturaPrintData.cabecera.id}
            fecha={facturaPrintData.cabecera.fecha}
            cliente={Number(facturaPrintData.cabecera.cliente_id) === 1 ? "Fca. General / Mostrador" : (facturaPrintData.cabecera.cliente || "Consumidor Final")}
            cajero={facturaPrintData.cabecera.cajero || "Principal"}
            metodoPago={facturaPrintData.cabecera.metodo_pago}
            items={facturaPrintData.detalles}
            total={facturaPrintData.cabecera.total}
            pagoEfectivoMixto={facturaPrintData.cabecera.metodo_pago === 'Mixto' ? facturaPrintData.cabecera.pago_efectivo : undefined}
            pagoTransferenciaMixto={facturaPrintData.cabecera.metodo_pago === 'Mixto' ? facturaPrintData.cabecera.pago_transferencia : undefined}
          />
        )}
      </div>

    </div>
  );
}

export default Facturas;
