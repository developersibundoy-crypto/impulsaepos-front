import React, { useState, useEffect } from 'react';
import API from '../api/api';

const SuperAdminSaaS = () => {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({
    wompi_public_key: '',
    wompi_private_key: '',
    wompi_integrity_secret: '',
    wompi_event_secret: '',
    precio_mes_centavos: 7000000,
    precio_semestre_centavos: 37800000,
    precio_anio_centavos: 67200000
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Estado para el modal y formulario de salida de dinero
  const [showGastoModal, setShowGastoModal] = useState(false);
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [comprobanteModalUrl, setComprobanteModalUrl] = useState<string | null>(null);
  const [nuevoGasto, setNuevoGasto] = useState({
    categoria: 'Hosting y Servidores',
    descripcion: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 10),
    metodo_pago: 'Transferencia',
    comprobante_url: ''
  });

  const fetchData = async () => {
    try {
      const [resEmpresas, resPagos, resConfig, resGastos] = await Promise.all([
        API.get('/suscripciones/superadmin/empresas'),
        API.get('/suscripciones/superadmin/pagos'),
        API.get('/suscripciones/superadmin/config'),
        API.get('/suscripciones/superadmin/gastos')
      ]);
      setEmpresas(resEmpresas.data || []);
      setPagos(resPagos.data || []);
      if (resConfig.data) setConfig(resConfig.data);
      setGastos(resGastos.data || []);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No Autorizado o problema de conexión.');
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        alert("El archivo es muy pesado. El límite máximo es de 8MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNuevoGasto(prev => ({ ...prev, comprobante_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCrearGasto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoGasto.categoria || !nuevoGasto.descripcion || !nuevoGasto.monto) {
      alert("Por favor complete todos los campos obligatorios.");
      return;
    }
    setGuardandoGasto(true);
    try {
      await API.post('/suscripciones/superadmin/gastos', nuevoGasto);
      alert('✅ Salida de dinero registrada exitosamente.');
      setShowGastoModal(false);
      setNuevoGasto({
        categoria: 'Hosting y Servidores',
        descripcion: '',
        monto: '',
        fecha: new Date().toISOString().slice(0, 10),
        metodo_pago: 'Transferencia',
        comprobante_url: ''
      });
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al registrar la salida de dinero.');
    } finally {
      setGuardandoGasto(false);
    }
  };

  const handleDeleteGasto = async (id: number, descripcion: string) => {
    if (!window.confirm(`¿Desea eliminar la salida de dinero "${descripcion}"?`)) {
      return;
    }
    try {
      await API.delete(`/suscripciones/superadmin/gastos/${id}`);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar el gasto.');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await API.post('/suscripciones/superadmin/config', config);
      alert('✅ Configuración de Plataforma guardada con éxito.');
    } catch (err: any) {
      alert('Error guardando configuración.');
    } finally {
      setSavingConfig(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManualActivate = async (empresaId: number, dias: number, nombre: string) => {
    const planName = dias === 30 ? 'MENSUAL' : dias === 180 ? 'SEMESTRAL' : 'ANUAL';
    if (!window.confirm(`⚠️ ACTIVACIÓN MANUAL\n\n¿Deseas activar el plan ${planName} (${dias} días) para "${nombre.toUpperCase()}"?\n\nEsta acción registrará el pago como físico/manual.`)) {
      return;
    }

    try {
      setLoading(true);
      // Calculamos un monto sugerido basado en la config actual para el historial
      const monto = dias === 30 ? config.precio_mes_centavos / 100 : 
                    dias === 180 ? config.precio_semestre_centavos / 100 : 
                    config.precio_anio_centavos / 100;

      await API.post('/suscripciones/superadmin/activar-manual', { 
        empresa_id: empresaId, 
        dias, 
        monto 
      });
      alert('✅ Suscripción activada correctamente.');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error en la activación manual.');
      setLoading(false);
    }
  };

  const handleDeleteEmpresa = async (id: number, nombre: string) => {
    if (!window.confirm(`⚠️ ¿ESTÁS SEGURO DE ELIMINAR A "${nombre.toUpperCase()}"?\n\nEsta acción es IRREVERSIBLE y borrará:\n- Todos sus productos e inventario.\n- Todas sus facturas de venta y compra.\n- Todos sus usuarios y configuraciones.\n- Todo rastro en la base de datos.`)) {
      return;
    }

    try {
      setLoading(true);
      await API.delete(`/suscripciones/superadmin/empresas/${id}`);
      alert('Empresa eliminada exitosamente y base de datos liberada.');
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error al eliminar la empresa.');
      setLoading(false);
    }
  };

  // Métricas Computadas
  const activas = empresas.filter(e => e.estado === 'Active').length;
  const expiradas = empresas.filter(e => e.estado === 'Expired').length;
  const trials = empresas.filter(e => e.estado === 'Trial').length;
  
  const totalHistorico = empresas.reduce((acc, emp) => acc + (Number(emp.total_recaudado) || 0), 0);
  const totalGastosHistorico = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
  const balanceNetoGlobal = totalHistorico - totalGastosHistorico;

  // Ingresos generados ESTE MES
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const ingresosEsteMes = pagos.reduce((acc, pago) => {
    if (pago.fecha_pago) {
      const fecha = new Date(pago.fecha_pago);
      if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
         return acc + (Number(pago.monto) || 0);
      }
    } else {
      return acc + (Number(pago.monto) || 0);
    }
    return acc;
  }, 0);

  // Gastos realizados ESTE MES
  const gastosEsteMes = gastos.reduce((acc, gasto) => {
    if (gasto.fecha) {
      const fecha = new Date(gasto.fecha);
      if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
        return acc + (Number(gasto.monto) || 0);
      }
    }
    return acc;
  }, 0);

  const balanceNetoMes = ingresosEsteMes - gastosEsteMes;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
       <div className="spinner" style={{ width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
       <h3 style={{ marginTop: '1rem', color: '#64748b' }}>Cargando Panel Maestro SaaS...</h3>
       <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <div style={{ background: '#fee2e2', padding: '2rem', borderRadius: '16px', border: '2px solid #ef4444', textAlign: 'center', maxWidth: '500px' }}>
        <h2 style={{ margin: 0, color: '#991b1b' }}>🛑 Acceso Denegado</h2>
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)', color: '#0f172a', padding: '2.5rem', borderRadius: '20px', marginBottom: '2.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', right: '-10%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.8rem', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '900', letterSpacing: '-0.5px' }}>
              <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>👑</span> 
              <span style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Portal Maestro SaaS</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '1.2rem', margin: 0, fontWeight: '500' }}>Supervisión Global, Métricas, Ingresos y Salidas de Dinero</p>
          </div>
          <button
            onClick={() => setShowGastoModal(true)}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '14px',
              fontWeight: '800',
              cursor: 'pointer',
              fontSize: '0.95rem',
              boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <span>💸</span> Registrar Salida de Dinero
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card" style={{ padding: '1.8rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderBottom: '4px solid #10b981' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Comercios Activos</h3>
          <p style={{ fontSize: '3rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#10b981', lineHeight: '1' }}>{activas}</p>
        </div>
        <div className="card" style={{ padding: '1.8rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderBottom: '4px solid #3b82f6' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>En Periodo Trial</h3>
          <p style={{ fontSize: '3rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#3b82f6', lineHeight: '1' }}>{trials}</p>
        </div>
        <div className="card" style={{ padding: '1.8rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderBottom: '4px solid #ef4444' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>En Mora / Expirados</h3>
          <p style={{ fontSize: '3rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#ef4444', lineHeight: '1' }}>{expiradas}</p>
        </div>
        <div className="card" style={{ padding: '1.8rem', textAlign: 'center', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: 0, color: '#166534', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Ingresos Brutos Globales</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#15803d' }}>
            ${totalHistorico.toLocaleString('es-CO')}
          </p>
          <div style={{ fontSize: '0.8rem', color: '#166534', marginTop: '0.3rem' }}>
            Este mes: ${ingresosEsteMes.toLocaleString('es-CO')}
          </div>
        </div>
        <div className="card" style={{ padding: '1.8rem', textAlign: 'center', background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid #f43f5e' }}>
          <h3 style={{ margin: 0, color: '#9f1239', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Salidas / Gastos Totales</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#e11d48' }}>
            -${totalGastosHistorico.toLocaleString('es-CO')}
          </p>
          <div style={{ fontSize: '0.8rem', color: '#9f1239', marginTop: '0.3rem' }}>
            Este mes: -${gastosEsteMes.toLocaleString('es-CO')}
          </div>
        </div>
        <div className="card" style={{ padding: '1.8rem', textAlign: 'center', background: balanceNetoGlobal >= 0 ? 'linear-gradient(135deg, #eff6ff, #dbeafe)' : 'linear-gradient(135deg, #fef2f2, #fee2e2)', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: `2px solid ${balanceNetoGlobal >= 0 ? '#3b82f6' : '#ef4444'}` }}>
          <h3 style={{ margin: 0, color: balanceNetoGlobal >= 0 ? '#1e40af' : '#991b1b', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Total Global Neto (Caja)</h3>
          <p style={{ fontSize: '2rem', margin: '0.5rem 0 0', fontWeight: '800', color: balanceNetoGlobal >= 0 ? '#2563eb' : '#dc2626' }}>
            ${balanceNetoGlobal.toLocaleString('es-CO')}
          </p>
          <div style={{ fontSize: '0.8rem', color: balanceNetoGlobal >= 0 ? '#1e40af' : '#991b1b', marginTop: '0.3rem' }}>
            Neto este mes: ${balanceNetoMes.toLocaleString('es-CO')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}>
        
        {/* Tabla Comercios */}
        <div className="card" style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>Directorio de Suscriptores</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', fontSize: '0.95rem' }}>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>ID</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Comercio</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Contacto</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Plan Seleccionado</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Vencimiento</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Estado SaaS</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Total Pagado</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map(emp => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="table-row-hover">
                    <td style={{ padding: '1rem', color: '#64748b' }}>#{emp.id}</td>
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ color: '#0f172a' }}>{emp.nombre_comercial}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>NIT: {emp.nit || 'N/A'} | User: {emp.owner_username || 'Ninguno'}</div>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#475569' }}>
                      {emp.telefono_contacto} <br/> {emp.correo_contacto}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ 
                        padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: !emp.ultimo_plan_dias ? '#f1f5f9' : emp.ultimo_plan_dias === 30 ? '#eff6ff' : emp.ultimo_plan_dias === 180 ? '#f5f3ff' : '#fff7ed',
                        color: !emp.ultimo_plan_dias ? '#64748b' : emp.ultimo_plan_dias === 30 ? '#2563eb' : emp.ultimo_plan_dias === 180 ? '#7c3aed' : '#ea580c',
                        border: `1px solid ${!emp.ultimo_plan_dias ? '#e2e8f0' : emp.ultimo_plan_dias === 30 ? '#bfdbfe' : emp.ultimo_plan_dias === 180 ? '#ddd6fe' : '#fed7aa'}`
                      }}>
                         <span>{
                           !emp.ultimo_plan_dias ? '🎁 TRIAL / GRATIS' : 
                           emp.ultimo_plan_dias === 30 ? '📅 MENSUAL' : 
                           emp.ultimo_plan_dias === 180 ? '⚡ SEMESTRAL' : 
                           emp.ultimo_plan_dias === 365 ? '🏆 ANUAL' : `🕒 ${emp.ultimo_plan_dias} DÍAS`
                         }</span>
                      </div>
                    </td>
                    <td style={{ padding: '1rem', color: '#475569' }}>
                      {new Date(emp.fecha_vencimiento_suscripcion).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-block',
                        background: emp.estado === 'Active' ? '#dcfce7' : emp.estado === 'Trial' ? '#e0f2fe' : '#fee2e2',
                        color: emp.estado === 'Active' ? '#166534' : emp.estado === 'Trial' ? '#075985' : '#991b1b',
                        border: `1px solid ${emp.estado === 'Active' ? '#86efac' : emp.estado === 'Trial' ? '#7dd3fc' : '#fca5a5'}`
                      }}>
                        {emp.estado.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: '#059669', fontSize: '1.1rem' }}>
                      ${(Number(emp.total_recaudado) || 0).toLocaleString('es-CO')}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => handleManualActivate(emp.id, 30, emp.nombre_comercial)}
                          style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                          title="Activar 30 Días (Manual)"
                        >
                          📅 +30d
                        </button>
                        <button 
                          onClick={() => handleManualActivate(emp.id, 180, emp.nombre_comercial)}
                          style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                          title="Activar 180 Días (Manual)"
                        >
                          ⚡ +180d
                        </button>
                        <button 
                          onClick={() => handleManualActivate(emp.id, 365, emp.nombre_comercial)}
                          style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                          title="Activar 365 Días (Manual)"
                        >
                          🏆 +365d
                        </button>

                        <button 
                          onClick={() => handleDeleteEmpresa(emp.id, emp.nombre_comercial)}
                          style={{ 
                            background: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '8px', 
                            cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem', transition: 'all 0.2s'
                          }}
                          title="Eliminar Empresa Permanentemente"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla Historial de Pagos */}
        <div className="card" style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <h2 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <span>Historial Directo de Pagos💳</span>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', fontSize: '1rem' }}>
              <span style={{ color: '#64748b', fontWeight: 'bold' }}>Bruto: <span style={{ color: '#059669' }}>+${totalHistorico.toLocaleString('es-CO')}</span></span>
              <span style={{ color: '#64748b', fontWeight: 'bold' }}>Gastos: <span style={{ color: '#dc2626' }}>-${totalGastosHistorico.toLocaleString('es-CO')}</span></span>
              <span style={{ color: '#0f172a', fontWeight: '800', background: '#f1f5f9', padding: '4px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Total Global Neto: ${balanceNetoGlobal.toLocaleString('es-CO')}</span>
            </div>
          </h2>
          {pagos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
              <p style={{ fontSize: '1.2rem' }}>Aún no se registran pagos en el sistema de Suscripciones.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', fontSize: '0.95rem' }}>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Ref Pago ID</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Comercio</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Wompi Transaction</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Fecha Liquidación</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Monto Recibido</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(pago => (
                    <tr key={pago.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>#{pago.id}</td>
                      <td style={{ padding: '1rem', color: '#0f172a', fontWeight: '600' }}>{pago.nombre_comercial}</td>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: '#3b82f6' }}>{pago.wompi_transaction_id || 'Manual/N/A'}</td>
                      <td style={{ padding: '1rem', color: '#475569' }}>
                        {pago.fecha_pago ? new Date(pago.fecha_pago).toLocaleString() : 'Fecha no registrada'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#059669', fontSize: '1.1rem' }}>
                        + ${(Number(pago.monto) || 0).toLocaleString('es-CO')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tabla Salidas de Dinero (Gastos Operativos SaaS) */}
        <div className="card" style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>💸 Salidas de Dinero y Gastos SaaS</span>
              </h2>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                Control de egresos por hosting, servidores, servicios y mantenimiento de la plataforma.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: 'bold' }}>
                Total Gastos: <span style={{ color: '#dc2626' }}>-${totalGastosHistorico.toLocaleString('es-CO')}</span>
              </span>
              <button
                onClick={() => setShowGastoModal(true)}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>➕</span> Nuevo Gasto
              </button>
            </div>
          </div>

          {gastos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
              <p style={{ fontSize: '1.2rem', margin: 0 }}>No hay salidas de dinero registradas todavía.</p>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '6px' }}>
                Haz clic en "Registrar Salida de Dinero" para ingresar pagos de hosting, nómina, dominios u otros servicios.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', fontSize: '0.95rem' }}>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>ID</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Fecha</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Categoría</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Descripción</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Método</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Comprobante</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0' }}>Monto</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map(g => (
                    <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      <td style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>#{g.id}</td>
                      <td style={{ padding: '1rem', color: '#475569', whiteSpace: 'nowrap' }}>
                        {g.fecha ? new Date(g.fecha).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: '800',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca'
                        }}>
                          {g.categoria}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#0f172a', fontWeight: '500', maxWidth: '300px' }}>
                        {g.descripcion}
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {g.metodo_pago || 'Transferencia'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {g.comprobante_url ? (
                          <button
                            onClick={() => setComprobanteModalUrl(g.comprobante_url)}
                            style={{
                              background: '#eff6ff',
                              color: '#2563eb',
                              border: '1px solid #bfdbfe',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>📎</span> Ver Soporte
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin archivo</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#dc2626', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                        - ${(Number(g.monto) || 0).toLocaleString('es-CO')}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteGasto(g.id, g.descripcion)}
                          style={{
                            background: '#fee2e2',
                            color: '#ef4444',
                            border: '1px solid #fca5a5',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}
                          title="Eliminar registro"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Configuración de Pasarela - MOVIDO AL FINAL */}
        <div className="card" style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', border: '1px solid #e2e8f0' }}>
           <h2 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
             ⚙️ Configuración Maestra Wompi
           </h2>
           <form onSubmit={handleSaveConfig} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Llave Pública</label>
                <input 
                  type="text" 
                  value={config.wompi_public_key} 
                  onChange={(e) => setConfig({...config, wompi_public_key: e.target.value})} 
                  placeholder="pub_test_..."
                  style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Llave Privada</label>
                <input 
                  type="password" 
                  value={config.wompi_private_key} 
                  onChange={(e) => setConfig({...config, wompi_private_key: e.target.value})} 
                  placeholder="prv_test_..."
                  style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Secreto de Integridad</label>
                <input 
                  type="password" 
                  value={config.wompi_integrity_secret} 
                  onChange={(e) => setConfig({...config, wompi_integrity_secret: e.target.value})} 
                  placeholder="integ_..."
                  style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Secreto de Eventos</label>
                <input 
                  type="password" 
                  value={config.wompi_event_secret} 
                  onChange={(e) => setConfig({...config, wompi_event_secret: e.target.value})} 
                  style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>
              
              <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                   <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>PRECIO MES (CENTS)</label>
                   <input type="number" value={config.precio_mes_centavos} onChange={(e) => setConfig({...config, precio_mes_centavos: parseInt(e.target.value)})} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                   <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>PRECIO SEMESTRE (CENTS)</label>
                   <input type="number" value={config.precio_semestre_centavos} onChange={(e) => setConfig({...config, precio_semestre_centavos: parseInt(e.target.value)})} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                   <label style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>PRECIO AÑO (CENTS)</label>
                   <input type="number" value={config.precio_anio_centavos} onChange={(e) => setConfig({...config, precio_anio_centavos: parseInt(e.target.value)})} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                 </div>
              </div>

              <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
                <button 
                  type="submit" 
                  disabled={savingConfig}
                  style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s', opacity: savingConfig ? 0.5 : 1 }}
                >
                  {savingConfig ? 'Guardando...' : '💾 Guardar Cambios Globales'}
                </button>
              </div>
           </form>
        </div>
      </div>

      {/* MODAL REGISTRAR SALIDA DE DINERO */}
      {showGastoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            maxWidth: '600px',
            width: '100%',
            padding: '2.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            maxHeight: '90vh',
            overflowY: 'auto',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💸</span> Registrar Salida de Dinero
                </h3>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Ingresa los detalles del gasto operativo de la plataforma
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGastoModal(false)}
                style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearGasto} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                    Categoría *
                  </label>
                  <select
                    value={nuevoGasto.categoria}
                    onChange={(e) => setNuevoGasto({ ...nuevoGasto, categoria: e.target.value })}
                    style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  >
                    <option value="Hosting y Servidores">Hosting y Servidores</option>
                    <option value="Dominios y SSL">Dominios y SSL</option>
                    <option value="Servicios en la Nube / DB">Servicios en la Nube / DB</option>
                    <option value="Pasarela de Pagos / Comisiones">Pasarela de Pagos / Comisiones</option>
                    <option value="Marketing y Publicidad">Marketing y Publicidad</option>
                    <option value="Desarrollo y Mantenimiento">Desarrollo y Mantenimiento</option>
                    <option value="Otros Gastos Operativos">Otros Gastos Operativos</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                    Fecha del Pago *
                  </label>
                  <input
                    type="date"
                    required
                    value={nuevoGasto.fecha}
                    onChange={(e) => setNuevoGasto({ ...nuevoGasto, fecha: e.target.value })}
                    style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                    Monto ($ COP) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="Ej: 150000"
                    value={nuevoGasto.monto}
                    onChange={(e) => setNuevoGasto({ ...nuevoGasto, monto: e.target.value })}
                    style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', fontWeight: 'bold' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                    Método de Pago
                  </label>
                  <select
                    value={nuevoGasto.metodo_pago}
                    onChange={(e) => setNuevoGasto({ ...nuevoGasto, metodo_pago: e.target.value })}
                    style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                  >
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="PayPal">PayPal</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                  Descripción / Beneficiario *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej: Pago mensual de VPS Hostinger / Pago de API OpenAI"
                  value={nuevoGasto.descripcion}
                  onChange={(e) => setNuevoGasto({ ...nuevoGasto, descripcion: e.target.value })}
                  style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {/* CARGA DE COMPROBANTE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' }}>
                  Comprobante de Pago (Factura / Recibo / Captura)
                </label>
                <div style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '1.2rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  position: 'relative'
                }}>
                  {nuevoGasto.comprobante_url ? (
                    <div>
                      <p style={{ margin: '0 0 8px 0', color: '#16a34a', fontWeight: 'bold', fontSize: '0.85rem' }}>
                        ✅ Archivo cargado correctamente
                      </p>
                      {nuevoGasto.comprobante_url.startsWith('data:image') && (
                        <img
                          src={nuevoGasto.comprobante_url}
                          alt="Previsualización"
                          style={{ maxHeight: '120px', borderRadius: '8px', margin: '0 auto 8px', display: 'block', objectFit: 'contain' }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setNuevoGasto({ ...nuevoGasto, comprobante_url: '' })}
                        style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Quitar comprobante
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
                        Arrastra o selecciona un archivo (PDF o Imagen, máx 8MB)
                      </p>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        style={{ marginTop: '8px', fontSize: '0.8rem' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowGastoModal(false)}
                  style={{ background: '#f1f5f9', color: '#64748b', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoGasto}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '10px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                    opacity: guardandoGasto ? 0.6 : 1
                  }}
                >
                  {guardandoGasto ? 'Guardando...' : '💾 Guardar Salida de Dinero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PREVISUALIZAR COMPROBANTE */}
      {comprobanteModalUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ padding: '1rem 1.5rem', background: '#0f172a', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>📎 Comprobante de Salida de Dinero</h3>
              <button
                onClick={() => setComprobanteModalUrl(null)}
                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.3rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', background: '#f8fafc' }}>
              {comprobanteModalUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={comprobanteModalUrl}
                  title="Comprobante PDF"
                  style={{ width: '100%', height: '550px', border: 'none', borderRadius: '8px' }}
                />
              ) : (
                <img
                  src={comprobanteModalUrl}
                  alt="Comprobante"
                  style={{ maxWidth: '100%', maxHeight: '550px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                />
              )}
            </div>
            <div style={{ padding: '0.8rem 1.5rem', background: 'white', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <a
                href={comprobanteModalUrl}
                download="comprobante_gasto_saas"
                style={{
                  background: '#2563eb',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  display: 'inline-block',
                  marginRight: '8px'
                }}
              >
                ⬇️ Descargar
              </a>
              <button
                onClick={() => setComprobanteModalUrl(null)}
                style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSaaS;
