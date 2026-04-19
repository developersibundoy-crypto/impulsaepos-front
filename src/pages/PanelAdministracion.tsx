import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LoginAdministracion from './LoginAdministracion';
import WompiCheckout from '../components/WompiCheckout';
import { hasAccess, hasPlanFeature, PLAN_FEATURES } from '../utils/auth';
import PlanRestrictionModal from '../components/PlanRestrictionModal';

function PanelAdministracion() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [planCategory, setPlanCategory] = useState<'standard' | 'facturacion'>('standard');
  const [selectedPlan, setSelectedPlan] = useState('mensual');
  const [isRestrictedModalOpen, setIsRestrictedModalOpen] = useState(false);
  const [restrictedFeature, setRestrictedFeature] = useState('');
  
  const navigate = useNavigate();

  const planesStandard: any = {
    mensual: { id: '30', label: 'Mensual', precio: 70000, amount: 7000000, desc: '30 Días de Acceso', tag: 'Básico' },
    semestral: { id: '180', label: 'Semestral', precio: 378000, amount: 37800000, desc: '180 Días de Acceso', tag: 'Popular', ahorro: '10%' },
    anual: { id: '365', label: 'Anual', precio: 672000, amount: 67200000, desc: '365 Días de Acceso', tag: 'Mejor Valor', ahorro: '20%' }
  };

  const planesFacturacion: any = {
    mensual: { id: '30_FE', label: 'Mensual + FE', precio: 100000, amount: 10000000, desc: '30 Días + Facturación Electrónica', tag: 'Pro' },
    semestral: { id: '180_FE', label: 'Semestral + FE', precio: 540000, amount: 54000000, desc: '180 Días + Facturación Electrónica', tag: 'Pro', ahorro: '10%' },
    anual: { id: '365_FE', label: 'Anual + FE', precio: 960000, amount: 96000000, desc: '365 Días + Facturación Electrónica', tag: 'Empresarial', ahorro: '20%' }
  };

  const currentPlanes = planCategory === 'standard' ? planesStandard : planesFacturacion;


  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const esSuperAdmin = localStorage.getItem('adminRole') === 'superadmin';
  const esEmpresaPrincipal = localStorage.getItem('adminEmpresaId') === '1'; // RedCograf ID 1

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    navigate('/');
  };

  if (!isAuthenticated) {
    return <LoginAdministracion onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // Count visible sections
  const canSeeAnalytics = hasAccess("analitica");
  const canSeeHR = hasAccess("recursos_humanos");
  const canSeeInventory = hasAccess("inventario") || hasAccess("ajustes") || hasAccess("ingreso") || hasAccess("kardex");
  const canSeeFiscal = hasAccess("configuracion") || hasAccess("clientes") || hasAccess("proveedores");
  const canSeeFinances = hasAccess("facturas_venta") || hasAccess("facturas_compra") || hasAccess("separados");

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 leading-tight">
            Panel de Administración Global
          </h1>
          <p className="text-slate-500 font-medium text-lg italic opacity-80">Centro de mando para estadísticas, inventario pesado y configuración corporativa.</p>
        </div>
        <button 
          onClick={handleLogout}
          className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-100 hover:shadow-red-200 transition-all duration-300 hover:-translate-y-1 active:translate-y-0 flex items-center gap-3 group"
        >
          <span className="text-xl group-hover:rotate-12 transition-transform">🛑</span>
          CERRAR SESIÓN
        </button>
      </div>

    
      <div className="space-y-16">
        {esSuperAdmin && esEmpresaPrincipal && (
           <section className="animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-2 h-8 bg-pink-500 rounded-full"></div>
                <h2 className="text-xl font-black uppercase tracking-[0.2em] text-pink-600">👑 Portal del Creador (SaaS Central)</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <button 
                   onClick={() => {
                     const pass = prompt("🔑 Ingrese Clave Maestra de Infraestructura:");
                     if (pass === "superimpulsa") {
                       window.location.href = "/superadmin";
                     } else {
                       alert("🚫 Acceso Denegado.");
                     }
                   }}
                   className="w-full text-left group relative overflow-hidden bg-gradient-to-br from-indigo-600 to-pink-600 p-8 rounded-3xl shadow-xl shadow-indigo-100 transition-all duration-500 hover:-translate-y-2"
                >
                  <div className="relative z-10">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-soft">🌍</div>
                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Súper Administrador Global</h3>
                    <p className="text-indigo-50/80 text-sm font-medium leading-relaxed mb-6">Monitorea el registro SaaS automático, pagos en Wompi y el recaudo mensual de todas las tiendas.</p>
                    <div className="flex items-center gap-2 text-white font-bold text-sm bg-white/10 w-fit px-4 py-2 rounded-xl backdrop-blur-sm group-hover:bg-white/20 transition-colors">
                      Ver Matrix de Rentabilidad <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                    </div>
                  </div>
                  <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                </button>
              </div>
           </section>
        )}

        {/* Intelligence & Finance */}
        {(canSeeAnalytics || canSeeFinances) && (
          <section className="animate-in slide-in-from-bottom-4 delay-100 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
              <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-800">📊 Inteligencia y Finanzas</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AdminCard 
                to="/dashboard" icon="📈" title="Dashboard y Finanzas" 
                desc="Visión global del estado de tu mercancía, capital invertido y reportes contables generales." 
                color="indigo" 
                module="analitica"
              />
              <AdminCard 
                to="/ai" icon="🤖" title="Predicciones AI" 
                desc="Motor de Análisis Inteligente para predecir faltantes y calcular qué debes comprar." 
                color="violet" 
                module="analitica"
              />
              <AdminCard 
                to="/reportes" icon="🧾" title="Cortes de Caja" 
                desc="Exporta Excel, cuadra las cajas y revisa cuánto dinero ingresó por cada cajero." 
                color="emerald" 
                module="reportes"
              />
              <AdminCard 
                to="/facturas" icon="🏷️" title="Auditoría de Recibos" 
                desc="Control de tickets impresos, re-impresiones y opción de anulación de ventas." 
                color="slate" 
                module="facturas_venta"
              />
              <AdminCard 
                to="/separados" icon="🛒" title="Separados" 
                desc="Sistema de abonos para compras a plazos. Reserva mercancía y abona poco a poco." 
                color="blue" 
                module="separados"
                highlight 
              />
            </div>
          </section>
        )}

        {/* Inventory */}
        {canSeeInventory && (
          <section className="animate-in slide-in-from-bottom-4 delay-200 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-amber-500 rounded-full"></div>
              <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-800">📦 Compras e Inventario Físico</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AdminCard 
                to="/ingreso" icon="📥" title="Ingreso de Lotes" 
                desc="Registra compras completas, ingresa cajas de proveedores y captura códigos de barras." 
                color="orange" 
                module="ingreso"
              />
              <AdminCard 
                to="/compras" icon="📚" title="Histórico de Compras" 
                desc="Navega a través del tiempo sobre tus remisiones de proveedor pasadas y edítalas." 
                color="amber" 
                module="facturas_compra"
              />
              <AdminCard 
                to="/inventario-global" icon="🔍" title="Inventario Global" 
                desc="Buscador maestro de productos. Edita nombres, precios o elimina stock obsoleto." 
                color="indigo" 
                module="inventario"
              />
              <AdminCard 
                to="/ajustes" icon="⚖️" title="Ajuste Ciego" 
                desc="Corrección forzada de sobrantes o mermas (robos) de tu vitrina principal." 
                color="rose" 
                module="ajustes"
              />
              <AdminCard 
                to="/kardex" icon="📑" title="Libro Kardex" 
                desc="Historial de movimientos, trazabilidad completa de stock y auditoría de inventario." 
                color="amber" 
                module="kardex"
              />
            </div>
          </section>
        )}

        {/* Systems */}
        {canSeeFiscal && (
          <section className="animate-in slide-in-from-bottom-4 delay-300 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-8 bg-slate-400 rounded-full"></div>
              <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-800">🏢 Base de Datos y Sistemas</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AdminCard 
                to="/empresa" icon="⚙️" title="Empresa & Fiscal" 
                desc="Modifica Razón Social, NIT/RUT, mensajes del ticket y configuración fiscal básica." 
                color="slate" 
                module="configuracion"
              />
               <AdminCard 
                to="/configuracion-dian" icon="⚖️" title="Configuración DIAN" 
                desc="Gestión de resoluciones, prefijos, rangos de facturación y ambiente de operación legal." 
                color="amber" 
                module="configuracion"
                planFeature={PLAN_FEATURES.FACTURACION_ELECTRONICA}
                onRestrictedClick={(name) => {
                  setRestrictedFeature(name);
                  setIsRestrictedModalOpen(true);
                }}
                highlight
              />
              <AdminCard 
                to="/cajeros" icon="🧑‍💼" title="RRHH: Personal" 
                desc="Permisos y control de todas las personas autorizadas a operar la Caja y Ventas." 
                color="indigo" 
                module="recursos_humanos"
              />
              <AdminCard 
                to="/pagos" icon="💰" title="Pago de Nómina" 
                desc="Liquidación automática de salario base y comisiones por cada empleado." 
                color="emerald" 
                module="recursos_humanos"
              />
              <AdminCard 
                to="/clientes" icon="👥" title="Directorio Clientes" 
                desc="Lista de clientes frecuentes para la emisión de facturas o remisiones." 
                color="sky" 
                module="clientes"
              />
              <AdminCard 
                to="/proveedores" icon="🚛" title="Proveedores" 
                desc="Control de marcas, distribuidores e importadores ligados a tus facturas." 
                color="slate" 
                module="proveedores"
              />
            </div>
          </section>
        )}
      </div>

      <section id="seccion-planes" className="animate-in slide-in-from-bottom-4 duration-500 overflow-hidden relative mt-20">
        <div className="bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl shadow-indigo-200/50 flex flex-col xl:flex-row items-center gap-12 border-4 border-indigo-500/10">
          <div className="flex-1 space-y-6 text-center xl:text-left w-full">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-400/20 backdrop-blur-md">
              <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-pulse"></span>
              Impulsa tu Crecimiento
            </div>
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-none italic">
              ¡Tu éxito es nuestro mayor <br />
              <span className="text-indigo-400 underline decoration-indigo-800 underline-offset-8">TRIUNFO!</span>
            </h2>
            
            {/* Categorías de Planes */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center xl:justify-start pt-4">
              <button
                onClick={() => { setPlanCategory('standard'); setSelectedPlan('mensual'); }}
                className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${planCategory === 'standard' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
              >
                📊 Planes Estándar
              </button>
              <button
                onClick={() => { setPlanCategory('facturacion'); setSelectedPlan('mensual'); }}
                className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${planCategory === 'facturacion' ? 'bg-amber-500 text-white shadow-lg' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}
              >
                ⚡ Planes con Facturación Electrónica
              </button>
            </div>

            <p className="text-indigo-100/60 text-sm font-medium leading-relaxed max-w-2xl italic mx-auto xl:mx-0 pt-2">
              {planCategory === 'facturacion' 
                ? "Accede a la emisión de facturas legales, sincronización con la DIAN y gestión de folios desde una plataforma simplificada."
                : "Optimiza tu control de inventario, ventas y analítica básica con nuestros planes esenciales."
              }
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
               {Object.keys(currentPlanes).map((key) => (
                  <button
                     key={key}
                     onClick={() => setSelectedPlan(key)}
                     className={`p-6 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-2 relative overflow-hidden group ${
                        selectedPlan === key 
                        ? 'border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/20 translate-y-[-4px]' 
                        : 'border-white/5 bg-white/5 hover:bg-white/10'
                     }`}
                  >
                     {currentPlanes[key].ahorro && (
                        <span className="absolute top-2 right-2 bg-emerald-500 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg">Ahorra {currentPlanes[key].ahorro}</span>
                     )}
                     <span className={`text-[10px] font-black uppercase tracking-widest ${selectedPlan === key ? 'text-indigo-300' : 'text-slate-400'}`}>{currentPlanes[key].label}</span>
                     <span className="text-2xl font-black tracking-tighter leading-none">${currentPlanes[key].precio.toLocaleString()}</span>
                     <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest text-center">{currentPlanes[key].desc}</span>
                  </button>
               ))}
            </div>
          </div>

          <div className="w-full xl:w-[380px] shrink-0 bg-white/5 backdrop-blur-2xl p-8 xl:p-10 rounded-[3rem] border border-white/10 flex flex-col items-center justify-center text-center shadow-2xl relative translate-y-4">
             <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-xl shadow-indigo-900/40 animate-bounce duration-[3000ms]">💎</div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300/80 mb-1">Plan {currentPlanes[selectedPlan].label} Seleccionado</p>
             <h4 className="text-5xl font-black text-white mb-6 tracking-tighter">
                ${currentPlanes[selectedPlan].precio.toLocaleString()}
                <span className="text-sm opacity-40 font-bold lowercase tracking-normal pl-1">
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
             
             <p className="text-[9px] text-indigo-300/40 font-black mt-4 uppercase tracking-widest">
                Activa {currentPlanes[selectedPlan].desc} de forma segura
             </p>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
        </div>
      </section>

      <PlanRestrictionModal 
        isOpen={isRestrictedModalOpen} 
        onClose={() => setIsRestrictedModalOpen(false)} 
        featureName={restrictedFeature} 
      />

      <p className="mt-20 text-center text-slate-400 text-sm font-bold uppercase tracking-[0.3em]">
        &copy; 2026 Impulsa POS - Advanced Retail Control
      </p>

    </div>
  );
}

const colorMap = {
  indigo: "group-hover:bg-indigo-50 group-hover:text-indigo-600 bg-slate-100 text-slate-600",
  violet: "group-hover:bg-violet-50 group-hover:text-violet-600 bg-slate-100 text-slate-600",
  emerald: "group-hover:bg-emerald-50 group-hover:text-emerald-600 bg-slate-100 text-slate-600",
  slate: "group-hover:bg-slate-100 group-hover:text-slate-900 bg-slate-100 text-slate-600",
  blue: "group-hover:bg-blue-50 group-hover:text-blue-600 bg-slate-100 text-slate-600",
  orange: "group-hover:bg-orange-50 group-hover:text-orange-600 bg-slate-100 text-slate-600",
  amber: "group-hover:bg-amber-50 group-hover:text-amber-600 bg-slate-100 text-slate-600",
  rose: "group-hover:bg-rose-50 group-hover:text-rose-600 bg-slate-100 text-slate-600",
  sky: "group-hover:bg-sky-50 group-hover:text-sky-600 bg-slate-100 text-slate-600",
};

const barMap = {
  indigo: "bg-indigo-600",
  violet: "bg-violet-600",
  emerald: "bg-emerald-600",
  slate: "bg-slate-900",
  blue: "bg-blue-600",
  orange: "bg-orange-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  sky: "bg-sky-600",
};

function AdminCard({ to, icon, title, desc, color, highlight, module, planFeature, onRestrictedClick }: { to: string, icon: string, title: string, desc: string, color: keyof typeof colorMap, highlight?: boolean, module?: string, planFeature?: string, onRestrictedClick?: (name: string) => void }) {
  if (module && !hasAccess(module)) return null;

  const handleClick = (e: React.MouseEvent) => {
    if (planFeature && !hasPlanFeature(planFeature)) {
      e.preventDefault();
      onRestrictedClick?.(title);
    }
  };

  return (
    <Link 
      to={to} 
      onClick={handleClick}
      className={`group relative bg-white p-6 rounded-3xl border border-slate-200 shadow-sm transition-all duration-400 hover:-translate-y-2 hover:shadow-xl hover:border-transparent flex flex-col items-start ${highlight ? `ring-2 ring-blue-500 ring-offset-2` : ''}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-5 transition-all duration-400 ${colorMap[color]}`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-2 tracking-tight">{title}</h3>
      <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">{desc}</p>
      
      {planFeature && !hasPlanFeature(planFeature) && (
        <div className="mb-4 px-3 py-1 bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest rounded-full border border-amber-100 flex items-center gap-1">
          <span>🔒 Plan Facturación Requerido</span>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-600 transition-all text-left">
        {planFeature && !hasPlanFeature(planFeature) ? "Mejorar Plan" : "Gestionar"} <span className="group-hover:translate-x-1 transition-transform">→</span>
      </div>
      <div className={`absolute left-6 bottom-0 right-6 h-1 rounded-t-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left ${barMap[color]}`}></div>
    </Link>
  );
}

export default PanelAdministracion;
