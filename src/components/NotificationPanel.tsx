import React, { useState, useEffect } from 'react';
import API from '../api/api';
import WompiCheckout from './WompiCheckout';
import PricingPlans from './PricingPlans';

const motivaciones = [
// ... (omitted for brevity in replacement chunk)
  "¡Que tengas un excelente día y muchas ventas hoy! 🚀",
  "Recuerda que cada cliente satisfecho hace crecer tu negocio. 📈",
  "Hoy puede ser un gran día para aumentar tus ingresos. 💰",
  "Tu esfuerzo de hoy es el éxito de mañana. ¡Vamos con toda! 💪",
  "La clave del éxito es la constancia. ¡Sigue así! ✨",
  "Un cliente bien atendido siempre vuelve. ¡Brinda tu mejor sonrisa! 😊",
  "La excelencia no es un acto, es un hábito. ¡Haz que hoy cuente! 🏆",
  "Cree en lo que vendes y venderás más. ¡Tus productos son geniales! 🏷️",
  "El éxito es la suma de pequeños esfuerzos repetidos día tras día. 🏁",
  "Tu actitud determina tu dirección. ¡Mantente positivo! 🧭"
];

const NotificationPanel = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [motivation, setMotivation] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Seleccionar mensaje basado en el día del año
    const todayDate = new Date();
    const start = new Date(todayDate.getFullYear(), 0, 0);
    const diff = todayDate.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    setMotivation(motivaciones[dayOfYear % motivaciones.length]);

    const fetchAlerts = async () => {
      try {
        const [subRes, sepRes] = await Promise.all([
          API.get('/suscripciones/estado'),
          API.get('/separados')
        ]);

        const sub = subRes.data;
        const seps = sepRes.data || [];
        const newAlerts: any[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Alerta de Suscripción del Sistema (Pago SaaS)
        if (sub && sub.fecha_vencimiento_suscripcion) {
          const vDate = new Date(sub.fecha_vencimiento_suscripcion);
          // Usamos la diferencia de días calculada por el backend o la recalculamos para seguridad
          const diffDays = Math.ceil((vDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

          if (diffDays < 0) {
            newAlerts.push({
              type: 'danger',
              icon: '💳',
              label: 'SISTEMA VENCIDO',
              message: `La suscripción del sistema venció el ${vDate.toLocaleDateString()}. Renueva para evitar bloqueos.`
            });
          } else if (diffDays <= 10) {
            newAlerts.push({
              type: 'warning',
              icon: '⚠️',
              label: 'VENCIMIENTO DE PAGO',
              message: `El pago de renovación del sistema vence en ${diffDays === 0 ? 'hoy' : diffDays + ' días'} (${vDate.toLocaleDateString()}).`
            });
          }
        }

        // 2. Alertas de Pagos Pendientes y Mora de Clientes (Separados)
        seps.forEach((s: any) => {
          if (s.estado === 'Pendiente' && parseFloat(s.saldo_pendiente) > 0) {
            if (s.fecha_vencimiento) {
              const vDate = new Date(s.fecha_vencimiento);
              const diffDays = Math.ceil((vDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

              if (diffDays < 0) {
                newAlerts.push({
                  type: 'danger',
                  icon: '💸',
                  label: 'MORA EN PAGO',
                  message: `Separado #${s.id} de ${s.cliente_nombre} tiene mora de ${Math.abs(diffDays)} días.`
                });
              } else if (diffDays <= 10) {
                newAlerts.push({
                  type: 'warning',
                  icon: '🗓️',
                  label: 'RECORDATORIO DE PAGO',
                  message: `Separado #${s.id} (${s.cliente_nombre}) vence en ${diffDays === 0 ? 'hoy' : diffDays + ' días'}.`
                });
              }
            }
          }
        });

        setAlerts(newAlerts);
      } catch (e) {
        console.error("Error fetching alerts:", e);
      }
    };

    fetchAlerts();
  }, []);

  // Ciclo de alertas
  useEffect(() => {
    if (alerts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % alerts.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [alerts]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  if (alerts.length > 0) {
    const currentAlert = alerts[currentIndex];
    const isSystemOverdue = currentAlert.label === 'SISTEMA VENCIDO';

    return (
      <>
        <div className={`py-1.5 px-4 rounded-full mb-4 flex items-center gap-3 transition-all duration-700 border animate-in fade-in slide-in-from-top-2 ${currentAlert.type === 'danger'
            ? 'bg-rose-50 border-rose-100 text-rose-800 shadow-sm shadow-rose-100/20'
            : 'bg-amber-50 border-amber-100 text-amber-800 shadow-sm shadow-amber-100/20'
          }`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-inner shrink-0 ${currentAlert.type === 'danger' ? 'bg-rose-200/50' : 'bg-amber-200/50'
            }`}>
            {currentAlert.icon}
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className={`text-[8px] font-black uppercase tracking-[0.1em] shrink-0 ${currentAlert.type === 'danger' ? 'text-rose-500' : 'text-amber-600'}`}>
              {currentAlert.label}:
            </span>
            <span className="text-xs font-bold tracking-tight truncate">
              {currentAlert.message}
            </span>
          </div>

          {isSystemOverdue && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="px-3 py-1 bg-rose-600 text-white text-[9px] font-black rounded-full hover:bg-rose-700 transition-all shadow-md active:scale-95 shrink-0"
            >
              PAGAR AHORA
            </button>
          )}

          {alerts.length > 1 && !isSystemOverdue && (
            <span className="text-[7px] font-bold bg-white/60 px-2 py-0.5 rounded-full text-slate-500 shrink-0">
              {currentIndex + 1}/{alerts.length}
            </span>
          )}
        </div>

        {/* Modal de Pagos Rediseñado - Sistema Unificado */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white/95 rounded-[48px] p-6 lg:p-10 w-full max-w-5xl shadow-4xl animate-in zoom-in-95 duration-500 border border-white relative overflow-y-auto max-h-[95vh] custom-scrollbar">
              
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-6 right-6 w-10 h-10 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 rounded-xl flex items-center justify-center transition-all duration-300 text-lg font-bold z-20"
              >
                ✕
              </button>

              <div className="text-center mb-10">
                <h3 className="text-3xl lg:text-5xl font-black text-slate-900 mb-2 tracking-tighter leading-none uppercase italic">
                   Renovación <span className="text-indigo-600">Oficial</span>
                </h3>
                <p className="text-slate-500 text-sm font-medium italic opacity-70">Selecciona el plan implementado en administración general para continuar.</p>
              </div>

              <PricingPlans />

              <p className="mt-10 text-center text-[9px] text-slate-300 font-black uppercase tracking-[0.4em] italic">
                Impulsa POS &copy; 2026 - Soluciones de Infraestructura Digital
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="py-1.5 px-4 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 border border-indigo-100/50 rounded-full mb-4 flex items-center gap-3 shadow-sm shadow-indigo-100/10 animate-in fade-in slide-in-from-top-2">
      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center text-sm shadow-sm shrink-0">
        🌟
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[8px] font-black uppercase tracking-[0.1em] text-indigo-400 shrink-0">DIARIO:</span>
        <span className="text-xs font-medium text-indigo-900 tracking-tight italic truncate">
          "{motivation}"
        </span>
      </div>
    </div>
  );
};

export default NotificationPanel;
