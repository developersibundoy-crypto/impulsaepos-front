export const PLAN_FEATURES = {
  FACTURACION_ELECTRONICA: "facturacion_electronica",
  ANALITICA_AVANZADA: "analitica_avanzada"
};

export const hasAccess = (module: string) => {
  const role = localStorage.getItem("adminRole");
  const permisos = localStorage.getItem("adminPermisos");
  
  if (!permisos || permisos === "" || permisos === "null") {
    if (role === "admin" || role === "superadmin" || role === "dueño") {
      return true;
    }
  }

  if (permisos === "all") return true;
  
  try {
    const list = JSON.parse(permisos || "[]");
    return list.includes(module);
  } catch (e) {
    return false;
  }
};

/**
 * Verifica si el plan actual de la empresa tiene acceso a una funcionalidad específica.
 * @param feature Funcionalidad a verificar (ej: PLAN_FEATURES.FACTURACION_ELECTRONICA)
 */
export const hasPlanFeature = (feature: string): boolean => {
  const plan = localStorage.getItem("adminPlan") || "basic";
  const role = localStorage.getItem("adminRole");

  // El superadmin siempre tiene acceso a todo para soporte
  if (role === "superadmin") return true;

  const planMapping: Record<string, string[]> = {
    basic: [],
    standard: [],
    pro_facturacion: [PLAN_FEATURES.FACTURACION_ELECTRONICA],
    // Planes heredados (por compatibilidad con IDs de días)
    "30": [],
    "180": [],
    "365": []
  };

  const allowedFeatures = planMapping[plan] || [];
  return allowedFeatures.includes(feature);
};
