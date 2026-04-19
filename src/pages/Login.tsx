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
  const leftPanelRef = useRef<HTMLDivElement>(null);

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
        setExpiredData({ empresa_id: data.empresa_id });
        setError("Tu suscripción ha expirado. Por favor renueva tu acceso para continuar.");
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
    <div className="min-h-screen w-full bg-slate-100/50 flex items-center justify-center p-2 lg:p-6 font-sans overflow-hidden selection:bg-indigo-100">
      
      {/* CONTENEDOR MAESTRO COMPACTO */}
      <div className="w-full max-w-6xl h-full max-h-[750px] bg-white rounded-[40px] shadow-2xl shadow-indigo-100/30 flex flex-col lg:flex-row overflow-hidden border border-white animate-in zoom-in duration-500">
        
        {/* PANEL IZQUIERDO: Acceso Eficiente */}
        <div 
          ref={leftPanelRef}
          className="w-full lg:w-[42%] flex flex-col items-center justify-center p-8 xl:p-12 bg-white z-20 overflow-y-auto scrollbar-hide"
        >
          <div className="w-full max-w-[320px] space-y-6 py-10 my-auto">
            
            {/* Branding Compacto */}
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 flex-shrink-0">
                  <span className="text-2xl">📦</span>
               </div>
               <div>
                  <h1 className="text-xl font-medium tracking-tighter text-slate-900 uppercase leading-none italic">Impulsa POS</h1>
                  <p className="text-[9px] font-medium text-indigo-500 uppercase tracking-widest mt-1 opacity-70">Operación Inteligente</p>
               </div>
            </div>

            {/* Formulario Compacto */}
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="space-y-3">
                  
                  {/* PASO 1: LOGIN O INICIO DE RECUPERACIÓN */}
                  {(mode !== 'recover' || recoverStep === 1) && (
                    <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  {/* NIT Solo en Registro o Recuperación */}
                  {(mode === 'register' || mode === 'recover') && (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">NIT Empresa</label>
                        <input
                            type="text"
                            name="nit"
                            placeholder="1122784852"
                            value={formData.nit}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs"
                        />
                    </div>
                  )}

                  {/* Usuario siempre visible */}
                  {(mode !== 'recover' || recoverStep === 1) && (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Usuario</label>
                        <input
                            type="text"
                            name="username"
                            placeholder="redcograf"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs"
                        />
                    </div>
                  )}
                    </div>
                  )}

                  {/* CAMPOS ADICIONALES PARA REGISTRO */}
                  {mode === 'register' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
                        <input
                            type="email"
                            name="correo"
                            placeholder="admin@empresa.com"
                            value={formData.correo}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs lowercase"
                        />
                    </div>
                  )}

                  {mode === 'login' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 focus:border-indigo-600 outline-none transition-all placeholder:text-slate-300 font-medium text-xs"
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
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                        <p className="text-[10px] text-slate-500 font-medium italic text-center">Seleccione el destino para el código:</p>
                        <div className="grid grid-cols-1 gap-2">
                            <button 
                                type="button" 
                                onClick={() => setRecoverData({...recoverData, method: 'email'})}
                                className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${recoverData.method === 'email' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <span className="text-xl">📧</span>
                                <div className="overflow-hidden">
                                    <p className="text-[8px] font-medium text-slate-400 uppercase tracking-widest">Correo</p>
                                    <p className="text-[10px] font-medium text-slate-700 truncate">{recoverData.obscureEmail}</p>
                                </div>
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setRecoverData({...recoverData, method: 'sms'})}
                                className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${recoverData.method === 'sms' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <span className="text-xl">📱</span>
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
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-1">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1 italic text-center block">Código de Verificación</label>
                            <input
                                type="text"
                                name="otp"
                                maxLength={6}
                                placeholder="000000"
                                value={recoverData.otp}
                                onChange={handleRecoverChange}
                                required
                                className="w-full px-4 py-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-center text-xl font-medium tracking-[0.5em] focus:bg-white focus:ring-4 focus:ring-indigo-100/20 outline-none transition-all placeholder:text-slate-200"
                            />
                            <p className="text-[8px] text-indigo-500 font-medium text-center uppercase tracking-widest mt-2 animate-pulse">Revisa tu {recoverData.method}</p>
                        </div>
                    </div>
                  )}

                  {/* FLUJO RECUPERACIÓN PASO 4: NUEVA CLAVE */}
                  {mode === 'recover' && recoverStep === 4 && (
                    <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                        <div className="space-y-1">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nueva Contraseña</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 outline-none transition-all font-medium text-xs"
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
                        <div className="space-y-1">
                            <label className="text-[9px] font-medium text-slate-400 uppercase tracking-widest ml-1">Confirmar Contraseña</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    placeholder="••••••••"
                                    value={recoverData.confirmPassword}
                                    onChange={handleRecoverChange}
                                    required
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:bg-white focus:ring-4 focus:ring-indigo-100/20 outline-none transition-all font-medium text-xs"
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
                className="w-full py-4 bg-indigo-600 text-white font-medium rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all text-[10px] uppercase tracking-widest italic"
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

            <div className="flex flex-col items-center gap-4 pt-4 border-t border-slate-100 text-center">
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
                  className="w-full py-4 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 text-indigo-700 font-bold rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md hover:shadow-indigo-100/50 transition-all text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 italic hover:-translate-y-0.5 active:translate-y-0"
              >
                  🌐 REGISTRA TU NEGOCIO EN LA NUBE <span className="bg-emerald-500 text-white text-[7px] px-2 py-0.5 rounded-full uppercase ml-1 font-bold animate-pulse">Gratis</span>
              </button>
            </div>

          </div>
        </div>

        {/* PANEL DERECHO: Centro de Información Compacto y Luminoso */}
        <div className="w-full lg:w-[58%] bg-gradient-to-br from-white via-slate-50 to-indigo-50/50 relative overflow-hidden flex items-center justify-center p-10 lg:p-14 order-first lg:order-last border-l border-slate-100">
             
             {/* Decorativos Sutiles y Claros */}
             <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4"></div>
             <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4"></div>
             
             <div className="relative z-10 w-full max-w-lg flex flex-col items-center text-center space-y-6">
                  
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-full font-medium text-[9px] uppercase tracking-widest shadow-lg shadow-indigo-100">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400"></span>
                      Solución Inteligente
                  </div>

                  <div className="space-y-4">
                      <h2 className="text-3xl xl:text-4xl font-medium text-slate-900 leading-tight tracking-tighter italic">
                         Impulsa tu negocio con <br />
                         <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-4">Impulsa POS.</span>
                      </h2>
                      
                      <p className="text-sm text-slate-500 font-medium leading-relaxed italic opacity-80 max-w-sm mx-auto">
                        "El software que simplifica tus ventas y organiza tu operación para crecer sin complicaciones."
                      </p>
                  </div>

                  {/* Glassmorphism en Fondo Claro */}
                  <div className="w-full max-w-sm bg-white p-6 rounded-[32px] border border-indigo-50 shadow-xl shadow-indigo-100/50 transform hover:scale-[1.02] transition-transform duration-500">
                    <p className="text-sm text-indigo-900 font-medium italic leading-tight tracking-tight">
                        "Si quieres avanzar y tomar mejores decisiones, es momento de llevar tu negocio al <span className="text-emerald-500 uppercase tracking-widest underline decoration-emerald-100 underline-offset-4">siguiente nivel."</span>
                    </p>
                  </div>

                  {/* SECCIÓN DE CONTACTO LUMINOSA */}
                  <div className="w-full max-w-[320px] pt-4 space-y-4">
                      <div className="flex flex-col items-center gap-3">
                          <p className="text-slate-400 font-medium text-[9px] uppercase tracking-widest">¿Necesitas Soporte Técnico?</p>
                          
                          <div className="w-full bg-white p-5 rounded-[40px] shadow-3xl shadow-indigo-100/50 border border-white flex flex-col items-center gap-4 group">
                              <div className="flex flex-col items-center text-center gap-1">
                                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-1">WhatsApp Directo</span>
                                  <div className="flex items-center gap-3">
                                      <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-xl shadow-sm transform -rotate-3 group-hover:rotate-0 transition-transform">💬</div>
                                      <span className="text-3xl font-medium text-indigo-700 tracking-tighter">315 279 6683</span>
                                  </div>
                              </div>
                              
                              <button 
                                  onClick={handleWhatsApp}
                                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-medium text-[10px] uppercase tracking-[0.1em] transition-all duration-300 shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 italic"
                              >
                                  <span>Contactar ahora</span>
                                  <span className="text-xl group-hover:translate-x-1 transition-transform">🚀</span>
                              </button>
                              
                              <p className="text-[9px] text-slate-400 font-medium italic uppercase tracking-widest opacity-80 animate-pulse">Respuesta inmediata 24/7</p>
                          </div>
                      </div>
                  </div>
             </div>
        </div>

      </div>

    </div>
  );
};

export default Login;
