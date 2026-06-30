import React, { useState } from 'react';

export const AbonoModal = ({ isOpen, onClose, cuenta, tipo, onAbonoGuardado }: any) => {
    const [monto, setMonto] = useState("");
    const [metodoPago, setMetodoPago] = useState("Efectivo");
    const [loading, setLoading] = useState(false);

    if (!isOpen || !cuenta) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onAbonoGuardado(cuenta.id, parseFloat(monto), metodoPago, tipo, cuenta.tipo_cxc);
        setLoading(false);
        setMonto("");
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-black text-slate-800">Registrar Abono a {tipo === 'cxc' ? 'Cliente' : 'Proveedor'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-amber-50 p-3 rounded-lg text-amber-800 text-sm flex justify-between items-center border border-amber-100">
                        <span className="font-semibold">Saldo Pendiente:</span>
                        <span className="font-black text-lg">${parseFloat(cuenta.saldo_pendiente).toLocaleString()}</span>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto a Abonar</label>
                        <input
                            type="number"
                            required
                            min="1"
                            max={cuenta.saldo_pendiente}
                            value={monto}
                            onChange={(e) => setMonto(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="Ej. 50000"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
                        <select
                            value={metodoPago}
                            onChange={(e) => setMetodoPago(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                            <option value="Efectivo">💵 Efectivo</option>
                            <option value="Transferencia">📱 Transferencia</option>
                            <option value="Tarjeta">💳 Tarjeta</option>
                        </select>
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-black uppercase tracking-wider hover:bg-indigo-700 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Procesando...' : 'Guardar Abono'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export const CrearDeudaModal = ({ isOpen, onClose, tipo, clientes, onGuardar }: any) => {
    const [clienteId, setClienteId] = useState("");
    const [proveedor, setProveedor] = useState("");
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const data = tipo === 'cxc' 
            ? { cliente_id: clienteId, monto_total: parseFloat(monto), fecha_vencimiento: fecha || null }
            : { proveedor: proveedor, monto_total: parseFloat(monto), fecha_vencimiento: fecha || null };
        await onGuardar(tipo, data);
        setLoading(false);
        setClienteId(""); setProveedor(""); setMonto(""); setFecha("");
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-black text-slate-800">Nueva Cuenta por {tipo === 'cxc' ? 'Cobrar' : 'Pagar'}</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">✕</button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {tipo === 'cxc' ? (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cliente</label>
                            <select
                                required
                                value={clienteId}
                                onChange={(e) => setClienteId(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                                <option value="">Seleccione un cliente...</option>
                                {clientes?.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.nombre} - {c.documento}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre del Proveedor</label>
                            <input
                                type="text"
                                required
                                value={proveedor}
                                onChange={(e) => setProveedor(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Ej. Distribuidora XYZ"
                            />
                        </div>
                    )}
                    
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
    );
};
