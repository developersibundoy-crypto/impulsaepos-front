import { useState, useEffect } from 'react';
import { hasPlanFeature, PLAN_FEATURES } from '../utils/auth';

export const usePlan = () => {
  const [currentPlan, setCurrentPlan] = useState<string>(localStorage.getItem("adminPlan") || "basic");

  useEffect(() => {
    // Escuchar cambios en el localStorage (por si se actualiza el plan en otra pestaña o modal)
    const handleStorageChange = () => {
      setCurrentPlan(localStorage.getItem("adminPlan") || "basic");
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const canAccessElectronicBilling = hasPlanFeature(PLAN_FEATURES.FACTURACION_ELECTRONICA);

  return {
    currentPlan,
    canAccessElectronicBilling,
    PLAN_FEATURES
  };
};
