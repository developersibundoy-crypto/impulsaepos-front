import React, { useState, useEffect, useCallback } from 'react';
import API from "../api/api";

interface RuletaDescuentosProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Premio {
  id: number;
  nombre: string;
  descripcion: string;
  cantidad_disponible: number;
  cantidad_max_ganadores: number | null;
  estado: "Activo" | "Inactivo";
  imagen: string | null;
  orden_entrega: number;
  fecha_vigencia: string | null;
}

interface ClienteSorteo {
  id: number;
  nombre: string;
  telefono: string;
  documento: string;
  ya_gano: number;
  premio_ganado: string | null;
  fecha_premio: string | null;
  estado_entrega: string | null;
}

interface HistorialEntry {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  premio_id: number | null;
  premio_nombre: string | null;
  fecha: string;
  hora: string;
  usuario_id: number;
  usuario_nombre: string;
  numero_sorteo: number;
  estado_entrega: "Pendiente" | "Entregado";
  imagen: string | null;
}

interface SorteoEstado {
  config: any;
  premiosActivos: number;
  premiosDisponibles: number;
  totalGiros: number;
  totalGanadores: number;
  clientesDisponibles: number;
}

const COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#f97316"
];

interface SorteoConfigDB {
  id: number;
  empresa_id: number;
  estado: string;
  numero_sorteo: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  filtro_monto_min: number | null;
  filtro_compras_min: number | null;
  filtro_fecha_inicio: string | null;
  filtro_fecha_fin: string | null;
}

type TabView = "ruleta" | "premios" | "historial" | "config";

export const RuletaDescuentos: React.FC<RuletaDescuentosProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabView>("ruleta");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Premios ────────────────────────────────────────────────
  const [premios, setPremios] = useState<Premio[]>([]);
  const [showPremioForm, setShowPremioForm] = useState(false);
  const [editingPremio, setEditingPremio] = useState<Premio | null>(null);
  const [premioForm, setPremioForm] = useState({ nombre: "", descripcion: "", cantidad_disponible: 1, cantidad_max_ganadores: "", estado: "Activo" as "Activo" | "Inactivo", imagen: "", orden_entrega: 0, fecha_vigencia: "" });

  // ─── Clientes ───────────────────────────────────────────────
  const [clientes, setClientes] = useState<ClienteSorteo[]>([]);

  // ─── Sorteo ─────────────────────────────────────────────────
  const [estado, setEstado] = useState<SorteoEstado | null>(null);
  const [historial, setHistorial] = useState<HistorialEntry[]>([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultado, setResultado] = useState<{ cliente: { id: number; nombre: string }; premio: { id: number; nombre: string }; fecha: string; hora: string; numero_sorteo: number } | null>(null);
  const [showResult, setShowResult] = useState(false);

  // ─── Participantes actuales para la ruleta ──────────────────
  const [participantes, setParticipantes] = useState<ClienteSorteo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ─── Configuración ──────────────────────────────────────────
  const [config, setConfig] = useState<SorteoConfigDB | null>(null);
  const [configForm, setConfigForm] = useState({
    filtro_monto_min: "",
    filtro_compras_min: "",
    filtro_fecha_inicio: "",
    filtro_fecha_fin: ""
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // ─── Filtros ────────────────────────────────────────────────
  const [filtroGanador, setFiltroGanador] = useState("todos");
  const [historialStartDate, setHistorialStartDate] = useState("");
  const [historialEndDate, setHistorialEndDate] = useState("");

  // ─── Cargar datos iniciales ─────────────────────────────────
  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      API.get("/sorteo/premios"),
      API.get("/sorteo/clientes"),
      API.get("/sorteo/estado"),
      API.get("/sorteo/historial")
    ]).then(([premiosRes, clientesRes, estadoRes, historialRes]) => {
      setPremios(premiosRes.data);
      setClientes(clientesRes.data);
      setEstado(estadoRes.data);
      setHistorial(historialRes.data);
      const disponibles = clientesRes.data.filter((c: ClienteSorteo) => !c.ya_gano);
      setParticipantes(disponibles);
      setCurrentIndex(0);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setError("Error cargando datos del sorteo");
      setLoading(false);
    });
  }, []);

  const fetchHistorial = useCallback(() => {
    const params = new URLSearchParams();
    if (historialStartDate) params.append("startDate", historialStartDate);
    if (historialEndDate) params.append("endDate", historialEndDate);
    API.get(`/sorteo/historial?${params.toString()}`).then(res => {
      setHistorial(res.data);
    }).catch(console.error);
  }, [historialStartDate, historialEndDate]);

  const fetchConfig = useCallback(() => {
    API.get("/sorteo/config").then(res => {
      const c = res.data;
      setConfig(c);
      if (c) {
        setConfigForm({
          filtro_monto_min: c.filtro_monto_min?.toString() || "",
          filtro_compras_min: c.filtro_compras_min?.toString() || "",
          filtro_fecha_inicio: c.filtro_fecha_inicio || "",
          filtro_fecha_fin: c.filtro_fecha_fin || ""
        });
      }
    }).catch(console.error);
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await API.post("/sorteo/config", {
        filtro_monto_min: configForm.filtro_monto_min ? parseFloat(configForm.filtro_monto_min) : null,
        filtro_compras_min: configForm.filtro_compras_min ? parseInt(configForm.filtro_compras_min) : null,
        filtro_fecha_inicio: configForm.filtro_fecha_inicio || null,
        filtro_fecha_fin: configForm.filtro_fecha_fin || null
      });
      await fetchConfig();
      await fetchAll();
    } catch (err) {
      console.error(err);
      setError("Error guardando configuración");
    }
    setSavingConfig(false);
  };

  useEffect(() => {
    if (isOpen) fetchHistorial();
  }, [historialStartDate, historialEndDate, fetchHistorial]);

  useEffect(() => {
    if (isOpen) {
      fetchAll();
      fetchConfig();
      setResultado(null);
      setShowResult(false);
      setRotation(0);
    }
  }, [isOpen, fetchAll, fetchConfig]);

  if (!isOpen) return null;

  // ─── Gestión de premios ─────────────────────────────────────

  const resetPremioForm = () => {
    setPremioForm({ nombre: "", descripcion: "", cantidad_disponible: 1, cantidad_max_ganadores: "", estado: "Activo", imagen: "", orden_entrega: 0, fecha_vigencia: "" });
    setEditingPremio(null);
    setShowPremioForm(false);
  };

  const handleEditPremio = (p: Premio) => {
    setEditingPremio(p);
    setPremioForm({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      cantidad_disponible: p.cantidad_disponible,
      cantidad_max_ganadores: p.cantidad_max_ganadores?.toString() || "",
      estado: p.estado,
      imagen: p.imagen || "",
      orden_entrega: p.orden_entrega,
      fecha_vigencia: p.fecha_vigencia || ""
    });
    setShowPremioForm(true);
  };

  const handleSavePremio = async () => {
    if (!premioForm.nombre.trim()) return;
    setLoading(true);
    try {
      const body = {
        ...premioForm,
        cantidad_max_ganadores: premioForm.cantidad_max_ganadores ? parseInt(premioForm.cantidad_max_ganadores) : null,
        fecha_vigencia: premioForm.fecha_vigencia || null
      };
      if (editingPremio) {
        await API.put(`/sorteo/premios/${editingPremio.id}`, body);
      } else {
        await API.post("/sorteo/premios", body);
      }
      resetPremioForm();
      const res = await API.get("/sorteo/premios");
      setPremios(res.data);
    } catch (err) {
      console.error(err);
      setError("Error guardando premio");
    }
    setLoading(false);
  };

  const handleDeletePremio = async (id: number) => {
    if (!window.confirm("¿Eliminar este premio?")) return;
    try {
      await API.delete(`/sorteo/premios/${id}`);
      const res = await API.get("/sorteo/premios");
      setPremios(res.data);
    } catch (err) {
      console.error(err);
      setError("Error eliminando premio");
    }
  };

  // ─── Lógica del giro ────────────────────────────────────────

  const handleSpin = async () => {
    if (isSpinning) return;
    setError(null);

    const disponibles = participantes.filter(c => !c.ya_gano);
    if (disponibles.length === 0) {
      setError("No hay clientes disponibles para participar");
      return;
    }

    const premiosActivos = premios.filter(p => p.estado === "Activo" && p.cantidad_disponible > 0);
    if (premiosActivos.length === 0) {
      setError("No hay premios activos disponibles");
      return;
    }

    // Pick next client in order
    const idx = currentIndex % disponibles.length;
    const cliente = disponibles[idx];
    setCurrentIndex(idx + 1);

    setIsSpinning(true);
    setResultado(null);
    setShowResult(false);

    try {
      const res = await API.post("/sorteo/girar", { cliente_id: cliente.id });
      const data = res.data;

      // Animate the wheel
      const sliceAngle = 360 / participantes.length;
      const targetAngle = (participantes.length - idx) * sliceAngle;
      const spins = Math.floor(Math.random() * 5) + 5;
      const randomOffset = (Math.random() * sliceAngle * 0.8) - (sliceAngle * 0.4);
      const finalRotation = rotation + (spins * 360) + targetAngle - (rotation % 360) + randomOffset;
      setRotation(finalRotation);

      setTimeout(() => {
        setIsSpinning(false);
        setResultado(data);
        setShowResult(true);
        fetchAll();
      }, 5000);
    } catch (err: any) {
      setIsSpinning(false);
      const msg = err.response?.data?.error || "Error al realizar el sorteo";
      setError(msg);
    }
  };

  // ─── Cambiar estado de entrega ─────────────────────────────

  const handleEntregar = async (id: number) => {
    try {
      await API.put(`/sorteo/historial/${id}/entregar`);
      const res = await API.get("/sorteo/historial");
      setHistorial(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  const clientesDisponibles = participantes.filter(c => !c.ya_gano);
  const premiosDisponiblesCount = premios.filter(p => p.estado === "Activo" && p.cantidad_disponible > 0).length;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!isSpinning) onClose(); }}></div>

      <div className="relative bg-white w-full max-w-6xl max-h-[95vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600 shrink-0">
          <h2 className="text-lg sm:text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
            🎡 Sorteo de Premios
          </h2>
          <button onClick={onClose} disabled={isSpinning} className="w-9 h-9 bg-white/20 text-white rounded-2xl flex items-center justify-center hover:bg-white/30 transition-all font-black text-lg disabled:opacity-50">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 shrink-0">
          {[
            { key: "ruleta" as TabView, label: "🎡 Ruleta", icon: "🎡" },
            { key: "premios" as TabView, label: "🏆 Premios", icon: "🏆" },
            { key: "historial" as TabView, label: "📜 Historial", icon: "📜" },
            { key: "config" as TabView, label: "⚙️ Config", icon: "⚙️" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { if (!isSpinning) setActiveTab(tab.key); }}
              className={`flex-1 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab.key ? "bg-white text-indigo-700 border-b-2 border-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.icon}</span>
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-[11px] font-medium flex items-center gap-2 shrink-0">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600 font-bold">✕</button>
          </div>
        )}

        {/* Loading */}
        {loading && !resultado && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* ─── TAB: Ruleta ─────────────────────────────────── */}
        {activeTab === "ruleta" && !loading && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-2xl p-3 sm:p-4 border border-indigo-100">
                <span className="text-[9px] uppercase tracking-widest text-indigo-500 font-medium">Participantes</span>
                <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">{clientesDisponibles.length}</div>
                <span className="text-[9px] text-indigo-400">Disponibles</span>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-3 sm:p-4 border border-emerald-100">
                <span className="text-[9px] uppercase tracking-widest text-emerald-500 font-medium">Premios</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{premiosDisponiblesCount}</div>
                <span className="text-[9px] text-emerald-400">Activos</span>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-3 sm:p-4 border border-amber-100">
                <span className="text-[9px] uppercase tracking-widest text-amber-500 font-medium">Ganadores</span>
                <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{estado?.totalGanadores || 0}</div>
                <span className="text-[9px] text-amber-400">Sorteo #{estado?.config?.numero_sorteo || 1}</span>
              </div>
              <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl p-3 sm:p-4 border border-rose-100">
                <span className="text-[9px] uppercase tracking-widest text-rose-500 font-medium">Giros</span>
                <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{estado?.totalGiros || 0}</div>
                <span className="text-[9px] text-rose-400">Realizados</span>
              </div>
            </div>

            {/* Wheel + Controls */}
            <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-start">
              {/* Wheel */}
              <div className="relative flex flex-col items-center flex-1">
                <div className="relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[24px] border-transparent border-t-slate-800 drop-shadow-md -translate-y-3"></div>
                  <div className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] rounded-full overflow-hidden shadow-[0_0_40px_rgba(79,70,229,0.2)] border-[6px] border-white z-10 bg-white">
                    <div
                      className="w-full h-full rounded-full relative transition-all"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transitionDuration: '5s',
                        transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.1, 1)'
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: `conic-gradient(${clientesDisponibles.map((_, i) => `${COLORS[i % COLORS.length]} ${(i * 360) / Math.max(clientesDisponibles.length, 1)}deg ${((i + 1) * 360) / Math.max(clientesDisponibles.length, 1)}deg`).join(', ')})`
                        }}
                      ></div>
                      {clientesDisponibles.map((c, i) => {
                        const angle = (360 / Math.max(clientesDisponibles.length, 1)) * i + (360 / Math.max(clientesDisponibles.length, 1)) / 2;
                        return (
                          <div key={c.id} className="absolute w-full h-full flex items-start justify-center pt-1 sm:pt-2" style={{ transform: `rotate(${angle}deg)` }}>
                            <span className="text-white text-[7px] sm:text-[10px] font-black uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] whitespace-pre-line text-center leading-tight px-1" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                              {c.nombre}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full shadow-lg border-4 border-slate-100 flex items-center justify-center z-20">
                      <span className="text-[8px] sm:text-[10px] font-black text-indigo-900 uppercase tracking-tighter text-center leading-tight">SUMAK<br/>TECH</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSpin}
                  disabled={isSpinning || clientesDisponibles.length === 0 || premiosDisponiblesCount === 0}
                  className="mt-6 px-8 py-3 sm:px-10 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full font-black uppercase tracking-widest text-xs sm:text-sm hover:from-indigo-700 hover:to-purple-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-200 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  {isSpinning ? 'Girando...' : '¡Girar Ruleta!'}
                </button>

                {/* Result modal */}
                {showResult && resultado && (
                  <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={() => setShowResult(false)}></div>
                    <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-8 sm:p-12 rounded-[40px] shadow-2xl max-w-md w-full text-center animate-in zoom-in duration-500">
                      <div className="text-5xl sm:text-7xl mb-4 animate-bounce">🎉</div>
                      <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter mb-2">Felicitaciones</h3>
                      <div className="text-xl sm:text-2xl font-bold text-yellow-300 mb-1">{resultado.cliente.nombre}</div>
                      <p className="text-sm text-white/70 mb-6">Ha ganado:</p>
                      <div className="bg-white/20 backdrop-blur-sm rounded-3xl px-6 py-4 border border-white/30">
                        <span className="text-2xl sm:text-3xl font-black text-yellow-300">{resultado.premio.nombre}</span>
                      </div>
                      <div className="mt-6 text-[10px] text-white/50 uppercase tracking-widest">
                        Sorteo #{resultado.numero_sorteo} — {resultado.fecha}
                      </div>
                      <button onClick={() => setShowResult(false)} className="mt-6 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-full font-bold uppercase tracking-widest text-xs transition-all border border-white/30">
                        Continuar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Client list sidebar */}
              <div className="w-full lg:w-72 bg-slate-50/80 rounded-3xl border border-slate-200 p-4 max-h-[400px] overflow-y-auto">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Participantes ({clientesDisponibles.length})</h3>
                <div className="space-y-1">
                  {clientesDisponibles.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-8">No hay participantes disponibles</p>
                  )}
                  {clientesDisponibles.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-all ${clientesDisponibles[currentIndex % Math.max(clientesDisponibles.length, 1)]?.id === c.id ? "bg-indigo-100 text-indigo-800 ring-2 ring-indigo-300" : "bg-white text-slate-700"}`}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i + 1}</span>
                      <span className="truncate">{c.nombre}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB: Premios ────────────────────────────────── */}
        {activeTab === "premios" && !loading && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Catálogo de Premios</h3>
              <button
                onClick={() => { resetPremioForm(); setShowPremioForm(true); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md"
              >
                + Nuevo Premio
              </button>
            </div>

            {/* Premio form */}
            {showPremioForm && (
              <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-4 sm:p-6 border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-4">{editingPremio ? "Editar" : "Nuevo"} Premio</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Nombre *</label>
                    <input type="text" value={premioForm.nombre} onChange={e => setPremioForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Bono de $50.000" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Cantidad</label>
                    <input type="number" min="0" value={premioForm.cantidad_disponible} onChange={e => setPremioForm(p => ({ ...p, cantidad_disponible: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Máx. Ganadores</label>
                    <input type="number" min="0" value={premioForm.cantidad_max_ganadores} onChange={e => setPremioForm(p => ({ ...p, cantidad_max_ganadores: e.target.value }))} placeholder="Ilimitado" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Descripción</label>
                    <input type="text" value={premioForm.descripcion} onChange={e => setPremioForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción del premio" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Orden</label>
                    <input type="number" min="0" value={premioForm.orden_entrega} onChange={e => setPremioForm(p => ({ ...p, orden_entrega: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Vigencia</label>
                    <input type="date" value={premioForm.fecha_vigencia} onChange={e => setPremioForm(p => ({ ...p, fecha_vigencia: e.target.value }))} className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">URL Imagen</label>
                    <input type="text" value={premioForm.imagen} onChange={e => setPremioForm(p => ({ ...p, imagen: e.target.value }))} placeholder="https://..." className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all" />
                  </div>
                  <div className="space-y-1 flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={premioForm.estado === "Activo"} onChange={e => setPremioForm(p => ({ ...p, estado: e.target.checked ? "Activo" : "Inactivo" }))} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-[10px] font-medium text-slate-600">Activo</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={resetPremioForm} className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all">Cancelar</button>
                  <button onClick={handleSavePremio} disabled={loading || !premioForm.nombre.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50">Guardar</button>
                </div>
              </div>
            )}

            {/* Premios list */}
            <div className="space-y-2">
              {premios.length === 0 && (
                <div className="text-center py-16 text-slate-400 italic text-sm">No hay premios configurados. Crea tu primer premio.</div>
              )}
              {premios.map(p => (
                <div key={p.id} className={`bg-white rounded-2xl border p-4 flex items-center justify-between gap-4 transition-all hover:shadow-sm ${p.estado === "Inactivo" ? "border-slate-100 opacity-60" : "border-slate-200"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    {p.imagen && <img src={p.imagen} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0" />}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{p.nombre}</div>
                      {p.descripcion && <div className="text-[10px] text-slate-500 truncate">{p.descripcion}</div>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">Stock: <strong className={p.cantidad_disponible > 0 ? "text-emerald-600" : "text-rose-600"}>{p.cantidad_disponible}</strong></span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${p.estado === "Activo" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>{p.estado}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleEditPremio(p)} className="w-8 h-8 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center text-sm" title="Editar">✏️</button>
                    <button onClick={() => handleDeletePremio(p.id)} className="w-8 h-8 bg-white border border-slate-200 text-slate-500 rounded-xl hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center text-sm" title="Eliminar">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB: Historial ──────────────────────────────── */}
        {activeTab === "historial" && !loading && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Historial de Ganadores</h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={historialStartDate}
                  onChange={e => { setHistorialStartDate(e.target.value); }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-medium outline-none focus:border-indigo-400 transition-all"
                />
                <span className="text-[9px] text-slate-400">→</span>
                <input
                  type="date"
                  value={historialEndDate}
                  onChange={e => { setHistorialEndDate(e.target.value); }}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-medium outline-none focus:border-indigo-400 transition-all"
                />
                <button
                  onClick={() => { setHistorialStartDate(""); setHistorialEndDate(""); }}
                  className="px-3 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Limpiar
                </button>
                {["todos", "Pendiente", "Entregado"].map(f => (
                  <button
                    key={f}
                    onClick={() => setFiltroGanador(f)}
                    className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all ${filtroGanador === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {f === "todos" ? "Todos" : f}
                  </button>
                ))}
              </div>
            </div>

            {historial.length === 0 && (
              <div className="text-center py-16 text-slate-400 italic text-sm">No hay historial aún. ¡Comienza a girar la ruleta!</div>
            )}

            {historial.filter(h => filtroGanador === "todos" || h.estado_entrega === filtroGanador).map(h => (
              <div key={h.id} className="bg-white rounded-2xl border border-slate-200 p-4 mb-2 flex items-center justify-between gap-4 hover:shadow-sm transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-lg shrink-0">🏆</div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm">{h.cliente_nombre}</div>
                    <div className="text-[11px] text-indigo-600 font-semibold">{h.premio_nombre || "N/A"}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      Sorteo #{h.numero_sorteo} — {h.fecha} {h.hora?.slice(0, 5)} — por: {h.usuario_nombre}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-xl text-[9px] font-bold uppercase tracking-widest ${h.estado_entrega === "Entregado" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                    {h.estado_entrega === "Entregado" ? "✅ Entregado" : "⏳ Pendiente"}
                  </span>
                  {h.estado_entrega === "Pendiente" && (
                    <button onClick={() => handleEntregar(h.id)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all">
                      Entregar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── TAB: Configuración ──────────────────────────── */}
        {activeTab === "config" && !loading && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-1">Filtro por Compras</h3>
              <p className="text-[10px] text-slate-400">
                Configura un filtro para que solo aparezcan en la ruleta los clientes que hayan realizado compras en un período específico con un monto mínimo.
                Déjalo vacío para mostrar todos los clientes activos.
              </p>
            </div>

            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-3xl p-4 sm:p-6 border border-indigo-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Monto Mínimo por Compra</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={configForm.filtro_monto_min}
                    onChange={e => setConfigForm(f => ({ ...f, filtro_monto_min: e.target.value }))}
                    placeholder="Ej: 30000"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Compras Mínimas</label>
                  <input
                    type="number"
                    min="0"
                    value={configForm.filtro_compras_min}
                    onChange={e => setConfigForm(f => ({ ...f, filtro_compras_min: e.target.value }))}
                    placeholder="Ej: 1 (mín. 1 compra)"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Fecha Inicio</label>
                  <input
                    type="date"
                    value={configForm.filtro_fecha_inicio}
                    onChange={e => setConfigForm(f => ({ ...f, filtro_fecha_inicio: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-medium text-slate-500 uppercase tracking-widest">Fecha Fin</label>
                  <input
                    type="date"
                    value={configForm.filtro_fecha_fin}
                    onChange={e => setConfigForm(f => ({ ...f, filtro_fecha_fin: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-indigo-400 transition-all"
                  />
                </div>
              </div>

              <div className="mt-4 p-3 bg-white/60 rounded-2xl border border-indigo-100">
                <p className="text-[10px] text-slate-500 flex items-start gap-2">
                  <span className="text-indigo-500 mt-0.5">💡</span>
                  <span>
                    <strong>Ejemplo:</strong> si pones monto mínimo = <strong>30.000</strong>, fecha inicio = <strong>2026-08-01</strong>, fecha fin = <strong>2026-08-31</strong> y compras mínimas = <strong>1</strong>, solo los clientes que hayan hecho al menos una compra de $30.000 o más en agosto aparecerán en la ruleta.
                  </span>
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={async () => {
                    setConfigForm({ filtro_monto_min: "", filtro_compras_min: "", filtro_fecha_inicio: "", filtro_fecha_fin: "" });
                    setSavingConfig(true);
                    try {
                      await API.post("/sorteo/config", {
                        filtro_monto_min: null,
                        filtro_compras_min: null,
                        filtro_fecha_inicio: null,
                        filtro_fecha_fin: null
                      });
                      await fetchConfig();
                      await fetchAll();
                    } catch (err) {
                      console.error(err);
                    }
                    setSavingConfig(false);
                  }}
                  className="px-5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Limpiar Filtros
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {savingConfig ? "Guardando..." : "Guardar Configuración"}
                </button>
              </div>
            </div>

            {/* Current config summary */}
            {config && (config.filtro_monto_min || config.filtro_fecha_inicio) && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <h4 className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2">Filtro activo actualmente</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-emerald-500 text-[9px] uppercase tracking-wider">Monto mínimo</span>
                    <div className="font-bold text-emerald-800">${Number(config.filtro_monto_min || 0).toLocaleString('es-CO')}</div>
                  </div>
                  <div>
                    <span className="text-emerald-500 text-[9px] uppercase tracking-wider">Compras mín.</span>
                    <div className="font-bold text-emerald-800">{config.filtro_compras_min || 1}</div>
                  </div>
                  <div>
                    <span className="text-emerald-500 text-[9px] uppercase tracking-wider">Desde</span>
                    <div className="font-bold text-emerald-800">{config.filtro_fecha_inicio || "—"}</div>
                  </div>
                  <div>
                    <span className="text-emerald-500 text-[9px] uppercase tracking-wider">Hasta</span>
                    <div className="font-bold text-emerald-800">{config.filtro_fecha_fin || "—"}</div>
                  </div>
                </div>
              </div>
            )}

            {(!config || (!config.filtro_monto_min && !config.filtro_fecha_inicio)) && (
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[11px] text-slate-400 italic">No hay filtro activo. Todos los clientes activos participan en la ruleta.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RuletaDescuentos;
