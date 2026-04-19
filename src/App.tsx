import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import Productos from "./pages/Productos";
import IngresoProductos from "./pages/IngresoProductos";
import Cajeros from "./pages/Cajeros";
import PagosEmpleados from "./pages/PagosEmpleados";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import ConfiguracionEmpresa from "./pages/ConfiguracionEmpresa";
import Reportes from "./pages/Reportes";
import AjustesInventario from "./pages/AjustesInventario";
import VentasMayoristas from "./pages/VentasMayoristas";
import Facturas from "./pages/Facturas";
import FacturasCompra from "./pages/FacturasCompra";
import Dashboard from "./pages/Dashboard";
import PrediccionesAI from "./pages/PrediccionesAI";
import PanelAdministracion from "./pages/PanelAdministracion";
import Separados from "./pages/Separados";
import Login from "./pages/Login";
import RegistroSaaS from "./pages/RegistroSaaS";
import SuperAdminSaaS from "./pages/SuperAdminSaaS";
import InventarioAdmin from "./pages/InventarioAdmin";
import Kardex from "./pages/Kardex";
import FacturacionElectronica from "./pages/FacturacionElectronica";
import ConfiguracionDian from "./pages/ConfiguracionDian";

import "./index.css";

import { hasAccess, hasPlanFeature, PLAN_FEATURES } from "./utils/auth";
import { CajaProvider, useCaja } from "./components/CajaContext";
import { ControlCajaWrapper } from "./components/ControlCajaWrapper";
import { CierreCajaModal, MovimientoCajaModal } from "./components/CajaModals";
import PlanRestrictionModal from "./components/PlanRestrictionModal";
import { usePlan } from "./hooks/usePlan";


const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem("adminToken");
  return token ? <>{children}</> : <Navigate to="/login" replace />;
};

const RoleRoute = ({ children, allowedRoles, module, planFeature }: { children: React.ReactNode, allowedRoles: string[], module?: string, planFeature?: string }) => {
  const token = localStorage.getItem("adminToken");
  const role = localStorage.getItem("adminRole");
  
  if (!token) return <Navigate to="/login" replace />;
  
  // 1. Check Role
  const hasRole = role && allowedRoles.includes(role);
  
  // 2. Check Module Permission (if provided)
  const hasModule = module ? hasAccess(module) : true;

  // 3. Check Plan Feature (if provided)
  const hasFeature = planFeature ? hasPlanFeature(planFeature) : true;

  if (!hasRole || !hasModule) {
    return <Navigate to="/" replace />;
  }

  if (!hasFeature) {
    // Si no tiene el plan, lo mandamos al admin para que vea los planes
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};

const Navigation = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const isLoginPage = location.pathname === "/login" || location.pathname === "/registro-saas";
  const role = localStorage.getItem("adminRole");

  const [isCierreModalOpen, setIsCierreModalOpen] = React.useState(false);
  const [isRestrictedModalOpen, setIsRestrictedModalOpen] = React.useState(false);
  const [restrictedFeature, setRestrictedFeature] = React.useState("");

  const [movType, setMovType] = React.useState<'Ingreso' | 'Salida' | null>(null);
  const { sesion } = useCaja();

  if (isLoginPage) return null;

  const handleLogoutClick = () => {
    if (sesion) {
      setIsCierreModalOpen(true);
    } else {
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  const confirmLogout = () => {
    localStorage.clear();
    window.location.assign('/login');
  };


  const NavLink = ({ to, label, emoji, activeClass, module, planFeature }: any) => {
    const hasModuleAccess = module ? hasAccess(module) : true;
    const hasFeatureAccess = planFeature ? hasPlanFeature(planFeature) : true;

    const handleClick = (e: React.MouseEvent) => {
      if (!hasModuleAccess) {
        e.preventDefault();
        alert("🚫 No tienes permiso para acceder a este módulo.");
        return;
      }

      if (!hasFeatureAccess) {
        e.preventDefault();
        setRestrictedFeature(label);
        setIsRestrictedModalOpen(true);
        setIsMenuOpen(false);
      } else {
        setIsMenuOpen(false);
      }
    };

    return (
      <Link 
        to={hasModuleAccess ? to : "#"} 
        onClick={handleClick}
        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-3 ${
          location.pathname === to 
            ? activeClass || "bg-slate-100 text-slate-900 shadow-sm" 
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        } ${!hasModuleAccess ? "opacity-60 grayscale-[0.5] cursor-not-allowed" : ""}`}
      >
        <span className="text-lg">{emoji}</span>
        {label}
        {!hasModuleAccess && (
          <span className="ml-auto text-[10px]">🔒</span>
        )}
        {hasModuleAccess && planFeature && !hasFeatureAccess && (
          <span className="ml-auto text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">🔒 PRO</span>
        )}
      </Link>
    );
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 no-print">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform duration-300">
              <span className="text-xl">📦</span>
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 leading-none uppercase tracking-tighter">IMPULSA POS</span>
              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Gestión Digital</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-2">
            <NavLink to="/" label="Venta General" emoji="🏪" module="venta" />
            <NavLink to="/mayoristas" label="Mayoristas" emoji="🚛" module="mayoristas" activeClass="bg-sky-50 text-sky-700 border border-sky-100 shadow-sm" />
            <NavLink to="/facturacion-electronica" label="Factura Electrónica" emoji="⚡" module="facturas_venta" planFeature={PLAN_FEATURES.FACTURACION_ELECTRONICA} activeClass="bg-amber-50 text-amber-700 border border-amber-100 shadow-sm" />

            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            


            
            <Link 
              to={ (hasAccess("recursos_humanos") || hasAccess("analitica")) ? "/admin" : "#" }
              onClick={(e) => {
                if (!hasAccess("recursos_humanos") && !hasAccess("analitica")) {
                  e.preventDefault();
                  alert("🚫 No tienes permiso para acceder al panel de administración.");
                }
              }}
              className={`px-5 py-2 rounded-xl text-xs font-black bg-slate-900 text-white shadow-xl hover:bg-indigo-600 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 uppercase tracking-widest ${(!hasAccess("recursos_humanos") && !hasAccess("analitica")) ? "opacity-60 grayscale-[0.5]" : ""}`}
            >
              🛡️ Administración
            </Link>

            <button 
              onClick={handleLogoutClick}
              className="px-5 py-2 rounded-xl text-xs font-black bg-rose-50 text-rose-600 border border-rose-100 shadow-sm hover:bg-rose-600 hover:text-white hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 uppercase tracking-widest ml-1"
            >
              🚪 Salir
            </button>

            {sesion && (
              <div className="flex items-center gap-1 ml-2">
                <button 
                  onClick={() => setMovType('Ingreso')}
                  className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex items-center justify-center text-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                  title="Ingreso de Dinero"
                >
                  📥
                </button>
                <button 
                  onClick={() => setMovType('Salida')}
                  className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-center justify-center text-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                  title="Salida de Dinero"
                >
                  📤
                </button>
              </div>
            )}

            <MovimientoCajaModal 
              isOpen={movType !== null} 
              onClose={() => setMovType(null)} 
              tipo={movType as any} 
            />

            <CierreCajaModal 
              isOpen={isCierreModalOpen} 
              onClose={() => setIsCierreModalOpen(false)} 
              onConfirm={confirmLogout} 
            />


            <button
               onClick={() => {
                 const message = "Hola, requiero información o ayuda sobre Impulsa POS.";
                 window.open(`https://wa.me/573152796683?text=${encodeURIComponent(message)}`, '_blank');
               }}
               className="w-9 h-9 bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-50 flex items-center justify-center text-lg font-black hover:bg-emerald-600 transition-all duration-300 ml-2"
               title="Soporte WhatsApp"
            >
               ❓
            </button>

            <Link 
              to={hasAccess("configuracion") ? "/empresa" : "#"}
              onClick={(e) => {
                if (!hasAccess("configuracion")) {
                  e.preventDefault();
                  alert("🚫 No tienes permiso para configurar los datos de la empresa.");
                }
              }}
              className={`w-9 h-9 bg-slate-100 text-slate-900 rounded-lg shadow-md flex items-center justify-center text-lg font-black hover:bg-indigo-600 hover:text-white transition-all duration-300 ml-2 ${!hasAccess("configuracion") ? "opacity-60 grayscale" : ""}`}
              title="Perfil de Empresa"
            >
                🏢
            </Link>

            {localStorage.getItem('adminRole') === 'superadmin' && localStorage.getItem('adminEmpresaId') === '1' && (
              <button 
                onClick={() => {
                  const pass = prompt("🔑 Ingrese la Clave Maestra de Infraestructura:");
                  if (pass === "superimpulsa") {
                    window.location.href = "/superadmin";
                  } else {
                    alert("🚫 Clave Incorrecta. Acceso Denegado.");
                  }
                }}
                className="w-9 h-9 bg-pink-600 text-white rounded-lg shadow-lg shadow-pink-200 flex items-center justify-center text-lg font-black hover:bg-pink-700 transition-all duration-300 ml-2 animate-pulse"
                title="Panel SaaS Global"
              >
                 👑
              </button>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
             {isMenuOpen ? <span className="text-2xl">✕</span> : <span className="text-2xl">☰</span>}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
       {isMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-2xl p-4 space-y-2 animate-in slide-in-from-top duration-300">
           <NavLink to="/" label="Venta General" emoji="🏪" module="venta" />
           <NavLink to="/mayoristas" label="Distribución Mayorista" emoji="🚛" module="mayoristas" activeClass="bg-sky-50 text-sky-700 border border-sky-100 shadow-sm" />
           <NavLink to="/facturacion-electronica" label="Factura Electrónica" emoji="⚡" module="facturas_venta" planFeature={PLAN_FEATURES.FACTURACION_ELECTRONICA} activeClass="bg-amber-50 text-amber-700 border border-amber-100 shadow-sm" />
           
           <NavLink 
             to="/admin" 
             label="Administración Central" 
             emoji="🛡️" 
             module="recursos_humanos" // Se usará para la validación en NavLink
             activeClass="bg-slate-900 text-white shadow-lg" 
           />
           
           <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
              <button
                 onClick={() => {
                   const message = "Hola, requiero información o ayuda sobre Impulsa POS.";
                   window.open(`https://wa.me/573152796683?text=${encodeURIComponent(message)}`, '_blank');
                   setIsMenuOpen(false);
                 }}
                 className="px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                 ❓ Soporte
              </button>
              <Link
                to={hasAccess("configuracion") ? "/empresa" : "#"}
                onClick={(e) => {
                  if (!hasAccess("configuracion")) {
                    e.preventDefault();
                    alert("🚫 No tienes permiso para configurar los datos de la empresa.");
                  }
                  setIsMenuOpen(false);
                }}
                className={`px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 uppercase tracking-widest ${!hasAccess("configuracion") ? "opacity-50 grayscale" : ""}`}
              >
                🏢 Perfil
              </Link>
              <button
                onClick={handleLogoutClick}
                className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 uppercase tracking-widest col-span-2 border border-rose-100"
              >
                🚪 Cerrar Sesión
              </button>

              
              {localStorage.getItem('adminRole') === 'superadmin' && (
                <Link
                   to="/superadmin"
                   onClick={() => setIsMenuOpen(false)}
                   className="px-4 py-3 bg-pink-600 text-white rounded-xl text-[10px] font-black flex items-center justify-center gap-2 uppercase tracking-widest col-span-2"
                >
                   👑 Panel SaaS Global
                </Link>
              )}
           </div>
        </div>
      )}

      <PlanRestrictionModal 
        isOpen={isRestrictedModalOpen} 
        onClose={() => setIsRestrictedModalOpen(false)} 
        featureName={restrictedFeature} 
      />
    </nav>
  );
};

function App() {
  const allRoles = ["admin", "superadmin", "cajero"];
  const adminPlus = ["admin", "superadmin"];

  return (
    <BrowserRouter>
      <CajaProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
          <Navigation />
          <main className="flex-1 w-full max-w-full mx-auto p-4 sm:p-6 lg:p-8 animate-in fade-in duration-500">
            <ControlCajaWrapper>
              <Routes>


            <Route path="/login" element={<Login />} />
            <Route path="/registro-saas" element={<RegistroSaaS />} />
            
            <Route path="/" element={<AdminRoute><Productos /></AdminRoute>} />
            
            {/* Permission-Protected Routes */}
            <Route path="/mayoristas" element={<RoleRoute allowedRoles={allRoles} module="mayoristas"><VentasMayoristas /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute allowedRoles={allRoles}><PanelAdministracion /></RoleRoute>} />
            <Route path="/dashboard" element={<RoleRoute allowedRoles={allRoles} module="analitica"><Dashboard /></RoleRoute>} />
            <Route path="/ai" element={<RoleRoute allowedRoles={allRoles} module="analitica"><PrediccionesAI /></RoleRoute>} />
            <Route path="/ingreso" element={<RoleRoute allowedRoles={allRoles} module="ingreso"><IngresoProductos /></RoleRoute>} />
            <Route path="/compras" element={<RoleRoute allowedRoles={allRoles} module="facturas_compra"><FacturasCompra /></RoleRoute>} />
            <Route path="/cajeros" element={<RoleRoute allowedRoles={allRoles} module="recursos_humanos"><Cajeros /></RoleRoute>} />
            <Route path="/pagos" element={<RoleRoute allowedRoles={allRoles} module="recursos_humanos"><PagosEmpleados /></RoleRoute>} />
            <Route path="/clientes" element={<RoleRoute allowedRoles={allRoles} module="clientes"><Clientes /></RoleRoute>} />
            <Route path="/proveedores" element={<RoleRoute allowedRoles={allRoles} module="proveedores"><Proveedores /></RoleRoute>} />
            <Route path="/empresa" element={<RoleRoute allowedRoles={allRoles} module="configuracion"><ConfiguracionEmpresa /></RoleRoute>} />
            <Route path="/ajustes" element={<RoleRoute allowedRoles={allRoles} module="ajustes"><AjustesInventario /></RoleRoute>} />
            <Route path="/facturas" element={<RoleRoute allowedRoles={allRoles} module="facturas_venta"><Facturas /></RoleRoute>} />
            <Route path="/facturacion-electronica" element={<RoleRoute allowedRoles={allRoles} module="facturas_venta" planFeature={PLAN_FEATURES.FACTURACION_ELECTRONICA}><FacturacionElectronica /></RoleRoute>} />
            <Route path="/configuracion-dian" element={<RoleRoute allowedRoles={allRoles} module="configuracion" planFeature={PLAN_FEATURES.FACTURACION_ELECTRONICA}><ConfiguracionDian /></RoleRoute>} />
            <Route path="/reportes" element={<RoleRoute allowedRoles={allRoles} module="reportes"><Reportes /></RoleRoute>} />

            <Route path="/separados" element={<RoleRoute allowedRoles={allRoles} module="separados"><Separados /></RoleRoute>} />
            <Route path="/inventario-global" element={<RoleRoute allowedRoles={allRoles} module="inventario"><InventarioAdmin /></RoleRoute>} />
            <Route path="/kardex" element={<RoleRoute allowedRoles={allRoles} module="kardex"><Kardex /></RoleRoute>} />
            
            {/* Infraestructure Only */}
            <Route path="/superadmin" element={<RoleRoute allowedRoles={["superadmin"]}><SuperAdminSaaS /></RoleRoute>} />
          </Routes>
            </ControlCajaWrapper>
        </main>
      </div>
      </CajaProvider>
    </BrowserRouter>
  );
}

export default App;
