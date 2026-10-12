import React, { useState } from 'react';
import API from '../api/api';

interface LoginAdministracionProps {
  onLoginSuccess?: () => void;
}

function LoginAdministracion({ onLoginSuccess }: LoginAdministracionProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const response = await API.post('/auth/login', {
        username,
        password
      });

      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminUser', response.data.username);
        localStorage.setItem('adminRole', response.data.role);
        localStorage.setItem('adminEmpresaId', String(response.data.empresa_id || '1'));
        
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    } catch (err: any) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Error de conexión con el servidor.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 p-4">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(63,66,241,0.1),transparent)] pointer-events-none"></div>

      <div className="w-full max-w-sm animate-in fade-in zoom-in duration-700 relative z-10 my-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-[40px] shadow-2xl p-8 md:p-10 text-center space-y-8 overflow-hidden group">
            
            <div className="space-y-4">
                <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-inner shadow-indigo-500/10 group-hover:rotate-12 transition-transform duration-500">
                    🛡️
                </div>
                <div className="space-y-1">
                    <h2 className="text-white text-xl font-black tracking-tight uppercase">Acceso Restringido</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Centro de Mando ERP</p>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 duration-300">
                    ⚠️ {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuario Master</label>
                    <input 
                        type="text" 
                        placeholder="Admin ID"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoFocus
                        className="w-full px-5 py-3.5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:bg-slate-800 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    />
                </div>

                <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Código de Seguridad</label>
                    <input 
                        type="password" 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-5 py-3.5 bg-slate-800/50 border border-slate-700 rounded-2xl text-white font-bold text-sm outline-none focus:bg-slate-800 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    />
                </div>

                <button 
                    type="submit" 
                    className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-600/10 hover:bg-indigo-500 hover:-translate-y-1 transition-all disabled:opacity-30 text-[10px] uppercase tracking-widest group-active:translate-y-0"
                    disabled={loading}
                >
                    {loading ? 'Validando...' : 'Iniciar Autenticación'}
                </button>
            </form>

            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em] pt-4">
                Solo Personal Nivel 1 Autorizado
            </p>
            
            {/* Corner Light Effect */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl pointer-events-none rounded-full"></div>
        </div>
        
        <p className="mt-8 text-center text-slate-700 text-[10px] font-black uppercase tracking-[0.5em] opacity-40 italic">
            Secure Kernel v4.0.2
        </p>
      </div>
    </div>
  );
}

export default LoginAdministracion;
