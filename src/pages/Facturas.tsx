import React, { useState, useEffect, useRef, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP, formatDateTime } from "../utils/format";
import { FacturaVenta } from "../types";
import PrintReceipt from "../components/PrintReceipt";

function ModalCambioProducto({ factura, detalles, onClose, onExito }: any) {
    const [productoDevueltoId, setProductoDevueltoId] = useState<number | "">("");
    const [productosBuscar, setProductosBuscar] = useState<any[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [productoNuevo, setProductoNuevo] = useState<any>(null);
    const [metodoPago, setMetodoPago] = useState("Efectivo");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const delayFn = setTimeout(() => {
            if (busqueda.length >= 2) {
                API.get(`/productos?search=${busqueda}`).then(res => {
                    setProductosBuscar(Array.isArray(res.data) ? res.data : (res.data.data || []));
                }).catch(console.error);
            } else {
                setProductosBuscar([]);
            }
        }, 500);
        return () => clearTimeout(delayFn);
    }, [busqueda]);

    const pDevuelto = detalles.find((d: any) => d.producto_id === Number(productoDevueltoId));
    const valorOriginal = pDevuelto ? Number(pDevuelto.precio_unitario) : 0;
    const valorNuevo = productoNuevo ? Number(productoNuevo.precio_venta) : 0;
    const cantidadCambio = factura.metodo_pago === 'Separado' || factura.origen_separado ? Number(pDevuelto?.cantidad || 1) : 1;
    const diferencia = (Math.round(valorNuevo * 100) - Math.round(valorOriginal * 100)) * cantidadCambio / 100;

    const handleConfirm = () => {
        if (!pDevuelto) return alert("Seleccione el producto a devolver.");
        if (!productoNuevo) return alert("Seleccione el producto nuevo.");

        const payload = {
            factura_id: factura.id,
            producto_devuelto_id: pDevuelto.producto_id,
            producto_nuevo_id: productoNuevo.id,
            cantidad_devuelta: cantidadCambio,
            cantidad_nueva: cantidadCambio,
            valor_original: valorOriginal,
            valor_nuevo: valorNuevo,
            saldo_adicional: diferencia,
            metodo_pago: metodoPago
        };

        setLoading(true);
        API.post('/ventas/cambio-producto', payload).then(res => {
            alert(res.data.message || "Cambio registrado");
            onExito();
        }).catch(err => {
            alert(err.response?.data?.error || "Error al realizar el cambio");
        }).finally(() => setLoading(false));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Cambio de Producto</h3>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">1. Producto que devuelve el cliente</label>
                        <select
                            value={productoDevueltoId}
                            onChange={e => setProductoDevueltoId(Number(e.target.value))}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700"
                        >
                            <option value="">Seleccione el ítem...</option>
                            {detalles.map((d: any, i: number) => (
                                <option key={i} value={d.producto_id}>{d.nombre} - {formatCOP(d.precio_unitario)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">2. Producto Nuevo (A entregar)</label>
                        {!productoNuevo ? (
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar nuevo producto..."
                                    value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all font-medium text-slate-700"
                                />
                                {productosBuscar.length > 0 && (
                                    <div className="absolute top-full mt-2 w-full bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                                        {productosBuscar.map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => setProductoNuevo(p)}
                                                className="p-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer transition-colors"
                                            >
                                                <p className="font-semibold text-sm text-slate-800">{p.nombre}</p>
                                                <p className="text-xs text-slate-500 font-medium">{formatCOP(p.precio_venta)} • Stock: {p.cantidad}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-indigo-900">{productoNuevo.nombre}</p>
                                    <p className="text-sm text-indigo-700 font-medium">{formatCOP(productoNuevo.precio_venta)}</p>
                                </div>
                                <button onClick={() => setProductoNuevo(null)} className="text-indigo-400 hover:text-indigo-600 font-medium text-sm px-2 py-1 bg-white rounded-lg shadow-sm">Cambiar</button>
                            </div>
                        )}
                    </div>

                    {pDevuelto && productoNuevo && (
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Valor Original (Devuelto)</span>
                                <span className="text-slate-800 font-semibold">{formatCOP(valorOriginal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 font-medium">Nuevo Valor (Entregado)</span>
                                <span className="text-slate-800 font-semibold">{formatCOP(valorNuevo)}</span>
                            </div>
                            <div className="h-px bg-slate-200 w-full"></div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-700 font-bold uppercase tracking-widest text-xs">
                                    {diferencia > 0 ? "Saldo a Cobrar" : diferencia < 0 ? "Saldo a Favor del Cliente" : "Sin Diferencia"}
                                </span>
                                <span className={`text-xl font-black ${diferencia > 0 ? 'text-rose-600' : diferencia < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                                    {formatCOP(Math.abs(diferencia))}
                                </span>
                            </div>
                        </div>
                    )}

                    {diferencia > 0 && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">Método de Pago del Saldo</label>
                            <div className="flex gap-2">
                                {["Efectivo", "Transferencia"].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setMetodoPago(m)}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${metodoPago === m ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 mt-auto">
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !pDevuelto || !productoNuevo}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200"
                    >
                        {loading ? 'Procesando...' : 'Confirmar Cambio'}
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-3 font-medium uppercase tracking-widest">
                        Esta operación es atómica y afectará el inventario
                    </p>
                </div>
            </div>
        </div>
    );
}

function Facturas() {
    const [facturas, setFacturas] = useState<FacturaVenta[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filtroRapido, setFiltroRapido] = useState("Todas");
    const [filtroTipoFactura, setFiltroTipoFactura] = useState("Todas");
    const [empresa, setEmpresa] = useState<any>({});

    // Navegación de sección: 'ventas' (facturas) o 'abonos_separados'
    const [seccionActiva, setSeccionActiva] = useState<'ventas' | 'abonos_separados'>('ventas');

    // Estados para Historial de Abonos de Separados
    const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const [fechaDesdeAbono, setFechaDesdeAbono] = useState<string>(hoyStr);
    const [fechaHastaAbono, setFechaHastaAbono] = useState<string>(hoyStr);
    const [searchAbono, setSearchAbono] = useState<string>("");
    const [vistaAbonos, setVistaAbonos] = useState<'agrupado' | 'lista'>('agrupado');
    const [expandedSeparados, setExpandedSeparados] = useState<Record<number, boolean>>({});
    const [abonosList, setAbonosList] = useState<any[]>([]);
    const historialRequest = useRef(0);
    const [resumenSeparados, setResumenSeparados] = useState<any>({
        total_separados_registrados: 0,
        valor_total_separados: 0,
        saldo_total_pendiente: 0,
        total_recaudado_historico: 0,
        total_separados_activos: 0,
        saldo_pendiente_activos: 0
    });
    const [loadingAbonos, setLoadingAbonos] = useState<boolean>(false);

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
    const [cambioData, setCambioData] = useState<{ factura: FacturaVenta, detalles: any[] } | null>(null);

    // Estado para Imprimir
    const [facturaPrintData, setFacturaPrintData] = useState<{ cabecera: FacturaVenta, detalles: any[] } | null>(null);

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
        API.get(`/ventas/${f.id}?tipo=${f.tipo_factura}`)
            .then(res => {
                setFacturaPrintData({ cabecera: f, detalles: res.data });
                setMenuOpenId(null);
            })
            .catch(console.error);
    };

    useEffect(() => {
        fetchFacturas(1);
        API.get("/empresa").then(res => setEmpresa(res.data)).catch(console.error);
    }, [filtroRapido, filtroTipoFactura, searchTerm]);

    const toggleExpandSeparado = (sepId: number) => {
        setExpandedSeparados(prev => ({
            ...prev,
            [sepId]: prev[sepId] === undefined ? false : !prev[sepId]
        }));
    };

    const abonosAgrupados = useMemo(() => {
        const map = new Map<number, {
            separado_id: number;
            cliente_id: number;
            cliente_nombre: string;
            cliente_documento: string;
            cliente_telefono: string;
            separado_total: number;
            saldo_pendiente: number;
            separado_estado: string;
            separado_fecha_creacion: string;
            total_abonado_en_rango: number;
            abonos: any[];
        }>();

        abonosList.forEach(item => {
            const sepId = item.separado_id;
            if (!map.has(sepId)) {
                map.set(sepId, {
                    separado_id: sepId,
                    cliente_id: item.cliente_id,
                    cliente_nombre: item.cliente_nombre || 'Cliente General',
                    cliente_documento: item.cliente_documento || '',
                    cliente_telefono: item.cliente_telefono || '',
                    separado_total: Number(item.separado_total || 0),
                    saldo_pendiente: Number(item.saldo_pendiente || 0),
                    separado_estado: item.separado_estado || 'Pendiente',
                    separado_fecha_creacion: item.separado_fecha_creacion || '',
                    total_abonado_en_rango: 0,
                    abonos: []
                });
            }
            const grupo = map.get(sepId)!;
            grupo.total_abonado_en_rango += Number(item.monto || 0);
            grupo.abonos.push(item);
        });

        return Array.from(map.values());
    }, [abonosList]);

    const fetchHistorialAbonos = () => {
        const request = ++historialRequest.current;
        setLoadingAbonos(true);
        const queryParams = new URLSearchParams();
        if (fechaDesdeAbono && fechaHastaAbono && fechaDesdeAbono === fechaHastaAbono) {
            queryParams.append("fecha", fechaDesdeAbono);
        } else {
            if (fechaDesdeAbono) queryParams.append("fecha_inicio", fechaDesdeAbono);
            if (fechaHastaAbono) queryParams.append("fecha_fin", fechaHastaAbono);
        }
        if (searchAbono.trim()) queryParams.append("search", searchAbono.trim());

        API.get(`/separados/historial-abonos?${queryParams.toString()}`)
            .then(res => {
                if (request !== historialRequest.current) return;
                setAbonosList(res.data.abonos || []);
                if (res.data.resumen_global) {
                    setResumenSeparados(res.data.resumen_global);
                }
                setLoadingAbonos(false);
            })
            .catch(err => {
                if (request !== historialRequest.current) return;
                console.error("Error cargando abonos:", err);
                setLoadingAbonos(false);
            });
    };

    useEffect(() => {
        if (seccionActiva === 'abonos_separados') {
            fetchHistorialAbonos();
            const refresh = () => fetchHistorialAbonos();
            window.addEventListener('focus', refresh);
            let disposed = false;
            let cleanup = () => {};
            import('../utils/socket').then(({ socket }) => {
                if (disposed) return;
                const events = ['abono_added', 'separado_updated', 'separado_created'];
                events.forEach(event => socket.on(event, refresh));
                cleanup = () => events.forEach(event => socket.off(event, refresh));
            });
            return () => { disposed = true; historialRequest.current++; cleanup(); window.removeEventListener('focus', refresh); };
        }
    }, [seccionActiva, fechaDesdeAbono, fechaHastaAbono, searchAbono]);

    const fetchFacturas = (p: number = page) => {
        setLoading(true);
        API.get(`/ventas?page=${p}&limit=${limit}&search=${searchTerm}&filtro=${filtroRapido}&tipo_factura=${filtroTipoFactura}`)
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
        const f = facturas.find(fac => fac.id === id);
        const tipo = f?.tipo_factura || 'POS';
        const numDisplay = tipo === 'ELECTRONICA' ? `${f?.prefijo || 'FE'}-${f?.consecutivo}` : `#${id}`;
        const motivo = window.prompt(`⚠️ ¿Anular factura ${numDisplay}? Se devolverá el stock.\n\nEscriba el motivo de la anulación:`);

        if (motivo === null) return; // Usuario canceló
        if (!motivo.trim()) return alert("Debe ingresar un motivo para anular la factura.");

        API.delete(`/ventas/${id}?tipo=${tipo}`, { data: { motivo_anulacion: motivo } })
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
            const f = facturas.find(fac => fac.id === id);
            const tipo = f?.tipo_factura || 'POS';
            API.get(`/ventas/${id}?tipo=${tipo}`)
                .then(res => {
                    setDetallesFactura(Array.isArray(res.data) ? res.data : []);
                    setMenuOpenId(null);
                    // Cargar teléfono del cliente
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

            <div className="no-print space-y-8">

                {/* Selector de Sección: Facturas vs Historial de Abonos */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit border border-slate-200 shadow-inner">
                    <button
                        onClick={() => setSeccionActiva('ventas')}
                        className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            seccionActiva === 'ventas'
                                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span>📑</span>
                        <span>Facturación de Ventas</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200/70 text-slate-700">
                            {totalRecords}
                        </span>
                    </button>
                    <button
                        onClick={() => setSeccionActiva('abonos_separados')}
                        className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                            seccionActiva === 'abonos_separados'
                                ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100'
                                : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <span>📋</span>
                        <span>Historial de Abonos / Separados</span>
                        {resumenSeparados.total_separados_activos > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 text-indigo-700 font-bold">
                                {resumenSeparados.total_separados_activos} Activos
                            </span>
                        )}
                    </button>
                </div>

                {seccionActiva === 'ventas' ? (
                    <>
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
                <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Filtro de Pago */}
                        <div className="flex flex-wrap p-1 bg-slate-100 rounded-2xl border border-slate-200">
                            {["Todas", "Efectivo", "Transferencia", "Tarjeta", "Addi", "Sistecredito", "Separado"].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFiltroRapido(f)}
                                    className={`px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-widest transition-all ${filtroRapido === f ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    {f === "Todas" ? "Todas" : f === "Transferencia" ? "Banco" : f}
                                </button>
                            ))}
                        </div>

                        {/* Filtro de Tipo de Factura */}
                        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                            {[
                                { val: "Todas", label: "Todos los Tipos" },
                                { val: "POS", label: "Solo POS" },
                                { val: "ELECTRONICA", label: "Solo Electrónica" }
                            ].map(f => (
                                <button
                                    key={f.val}
                                    onClick={() => setFiltroTipoFactura(f.val)}
                                    className={`px-4 py-2 rounded-xl text-xs font-medium uppercase tracking-widest transition-all ${filtroTipoFactura === f.val ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100' : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 bg-white border border-slate-200 px-4 py-2 rounded-full text-center">
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
                                                API.get(`/ventas/${f.id}?tipo=${f.tipo_factura}`)
                                                    .then(res => setDetallesFactura(Array.isArray(res.data) ? res.data : []))
                                                    .catch(console.error);
                                            }
                                        }}
                                    >
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 p-1">
                                            <span className="text-indigo-600 font-semibold text-[10px] text-center leading-tight">
                                                {f.tipo_factura === 'ELECTRONICA' ? `${f.prefijo || 'FE'}-${f.consecutivo}` : `#${f.id}`}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-[200px]">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-sm font-semibold text-slate-900 uppercase truncate">
                                                    {Number(f.cliente_id) === 1 ? "Cliente Mostrador" : (f.cliente || "Consumidor Final")}
                                                </h3>
                                                {f.tipo_factura === 'ELECTRONICA' ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 uppercase tracking-wider">Electrónica</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">POS</span>
                                                )}
                                            </div>
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

                                                    {f.tipo_factura !== 'ELECTRONICA' && (
                                                        <button
                                                            onClick={() => setCambioData({ factura: f, detalles: detallesFactura })}
                                                            className="w-full py-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl text-[10px] font-medium uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 mt-2"
                                                        >
                                                            <span>🔄</span> Cambiar Producto
                                                        </button>
                                                    )}

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
                            className={`px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${page === 1 ? 'bg-slate-100 text-slate-300' : 'bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 shadow-sm'
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
                            className={`px-4 py-2 rounded-xl text-[10px] font-medium uppercase tracking-widest transition-all ${page === totalPages ? 'bg-slate-100 text-slate-300' : 'bg-white text-indigo-600 border border-slate-200 hover:bg-indigo-50 shadow-sm'
                                }`}
                        >
                            Siguiente
                        </button>
                    </div>
                )}
                    </>
                ) : (
                    <>
                        {/* Historial de Abonos y Separados */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-slate-200">
                            <div className="space-y-1">
                                <h1 className="text-4xl font-medium tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
                                    Historial de Abonos de Separados
                                </h1>
                                <p className="text-slate-500 font-medium text-base">
                                    Rastreo de abonos por cliente, quién registró y sumatoria total de cartera en separados.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchHistorialAbonos()}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-indigo-600 shadow-sm transition-all"
                                >
                                    <span>🔄</span>
                                    <span>Actualizar</span>
                                </button>
                            </div>
                        </div>

                        {/* Metric Cards - Totales y Sumatorias */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* 1. Total en Separados */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total en Separados</span>
                                    <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm">📦</span>
                                </div>
                                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                                    {formatCOP(resumenSeparados.valor_total_separados || 0)}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                    Sumatoria global ({resumenSeparados.total_separados_registrados || 0} separados registrados)
                                </p>
                            </div>

                            {/* 2. Saldo Pendiente por Cobrar */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Saldo Pendiente</span>
                                    <span className="p-2 rounded-xl bg-amber-50 text-amber-600 text-sm">⏳</span>
                                </div>
                                <p className="text-2xl font-bold text-amber-600 tracking-tight">
                                    {formatCOP(resumenSeparados.saldo_total_pendiente || 0)}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                    Por cobrar en {resumenSeparados.total_separados_activos || 0} separados activos
                                </p>
                            </div>

                            {/* 3. Total Histórico Recaudado */}
                            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Total Recaudado</span>
                                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm">💰</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                                    {formatCOP(resumenSeparados.total_recaudado_historico || 0)}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                    Total recaudado en todos los abonos
                                </p>
                            </div>

                            {/* 4. Abonos del Filtro Actual */}
                            <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-3xl border border-indigo-200 shadow-sm relative overflow-hidden">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Abonos Consultados</span>
                                    <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700 text-sm">📅</span>
                                </div>
                                <p className="text-2xl font-bold text-indigo-700 tracking-tight">
                                    {formatCOP(abonosList.reduce((acc, a) => acc + Number(a.monto || 0), 0))}
                                </p>
                                <p className="text-[11px] text-indigo-500 mt-1 font-medium">
                                    {abonosList.length} abonos {
                                        fechaDesdeAbono && fechaHastaAbono && fechaDesdeAbono === fechaHastaAbono
                                            ? `el ${fechaDesdeAbono}`
                                            : fechaDesdeAbono && fechaHastaAbono
                                            ? `del ${fechaDesdeAbono} al ${fechaHastaAbono}`
                                            : fechaDesdeAbono
                                            ? `desde ${fechaDesdeAbono}`
                                            : fechaHastaAbono
                                            ? `hasta ${fechaHastaAbono}`
                                            : 'en el histórico completo'
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Filtros de Rango de Fechas (Desde - Hasta), Modos de Agrupación y Búsqueda */}
                        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
                                    <span className="text-xs font-semibold text-slate-500">📅 Desde:</span>
                                    <input
                                        type="date"
                                        value={fechaDesdeAbono}
                                        onChange={e => setFechaDesdeAbono(e.target.value)}
                                        className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
                                    <span className="text-xs font-semibold text-slate-500">Hasta:</span>
                                    <input
                                        type="date"
                                        value={fechaHastaAbono}
                                        onChange={e => setFechaHastaAbono(e.target.value)}
                                        className="bg-transparent text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                                    />
                                </div>
                                <button
                                    onClick={() => { setFechaDesdeAbono(hoyStr); setFechaHastaAbono(hoyStr); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        fechaDesdeAbono === hoyStr && fechaHastaAbono === hoyStr
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Hoy
                                </button>
                                <button
                                    onClick={() => { setFechaDesdeAbono(""); setFechaHastaAbono(""); }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        !fechaDesdeAbono && !fechaHastaAbono
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Todo
                                </button>

                                {/* Selector de Modo de Vista */}
                                <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setVistaAbonos('agrupado')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            vistaAbonos === 'agrupado'
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                        title="Agrupar abonos por Separado y Cliente"
                                    >
                                        <span>📁</span>
                                        <span>Por Separado / Cliente</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVistaAbonos('lista')}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                            vistaAbonos === 'lista'
                                                ? 'bg-white text-indigo-700 shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                        title="Ver lista corrida de abonos"
                                    >
                                        <span>📄</span>
                                        <span>Lista Corrida</span>
                                    </button>
                                </div>
                            </div>

                            <div className="relative flex-1 max-w-md">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente, documento o separado #..."
                                    value={searchAbono}
                                    onChange={e => setSearchAbono(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all text-sm font-medium text-slate-700"
                                />
                                {searchAbono && (
                                    <button
                                        onClick={() => setSearchAbono("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Contenedor de Historial de Abonos - Ajustado al espacio sin barra horizontal */}
                        <div className="w-full">
                            {loadingAbonos ? (
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-20 text-center space-y-4">
                                    <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                                    <p className="text-slate-400 font-medium uppercase tracking-widest text-[10px]">Cargando historial de abonos...</p>
                                </div>
                            ) : abonosList.length === 0 ? (
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm py-20 text-center space-y-3">
                                    <div className="text-5xl">📋</div>
                                    <h3 className="text-base font-bold text-slate-700">No se encontraron abonos registrados</h3>
                                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                                        {fechaDesdeAbono || fechaHastaAbono
                                            ? "No se registran abonos en el período seleccionado. Puedes ampliar el rango o pulsar 'Ver Todo'."
                                            : "No hay abonos que coincidan con los criterios de búsqueda."}
                                    </p>
                                    {(fechaDesdeAbono || fechaHastaAbono) && (
                                        <button
                                            onClick={() => { setFechaDesdeAbono(""); setFechaHastaAbono(""); }}
                                            className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                                        >
                                            Ver Todo el Histórico
                                        </button>
                                    )}
                                </div>
                            ) : vistaAbonos === 'agrupado' ? (
                                /* VISTA AGRUPADA POR CLIENTE / SEPARADO (Ajustada 100% al ancho, sin scrollbar horizontal) */
                                <div className="space-y-4">
                                    {abonosAgrupados.map(grupo => {
                                        const isExpanded = expandedSeparados[grupo.separado_id] !== false;
                                        const esAnulado = String(grupo.separado_estado).toLowerCase() === 'anulado';
                                        const estadoBadge = esAnulado
                                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                                            : grupo.separado_estado === 'ENTREGADO' || grupo.separado_estado === 'Pagado'
                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                            : 'bg-amber-100 text-amber-700 border-amber-200';

                                        const pctAbonado = grupo.separado_total > 0
                                            ? Math.min(100, Math.round(((grupo.separado_total - grupo.saldo_pendiente) / grupo.separado_total) * 100))
                                            : 0;

                                        return (
                                            <div key={grupo.separado_id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-indigo-300">
                                                {/* Cabecera del Separado / Cliente */}
                                                <div 
                                                    onClick={() => toggleExpandSeparado(grupo.separado_id)}
                                                    className="p-4 sm:p-5 bg-gradient-to-r from-slate-50/90 via-white to-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-black text-sm shadow-sm">
                                                            #{grupo.separado_id}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-slate-900 text-sm sm:text-base">{grupo.cliente_nombre}</h4>
                                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${estadoBadge}`}>
                                                                    {grupo.separado_estado}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                                                                {grupo.cliente_documento && `CC: ${grupo.cliente_documento}`}
                                                                {grupo.cliente_telefono && ` • Tel: ${grupo.cliente_telefono}`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Resumen Financiero del Separado */}
                                                    <div className="flex flex-wrap items-center gap-5 sm:gap-7 text-xs">
                                                        <div>
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total Separado</span>
                                                            <span className="font-extrabold text-slate-800 text-sm">{formatCOP(grupo.separado_total)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Abonado en Período</span>
                                                            <span className="font-extrabold text-emerald-600 text-sm">+{formatCOP(grupo.total_abonado_en_rango)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Saldo Pendiente</span>
                                                            <span className={`font-extrabold text-sm ${esAnulado ? 'text-slate-400' : grupo.saldo_pendiente > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                                                                {esAnulado ? '$0' : formatCOP(grupo.saldo_pendiente)}
                                                            </span>
                                                        </div>
                                                        <div className="hidden lg:block w-28">
                                                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                                                                <span>Progreso</span>
                                                                <span>{pctAbonado}%</span>
                                                            </div>
                                                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${pctAbonado}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Botón / Contador */}
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100">
                                                            {grupo.abonos.length} {grupo.abonos.length === 1 ? 'abono' : 'abonos'}
                                                        </span>
                                                        <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold transition-transform">
                                                            {isExpanded ? '▲' : '▼'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Abonos del Separado */}
                                                {isExpanded && (
                                                    <div className="divide-y divide-slate-100 bg-white">
                                                        {grupo.abonos.map((item: any) => {
                                                            const esDev = Number(item.monto) < 0 || String(item.metodo_pago).toLowerCase().includes('devolución');
                                                            return (
                                                                <div key={item.id} className="p-3.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-2 h-2 rounded-full ${esDev ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                                                        <div>
                                                                            <span className="font-semibold text-slate-700">{formatDateTime(item.fecha_pago)}</span>
                                                                            <span className="text-[11px] text-slate-400 block sm:inline sm:ml-2">
                                                                                👤 Cajero: <strong className="text-slate-600 font-medium">{item.cajero_nombre || 'Sistema'}</strong>
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-4">
                                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                                                            esDev
                                                                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                                : item.metodo_pago === 'Efectivo'
                                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                                : item.metodo_pago === 'Transferencia'
                                                                                ? 'bg-sky-50 text-sky-700'
                                                                                : item.metodo_pago === 'Sistecredito'
                                                                                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                                                : 'bg-purple-50 text-purple-700'
                                                                        }`}>
                                                                            {item.metodo_pago}
                                                                        </span>
                                                                        <div className="text-right min-w-[90px]">
                                                                            <span className={`text-sm font-black ${esDev ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                                {esDev ? '-' : '+'}{formatCOP(Math.abs(item.monto))}
                                                                            </span>
                                                                            {esDev && <span className="text-[9px] text-rose-500 block uppercase font-bold">Devolución</span>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* VISTA LISTA CONTINUA (Ajustada 100% al ancho sin forzar scrollbar) */
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="w-full text-left border-collapse table-auto">
                                        <thead>
                                            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                <th className="py-3 px-3">Fecha / Hora</th>
                                                <th className="py-3 px-2">Separado #</th>
                                                <th className="py-3 px-3">Cliente</th>
                                                <th className="py-3 px-3">Cajero</th>
                                                <th className="py-3 px-2">Método</th>
                                                <th className="py-3 px-3 text-right">Monto</th>
                                                <th className="py-3 px-3 text-right">Total Sep.</th>
                                                <th className="py-3 px-3 text-right">Saldo</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-xs">
                                            {abonosList.map((item: any) => {
                                                const esDevolucion = Number(item.monto) < 0 || String(item.metodo_pago).toLowerCase().includes('devolución');
                                                const esAnulado = String(item.separado_estado).toLowerCase() === 'anulado';
                                                const estadoColor = esDevolucion || esAnulado
                                                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                                                    : item.separado_estado === 'ENTREGADO' || item.separado_estado === 'Pagado'
                                                    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                                    : 'bg-amber-100 text-amber-700 border-amber-200';

                                                return (
                                                    <tr key={item.id} className={`transition-colors ${
                                                        esDevolucion
                                                            ? 'bg-rose-50/50 hover:bg-rose-50/80 border-l-4 border-l-rose-500'
                                                            : esAnulado
                                                            ? 'bg-slate-50/80 hover:bg-slate-100/80 border-l-4 border-l-rose-400'
                                                            : 'hover:bg-slate-50/60'
                                                    }`}>
                                                        <td className="py-3 px-3 font-medium text-slate-600">
                                                            {formatDateTime(item.fecha_pago)}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-slate-900">#{item.separado_id}</span>
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${estadoColor}`}>
                                                                    {esDevolucion ? 'DEV' : esAnulado ? 'ANUL' : item.separado_estado}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <div className="font-bold text-slate-900">{item.cliente_nombre || 'Cliente General'}</div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {item.cliente_documento && `CC: ${item.cliente_documento}`}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3 font-semibold text-slate-600">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                                                                👤 {item.cajero_nombre || 'Sistema'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                                                esDevolucion
                                                                    ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                                                    : item.metodo_pago === 'Efectivo'
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : item.metodo_pago === 'Transferencia'
                                                                    ? 'bg-sky-50 text-sky-700'
                                                                    : item.metodo_pago === 'Sistecredito'
                                                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                                                    : 'bg-purple-50 text-purple-700'
                                                            }`}>
                                                                {item.metodo_pago}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-black">
                                                            <span className={esDevolucion ? 'text-rose-600' : 'text-emerald-600'}>
                                                                {esDevolucion ? '-' : '+'}{formatCOP(Math.abs(item.monto))}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-bold text-slate-800">
                                                            {formatCOP(item.separado_total)}
                                                        </td>
                                                        <td className="py-3 px-3 text-right font-bold text-amber-600">
                                                            {esAnulado ? '$0' : formatCOP(item.saldo_pendiente)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Floating Button */}
                <button
                    onClick={() => window.location.href = "/"}
                    className="fixed bottom-10 right-10 w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center text-3xl font-semibold shadow-2xl hover:scale-110 active:scale-95 transition-all z-30"
                >+</button>
            </div>



            <div style={{ display: 'none' }}>
                {facturaPrintData && (
                    <PrintReceipt
                        ref={contentRef}
                        empresa={empresa}
                        numero={
                            facturaPrintData.cabecera.tipo_factura === 'ELECTRONICA'
                                ? `${facturaPrintData.cabecera.prefijo || 'FE'}-${String(facturaPrintData.cabecera.consecutivo || facturaPrintData.cabecera.id).padStart(6, '0')}`
                                : facturaPrintData.cabecera.id
                        }
                        fecha={facturaPrintData.cabecera.fecha}
                        cliente={Number(facturaPrintData.cabecera.cliente_id) === 1 ? "Fca. General / Mostrador" : (facturaPrintData.cabecera.cliente || "Consumidor Final")}
                        cajero={facturaPrintData.cabecera.cajero || "Principal"}
                        metodoPago={facturaPrintData.cabecera.metodo_pago}
                        items={facturaPrintData.detalles}
                        total={facturaPrintData.cabecera.total}
                        pagoEfectivoMixto={facturaPrintData.cabecera.metodo_pago === 'Mixto' ? facturaPrintData.cabecera.pago_efectivo : undefined}
                        pagoTransferenciaMixto={facturaPrintData.cabecera.metodo_pago === 'Mixto' ? facturaPrintData.cabecera.pago_transferencia : undefined}
                        tipoFactura={facturaPrintData.cabecera.tipo_factura === 'ELECTRONICA' ? 'ELECTRONICA' : 'POS'}
                        prefijo={facturaPrintData.cabecera.prefijo || undefined}
                    />
                )}
            </div>

            {cambioData && (
                <ModalCambioProducto
                    factura={cambioData.factura}
                    detalles={cambioData.detalles}
                    onClose={() => setCambioData(null)}
                    onExito={() => {
                        setCambioData(null);
                        fetchFacturas();
                    }}
                />
            )}

        </div>
    );
}

export default Facturas;
