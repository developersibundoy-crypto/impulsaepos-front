import React, { useState } from 'react';
import { useCaja } from './CajaContext';
import { AperturaCajaModal, CierreCajaModal } from './CajaModals';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../api/api';

export const ControlCajaWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sesion, loading } = useCaja();
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');

  const [checkingSub, setCheckingSub] = useState(true);

  // No aplicar control de caja en login, registro o renovación
  const isPublicPage = location.pathname === '/login' || location.pathname === '/registro-saas' || location.pathname === '/renovacion';
  
  React.useEffect(() => {
    if (token && !isPublicPage) {
      const isAdminOfPlatform = localStorage.getItem('adminEmpresaId') === '1';
      if (isAdminOfPlatform) {
        setCheckingSub(false);
        return;
      }

      API.get('/suscripciones/estado')
        .then((res: any) => {
          if (res.data.diasRestantes <= 0) {
            navigate('/renovacion');
          }
        })
        .finally(() => setCheckingSub(false));
    } else {
      setCheckingSub(false);
    }
  }, [token, isPublicPage, navigate]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  // Si no hay token de autenticación, redirigir al login (sesión expirada)
  if (!token) {
    // Limpieza de seguridad y redirección
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminRole');
    navigate('/login', { replace: true });
    return null;
  }

  if (loading || checkingSub) {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center z-[200]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Si hay token pero no hay sesión de caja abierta, mostrar apertura de caja
  if (!sesion) {
    return <AperturaCajaModal />;
  }

  return <>{children}</>;
};
