import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ModalLanzamientoTiendaProps {
  onClose?: () => void;
}

export const ModalLanzamientoTienda: React.FC<ModalLanzamientoTiendaProps> = ({ onClose }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar si el usuario ya vio el anuncio de la tienda en línea
    const yaVisto = localStorage.getItem('visto_anuncio_tienda_v1');
    const token = localStorage.getItem('adminToken');
    
    // Solo mostrar a usuarios autenticados que no lo hayan visto
    if (!yaVisto && token) {
      // Pequeño retardo para que la interfaz cargue suavemente
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('visto_anuncio_tienda_v1', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleGoToTienda = () => {
    localStorage.setItem('visto_anuncio_tienda_v1', 'true');
    setIsOpen(false);
    if (onClose) onClose();
    navigate('/tienda-admin');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 to-indigo-950 border border-indigo-500/40 rounded-3xl shadow-2xl p-6 sm:p-8 text-white relative space-y-6">
        
        {/* Botón cerrar */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition text-sm"
          title="Cerrar aviso"
        >
          ✕
        </button>

        {/* Encabezado con Badge llamativo */}
        <div className="space-y-2 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-emerald-500/20 via-indigo-500/20 to-purple-500/20 border border-emerald-400/40 text-emerald-300 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            🚀 NUEVA FUNCIONALIDAD EXCLUSIVA
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
            ¡Lanzamos tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-emerald-300">Tienda en Línea</span> en 1 Clic!
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Multiplica tus ventas llevando los productos de tu POS directo a internet. Sin conocimientos técnicos ni pagar comisiones por venta a intermediarios.
          </p>
        </div>

        {/* 3 Beneficios Principales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-800/60 border border-indigo-500/20 p-3.5 rounded-2xl space-y-1">
            <span className="text-2xl">⚡</span>
            <h4 className="font-bold text-xs text-white">Catálogo en 1 Clic</h4>
            <p className="text-[11px] text-slate-300 leading-snug">Publica tus productos con su stock actual al instante.</p>
          </div>

          <div className="bg-slate-800/60 border border-indigo-500/20 p-3.5 rounded-2xl space-y-1">
            <span className="text-2xl">💳</span>
            <h4 className="font-bold text-xs text-white">Tus Pagos Directos</h4>
            <p className="text-[11px] text-slate-300 leading-snug">Conecta tu Wompi y recibe Nequi, PSE y tarjetas en tu banco.</p>
          </div>

          <div className="bg-slate-800/60 border border-indigo-500/20 p-3.5 rounded-2xl space-y-1">
            <span className="text-2xl">🔄</span>
            <h4 className="font-bold text-xs text-white">Cero Sobreventa</h4>
            <p className="text-[11px] text-slate-300 leading-snug">Stock sincronizado en vivo entre tu mostrador y la web.</p>
          </div>
        </div>

        {/* Banner de Precio e Incentivo */}
        <div className="bg-gradient-to-r from-emerald-950/60 via-indigo-900/40 to-slate-900 border border-emerald-500/40 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <div className="inline-block px-2 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-extrabold rounded uppercase tracking-wider mb-1">
              🎁 14 DÍAS DE PRUEBA GRATIS
            </div>
            <p className="text-xs text-slate-200">
              Pruébalo sin costo. Luego continúa por solo <strong className="text-emerald-300 font-bold">$70.000 COP / mes</strong> adicionales a tu POS.
            </p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={handleGoToTienda}
            className="flex-1 py-3 px-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
          >
            <span>✨ Activar Mis 14 Días Gratis Ahora</span>
            <span>→</span>
          </button>
          
          <button
            onClick={handleDismiss}
            className="py-3 px-4 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs uppercase tracking-wider transition"
          >
            Ver más tarde
          </button>
        </div>

      </div>
    </div>
  );
};

export default ModalLanzamientoTienda;
