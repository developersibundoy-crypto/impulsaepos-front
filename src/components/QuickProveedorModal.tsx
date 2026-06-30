import React, { useState } from "react";
import API from "../api/api";

interface QuickProveedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProveedorCreated: (proveedor: any) => void;
}

export function QuickProveedorModal({ isOpen, onClose, onProveedorCreated }: QuickProveedorModalProps) {
  const [formData, setFormData] = useState({
    nombre_comercial: "",
    nit: "",
    direccion: "",
    telefono: "",
    correo: ""
  });
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await API.post("/proveedores", formData);
      onProveedorCreated(res.data);
      setFormData({ nombre_comercial: "", nit: "", direccion: "", telefono: "", correo: "" });
    } catch (err: any) {
      alert("Error creando proveedor: " + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-md bg-white rounded-[40px] shadow-3xl p-10 animate-in zoom-in duration-300 border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1">
            <h2 className="text-2xl text-slate-900 font-black leading-none">Nuevo Aliado</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Creación Rápida</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all font-semibold">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Razón Social / Nombre <span className="text-rose-500">*</span></label>
            <input type="text" name="nombre_comercial" value={formData.nombre_comercial} onChange={handleChange} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all uppercase" placeholder="Ej: Distribuidora Global S.A" autoFocus />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NIT / Tax ID</label>
            <input type="text" name="nit" value={formData.nit} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all uppercase" placeholder="900.000.000-0" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sede Operativa</label>
            <textarea name="direccion" value={formData.direccion} onChange={handleChange} rows={2} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all resize-none" placeholder="Carrera 45 # 12-34..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all" placeholder="300 000 0000" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <input type="email" name="correo" value={formData.correo} onChange={handleChange} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all lowercase" placeholder="proveedor@email.com" />
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="w-full py-5 bg-indigo-600 text-white rounded-3xl shadow-2xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-[10px] font-black mt-4">
            {isLoading ? "⏳ Creando..." : "✅ Registrar Aliado"}
          </button>
        </form>
      </div>
    </div>
  );
}
