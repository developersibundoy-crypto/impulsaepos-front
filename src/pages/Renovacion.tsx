import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PricingPlans from '../components/PricingPlans';

const Renovacion: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // El empresaId ahora lo maneja PricingPlans a través del localStorage

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 lg:p-12 font-sans selection:bg-indigo-100">
      
      <div className="w-full max-w-6xl bg-white rounded-[56px] shadow-4xl border border-white p-8 lg:p-14 animate-in zoom-in duration-700 relative overflow-hidden">
        
        {/* Decorativos de Fondo */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4"></div>
        
        <div className="relative z-10 text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-50 rounded-full text-[10px] font-black uppercase tracking-widest text-rose-600 mb-6 border border-rose-100 animate-pulse">
            <span className="flex h-2 w-2 rounded-full bg-rose-600"></span>
            Suscripción Vencida
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 tracking-tighter uppercase italic leading-none">
            RENOVAR <span className="text-indigo-600">ACCESO</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium italic max-w-2xl mx-auto opacity-80 leading-relaxed">
            Tu suscripción ha expirado. Realiza el pago de renovación utilizando el sistema oficial de administración para reactivar tus funciones de inmediato.
          </p>
        </div>

        <div className="relative z-10">
          <PricingPlans isFullPage />
        </div>

        <div className="mt-12 flex flex-col lg:flex-row items-center justify-between gap-6 border-t border-slate-50 pt-8">
          <button 
            onClick={() => navigate('/login')}
            className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-all uppercase tracking-[0.3em] flex items-center gap-2"
          >
            ← Volver al Inicio de Sesión
          </button>
          
          <div className="flex items-center gap-4 text-slate-400">
             <p className="text-[10px] font-black uppercase tracking-widest">¿Problemas con el pago?</p>
             <a href="https://wa.me/573152796683" target="_blank" className="bg-emerald-500 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 hover:scale-105 transition-all">Soporte WhatsApp</a>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Renovacion;
