import React, { useState } from 'react';
import WompiCheckout from './WompiCheckout';

const PricingPlans: React.FC<{ isFullPage?: boolean }> = ({ isFullPage }) => {
  const [planCategory, setPlanCategory] = useState<'standard' | 'facturacion'>('standard');
  const [selectedPlan, setSelectedPlan] = useState('mensual');

  const planesStandard: any = {
    mensual: { id: '30', label: 'Mensual', precio: 70000, amount: 7000000, desc: '30 Días de Acceso', tag: 'Básico' },
    semestral: { id: '180', label: 'Semestral', precio: 378000, amount: 37800000, desc: '180 Días de Acceso', tag: 'Popular', ahorro: '10%' },
    anual: { id: '365', label: 'Anual', precio: 672000, amount: 67200000, desc: '365 Días de Acceso', tag: 'Mejor Valor', ahorro: '20%' }
  };

  const planesFacturacion: any = {
    mensual: { id: '30_FE', label: 'Mensual + FE', precio: 100000, amount: 10000000, desc: '30 Días + FE', tag: 'Pro' },
    semestral: { id: '180_FE', label: 'Semestral + FE', precio: 540000, amount: 54000000, desc: '180 Días + FE', tag: 'Pro', ahorro: '10%' },
    anual: { id: '365_FE', label: 'Anual + FE', precio: 960000, amount: 96000000, desc: '365 Días + FE', tag: 'Empresarial', ahorro: '20%' }
  };

  const currentPlanes = planCategory === 'standard' ? planesStandard : planesFacturacion;

  return (
    <div className={`bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 ${isFullPage ? 'rounded-[3rem]' : 'rounded-[2rem]'} p-6 lg:p-10 text-white shadow-2xl flex flex-col xl:flex-row items-center gap-10 border-4 border-indigo-500/10 overflow-hidden relative`}>
      
      <div className="flex-1 space-y-6 text-center xl:text-left w-full relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-400/20 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
          Selecciona tu Plan de Crecimiento
        </div>
        
        <h2 className="text-3xl lg:text-4xl font-black tracking-tighter leading-none italic uppercase">
          Activa tu <span className="text-indigo-400">Potencial</span>
        </h2>

        {/* Selector de Categoría */}
        <div className="flex flex-col sm:flex-row gap-2 justify-center xl:justify-start">
          <button
            onClick={() => { setPlanCategory('standard'); setSelectedPlan('mensual'); }}
            className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${planCategory === 'standard' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
          >
            📊 Planes Estándar
          </button>
          <button
            onClick={() => { setPlanCategory('facturacion'); setSelectedPlan('mensual'); }}
            className={`px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${planCategory === 'facturacion' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
          >
            ⚡ Facturación Electrónica
          </button>
        </div>

        {/* Grid de Opciones (Periodos) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.keys(currentPlanes).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedPlan(key)}
              className={`p-5 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-1 relative overflow-hidden ${
                selectedPlan === key 
                ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/20 translate-y-[-4px]' 
                : 'border-white/5 bg-white/5 hover:bg-white/10'
              }`}
            >
              {currentPlanes[key].ahorro && (
                <span className="absolute top-1 right-1 bg-emerald-500 text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">-{currentPlanes[key].ahorro}</span>
              )}
              <span className={`text-[8px] font-black uppercase tracking-widest ${selectedPlan === key ? 'text-indigo-300' : 'text-slate-400'}`}>{currentPlanes[key].label}</span>
              <span className="text-xl font-black tracking-tighter">${currentPlanes[key].precio.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Checkout Card */}
      <div className="w-full xl:w-[320px] shrink-0 bg-white/5 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-white/10 flex flex-col items-center justify-center text-center shadow-2xl relative">
        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-xl shadow-indigo-900/40">💎</div>
        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1">Total a Pagar</p>
        <h4 className="text-4xl font-black text-white mb-6 tracking-tighter">
          ${currentPlanes[selectedPlan].precio.toLocaleString()}
          <span className="text-[10px] opacity-40 font-bold lowercase tracking-normal pl-1">
            {selectedPlan === 'mensual' ? '/mes' : selectedPlan === 'semestral' ? '/sem' : '/año'}
          </span>
        </h4>
        
        <div className="w-full transform hover:scale-105 transition-transform duration-300">
          <WompiCheckout 
            key={`${planCategory}_${selectedPlan}`}
            reference={`SUB_${currentPlanes[selectedPlan].id}_${localStorage.getItem('adminEmpresaId') || '1'}_${Date.now()}`} 
            amountInCents={currentPlanes[selectedPlan].amount} 
          />
        </div>
        
        <p className="text-[8px] text-indigo-300/40 font-black mt-4 uppercase tracking-[0.2em]">
          Activación Inmediata
        </p>
      </div>

      {/* Decorativos */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>
    </div>
  );
};

export default PricingPlans;
