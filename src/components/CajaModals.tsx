import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCaja } from './CajaContext';
import { formatCOP } from '../utils/format';


export const AperturaCajaModal: React.FC = () => {
  const { abrirCaja } = useCaja();
  const [base, setBase] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!base || isNaN(Number(base))) return;

    setLoading(true);
    try {
      await abrirCaja(Number(base));
    } catch (error: any) {
      alert(error.response?.data?.error || "Error al abrir caja");
    } finally {
      setLoading(false);
    }

  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/98 backdrop-blur-2xl flex items-center justify-center p-4 overflow-y-auto">


      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in duration-300">

        <div className="bg-indigo-600 p-8 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <span className="text-3xl">💰</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Apertura de Caja</h2>
          <p className="text-indigo-100 text-sm mt-2">Ingresa el valor base para iniciar tu turno</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Efectivo Inicial (Base)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input
                type="text"
                value={base ? base.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setBase(val);
                }}
                placeholder="0"
                required
                autoFocus
                className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-indigo-100/30 focus:border-indigo-600 outline-none transition-all text-xl font-bold text-slate-700"
              />
            </div>
            <p className="text-[10px] text-slate-400 italic">Este valor corresponde al dinero físico con el que inicias el día.</p>
          </div>

          <button
            type="submit"
            disabled={loading || !base}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:translate-y-0 uppercase tracking-widest text-xs"
          >
            {loading ? "Iniciando..." : "Abrir Caja y Continuar"}
          </button>

          <button
            type="button"
            onClick={() => {
              localStorage.clear();
              window.location.href = '/login';
            }}
            className="w-full py-3 text-slate-400 font-bold hover:text-rose-500 transition-all uppercase tracking-widest text-[9px] mt-2"
          >
            Cerrar Sesión y Salir
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * CierreCajaModal — Módulo independiente de cierre de cajeros.
 * 
 * Características:
 * - Se renderiza en un portal outside the DOM hierarchy (completamente independiente)
 * - Sin control autónomo: no bloquea la UI, solo aparece cuando se abre
 * - Draggable: el usuario puede arrastrarlo libremente por la pantalla
 * - Se posiciona centrado por defecto
 * - z-index alto para estar siempre visible sobre todo
 */
export const CierreCajaModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void }> = ({ isOpen, onClose, onConfirm }) => {
  const { sesion, cerrarCaja, limpiarSesion, verificarEstado } = useCaja();
  const [reportado, setReportado] = useState('');
  const [loading, setLoading] = useState(false);

  // Cache sesion data so it survives after cerrarCaja clears the context
  const cachedSesion = useRef<any>(null);

  // --- Drag State ---
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Cache sesion when modal opens and sesion is available
  useEffect(() => {
    if (isOpen && sesion) {
      cachedSesion.current = sesion;
    }
  }, [isOpen, sesion]);

  // center and register socket
  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setReportado('');
      // Center on screen
      setPosition(null); // null = use CSS centering
      // Sincronizar datos automáticamente al abrir
      verificarEstado();

      // Socket Listeners for Real-time adjustments
      import("../utils/socket").then(({ socket }) => {
        socket.on("caja_movimiento", () => {
          console.log("[SOCKET CAJA]: Movimiento detectado, refrescando totales...");
          verificarEstado();
        });
      });
    }

    return () => {
      import("../utils/socket").then(({ socket }) => {
        socket.off("caja_movimiento");
      });
    };
  }, [isOpen]);

  // Center position calculation after mount
  useEffect(() => {
    if (isOpen && panelRef.current && position === null) {
      const rect = panelRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - rect.width) / 2;
      const centerY = (window.innerHeight - rect.height) / 2;
      setPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) });
    }
  }, [isOpen, position]);

  // --- Drag Handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    e.preventDefault();
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      // Clamp within viewport
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 600);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 400);
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Re-center helper
  const centerOnScreen = useCallback(() => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      setPosition({
        x: (window.innerWidth - rect.width) / 2,
        y: (window.innerHeight - rect.height) / 2
      });
    }
  }, []);

  // Use cached sesion so modal stays visible even after cerrarCaja
  const activeSesion = sesion || cachedSesion.current;
  if (!isOpen || !activeSesion) return null;

  // Handler for "Finalizar y salir" — clean session THEN redirect
  const handleFinalizar = () => {
    limpiarSesion();
    cachedSesion.current = null;
    onConfirm();
  };

  const handleCerrar = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!reportado || isNaN(Number(reportado))) return;

    setLoading(true);
    try {
      const data = await cerrarCaja(Number(reportado));
      if (data && data.success) {
        // Redirección directa al login tras éxito, eliminando el paso del resumen
        handleFinalizar();
      } else {
        throw new Error("Respuesta inválida del servidor");
      }
    } catch (error: any) {
      console.error("Error al cerrar caja:", error);
      if (window.confirm("No se pudo confirmar el cierre en el servidor. ¿Desea forzar el cierre de sesión y salir de todos modos?")) {
        handleFinalizar();
      }
    } finally {
      setLoading(false);
    }
  };

  const panelStyle: React.CSSProperties = position
    ? {
      position: 'fixed',
      left: `${position.x}px`,
      top: `${position.y}px`,
      zIndex: 9999,
      transition: isDragging ? 'none' : 'box-shadow 0.3s ease',
    }
    : {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
    };

  // --- Main Cierre Form ---
  const esperado = activeSesion.valor_esperado;
  const diferencia = reportado ? Number(reportado) - esperado : 0;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        style={panelStyle}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
      >
        {/* Elevated shadow for floating effect */}
        <div
          className="rounded-[40px] overflow-hidden flex-1 flex flex-col md:flex-row bg-white border border-slate-200/50 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.4)]"
        >
            <div
              onMouseDown={handleMouseDown}
              className="w-full md:w-[35%] bg-[#1a1c2e] p-8 md:p-10 text-white flex flex-col justify-between select-none relative overflow-hidden"
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {/* Decorative Background Element */}
              <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10">
                {/* Drag indicator bar */}
                <div className="flex justify-center mb-5 md:justify-start">
                  <div className="w-14 h-1.5 bg-white/25 rounded-full" />
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md">
                    <span className="text-3xl">🔐</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={verificarEstado}
                      className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
                      title="Refrescar datos"
                      type="button"
                    >
                      <span className="text-sm">🔄</span>
                    </button>
                    <button
                      onClick={centerOnScreen}
                      className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/20 hover:text-white transition-all"
                      title="Centrar en pantalla"
                      type="button"
                    >
                      <span className="text-sm">⊞</span>
                    </button>
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-black tracking-tighter leading-tight mb-2 uppercase italic">Cierre de<br />Sesión</h2>
                <div className="h-1 w-12 bg-indigo-500 rounded-full mt-4" />
                <p className="text-indigo-200/50 text-[9px] font-bold uppercase tracking-[0.3em] mt-3 italic">Control Administrativo</p>
              </div>

              <div className="space-y-1 mt-6">
                <div className="p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-emerald-900/40">💵</div>
                    <p className="text-[7px] uppercase tracking-[0.2em] opacity-60 font-black">Efectivo</p>
                  </div>
                  <p className="text-xl font-black text-white tracking-tighter italic">{formatCOP(activeSesion.total_efectivo || 0)}</p>
                </div>

                <div className="p-3 bg-white/5 rounded-xl border border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-sky-500 rounded-lg flex items-center justify-center text-sm shadow-lg shadow-sky-900/40">📱</div>
                    <p className="text-[7px] uppercase tracking-[0.2em] opacity-60 font-black">Digital</p>
                  </div>
                  <p className="text-xl font-black text-white tracking-tighter italic">{formatCOP(activeSesion.total_transferencia || 0)}</p>
                </div>

                <div className="grid grid-cols-2 gap-5 mt-10 pt-8 border-t border-white/10">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl border border-white/5">
                    <p className="text-[8px] uppercase tracking-widest opacity-60 font-bold mb-1">Total Bruto</p>
                    <p className="text-sm font-black">{formatCOP(activeSesion.total_ventas || 0)}</p>
                  </div>
                  <div className="p-3 bg-indigo-500/20 rounded-2xl border border-white/5">
                    <p className="text-[8px] uppercase tracking-widest opacity-60 font-bold mb-1">Base Caja</p>
                    <p className="text-sm font-black">{formatCOP(activeSesion.base_caja || 0)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 mt-6">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-white/5 text-center">
                    <p className="text-[7px] uppercase tracking-widest opacity-60 font-bold mb-0.5">Ingresos</p>
                    <p className="text-xs font-black text-emerald-300">+{formatCOP(activeSesion.total_ingresos || 0)}</p>
                  </div>
                  <div className="p-2 bg-rose-500/10 rounded-xl border border-white/5 text-center">
                    <p className="text-[7px] uppercase tracking-widest opacity-60 font-bold mb-0.5">Salidas</p>
                    <p className="text-xs font-black text-rose-300">-{formatCOP(activeSesion.total_salidas || 0)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lado Derecho: Formulario y Detalle Scrolleable */}
            <div className="flex-1 bg-white flex flex-col min-h-0">
              <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sesión de Caja Activa</span>
                 </div>
                 <button
                    type="button"
                    onClick={onClose}
                    className="w-10 h-10 hover:bg-rose-50 hover:text-rose-500 text-slate-300 rounded-xl transition-all flex items-center justify-center text-xl"
                 >
                    ✕
                 </button>
              </div>

              <form onSubmit={handleCerrar} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-200 shadow-sm group hover:border-blue-400 transition-all">
                    <p className="text-[7px] font-black text-blue-600 uppercase tracking-widest mb-0.5">Base Inicial</p>
                    <p className="text-base font-black text-blue-800 italic leading-none">{formatCOP(activeSesion.base_caja)}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-200 shadow-sm group hover:border-emerald-400 transition-all">
                    <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Efectivo en Caja</p>
                    <p className="text-base font-black text-emerald-800 italic leading-none">{formatCOP(activeSesion.total_efectivo || 0)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-center">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-4 block italic">Conteo de Efectivo Físico</label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-indigo-600/5 rounded-[32px] blur-xl group-focus-within:bg-indigo-600/10 transition-all" />
                      <div className="relative">
                        <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">$</span>
                        <input
                          type="text"
                          value={reportado ? reportado.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setReportado(val);
                          }}
                          placeholder="0"
                          required
                          autoFocus
                          className="w-full pl-10 pr-6 py-2.5 bg-white border-2 border-blue-400 rounded-2xl text-2xl font-black text-blue-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-center tracking-tighter shadow-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-200 text-center">
                      <p className="text-[7px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Valor Esperado</p>
                      <p className="text-base font-black text-blue-700 tracking-tighter italic leading-none">{formatCOP(esperado)}</p>
                    </div>
                    <div className={`p-3 rounded-2xl border text-center transition-all ${diferencia === 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                      <p className="text-[7px] font-bold uppercase tracking-widest mb-0.5 opacity-70">Diferencia</p>
                      <p className="text-base font-black tracking-tighter italic leading-none">{formatCOP(diferencia)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 rounded-2xl p-4 border border-blue-200 flex items-center gap-3">
                   <span className="text-xl">💡</span>
                   <p className="text-[10px] text-blue-800 leading-tight font-bold italic">
                      Verifique el conteo físico antes de confirmar el cierre definitivo del turno.
                   </p>
                </div>
              </form>

              <div className="p-8 md:px-12 md:pb-10 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-4">
                <button
                  type="button"
                  onClick={handleCerrar}
                  disabled={loading || !reportado}
                  className="w-full py-5 bg-[#1a1c2e] text-white font-black rounded-[24px] shadow-2xl hover:bg-indigo-600 transition-all active:scale-95 text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>CERRAR TURNO Y GENERAR REPORTE <span className="text-lg">🔐</span></>
                  )}
                </button>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.4em] text-center">Seguridad Bancaria Activada</p>
              </div>
            </div>
          </div>
        </div>
    </>,
    document.body
  );
};

export const MovimientoCajaModal: React.FC<{ isOpen: boolean; onClose: () => void; tipo: 'Ingreso' | 'Salida' }> = ({ isOpen, onClose, tipo }) => {
  const { sesion, registrarMovimiento } = useCaja();
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !sesion) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monto || !descripcion || isNaN(Number(monto))) return;

    if (!window.confirm(`¿Seguro que deseas registrar este ${tipo} de ${formatCOP(monto)}?`)) return;

    setLoading(true);
    try {
      await registrarMovimiento({
        tipo,
        monto: Number(monto),
        descripcion,
        sesion_caja_id: sesion.id
      });
      alert("✅ Movimiento registrado exitosamente");
      setMonto('');
      setDescripcion('');
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || "Error al registrar movimiento");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[42px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in duration-300">
        <div className={`p-8 text-white ${tipo === 'Ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <div className="flex justify-between items-start">
             <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <span className="text-2xl">{tipo === 'Ingreso' ? '📥' : '📤'}</span>
             </div>
             <button onClick={onClose} className="text-2xl text-white/50 hover:text-white transition-colors">&times;</button>
          </div>
          <h2 className="text-3xl font-black tracking-tighter mt-4 uppercase">Gestionar {tipo}</h2>
          <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Ajuste manual de fondo de caja</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Monto del {tipo} ($)</label>
            <input
              type="text"
              value={monto ? monto.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : ''}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setMonto(val);
              }}
              placeholder="0"
              required
              autoFocus
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-slate-100 focus:border-slate-900 outline-none transition-all text-2xl font-black text-slate-800"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Motivo / Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={tipo === 'Ingreso' ? "Ej: Reposición de base, billete falso cambiado, etc." : "Ej: Pago transporte, compra papelería, servicios, etc."}
              required
              rows={3}
              className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-slate-100 focus:border-slate-900 outline-none transition-all text-sm font-medium text-slate-700 resize-none"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !monto || !descripcion}
              className={`w-full py-5 text-white font-black rounded-[24px] shadow-xl transition-all active:scale-95 uppercase tracking-widest text-xs disabled:opacity-50 ${
                tipo === 'Ingreso' 
                  ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700' 
                  : 'bg-rose-600 shadow-rose-100 hover:bg-rose-700'
              }`}
            >
              {loading ? "Registrando..." : `Confirmar ${tipo} de Dinero`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest"
            >
              Cancelar Operación
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
