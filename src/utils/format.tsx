export const formatCOP = (value: any) => {
  if (value === undefined || value === null || isNaN(Number(value))) return "$0";
  // Forzamos el redondeo para eliminar cualquier decimal
  const rounded = Math.round(Number(value));
  // Usamos una expresión regular para insertar el punto (.) como separador de miles exacto y sin espacio tras el $
  return "$" + rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export const formatDateTime = (date: any) => {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString('es-CO', { 
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
