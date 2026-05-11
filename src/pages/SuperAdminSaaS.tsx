import React, { useState, useEffect } from 'react';
import API from '../api/api';

const SuperAdminSaaS = () => {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
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

  const fetchData = async () => {
    try {
      const [resEmpresas, resPagos, resConfig] = await Promise.all([
        API.get('/suscripciones/superadmin/empresas'),
        API.get('/suscripciones/superadmin/pagos'),
        API.get('/suscripciones/superadmin/config')
      ]);
      setEmpresas(resEmpresas.data);
      setPagos(resPagos.data);
      if (resConfig.data) setConfig(resConfig.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'No Autorizado o problema de conexión.');
      setLoading(false);
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

  // Ingresos generados ESTE MES
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const ingresosEsteMes = pagos.reduce((acc, pago) => {
    // Si no hay fecha de pago en BD, asumimos todo al histórico. Para filtrar mejor la BD debe tener 'fecha_pago'
    if (pago.fecha_pago) {
      const fecha = new Date(pago.fecha_pago);
      if (fecha.getMonth() === currentMonth && fecha.getFullYear() === currentYear) {
         return acc + (Number(pago.monto) || 0);
      }
    } else {
      // Fallback: Si no existe fecha_pago, sumamos todo o usamos asunción
      return acc + (Number(pago.monto) || 0);
    }
    return acc;
  }, 0);

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
        <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2.8rem', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '900', letterSpacing: '-0.5px' }}>
          <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}>👑</span> 
          <span style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Portal Maestro SaaS</span>
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.2rem', margin: 0, fontWeight: '500' }}>Supervisión Global, Métricas y Cobranzas Directas</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderBottom: '4px solid #10b981' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Comercios Activos</h3>
          <p style={{ fontSize: '3.5rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#10b981', lineHeight: '1' }}>{activas}</p>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderBottom: '4px solid #3b82f6' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>En Periodo Trial</h3>
          <p style={{ fontSize: '3.5rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#3b82f6', lineHeight: '1' }}>{trials}</p>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', borderBottom: '4px solid #ef4444' }}>
          <h3 style={{ margin: 0, color: '#64748b', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>En Mora / Expirados</h3>
          <p style={{ fontSize: '3.5rem', margin: '0.5rem 0 0', fontWeight: '800', color: '#ef4444', lineHeight: '1' }}>{expiradas}</p>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: 0, color: '#166534', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Ingresos Este Mes</h3>
          <p style={{ fontSize: '2.5rem', margin: '1rem 0 0', fontWeight: '800', color: '#15803d' }}>
            ${ingresosEsteMes.toLocaleString('es-CO')}
          </p>
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
          <h2 style={{ color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Historial Directo de Pagos💳</span>
            <span style={{ fontSize: '1.2rem', color: '#64748b', fontWeight: 'bold' }}>Total Global: <span style={{ color: '#0f172a' }}>${totalHistorico.toLocaleString('es-CO')}</span></span>
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
    </div>
  );
};

export default SuperAdminSaaS;
