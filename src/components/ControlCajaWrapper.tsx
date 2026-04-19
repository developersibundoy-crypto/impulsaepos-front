import React, { useState } from 'react';
import { useCaja } from './CajaContext';
import { AperturaCajaModal, CierreCajaModal } from './CajaModals';
import { useLocation, useNavigate } from 'react-router-dom';

export const ControlCajaWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { sesion, loading } = useCaja();
  const location = useLocation();
  const navigate = useNavigate();
  const token = localStorage.getItem('adminToken');
  
  // No aplicar control de caja en login o registro
  const isPublicPage = location.pathname === '/login' || location.pathname === '/registro-saas';
  
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

  if (loading) {
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
