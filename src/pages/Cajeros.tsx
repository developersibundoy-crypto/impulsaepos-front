import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";

const AVAILABLE_MODULES = [
  { id: "venta", label: "Venta General (POS)" },
  { id: "mayoristas", label: "Ventas Mayoristas" },
  { id: "inventario", label: "Inventario Global" },
  { id: "ajustes", label: "Ajustes de Stock" },
  { id: "ingreso", label: "Ingreso de Mercancía" },
  { id: "kardex", label: "Kardex de Movimientos" },
  { id: "facturas_venta", label: "Historial Ventas" },
  { id: "facturas_compra", label: "Historial Compras" },
  { id: "clientes", label: "Gestión Clientes" },
  { id: "proveedores", label: "Gestión Proveedores" },
  { id: "recursos_humanos", label: "Nómina y Cajeros" },
  { id: "analitica", label: "Dashboard y AI" },
  { id: "reportes", label: "Reportes Gerenciales" },
  { id: "configuracion", label: "Perfil Empresa" },
  { id: "separados", label: "Apartados / Separados" },
];

function Cajeros() {
  const [cajeros, setCajeros] = useState<any[]>([]);
  
  // States for form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    documento: "",
    telefono: "",
    direccion: "",
    fecha_contrato: "",
    salario: "",
    paga_comisiones: false,
    porcentaje_comision: "",
    username: "",
    password: "", 
    permisos: [] as string[],
    role: "cajero"
  });

  const fetchCajeros = () => {
    API.get("/cajeros").then(res => setCajeros(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchCajeros();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePermissionChange = (moduleId: string) => {
    setFormData(prev => {
      const current = [...prev.permisos];
      if (current.includes(moduleId)) {
        return { ...prev, permisos: current.filter(id => id !== moduleId) };
      } else {
        return { ...prev, permisos: [...current, moduleId] };
      }
    });
  };

  const toggleSelectAll = () => {
    if (formData.permisos.length === AVAILABLE_MODULES.length) {
      setFormData({ ...formData, permisos: [] });
    } else {
      setFormData({ ...formData, permisos: AVAILABLE_MODULES.map(m => m.id) });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      nombre: "", documento: "", telefono: "", direccion: "",
      fecha_contrato: "", salario: "", paga_comisiones: false, porcentaje_comision: "",
      username: "", password: "", permisos: [], role: "cajero"
    });
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    let parsedPermisos: string[] = [];
    try {
      if (c.permisos === "all") {
        parsedPermisos = AVAILABLE_MODULES.map(m => m.id);
      } else if (c.permisos) {
        parsedPermisos = JSON.parse(c.permisos);
      }
    } catch (e) {
      console.log("Error parsing permisos", e);
    }

    setFormData({
      nombre: c.nombre || "",
      documento: c.documento || "",
      telefono: c.telefono || "",
      direccion: c.direccion || "",
      fecha_contrato: c.fecha_contrato ? c.fecha_contrato.split('T')[0] : "",
      salario: c.salario || "",
      paga_comisiones: c.paga_comisiones === 1 || c.paga_comisiones === true,
      porcentaje_comision: c.porcentaje_comision || "",
      username: c.username || "",
      password: "", 
      permisos: parsedPermisos,
      role: c.role || "cajero"
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre) return alert("Nombre obligatorio");
    
    const payload = {
      ...formData,
      permisos: formData.permisos.length === AVAILABLE_MODULES.length ? "all" : JSON.stringify(formData.permisos)
    };

    try {
      if (editingId) {
        await API.put(`/cajeros/${editingId}`, payload);
      } else {
        await API.post("/cajeros", payload);
      }
      resetForm();
      fetchCajeros();
    } catch (error: any) {
      console.error(error);
      alert("Error: " + (error.response?.data?.error || error.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("⚠️ ¿Dar de baja a este empleado? Esto también eliminará su acceso al sistema.")) return;
    try {
      await API.delete(`/cajeros/${id}`);
      fetchCajeros();
    } catch (error) {
      alert("Error eliminando empleado");
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20 px-4">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 uppercase italic">
            Gestión de Talento
          </h1>
          <p className="text-slate-500 font-bold text-lg italic uppercase tracking-tight">Control de nómina, comisiones y permisos por módulo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        
        {/* Form Column */}
        <div className="xl:col-span-4">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-2xl sticky top-8 max-h-[90vh] overflow-y-auto scrollbar-hide">
                <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2 uppercase italic tracking-tighter text-indigo-600">
                    <span className="w-2 h-6 bg-indigo-600 rounded-full"></span> 
                    {editingId ? "Editar Colaborador" : "Nuevo Colaborador"}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
                        <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all uppercase" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Documento / CC</label>
                            <input type="text" name="documento" value={formData.documento} onChange={handleChange} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">F. Ingreso</label>
                            <input type="date" name="fecha_contrato" value={formData.fecha_contrato} onChange={handleChange} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
                            <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Salario Base</label>
                            <input type="number" name="salario" value={formData.salario} onChange={handleChange} className="w-full px-5 py-4 bg-indigo-50 border border-indigo-100 rounded-2xl font-black text-indigo-700 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" />
                        </div>
                    </div>

                    {/* SECCIÓN: CREDENCIALES */}
                    <div className="p-6 bg-indigo-50/50 rounded-3xl border border-indigo-100 space-y-4">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 italic">Credenciales de Acceso</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Usuario</label>
                                <select name="role" value={formData.role} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-xl font-bold outline-none text-xs uppercase">
                                    <option value="cajero">Cajero / Vendedor</option>
                                    <option value="admin">Administrador (Control Total)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Usuario de Sistema</label>
                                <input type="text" name="username" value={formData.username} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-xl font-bold outline-none text-xs" autoComplete="off" />
                            </div>
                            <div>
                                <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">{editingId ? "Nueva Contraseña (Opcional)" : "Contraseña Inicial"}</label>
                                <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-4 py-2 bg-white border border-indigo-100 rounded-xl font-bold outline-none text-xs" autoComplete="new-password" />
                            </div>
                        </div>
                    </div>

                    {/* SECCIÓN: PERMISOS DE MÓDULOS */}
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Permisos de Módulos</p>
                            <button type="button" onClick={toggleSelectAll} className="text-[8px] font-black text-indigo-600 uppercase underline">
                                {formData.permisos.length === AVAILABLE_MODULES.length ? "Deseleccionar Todo" : "Seleccionar Todo"}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto scrollbar-hide pr-2">
                             {AVAILABLE_MODULES.map(m => (
                               <label key={m.id} className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-xl cursor-pointer hover:border-indigo-200 transition-colors group">
                                  <input 
                                    type="checkbox" 
                                    checked={formData.permisos.includes(m.id)} 
                                    onChange={() => handlePermissionChange(m.id)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                                  />
                                  <span className="text-[10px] font-semibold text-slate-600 group-hover:text-indigo-600 uppercase">{m.label}</span>
                               </label>
                             ))}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                             <div className="relative">
                                <input type="checkbox" name="paga_comisiones" checked={formData.paga_comisiones} onChange={handleChange} className="sr-only peer" />
                                <div className="w-10 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                             </div>
                             <span className="text-xs font-black text-slate-700 uppercase tracking-widest group-hover:text-emerald-700 transition-colors">Ventas por Comisión</span>
                        </label>
                        
                        {formData.paga_comisiones && (
                            <div className="animate-in slide-in-from-top-2 duration-300">
                                <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1 block mb-2">% de Ganancia</label>
                                <div className="relative">
                                    <input type="number" step="0.1" name="porcentaje_comision" value={formData.porcentaje_comision} onChange={handleChange} className="w-full px-5 py-3 bg-white border border-emerald-200 rounded-2xl font-black text-emerald-700 outline-none" placeholder="0.0" />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-emerald-300">%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        {editingId && (
                            <button type="button" onClick={resetForm} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                        )}
                        <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-3xl font-black shadow-xl hover:bg-indigo-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-xs">
                            {editingId ? "💾 Sincronizar" : "🚀 Dar de Alta"}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        {/* List Column */}
        <div className="xl:col-span-8">
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tighter flex items-center gap-2 uppercase italic">
                        <span className="w-2 h-6 bg-slate-900 rounded-full"></span> Planta de Personal
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-slate-100">{cajeros.length} Empleados Activos</span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Colaborador</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Usuario</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Permisos</th>
                                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Esquema</th>
                                <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {cajeros.map(c => (
                                <tr key={c.id} className="group hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="font-bold text-slate-900 uppercase leading-tight group-hover:text-indigo-600 transition-colors">{c.nombre}</div>
                                        <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter italic">ID: {c.documento || "—"}</div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-fit ml-auto border border-indigo-100 uppercase">
                                            @{c.username || 'SIN-ACCESO'}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="text-[9px] font-black text-slate-500 uppercase italic">
                                            {c.permisos === "all" ? "Acceso Total" : (c.permisos ? `${JSON.parse(c.permisos).length} Módulos` : "Mínimo")}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        {c.paga_comisiones ? (
                                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black border border-emerald-100 italic">Comisión {c.porcentaje_comision}%</span>
                                        ) : (
                                            <span className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg text-[9px] font-black border border-slate-100 italic">Fijo</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-6 text-center">
                                        <div className="flex gap-2 justify-center">
                                            <button onClick={() => handleEdit(c)} className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-xl transition-all font-bold">✏️</button>
                                            <button onClick={() => handleDelete(c.id)} className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 hover:shadow-xl transition-all font-bold">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

export default Cajeros;
