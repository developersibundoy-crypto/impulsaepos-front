import React, { useState } from 'react';
import API from '../api/api';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: any) => void;
}

const calcularDV = (nit: string) => {
  if (!nit || isNaN(Number(nit))) return "";
  const vpri = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  let x = 0;
  let y = 0;
  let z = nit.length;
  for (let i = 0; i < z; i++) {
    y = parseInt(nit.substring(i, i + 1));
    x += y * vpri[z - 1 - i];
  }
  y = x % 11;
  return (y > 1 ? 11 - y : y).toString();
};

const initialState = {
  nombre: "", 
  documento: "", 
  dv: "",
  tipo_documento: "13",
  telefono: "", 
  correo: "", 
  correo_electronico_facturacion: "",
  direccion: "",
  tipo_persona: "Natural",
  primer_nombre: "",
  segundo_nombre: "",
  primer_apellido: "",
  segundo_apellido: "",
  razon_social: "",
  nombre_comercial: "",
  regimen_tributario: "49", 
  responsabilidad_fiscal: "R-99-PN", 
  codigo_tributario_dian: "ZZ", 
  obligado_facturar: false,
  gran_contribuyente: false,
  autorretenedor: false,
  correo_alternativo: "",
  telefono_fijo: "",
  pais: "Colombia",
  departamento: "",
  ciudad: "",
  codigo_postal: "",
  estado: "Activo",
  observaciones: ""
};

export function QuickCustomerModal({ isOpen, onClose, onCustomerCreated }: QuickCustomerModalProps) {
  const [formData, setFormData] = useState(initialState);
  const [activeTab, setActiveTab] = useState("basico");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    let newFormData = { ...formData, [name]: val };

    if (name === "tipo_documento") {
      if (value === "31") {
         newFormData.tipo_persona = "Jurídica";
         newFormData.dv = calcularDV(newFormData.documento);
         newFormData.regimen_tributario = "48"; // Responsable de IVA
      } else {
         newFormData.tipo_persona = "Natural";
         newFormData.dv = "";
      }
    }

    if (name === "documento") {
      const docOnlyNumbers = String(val).replace(/\D/g, "");
      newFormData.documento = docOnlyNumbers;
      if (newFormData.tipo_documento === "31" || true) { // Calculate DV always for now
        newFormData.dv = calcularDV(docOnlyNumbers);
      }
    }

    setFormData(newFormData);
  };

  const handleBlurNombre = () => {
    // Autocompletar el campo "nombre" para retrocompatibilidad
    if (formData.tipo_persona === "Natural") {
      const fullname = `${formData.primer_nombre} ${formData.segundo_nombre} ${formData.primer_apellido} ${formData.segundo_apellido}`.replace(/\s+/g, ' ').trim();
      setFormData(prev => ({ ...prev, nombre: fullname }));
    } else {
      setFormData(prev => ({ ...prev, nombre: formData.razon_social }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.tipo_persona === "Natural" && (!formData.primer_nombre || !formData.primer_apellido)) {
      return alert("Primer Nombre y Primer Apellido son obligatorios para Persona Natural.");
    }
    if (formData.tipo_persona === "Jurídica" && !formData.razon_social) {
      return alert("La Razón Social es obligatoria para Persona Jurídica.");
    }
    if (!formData.documento) {
      return alert("El número de documento es obligatorio.");
    }

    setIsCreatingCustomer(true);
    try {
      const dataToSubmit = { 
        ...formData, 
        correo: formData.correo.trim() === "" ? "nna" : formData.correo 
      };

      const res = await API.post("/clientes", dataToSubmit);
      onCustomerCreated(res.data);
      setFormData(initialState);
      setActiveTab("basico");
      onClose(); // Cerrar el modal después de crear exitosamente
    } catch (err: any) {
      alert("Error creando cliente: " + (err.response?.data?.error || err.message));
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-3xl p-8 animate-in zoom-in duration-300 border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 font-semibold">Registro Rápido de Cliente</h2>
          <button onClick={onClose} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center hover:text-rose-500 transition-all font-semibold">×</button>
        </div>

        <div className="flex bg-slate-100 rounded-xl p-1 mb-6 max-w-max">
            <button type="button" onClick={() => setActiveTab('basico')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'basico' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Básico</button>
            <button type="button" onClick={() => setActiveTab('tributaria')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'tributaria' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tributaria</button>
            <button type="button" onClick={() => setActiveTab('contacto')} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === 'contacto' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Contacto</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
            {/* SECCIÓN 1: BÁSICA */}
            {activeTab === 'basico' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Tipo Documento <span className="text-red-500">*</span></label>
                            <select name="tipo_documento" value={formData.tipo_documento} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 focus:ring-4 focus:ring-violet-50 transition-all">
                                <option value="13">Cédula de Ciudadanía (CC)</option>
                                <option value="31">NIT (DIAN)</option>
                                <option value="11">Registro Civil (RC)</option>
                                <option value="12">Tarjeta de Identidad (TI)</option>
                                <option value="21">Cédula de Extranjería (CE)</option>
                                <option value="41">Pasaporte</option>
                                <option value="42">Documento Extranjero</option>
                                <option value="47">PEP</option>
                                <option value="91">NUIP</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1 text-violet-600">Identificación <span className="text-red-500">*</span></label>
                            <div className="flex gap-2">
                                <input 
                                  type="text" 
                                  name="documento" 
                                  value={formData.documento} 
                                  onChange={handleChange} 
                                  onBlur={async () => {
                                    if (formData.documento && formData.documento.length >= 7) {
                                      try {
                                        const resp = await fetch(`https://api.v-pro.org/nit/${formData.documento}`);
                                        if (resp.ok) {
                                          const data = await resp.json();
                                          if (data && data.razon_social) {
                                            setFormData(prev => ({
                                              ...prev,
                                              razon_social: data.razon_social.toUpperCase(),
                                              nombre_comercial: data.razon_social.toUpperCase(),
                                              dv: data.dv?.toString() || calcularDV(prev.documento),
                                              tipo_documento: "31",
                                              tipo_persona: "Jurídica"
                                            }));
                                          }
                                        }
                                      } catch (e) {
                                        // Silently fail on blur to not interrupt user
                                      }
                                    }
                                  }}
                                  required 
                                  placeholder="Ej: 900123456" 
                                  className="flex-1 w-full px-4 py-3 bg-violet-50/50 border border-violet-100 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" 
                                />
                                <input type="text" name="dv" value={formData.dv} readOnly placeholder="DV" className="w-14 px-2 py-3 bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl font-bold text-center outline-none cursor-not-allowed" title="Dígito de Verificación Automático" />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!formData.documento) return alert("Ingrese el documento");
                                    try {
                                      const resp = await fetch(`https://api.v-pro.org/nit/${formData.documento}`);
                                      if (resp.ok) {
                                        const data = await resp.json();
                                        if (data && data.razon_social) {
                                          setFormData(prev => ({
                                            ...prev,
                                            razon_social: data.razon_social.toUpperCase(),
                                            nombre_comercial: data.razon_social.toUpperCase(),
                                            dv: data.dv?.toString() || calcularDV(prev.documento),
                                            tipo_documento: "31",
                                            tipo_persona: "Jurídica"
                                          }));
                                        } else {
                                          alert("No se encontraron datos.");
                                        }
                                      } else {
                                        alert("Error consultando el documento.");
                                      }
                                    } catch (error) {
                                      alert("Error de conexión al consultar.");
                                    }
                                  }}
                                  className="px-4 bg-violet-100 text-violet-600 rounded-2xl font-semibold text-[10px] uppercase hover:bg-violet-600 hover:text-white transition-all border border-violet-200"
                                >
                                  Consultar ✨
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Tipo de Persona <span className="text-red-500">*</span></label>
                            <select name="tipo_persona" value={formData.tipo_persona} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                                <option value="Natural">Persona Natural</option>
                                <option value="Jurídica">Persona Jurídica</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                            <select name="estado" value={formData.estado} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                                <option value="Activo">🟢 Activo</option>
                                <option value="Inactivo">🔴 Inactivo</option>
                            </select>
                        </div>
                    </div>

                    {formData.tipo_persona === 'Natural' ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Primer Nombre <span className="text-red-500">*</span></label>
                                    <input type="text" name="primer_nombre" value={formData.primer_nombre} onChange={handleChange} onBlur={handleBlurNombre} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Segundo Nombre</label>
                                    <input type="text" name="segundo_nombre" value={formData.segundo_nombre} onChange={handleChange} onBlur={handleBlurNombre} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Primer Apellido <span className="text-red-500">*</span></label>
                                    <input type="text" name="primer_apellido" value={formData.primer_apellido} onChange={handleChange} onBlur={handleBlurNombre} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Segundo Apellido</label>
                                    <input type="text" name="segundo_apellido" value={formData.segundo_apellido} onChange={handleChange} onBlur={handleBlurNombre} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Razón Social <span className="text-red-500">*</span></label>
                                <input type="text" name="razon_social" value={formData.razon_social} onChange={handleChange} onBlur={handleBlurNombre} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Nombre Comercial</label>
                                <input type="text" name="nombre_comercial" value={formData.nombre_comercial} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* SECCIÓN 2: TRIBUTARIA */}
            {activeTab === 'tributaria' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Régimen Tributario</label>
                        <select name="regimen_tributario" value={formData.regimen_tributario} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                            <option value="49">49 - No responsable de IVA</option>
                            <option value="48">48 - Responsable de IVA</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Responsabilidad Fiscal (RUT)</label>
                        <select name="responsabilidad_fiscal" value={formData.responsabilidad_fiscal} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                            <option value="R-99-PN">R-99-PN - No aplica / No responsable</option>
                            <option value="O-13">O-13 - Gran Contribuyente</option>
                            <option value="O-15">O-15 - Autorretenedor</option>
                            <option value="O-23">O-23 - Agente de retención IVA</option>
                            <option value="O-47">O-47 - Régimen Simple de Tributación</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Código Tributario (DIAN)</label>
                        <select name="codigo_tributario_dian" value={formData.codigo_tributario_dian} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all">
                            <option value="ZZ">ZZ - No Aplica</option>
                            <option value="01">01 - IVA</option>
                            <option value="04">04 - INC</option>
                            <option value="ZA">ZA - IVA e INC</option>
                        </select>
                    </div>
                    
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 mt-4">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" name="obligado_facturar" checked={formData.obligado_facturar} onChange={handleChange} className="w-5 h-5 text-violet-600 rounded bg-white border-slate-300 focus:ring-violet-500" />
                            <span className="text-sm font-medium text-slate-700">Obligado a Facturar Electrónicamente</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" name="gran_contribuyente" checked={formData.gran_contribuyente} onChange={handleChange} className="w-5 h-5 text-violet-600 rounded bg-white border-slate-300 focus:ring-violet-500" />
                            <span className="text-sm font-medium text-slate-700">Resolución Gran Contribuyente</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" name="autorretenedor" checked={formData.autorretenedor} onChange={handleChange} className="w-5 h-5 text-violet-600 rounded bg-white border-slate-300 focus:ring-violet-500" />
                            <span className="text-sm font-medium text-slate-700">Autorretenedor</span>
                        </label>
                    </div>
                </div>
            )}

            {/* SECCIÓN 3: CONTACTO */}
            {activeTab === 'contacto' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1 text-violet-600">Email Facturación ✨</label>
                            <input type="email" name="correo_electronico_facturacion" value={formData.correo_electronico_facturacion} onChange={handleChange} placeholder="fe@empresa.com" className="w-full px-4 py-3 bg-violet-50/50 border border-violet-100 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Email General</label>
                            <input type="email" name="correo" value={formData.correo} onChange={handleChange} placeholder="info@empresa.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Celular / WhatsApp</label>
                            <input type="text" name="telefono" value={formData.telefono} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Teléfono Fijo</label>
                            <input type="text" name="telefono_fijo" value={formData.telefono_fijo} onChange={handleChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Dirección Completa</label>
                        <input type="text" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Calle 1 # 2 - 3, Local 4" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Departamento</label>
                            <input type="text" name="departamento" value={formData.departamento} onChange={handleChange} placeholder="Ej: Cundinamarca" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Ciudad / Municipio</label>
                            <input type="text" name="ciudad" value={formData.ciudad} onChange={handleChange} placeholder="Ej: Bogotá" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Observaciones / Notas</label>
                        <textarea name="observaciones" value={formData.observaciones} onChange={handleChange} rows={2} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:bg-white focus:border-violet-400 transition-all resize-none"></textarea>
                    </div>
                </div>
            )}

            <button
              type="submit"
              disabled={isCreatingCustomer}
              className="w-full py-5 bg-violet-600 text-white rounded-3xl shadow-2xl shadow-violet-100 hover:bg-violet-700 hover:-translate-y-1 transition-all uppercase tracking-widest text-[10px] font-medium mt-6"
            >
              {isCreatingCustomer ? "⏳ Procesando..." : "✅ Registrar Cliente Rápido"}
            </button>
        </form>
      </div>
    </div>
  );
}
