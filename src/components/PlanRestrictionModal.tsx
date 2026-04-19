import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PlanRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
}

const PlanRestrictionModal: React.FC<PlanRestrictionModalProps> = ({ isOpen, onClose, featureName }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white rounded-[40px] shadow-3xl p-10 animate-in zoom-in duration-300 border border-slate-100 text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center text-4xl mb-6 mx-auto shadow-xl shadow-amber-100">
          ⚡
        </div>
        
        <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight leading-tight uppercase">
          Función Restringida
        </h2>
        
        <p className="text-slate-500 font-medium leading-relaxed mb-8">
          El módulo de <span className="text-indigo-600 font-bold">{featureName}</span> está disponible solo para planes con facturación electrónica. 
          Actualiza tu plan para acceder a esta funcionalidad.
        </p>
        
        <div className="space-y-3">
          <button
            onClick={() => {
              onClose();
              navigate('/admin');
              // Scroll to plans section if needed
              setTimeout(() => {
                const el = document.getElementById('seccion-planes');
                el?.scrollIntoView({ behavior: 'smooth' });
              }, 500);
            }}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest text-xs"
          >
            🚀 Ver Planes Disponibles
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-50 text-slate-400 font-black rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
          >
            Quizás más tarde
          </button>
        </div>
        
        <p className="mt-6 text-[9px] text-slate-300 font-black uppercase tracking-widest italic">
          Impulsa POS - Transformando tu negocio
        </p>
      </div>
    </div>
  );
};

export default PlanRestrictionModal;
