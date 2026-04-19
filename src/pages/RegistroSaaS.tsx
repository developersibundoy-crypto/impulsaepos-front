import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/api';

const RegistroSaaS = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    nombre_comercial: '',
    niti: '',
    telefono: '',
    correo: '',
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await API.post('/auth/registro-empresa', formData);
      if (data.success) {
        localStorage.clear(); // Limpiar cualquier residuo de sesiones anteriores
        alert(data.message || '🎉 ¡Registro Exitoso! Tu empresa ha sido creada. Ahora puedes iniciar sesión con tus credenciales.');
        navigate('/login');
      }
    } catch (err: any) {
      const msg = err.response?.data?.detalle || err.response?.data?.error || 'Error de conexión al servidor.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-50/50 backdrop-blur-sm overflow-y-auto p-4 py-10">
      <div className="w-full max-w-lg animate-in fade-in zoom-in duration-700 my-auto">
        <div className="bg-white rounded-[40px] shadow-3xl shadow-slate-200/50 border border-slate-100/50 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
            
            {/* Sidebar Visual Refinado - Más Estrecho */}
            <div className="lg:col-span-2 bg-gradient-to-b from-slate-900 to-slate-800 p-8 text-white flex flex-col justify-between relative overflow-hidden hidden lg:flex">
                <div className="relative z-10 space-y-4">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur-xl rounded-xl flex items-center justify-center text-xl shadow-xl">🚀</div>
                    <div className="space-y-1">
                        <h2 className="text-xl font-medium tracking-tight leading-tight italic">Prueba<br /><span className="text-indigo-300">Gratis</span></h2>
                        <p className="text-slate-400 text-[9px] font-medium uppercase tracking-widest leading-relaxed italic opacity-70">7 días acceso total.</p>
                    </div>
                </div>

                <div className="relative z-10 space-y-3 pt-8 border-t border-white/5">
                   <div className="flex items-center gap-2 text-[8px] font-medium uppercase tracking-[0.2em] text-emerald-400/80">
                        <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse"></span> 
                        SaaS POS
                   </div>
                   <p className="text-slate-500 text-[8px] leading-relaxed uppercase font-medium opacity-50 tracking-wider">Multi-sucursal & Auditoría.</p>
                </div>

                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
            </div>

            {/* Form Section - Más Compacto */}
            <div className="lg:col-span-3 p-6 md:p-8 space-y-6 bg-white">
                <div className="block lg:hidden text-center mb-4">
                    <h2 className="text-xl font-medium text-slate-900 tracking-tight italic">Registro SaaS</h2>
                </div>

                {error && (
                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[8px] font-medium uppercase tracking-widest animate-in slide-in-from-top-2 flex items-center gap-2 italic">
                        <span className="text-sm">⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-medium text-slate-400 uppercase tracking-widest ml-1">Identidad Comercial</label>
                            <input type="text" name="nombre_comercial" placeholder="Nombre del Negocio *" required onChange={handleChange} className="w-full px-5 py-3 bg-slate-50/50 border border-slate-100 rounded-xl font-medium text-xs outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all uppercase placeholder:italic" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-medium text-slate-400 uppercase tracking-widest ml-1">NIT (Opc.)</label>
                                <input type="text" name="niti" placeholder="900..." onChange={handleChange} className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-xl font-medium text-xs outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all uppercase placeholder:italic" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-medium text-slate-400 uppercase tracking-widest ml-1">Contacto</label>
                                <input type="text" name="telefono" placeholder="WhatsApp" onChange={handleChange} className="w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-xl font-medium text-xs outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all placeholder:italic" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[8px] font-medium text-slate-400 uppercase tracking-widest ml-1">Email Principal</label>
                            <input type="email" name="correo" placeholder="admin@tienda.com *" required onChange={handleChange} className="w-full px-5 py-3 bg-slate-50/50 border border-slate-100 rounded-xl font-medium text-xs outline-none focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all lowercase italic placeholder:not-italic" />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100/80 grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-medium text-indigo-500 uppercase tracking-widest ml-1 italic opacity-60">Usuario</label>
                            <input type="text" name="username" placeholder="User" required onChange={handleChange} className="w-full px-4 py-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl font-medium text-xs text-indigo-700 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100/20 transition-all lowercase" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-medium text-indigo-500 uppercase tracking-widest ml-1 italic opacity-60">Clave</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    name="password" 
                                    placeholder="••••" 
                                    required 
                                    onChange={handleChange} 
                                    className="w-full px-4 py-3 bg-indigo-50/30 border border-indigo-100/50 rounded-xl font-medium text-xs text-indigo-700 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100/20 transition-all" 
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

                    <button type="submit" disabled={loading} className="w-full py-3.5 bg-slate-900 text-white font-medium rounded-xl shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-0.5 transition-all uppercase tracking-[0.2em] text-[10px] italic mt-2">
                        {loading ? 'Activando...' : '🚀 Lanzar mi Negocio'}
                    </button>
                </form>

                <div className="text-center pt-1">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest opacity-80">¿Ya tienes cuenta? <span onClick={() => navigate('/login')} className="text-indigo-600 cursor-pointer hover:underline underline-offset-4">Entrar</span></p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistroSaaS;
