import React, { useState, useEffect } from 'react';
import { getCxC, getCxP, createCxC, createCxP, registerAbonoCxC, registerAbonoCxP, uploadSoporteCxP } from '../api/cartera';
import API from '../api/api';
import { AbonoModal } from '../components/CarteraModals';
import { useCaja } from '../components/CajaContext';
import { QuickProveedorModal } from '../components/QuickProveedorModal';
import { QuickCustomerModal } from '../components/QuickCustomerModal';

const CrearDeudaCxCModal = ({ isOpen, onClose, clientes, onGuardar }: any) => {
    const [clienteSearch, setClienteSearch] = useState("");
    const [selectedClienteId, setSelectedClienteId] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState("");
    const [loading, setLoading] = useState(false);
    const [quickModalOpen, setQuickModalOpen] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        let targetId = selectedClienteId;
        if (!targetId) {
            const exactMatch = clientes.find((c: any) => 
                c.nombre?.toLowerCase() === clienteSearch.toLowerCase() || 
                c.documento === clienteSearch
            );
            if (exactMatch) {
                targetId = exactMatch.id;
            } else {
                alert("Por favor selecciona un cliente válido de la lista o créalo usando el botón '+'.");
                return;
            }
        }

        setLoading(true);
        await onGuardar('cxc', { cliente_id: targetId, monto_total: parseFloat(monto), fecha_vencimiento: fecha || null });
        setLoading(false);
        setClienteSearch(""); setSelectedClienteId(""); setMonto(""); setFecha("");
        onClose();
    };

    const filteredClientes = clientes.filter((c: any) => {
        const nombre = c.nombre || "";
        const doc = c.documento || "";
        return nombre.toLowerCase().includes(clienteSearch.toLowerCase()) || doc.includes(clienteSearch);
    }).slice(0, 15);

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-lg font-black text-slate-800">Nueva Cuenta por Cobrar</h2>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">✕</button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente (Búsqueda Manual)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        required
                                        value={clienteSearch}
                                        onChange={(e) => {
                                            setClienteSearch(e.target.value);
                                            setSelectedClienteId("");
                                            setShowDropdown(true);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all"
                                        placeholder="Nombre o Documento..."
                                        autoComplete="off"
                                    />
                                    {showDropdown && clienteSearch.length > 0 && (
                                        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
                                            {filteredClientes.length > 0 ? (
                                                filteredClientes.map((c: any) => (
                                                    <li 
                                                        key={c.id}
                                                        onClick={() => {
                                                            setClienteSearch(c.nombre || "");
                                                            setSelectedClienteId(c.id);
                                                            setShowDropdown(false);
                                                        }}
                                                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                                    >
                                                        <div className="font-bold text-slate-800 text-xs uppercase">{c.nombre}</div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Doc: {c.documento}</div>
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="px-4 py-3 text-xs text-slate-500 italic font-medium">No se encontraron clientes</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setQuickModalOpen(true)}
                                    title="Crear nuevo cliente"
                                    className="w-[46px] shrink-0 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl flex items-center justify-center transition-all border border-indigo-100 font-black text-lg"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto Total</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Ej. 150000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha de Vencimiento (Opcional)</label>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-black uppercase tracking-wider hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Crear Deuda'}
                        </button>
                    </form>
                </div>
            </div>
            
            <QuickCustomerModal 
                isOpen={quickModalOpen}
                onClose={() => setQuickModalOpen(false)}
                onCustomerCreated={(c: any) => {
                    setClienteSearch(c.nombre || "");
                    setSelectedClienteId(c.id);
                    setQuickModalOpen(false);
                }}
            />
        </>
    );
};

const CrearDeudaCxPModal = ({ isOpen, onClose, proveedores, onGuardar }: any) => {
    const [proveedorSearch, setProveedorSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState("");
    const [loading, setLoading] = useState(false);
    const [quickModalOpen, setQuickModalOpen] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onGuardar('cxp', { proveedor: proveedorSearch, monto_total: parseFloat(monto), fecha_vencimiento: fecha || null });
        setLoading(false);
        setProveedorSearch(""); setMonto(""); setFecha("");
        onClose();
    };

    const filteredProveedores = proveedores.filter((p: any) => 
        p.nombre_comercial.toLowerCase().includes(proveedorSearch.toLowerCase()) || 
        (p.nit && p.nit.includes(proveedorSearch))
    ).slice(0, 15);

    return (
        <>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h2 className="text-lg font-black text-slate-800">Nueva Cuenta por Pagar</h2>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">✕</button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Proveedor (Búsqueda Manual)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        required
                                        value={proveedorSearch}
                                        onChange={(e) => {
                                            setProveedorSearch(e.target.value);
                                            setShowDropdown(true);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all"
                                        placeholder="Escribe el nombre o NIT..."
                                        autoComplete="off"
                                    />
                                    {showDropdown && proveedorSearch.length > 0 && (
                                        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto scrollbar-thin">
                                            {filteredProveedores.length > 0 ? (
                                                filteredProveedores.map((p: any) => (
                                                    <li 
                                                        key={p.id}
                                                        onClick={() => {
                                                            setProveedorSearch(p.nombre_comercial);
                                                            setShowDropdown(false);
                                                        }}
                                                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                                                    >
                                                        <div className="font-bold text-slate-800 text-xs uppercase">{p.nombre_comercial}</div>
                                                        {p.nit && <div className="text-[10px] text-slate-400 mt-0.5 font-medium">NIT: {p.nit}</div>}
                                                    </li>
                                                ))
                                            ) : (
                                                <li className="px-4 py-3 text-xs text-slate-500 italic font-medium">No se encontraron resultados</li>
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setQuickModalOpen(true)}
                                    title="Crear nuevo proveedor"
                                    className="w-[46px] shrink-0 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl flex items-center justify-center transition-all border border-indigo-100 font-black text-lg"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto Total</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={monto}
                                onChange={(e) => setMonto(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Ej. 150000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha de Vencimiento (Opcional)</label>
                            <input
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-black uppercase tracking-wider hover:bg-emerald-700 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Crear Deuda'}
                        </button>
                    </form>
                </div>
            </div>
            
            <QuickProveedorModal 
                isOpen={quickModalOpen}
                onClose={() => setQuickModalOpen(false)}
                onProveedorCreated={(p: any) => {
                    setProveedor(p.nombre_comercial);
                    // Also trigger a refresh of the providers list indirectly, 
                    // though for this modal just setting the text is enough to save.
                    setQuickModalOpen(false);
                }}
            />
        </>
    );
};

const Cartera = () => {
    const [tab, setTab] = useState<'cxc' | 'cxp'>('cxc');
    const [cxcList, setCxcList] = useState<any[]>([]);
    const [cxpList, setCxpList] = useState<any[]>([]);
    const [clientes, setClientes] = useState<any[]>([]);
    const [proveedores, setProveedores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals state
    const [abonoModal, setAbonoModal] = useState<{ isOpen: boolean, cuenta: any }>({ isOpen: false, cuenta: null });
    const [deudaModal, setDeudaModal] = useState(false);

    const { sesion } = useCaja();
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [uploadingId, setUploadingId] = useState<number | null>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [resCxC, resCxP, resClientes, resProveedores] = await Promise.all([
                getCxC(),
                getCxP(),
                API.get('/clientes'),
                API.get('/proveedores')
            ]);
            setCxcList(resCxC.data);
            setCxpList(resCxP.data);
            setClientes(resClientes.data);
            setProveedores(resProveedores.data);
        } catch (err) {
            console.error("Error loading cartera", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAbonoGuardado = async (id: number, monto: number, metodoPago: string, tipo: 'cxc' | 'cxp', tipoCxc?: string) => {
        try {
            const payload = { monto, metodo_pago: metodoPago, sesion_caja_id: sesion?.id };
            if (tipo === 'cxc') {
                if (tipoCxc === 'separado') {
                    await API.post(`/separados/${id}/abonos`, payload);
                } else {
                    await registerAbonoCxC(id, payload);
                }
            } else {
                await registerAbonoCxP(id, payload);
            }
            await loadData();
        } catch (error) {
            alert("Error al registrar abono");
        }
    };

    const handleDeudaGuardada = async (tipo: 'cxc' | 'cxp', data: any) => {
        try {
            if (tipo === 'cxc') {
                await createCxC(data);
            } else {
                await createCxP(data);
            }
            await loadData();
        } catch (error) {
            alert("Error al crear deuda");
        }
    };

    const handleSoporteClick = (id: number) => {
        setUploadingId(id);
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadingId) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("El archivo es muy pesado. Máximo 2MB.");
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = reader.result as string;
            try {
                await uploadSoporteCxP(uploadingId, base64);
                alert("Soporte cargado exitosamente.");
                loadData();
            } catch (error) {
                alert("El archivo es muy pesado. Máximo 50MB.");
            } finally {
                setUploadingId(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        };
    };

    const getStatusBadge = (estado: string) => {
        switch (estado) {
            case 'Pagada':
            case 'Pagado': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">{estado}</span>;
            case 'Vencida': return <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Vencida</span>;
            default: return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Pendiente</span>;
        }
    };

    const renderTable = (tipo: 'cxc' | 'cxp') => {
        const data = (tipo === 'cxc' ? cxcList : cxpList).filter(item => item.estado !== 'Pagada' && item.estado !== 'Pagado');

        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">{tipo === 'cxc' ? 'Cliente' : 'Proveedor'}</th>
                                <th className="px-6 py-4">Origen</th>
                                <th className="px-6 py-4 text-right">Monto Total</th>
                                <th className="px-6 py-4 text-right">Saldo Pendiente</th>
                                <th className="px-6 py-4 text-center">Estado</th>
                                <th className="px-6 py-4 text-right">Vencimiento</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                            {data.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-400">#{item.id}</td>
                                    <td className="px-6 py-4 font-bold text-slate-800">{tipo === 'cxc' ? item.cliente_nombre : item.proveedor}</td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {tipo === 'cxc'
                                            ? (item.tipo_cxc === 'separado' ? `Separado #${item.id}` : (item.factura_venta_id_real ? `Factura Venta #${item.factura_venta_id_real}` : 'Manual'))
                                            : (item.factura_compra_id ? `Factura Compra #${item.numero_factura || item.factura_compra_id}` : 'Manual')
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold">${parseFloat(item.monto_total).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-black text-rose-600">${parseFloat(item.saldo_pendiente).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">{getStatusBadge(item.estado)}</td>
                                    <td className="px-6 py-4 text-right text-xs text-slate-500">
                                        {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {item.estado !== 'Pagada' && item.estado !== 'Pagado' && (
                                            <button
                                                onClick={() => setAbonoModal({ isOpen: true, cuenta: item })}
                                                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors"
                                            >
                                                Abonar
                                            </button>
                                        )}
                                        {tipo === 'cxp' && (
                                            item.soporte_url ? (
                                                <button
                                                    onClick={() => {
                                                        const newWindow = window.open();
                                                        if (newWindow) newWindow.document.write(`<iframe src="${item.soporte_url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                    }}
                                                    className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors inline-flex items-center"
                                                    title="Ver Soporte"
                                                >
                                                    📄 Ver
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleSoporteClick(item.id)}
                                                    className="ml-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors inline-flex items-center"
                                                    title="Subir Soporte"
                                                >
                                                    {uploadingId === item.id ? '⌛' : '📎 Soporte'}
                                                </button>
                                            )
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400 font-semibold">
                                        No hay registros en esta cartera.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">📒</span>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Gestión de Cartera</h1>
                    </div>
                    <p className="text-slate-500 font-medium text-sm md:text-base">Administra tus Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP).</p>
                </div>

                <button
                    onClick={() => setDeudaModal(true)}
                    className="relative z-10 w-full md:w-auto bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider hover:bg-indigo-600 hover:-translate-y-0.5 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-2"
                >
                    <span>➕</span>
                    Nueva {tab === 'cxc' ? 'Deuda a Cliente' : 'Deuda a Proveedor'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-200/50 rounded-2xl w-fit">
                <button
                    onClick={() => setTab('cxc')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'cxc' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                    Cuentas por Cobrar (CxC)
                </button>
                <button
                    onClick={() => setTab('cxp')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'cxp' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}
                >
                    Cuentas por Pagar (CxP)
                </button>
            </div>

            {/* Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-6 rounded-2xl border ${tab === 'cxc' ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className={`text-xs font-black uppercase tracking-wider mb-1 ${tab === 'cxc' ? 'text-indigo-600/70' : 'text-emerald-600/70'}`}>
                        Total Saldo Pendiente {tab === 'cxc' ? '(Por Cobrar)' : '(Por Pagar)'}
                    </p>
                    <p className={`text-3xl font-black ${tab === 'cxc' ? 'text-indigo-700' : 'text-emerald-700'}`}>
                        ${(tab === 'cxc' ? cxcList : cxpList)
                            .filter(i => i.estado !== 'Pagada')
                            .reduce((acc, curr) => acc + parseFloat(curr.saldo_pendiente), 0)
                            .toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Table Content */}
            {loading ? (
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin text-4xl">⏳</div>
                </div>
            ) : (
                renderTable(tab)
            )}

            <AbonoModal
                isOpen={abonoModal.isOpen}
                cuenta={abonoModal.cuenta}
                tipo={tab}
                onClose={() => setAbonoModal({ isOpen: false, cuenta: null })}
                onAbonoGuardado={handleAbonoGuardado}
            />

            {tab === 'cxc' ? (
                <CrearDeudaCxCModal
                    isOpen={deudaModal}
                    clientes={clientes}
                    onClose={() => setDeudaModal(false)}
                    onGuardar={async (t: 'cxc' | 'cxp', data: any) => {
                        await handleDeudaGuardada(t, data);
                        API.get('/clientes').then(res => setClientes(res.data));
                    }}
                />
            ) : (
                <CrearDeudaCxPModal
                    isOpen={deudaModal}
                    proveedores={proveedores}
                    onClose={() => setDeudaModal(false)}
                    onGuardar={async (t: 'cxc' | 'cxp', data: any) => {
                        await handleDeudaGuardada(t, data);
                        API.get('/proveedores').then(res => setProveedores(res.data));
                    }}
                />
            )}

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*,.pdf"
                onChange={handleFileChange}
            />

        </div>
    );
};

export default Cartera;
