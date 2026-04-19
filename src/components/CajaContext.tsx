import React, { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/api';

interface SesionCaja {
  id: number;
  base_caja: number;
  fecha_apertura: string;
  total_ventas: number;
  total_efectivo: number;
  total_transferencia: number;
  total_ingresos: number;
  total_salidas: number;
  valor_esperado: number;
}

interface CajaContextType {
  sesion: SesionCaja | null;
  loading: boolean;
  abrirCaja: (base: number) => Promise<void>;
  cerrarCaja: (reportado: number) => Promise<any>;
  registrarMovimiento: (data: { tipo: string; monto: number; descripcion: string; sesion_caja_id: number }) => Promise<void>;
  limpiarSesion: () => void;
  verificarEstado: () => Promise<void>;
}

const CajaContext = createContext<CajaContextType | undefined>(undefined);

export const CajaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sesion, setSesion] = useState<SesionCaja | null>(null);
  const [loading, setLoading] = useState(true);

  const verificarEstado = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      setSesion(null);
      setLoading(false);
      return;
    }

    try {
      const res = await API.get('/caja/estado-actual');
      if (res.data.abierta) {
        setSesion(res.data.sesion);
      } else {
        setSesion(null);
      }
    } catch (error: any) {
      // Si es 401 (token expirado), el interceptor de API ya redirige al /login.
      // No seteamos sesion=null aquí para evitar mostrar AperturaCajaModal antes del redirect.
      if (error?.response?.status !== 401) {
        console.error("Error verificando estado de caja:", error);
        setSesion(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const abrirCaja = async (base: number) => {
    await API.post('/caja/apertura', { base_caja: base });
    await verificarEstado();
  };

  const cerrarCaja = async (reportado: number) => {
    const res = await API.post('/caja/cierre', { dinero_reportado: reportado });
    // NO limpiar sesión aquí — se limpia explícitamente después del resumen de cierre
    return res.data;
  };

  const registrarMovimiento = async (data: any) => {
    await API.post('/caja/movimiento', data);
    await verificarEstado();
  };

  const limpiarSesion = () => {
    setSesion(null);
  };

  useEffect(() => {
    verificarEstado();
  }, []);

  return (
    <CajaContext.Provider value={{ sesion, loading, abrirCaja, cerrarCaja, registrarMovimiento, limpiarSesion, verificarEstado }}>
      {children}
    </CajaContext.Provider>
  );
};

export const useCaja = () => {
  const context = useContext(CajaContext);
  if (context === undefined) {
    throw new Error('useCaja must be used within a CajaProvider');
  }
  return context;
};
