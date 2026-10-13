export function importeCentavos(valor: string | number) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(valor))) throw new Error('Ingrese un importe con máximo dos decimales');
  const cents = Math.round(Number(valor) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Importe fuera de rango');
  return cents;
}

export function intentoDevolucion(separado: number, turno: number, efectivo: string, transferencia: string, pendiente: number, uuid: string) {
  const ef = importeCentavos(efectivo), tr = importeCentavos(transferencia);
  if (ef + tr <= 0 || ef + tr > importeCentavos(pendiente)) throw new Error('La devolución debe ser positiva y no superar el remanente');
  return { sesion_caja_id: turno, operacion_id: `${separado}.${turno}.${uuid}`,
    devolucion_efectivo: ef / 100, devolucion_transferencia: tr / 100 };
}
