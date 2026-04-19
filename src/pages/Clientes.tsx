import React, { useState, useEffect } from "react";
import API from "../api/api";

function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({ 
    nombre: "", 
    documento: "", 
    dv: "",
    tipo_documento: "13",
    telefono: "", 
    correo: "", 
    correo_electronico_facturacion: "",
    direccion: "" 
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchClientes = () => {
    API.get("/clientes").then(res => setClientes(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre) return alert("El nombre es obligatorio");
    try {
      const dataToSubmit = { 
        ...formData, 
        correo: formData.correo.trim() === "" ? "nna" : formData.correo 
      };

      if (editingId) {
        await API.put(`/clientes/${editingId}`, dataToSubmit);
        alert("✅ Cliente actualizado");
      } else {
        await API.post("/clientes", dataToSubmit);
        alert("✅ Cliente registrado");
      }

      setFormData({ 
        nombre: "", documento: "", dv: "", tipo_documento: "13", 
        telefono: "", correo: "", correo_electronico_facturacion: "", direccion: "" 
      });
      setEditingId(null);
      fetchClientes();
    } catch (error) {
      alert("Error procesando cliente");
    }
  };

  const handleEdit = (c: any) => {
    setEditingId(c.id);
    setFormData({
      nombre: c.nombre,
      documento: c.documento || "",
      dv: c.dv || "",
      tipo_documento: c.tipo_documento || "13",
      telefono: c.telefono || "",
      correo: c.correo === "nna" ? "" : c.correo,
      correo_electronico_facturacion: c.correo_electronico_facturacion || "",
      direccion: c.direccion || ""
    });
  };

  const handleCancel = () => {
  const handleCancel = () => {
    setFormData({ 
        nombre: "", documento: "", dv: "", tipo_documento: "13", 
        telefono: "", correo: "", correo_electronico_facturacion: "", direccion: "" 
    });
    setEditingId(null);
  };
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("¿Eliminar cliente del sistema?")) return;
    try {
      await API.delete(`/clientes/${id}`);
      fetchClientes();
    } catch (error) {
      alert("Error eliminando cliente");
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.documento && c.documento.includes(searchTerm))
  );

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 pb-8 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-4xl font-medium tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
            Fidelización (CRM)
          </h1>
          <p className="text-slate-500 font-medium text-lg italic">Base de datos central de clientes, distribuidores y contactos.</p>
        </div>
        <div className="w-full md:w-auto relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors">🔍</span>
            <input 
                type="text" 
                placeholder="Buscar por nombre o ID..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full md:w-80 pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-violet-50 focus:border-violet-400 transition-all font-medium text-slate-700"
            />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        
        {/* Form Card */}
        <div className="xl:col-span-1">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm sticky top-8">
                <h3 className="text-xl font-medium text-slate-900 mb-8 flex items-center gap-2">
                    <span className="w-2 h-6 bg-violet-600 rounded-full"></span> {editingId ? "Actualizar Cliente" : "Nuevo Registro"}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nombre Completo / Razón Social</label>
                        <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white focus:ring-4 focus:ring-violet-50 transition-all" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Tipo Documento</label>
                            <select name="tipo_documento" value={formData.tipo_documento} onChange={(e: any) => handleChange(e)} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white transition-all">
                                <option value="13">Cédula de Ciudadanía</option>
                                <option value="31">NIT (DIAN)</option>
                                <option value="11">Registro Civil</option>
                                <option value="12">Tarjeta de Identidad</option>
                                <option value="41">Pasaporte</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">{formData.tipo_documento === '31' ? "NIT / Identificación" : "Número Documento"}</label>
                            <div className="flex gap-2">
                                <input type="text" name="documento" value={formData.documento} onChange={handleChange} className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white transition-all" />
                                {formData.tipo_documento === '31' && (
                                    <input type="text" name="dv" value={formData.dv} onChange={handleChange} placeholder="DV" className="w-12 px-2 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium text-center outline-none focus:bg-white transition-all" maxLength={1} />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Teléfono (WhatsApp)</label>
                        <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white focus:ring-4 focus:ring-violet-50 transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Dirección Física</label>
                        <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white focus:ring-4 focus:ring-violet-50 transition-all" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Email General</label>
                            <input type="text" name="correo" value={formData.correo} onChange={handleChange} placeholder="nna@redcograf.com" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white transition-all shadow-inner" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1 text-violet-600">Email Facturación ✨</label>
                            <input type="text" name="correo_electronico_facturacion" value={formData.correo_electronico_facturacion} onChange={handleChange} placeholder="Requerido para FE" className="w-full px-5 py-3 bg-violet-50/30 border border-violet-100 rounded-2xl font-medium outline-none focus:bg-white transition-all" />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-4 bg-violet-600 text-white rounded-3xl font-medium shadow-xl shadow-violet-100 hover:bg-violet-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-xs">
                        {editingId ? "💾 Guardar Cambios" : "⭐ Vincular Cliente"}
                    </button>
                    {editingId && (
                        <button type="button" onClick={handleCancel} className="w-full mt-2 py-2 text-slate-400 font-medium uppercase text-[10px] tracking-widest hover:text-slate-600 transition-colors">
                            Cancelar Edición
                        </button>
                    )}
                </form>
            </div>
        </div>

        {/* List Card */}
        <div className="xl:col-span-2">
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-xl font-medium text-slate-900 tracking-tight flex items-center gap-2">
                        <span className="w-2 h-6 bg-slate-900 rounded-full"></span> Cartera de Contactos
                    </h3>
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-1 rounded-full border border-slate-100">
                        {filteredClientes.length} Registros Activos
                    </span>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50">
                                <th className="px-8 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Información del Cliente</th>
                                <th className="px-8 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Contacto</th>
                                <th className="px-8 py-4 text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">Ubicación</th>
                                <th className="px-8 py-4 text-center text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100">X</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredClientes.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-400 font-medium italic opacity-40">No hay clientes en la mira.</td>
                                </tr>
                            ) : (
                                filteredClientes.map(c => (
                                    <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="font-medium text-slate-900 uppercase leading-tight group-hover:text-violet-600 transition-colors">{c.nombre}</div>
                                            <div className="text-[10px] font-medium text-slate-400 mt-1 uppercase tracking-tighter italic">ID: {c.documento || "SIN IDENTIFICAR"}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-medium text-slate-700 flex items-center gap-2">📱 {c.telefono || "—"}</span>
                                                <span className="text-[10px] font-medium text-slate-400 lowercase">{c.correo === 'nna' ? 'sin correo' : c.correo}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className="text-xs font-medium text-slate-500 uppercase tracking-tight">{c.direccion || "🌎 Venta Local"}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <button 
                                                    onClick={() => handleEdit(c)} 
                                                    className="w-10 h-10 rounded-2xl bg-white border border-slate-100 text-slate-300 hover:text-violet-600 hover:border-violet-100 hover:shadow-lg transition-all"
                                                >
                                                    ✏️
                                                </button>
                                                {c.id !== 1 && (
                                                    <button 
                                                        onClick={() => handleDelete(c.id)} 
                                                        className="w-10 h-10 rounded-2xl bg-white border border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-100 hover:shadow-lg transition-all font-medium"
                                                    >
                                                        🗑
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

export default Clientes;
