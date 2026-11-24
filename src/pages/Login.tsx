import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/api'; 

import WompiCheckout from '../components/WompiCheckout';
import { useCaja } from '../components/CajaContext';


const Login: React.FC = () => {
  const navigate = useNavigate();
  const { verificarEstado } = useCaja();
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');

  const [recoverStep, setRecoverStep] = useState(1); // 1: NIT/User, 2: Method, 3: OTP, 4: New Pass
  const [recoverData, setRecoverData] = useState({ nit: '', method: '', obscureEmail: '', obscurePhone: '', otp: '', confirmPassword: '' });
  
  const [formData, setFormData] = useState({
    username: '',
    correo: '',
    password: '',
    nit: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [expiredData, setExpiredData] = useState<{empresa_id: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTiendaModal, setShowTiendaModal] = useState(false);
  const [animStep, setAnimStep] = useState(0);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // Coreografía de animación escalonada al cargar la página
  useEffect(() => {
    // Momento 1: 150ms -> Entrada con gran desplazamiento de "NUEVO SERVICIO"
    const t1 = setTimeout(() => setAnimStep(1), 150);
    // Momento 2: 750ms -> Entrada con desplazamiento de "Tienda en línea 24/7"
    const t2 = setTimeout(() => setAnimStep(2), 750);
    // Momento 3: 1350ms -> Revelación suave del resto (subtítulo, imagen 3D, beneficios y acciones)
    const t3 = setTimeout(() => setAnimStep(3), 1350);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Efecto para centrar el inicio de la barra de desplazamiento (Scroll position)
  useEffect(() => {
    if (leftPanelRef.current) {
      const container = leftPanelRef.current;
      // Pequeño timeout para permitir que el DOM se asiente
      setTimeout(() => {
        const scrollAmount = (container.scrollHeight - container.clientHeight) / 2;
        container.scrollTo({ top: scrollAmount, behavior: 'smooth' });
      }, 50);
    }
  }, [mode, recoverStep]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    setExpiredData(null);
  };

  const handleRecoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecoverData({ ...recoverData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExpiredData(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        const payload = {
            nombre_comercial: formData.username, // Registro simplificado
            username: formData.username,
            password: formData.password,
            correo: formData.correo,
            niti: formData.nit
        };
        await API.post('/auth/registro-empresa', payload);
        alert('🎉 ¡Tienda Creada! Ahora puedes iniciar sesión con tus credenciales.');
        setMode('login');
        setFormData({ ...formData, password: '' });
      } else if (mode === 'recover') {
        // FLUJO POR PASOS DE RECUPERACIÓN SEGURA
        if (recoverStep === 1) {
            const res = await API.post('/auth/solicitar-codigo', { username: formData.username, nit: formData.nit });
            setRecoverData({ ...recoverData, obscureEmail: res.data.email, obscurePhone: res.data.phone });
            setRecoverStep(2);
        } else if (recoverStep === 2) {
            if (!recoverData.method) return setError("Selecciona un método de envío");
            await API.post('/auth/enviar-codigo', { username: formData.username, nit: formData.nit, metodo: recoverData.method });
            setRecoverStep(3);
        } else if (recoverStep === 3) {
            await API.post('/auth/verificar-codigo', { username: formData.username, nit: formData.nit, codigo: recoverData.otp });
            setRecoverStep(4);
        } else if (recoverStep === 4) {
            if (formData.password !== recoverData.confirmPassword) return setError("Las contraseñas no coinciden");
            await API.post('/auth/restablecer-final', { username: formData.username, nit: formData.nit, codigo: recoverData.otp, newPassword: formData.password });
            alert('🔑 Acceso restaurado. Ya puedes entrar con tu nueva clave.');
            setMode('login');
            setRecoverStep(1);
            setFormData({ ...formData, password: '' });
        }
      } else {
        const response = await API.post('/auth/login', {
          username: formData.username,
          password: formData.password
        });

        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminRole', response.data.role);
        localStorage.setItem('adminUser', response.data.username);
        localStorage.setItem('adminEmpresaId', response.data.empresa_id);
        localStorage.setItem('adminCajeroId', response.data.cajero_id || "");
        localStorage.setItem('adminPermisos', response.data.permisos || "");
        
        await verificarEstado();
        navigate('/');
      }

    } catch (err: any) {
      const data = err.response?.data;
      if (data?.reason === 'expired') {
        navigate(`/renovacion?empresa_id=${data.empresa_id}`);
      } else {
        setError(data?.error || 'Verifique sus datos e intente nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsApp = () => {
    const message = "Hola, requiero información sobre Impulsa POS.";
    window.open(`https://wa.me/573152796683?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="h-screen max-h-screen w-full flex flex-col lg:flex-row font-sans selection:bg-indigo-100 overflow-y-auto lg:overflow-hidden bg-white">
      
      {/* LADO IZQUIERDO: Escaparate Publicitario Tienda en Línea (COPIA EXACTA DE EJEMPLO DE DISEÑO) */}
      <div className="w-full lg:w-[58%] xl:w-[60%] h-full max-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 text-slate-900 relative overflow-hidden flex flex-col justify-between p-3 sm:p-4 lg:p-4 xl:p-6 border-b lg:border-b-0 lg:border-r border-slate-200/80 order-2 lg:order-1">
             
        {/* Decorativos de Fondo Curvos y Suaves */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-teal-100/40 rounded-full blur-3xl pointer-events-none"></div>

        {/* Encabezado Superior Publicitario */}
        <div className="relative z-10 flex items-center justify-between pb-0.5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 lg:w-8.5 lg:h-8.5 bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-300/40">
              <span className="text-sm lg:text-base text-white">📦</span>
            </div>
            <div>
              <span className="text-xs lg:text-sm font-black tracking-tight text-slate-900 uppercase italic">IMPULSA POS</span>
              <span className="text-[7.5px] lg:text-[8px] font-extrabold text-indigo-600 block uppercase tracking-widest leading-none">E-COMMERCE CLOUD</span>
            </div>
          </div>

          <div className="inline-flex items-center px-3 py-0.5 bg-teal-50 border border-teal-200/80 text-teal-800 rounded-full text-[8.5px] lg:text-[9px] font-extrabold uppercase tracking-wider shadow-sm">
            LANZAMIENTO 2026
          </div>
        </div>
             
        {/* Contenedor Central con Animaciones Escalonadas */}
        <div className="relative z-10 w-full flex flex-col items-center text-center space-y-1.5 lg:space-y-2 my-auto max-w-lg mx-auto py-0 flex-1 justify-center min-h-0">
                  
          {/* MOMENTO 1: Badge "NUEVO SERVICIO | TIENDA EN 1 CLIC" con Entrada desde la Izquierda */}
          <div className={`transition-all duration-700 ease-out transform flex-shrink-0 ${
            animStep >= 1 ? 'translate-x-0 opacity-100' : '-translate-x-32 opacity-0'
          }`}>
            <div className="inline-flex items-center p-0.5 bg-gradient-to-r from-purple-100/80 via-white to-indigo-100/80 border border-purple-200/90 rounded-full shadow-sm">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 lg:px-3 lg:py-1 bg-gradient-to-r from-purple-700 to-indigo-600 text-white rounded-full font-black text-[8.5px] lg:text-[9px] uppercase tracking-wider shadow-sm">
                <span>🚀</span> NUEVO SERVICIO
              </span>
              <span className="px-2.5 py-0.5 lg:px-3 lg:py-1 text-indigo-950 font-bold text-[8.5px] lg:text-[9px] uppercase tracking-wider">
                | TIENDA EN 1 CLIC
              </span>
            </div>
          </div>

          {/* MOMENTO 2: Titular "Tienda en línea 24/7" con Insignia Esmeralda y Destellos */}
          <div className={`space-y-0.5 max-w-md transition-all duration-700 ease-out transform flex-shrink-0 ${
            animStep >= 2 ? 'translate-x-0 opacity-100' : '-translate-x-28 opacity-0'
          }`}>
            <h2 className="text-2xl sm:text-3xl lg:text-3xl xl:text-[34px] font-black text-slate-950 leading-tight tracking-tight flex items-center justify-center gap-1.5 lg:gap-2">
              <span>Tienda en línea</span>
              <span className="relative inline-block">
                <span className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-xl sm:text-2xl lg:text-2xl xl:text-3xl px-2.5 lg:px-3 py-0.5 rounded-xl lg:rounded-2xl shadow-md shadow-emerald-600/30 inline-block align-middle">
                  24/7
                </span>
                {/* 3 Destellos Radiantes */}
                <svg className="absolute -top-2 -right-2 w-3.5 h-3.5 text-emerald-500 select-none pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="5" y1="14" x2="2" y2="10" />
                  <line x1="12" y1="9" x2="12" y2="4" />
                  <line x1="19" y1="14" x2="22" y2="10" />
                </svg>
              </span>
            </h2>
          </div>

          {/* MOMENTO 3: Taglines con Tipografía Púrpura y Gris */}
          <div className={`space-y-0.5 max-w-md transition-all duration-700 ease-out transform flex-shrink-0 ${
            animStep >= 3 ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'
          }`}>
            <p className="text-xs sm:text-sm lg:text-sm xl:text-base font-black text-indigo-950 leading-snug">
              Vende a cualquier hora, desde cualquier lugar.
            </p>
            <p className="text-[10px] lg:text-[11px] text-slate-600 font-normal leading-relaxed max-w-sm mx-auto">
              Convierte tu negocio en una tienda en línea y gestiona tus ventas e inventario desde una sola plataforma.
            </p>
          </div>

          {/* MOMENTO 4: Imagen Central 3D (Podio, Laptop, Móvil, Bolsa y Badge) */}
          <div className={`relative w-full max-w-md flex items-center justify-center py-0 min-h-0 flex-shrink transition-all duration-800 ease-out transform ${
            animStep >= 3 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-90'
          }`}>
             <img 
               src="/tienda-promo.png" 
               alt="Tienda en Línea Impulsa POS" 
               className="w-auto h-auto max-h-[110px] sm:max-h-[125px] md:max-h-[135px] lg:max-h-[145px] xl:max-h-[170px] 2xl:max-h-[195px] object-contain select-none transition-transform duration-500 hover:scale-[1.02]"
             />
          </div>

          {/* MOMENTO 5: Las 3 Tarjetas de Beneficios (Grid Idéntico al Ejemplo) */}
          <div className={`grid grid-cols-3 gap-1.5 lg:gap-2 w-full max-w-md transition-all duration-700 ease-out transform flex-shrink-0 ${
            animStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}>
             <div className="bg-white/95 border border-slate-100 shadow-sm shadow-slate-200/50 rounded-xl lg:rounded-2xl p-1.5 lg:p-2 text-center">
                <span className="text-base lg:text-lg block">⚡</span>
                <p className="text-[10px] lg:text-[11px] font-black text-slate-900 mt-0.5 leading-tight">1 Solo Clic</p>
                <p className="text-[8px] lg:text-[9px] text-slate-500 leading-none mt-0.5">Sin programar</p>
             </div>
             <div className="bg-white/95 border border-slate-100 shadow-sm shadow-slate-200/50 rounded-xl lg:rounded-2xl p-1.5 lg:p-2 text-center">
                <span className="text-base lg:text-lg block">🔄</span>
                <p className="text-[10px] lg:text-[11px] font-black text-slate-900 mt-0.5 leading-tight">Cero Sobreventa</p>
                <p className="text-[8px] lg:text-[9px] text-slate-500 leading-none mt-0.5">Stock en vivo</p>
             </div>
             <div className="bg-gradient-to-b from-teal-50/70 to-emerald-50/50 border border-teal-300 rounded-xl lg:rounded-2xl p-1.5 lg:p-2 text-center shadow-sm shadow-teal-100/50">
                <span className="text-base lg:text-lg block">🎁</span>
                <p className="text-[10px] lg:text-[11px] font-black text-teal-900 mt-0.5 leading-tight">14 Días Gratis</p>
                <p className="text-[8px] lg:text-[9px] text-teal-700 font-bold leading-none mt-0.5">$70.000/mes</p>
             </div>
          </div>

          {/* MOMENTO 6: Los 2 Botones Redondeados (Pill Buttons) */}
          <div className={`w-full max-w-md flex flex-col sm:flex-row gap-1.5 lg:gap-2 transition-all duration-700 ease-out transform flex-shrink-0 ${
            animStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
          }`}>
             <button
                type="button"
                onClick={() => setShowTiendaModal(true)}
                className="flex-1 py-2 px-3.5 lg:py-2.5 lg:px-4 bg-gradient-to-r from-purple-700 via-indigo-600 to-purple-800 hover:from-purple-600 hover:to-indigo-500 text-white rounded-full font-black text-[9px] lg:text-[10px] uppercase tracking-wider shadow-md shadow-purple-600/30 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
             >
                <span>✨ VER CÓMO FUNCIONA</span>
                <span className="text-xs">→</span>
             </button>
             <button
                type="button"
                onClick={handleWhatsApp}
                className="py-2 px-3.5 lg:py-2.5 lg:px-4 bg-white hover:bg-teal-50/50 text-teal-800 border-2 border-teal-400 rounded-full font-black text-[9px] lg:text-[10px] uppercase tracking-wider shadow-sm transition flex items-center justify-center gap-1.5"
             >
                <span className="text-xs">💬</span>
                <span>ASESORÍA WHATSAPP</span>
             </button>
          </div>

        </div>

        {/* Pie Inferior Publicitario */}
        <div className="relative z-10 pt-1.5 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-1 text-[9px] lg:text-[10px] text-slate-500 text-center sm:text-left flex-shrink-0">
           <span className="flex items-center gap-1 font-semibold text-slate-700">
             <span className="text-amber-500 font-bold">⚡</span> Sincronización nativa con inventario en tiempo real
           </span>
           <span className="text-teal-800 font-black">14 Días de Prueba Gratis Incluidos</span>
        </div>

      </div>

      {/* LADO DERECHO: Formulario de Acceso y Gestión */}
      <div 
        ref={leftPanelRef}
        className="w-full lg:w-[42%] xl:w-[40%] h-full max-h-screen flex flex-col items-center justify-center p-4 lg:p-6 xl:p-8 bg-white z-20 overflow-hidden order-1 lg:order-2"
      >
        <div className="w-full max-w-[320px] space-y-2.5 my-auto">
            
            {/* Branding Compacto */}
            <div className="flex items-center gap-2.5">
               <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 flex-shrink-0">
                  <span className="text-lg">📦</span>
               </div>
               <div>
                  <h1 className="text-base font-bold tracking-tight text-slate-900 uppercase leading-none italic">Impulsa POS</h1>
                  <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5 opacity-80">Operación Inteligente</p>
               </div>
            </div>

            {/* Formulario Compacto */}
            <form onSubmit={handleSubmit} className="space-y-2.5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center gap-4 animate-in shake duration-500">
                  <div className="flex items-start gap-2 w-full">
                    <span className="text-base text-red-500 leading-none">⚠️</span>
                    <p className="text-[10px] font-medium text-red-700 uppercase italic">{error}</p>
                  </div>
                  
                  {expiredData && (
                    <div className="w-full pt-2 border-t border-red-100 flex flex-col items-center gap-3">
                      <p className="text-[9px] font-medium text-rose-500 uppercase tracking-widest text-center">Paga $70.000 para Activar 30 Días de Acceso</p>
                      <div className="scale-90 transform origin-center">
                        <WompiCheckout 
                          reference={`SUB_LOGIN_${expiredData.empresa_id}_${Date.now()}`} 
                          amountInCents={7000000} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                  
                  {/* PASO 1: LOGIN O INICIO DE RECUPERACIÓN */}
                  {(mode !== 'recover' || recoverStep === 1) && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                  {/* NIT Solo en Registro o Recuperación */}
                  {(mode === 'register' || mode === 'recover') && (
                    <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">NIT Empresa</label>
                        <input
                            type="text"
                            name="nit"
                            placeholder="1122784852"
                            value={formData.nit}
                            onChange={handleChange}
                            required
                            className="w-full px-3.5 py-2 lg:py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs"
                        />
                    </div>
                  )}

                  {/* Usuario siempre visible */}
                  {(mode !== 'recover' || recoverStep === 1) && (
                    <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Usuario</label>
                        <input
                            type="text"
                            name="username"
                            placeholder="redcograf"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            className="w-full px-3.5 py-2 lg:py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs"
                        />
                    </div>
                  )}
                    </div>
                  )}

                  {/* CAMPOS ADICIONALES PARA REGISTRO */}
                  {mode === 'register' && (
                    <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                        <input
                            type="email"
                            name="correo"
                            placeholder="admin@empresa.com"
                            value={formData.correo}
                            onChange={handleChange}
                            required
                            className="w-full px-3.5 py-2 lg:py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs lowercase"
                        />
                    </div>
                  )}

                  {mode === 'login' && (
                    <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full px-3.5 py-2 lg:py-2.5 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
                            >
                                {showPassword ? "🙈" : "👁️"}
                            </button>
                        </div>
                    </div>
                  )}

                  {/* FLUJO RECUPERACIÓN PASO 2: SELECCIÓN MÉTODO */}
                  {mode === 'recover' && recoverStep === 2 && (
                    <div className="space-y-2 animate-in slide-in-from-right-4 duration-500">
                        <p className="text-[10px] text-slate-500 font-medium italic text-center">Seleccione el destino para el código:</p>
                        <div className="grid grid-cols-1 gap-1.5">
                            <button 
                                type="button" 
                                onClick={() => setRecoverData({...recoverData, method: 'email'})}
                                className={`p-2.5 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${recoverData.method === 'email' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <span className="text-lg">📧</span>
                                <div className="overflow-hidden">
                                    <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">Correo</p>
                                    <p className="text-[10px] font-medium text-slate-700 truncate">{recoverData.obscureEmail}</p>
                                </div>
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setRecoverData({...recoverData, method: 'sms'})}
                                className={`p-2.5 rounded-xl border-2 transition-all text-left flex items-center gap-3 ${recoverData.method === 'sms' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <span className="text-lg">📱</span>
                                <div className="overflow-hidden">
                                    <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">SMS</p>
                                    <p className="text-[10px] font-medium text-slate-700 truncate">{recoverData.obscurePhone}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                  )}

                  {/* FLUJO RECUPERACIÓN PASO 3: OTP */}
                  {mode === 'recover' && recoverStep === 3 && (
                    <div className="space-y-2 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-0.5">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1 italic text-center block">Código de Verificación</label>
                            <input
                                type="text"
                                name="otp"
                                maxLength={6}
                                placeholder="000000"
                                value={recoverData.otp}
                                onChange={handleRecoverChange}
                                required
                                className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center text-lg font-medium tracking-[0.5em] focus:bg-white focus:ring-4 focus:ring-indigo-100/20 outline-none transition-all placeholder:text-slate-200"
                            />
                            <p className="text-[8px] text-indigo-500 font-medium text-center uppercase tracking-widest mt-1 animate-pulse">Revisa tu {recoverData.method}</p>
                        </div>
                    </div>
                  )}

                  {/* FLUJO RECUPERACIÓN PASO 4: NUEVA CLAVE */}
                  {mode === 'recover' && recoverStep === 4 && (
                    <div className="space-y-2 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-0.5">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 outline-none transition-all font-medium text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-0.5">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    placeholder="••••••••"
                                    value={recoverData.confirmPassword}
                                    onChange={handleRecoverChange}
                                    required
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 outline-none transition-all font-medium text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>
                    </div>
                  )}

              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 lg:py-3 bg-indigo-600 text-white font-medium rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all text-[10px] uppercase tracking-widest italic"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                ) : (
                  <span>
                    {mode === 'register' ? 'Registrar Empresa' : 
                     mode === 'recover' ? (
                        recoverStep === 1 ? 'Validar Identidad' :
                        recoverStep === 2 ? 'Enviar Código' :
                        recoverStep === 3 ? 'Verificar Código' : 'Restaurar Clave'
                     ) : 'Entrar al Sistema'}
                  </span>
                )}
              </button>
            </form>

            <div className="flex flex-col items-center gap-2.5 pt-2.5 border-t border-slate-100 text-center">
              <div className="flex w-full gap-2 justify-center">
                  <button
                      type="button"
                      onClick={() => { setMode(mode === 'register' || mode === 'recover' ? 'login' : 'register'); setError(null); setRecoverStep(1); }}
                      className="text-[9px] font-medium text-slate-400 hover:text-indigo-600 transition-colors uppercase"
                  >
                      {mode === 'login' ? 'Crear Registro' : 'Volver al Inicio'}
                  </button>
                  {mode === 'login' && (
                      <>
                        <span className="text-slate-200">|</span>
                        <button
                            type="button"
                            onClick={() => { setMode('recover'); setError(null); setRecoverStep(1); }}
                            className="text-[9px] font-medium text-slate-400 hover:text-indigo-600 transition-colors uppercase"
                        >
                            ¿Olvidó Clave?
                        </button>
                      </>
                  )}
              </div>

              <button
                  type="button"
                  onClick={() => navigate('/registro-saas')}
                  className="w-full py-2.5 lg:py-3 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 text-indigo-700 font-bold rounded-xl border border-indigo-100 shadow-sm hover:shadow-md hover:shadow-indigo-100/50 transition-all text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 italic hover:-translate-y-0.5 active:translate-y-0"
              >
                  🌐 REGISTRA TU NEGOCIO EN LA NUBE <span className="bg-emerald-500 text-white text-[7px] px-2 py-0.5 rounded-full uppercase ml-1 font-bold animate-pulse">Gratis</span>
              </button>
            </div>

          </div>
        </div>

      {/* MODAL INFORMATIVO DE LANZAMIENTO TIENDA EN LÍNEA */}
      {showTiendaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="w-full max-w-xl bg-slate-900 border border-indigo-500/40 rounded-3xl shadow-2xl p-6 lg:p-8 text-white relative space-y-6">
              
              {/* Botón Cerrar */}
              <button 
                onClick={() => setShowTiendaModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
              >
                ✕
              </button>

              {/* Encabezado */}
              <div className="space-y-1">
                 <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold uppercase tracking-wider">
                   🌐 Complemento SaaS Impulsa POS
                 </div>
                 <h3 className="text-xl font-extrabold text-white">
                   Tu Tienda en Línea en 1 Clic
                 </h3>
                 <p className="text-xs text-slate-300">
                   Empieza a vender por internet sin pagar comisiones por venta a terceros ni contratar desarrolladores.
                 </p>
              </div>

              {/* Pasos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                 <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/50 space-y-1">
                    <span className="text-lg">1️⃣</span>
                    <h4 className="font-bold text-white">Activa en 1 Clic</h4>
                    <p className="text-[11px] text-slate-300">Desde tu panel de administración activas tu subdominio personalizado de inmediato.</p>
                 </div>
                 <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/50 space-y-1">
                    <span className="text-lg">2️⃣</span>
                    <h4 className="font-bold text-white">Sincroniza tus Productos</h4>
                    <p className="text-[11px] text-slate-300">Elige qué productos mostrar y sus fotos. El stock se descuenta en vivo con el POS.</p>
                 </div>
                 <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/50 space-y-1">
                    <span className="text-lg">3️⃣</span>
                    <h4 className="font-bold text-white">Tus Pagos Directos</h4>
                    <p className="text-[11px] text-slate-300">Configura tus llaves de Wompi y recibe el dinero de Nequi, PSE o tarjetas en tu banco.</p>
                 </div>
                 <div className="bg-slate-800/70 p-3 rounded-2xl border border-slate-700/50 space-y-1">
                    <span className="text-lg">4️⃣</span>
                    <h4 className="font-bold text-white">Recibe Pedidos al POS</h4>
                    <p className="text-[11px] text-slate-300">Los pedidos de tus clientes entran organizados a tu sistema para despacho rápido.</p>
                 </div>
              </div>

              {/* Oferta y Precios */}
              <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 p-4 rounded-2xl border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div>
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">🎁 Promoción Exclusiva</span>
                    <p className="text-sm font-extrabold text-white">14 Días de Prueba 100% Gratis</p>
                    <p className="text-[11px] text-slate-300">Luego solo <strong className="text-white">$70.000 COP / mes</strong> adicionales a tu suscripción POS.</p>
                 </div>
                 <button
                    onClick={() => {
                      setShowTiendaModal(false);
                      setMode('login');
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/30 whitespace-nowrap"
                 >
                    Ingresar y Activar
                 </button>
              </div>

           </div>
        </div>
      )}

    </div>
  );
};

export default Login;
