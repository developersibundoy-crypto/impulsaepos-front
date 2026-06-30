import React, { useState, useEffect, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import API from "../api/api";
import { formatCOP } from "../utils/format";

// Helper to calculate commercial days (30 days/month, 360 days/year)
const getDiasComerciales = (inicio: string, fin: string): number => {
  const start = new Date(inicio + "T00:00:00");
  const end = new Date(fin + "T00:00:00");

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

  let d1 = start.getDate();
  let m1 = start.getMonth() + 1;
  let y1 = start.getFullYear();

  let d2 = end.getDate();
  let m2 = end.getMonth() + 1;
  let y2 = end.getFullYear();

  // Regla de 30 días comerciales
  if (d1 === 31) d1 = 30;
  
  const isLeap1 = (y1 % 4 === 0 && y1 % 100 !== 0) || y1 % 400 === 0;
  const lastDayFeb1 = isLeap1 ? 29 : 28;
  if (m1 === 2 && d1 === lastDayFeb1) d1 = 30;

  if (d2 === 31) d2 = 30;

  const isLeap2 = (y2 % 4 === 0 && y2 % 100 !== 0) || y2 % 400 === 0;
  const lastDayFeb2 = isLeap2 ? 29 : 28;
  if (m2 === 2 && d2 === lastDayFeb2) d2 = 30;

  const days = (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1) + 1;
  return days > 0 ? days : 0;
};

function PagosEmpleados() {
  const [ nomina, setNomina ] = useState<any[]>([]);
  const [ loading, setLoading ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const currentDate = new Date();
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [ fechaInicio, setFechaInicio ] = useState(firstDay);
  const [ fechaFin, setFechaFin ] = useState(lastDay);

  const [ ticketData, setTicketData ] = useState<any>(null);
  
  // Per-employee date ranges and expanding logic
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [empDates, setEmpDates] = useState<{ [key: number]: { fechaInicio: string, fechaFin: string } }>({});
  const [loadingEmp, setLoadingEmp] = useState<{ [key: number]: boolean }>({});
  const [incluirComisiones, setIncluirComisiones] = useState<{ [key: number]: boolean }>({});

  const fetchNomina = async () => {
    if (fechaInicio > fechaFin) {
        setError("La fecha inicial no puede ser mayor que la final.");
        return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await API.get(`/pagos?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`);
      
      // Initialize empDates for new records if not already set
      const newEmpDates = { ...empDates };
      res.data.forEach((emp: any) => {
          if (!newEmpDates[emp.cajero_id]) {
              newEmpDates[emp.cajero_id] = { fechaInicio, fechaFin };
          }
      });
      setEmpDates(newEmpDates);
      setNomina(res.data);
    } catch (err: any) {
      console.error("Payroll Fetch Error:", err);
      const msg = err.response?.data?.error || err.message || "Error desconocido";
      setError(`Fallo de conexión: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNomina();
  }, [fechaInicio, fechaFin]);

  const recalculateEmployee = async (cajero_id: number) => {
      const dates = empDates[cajero_id] || { fechaInicio, fechaFin };
      if (dates.fechaInicio > dates.fechaFin) {
          alert("La fecha inicial no puede ser mayor que la final para este colaborador.");
          return;
      }
      setLoadingEmp(prev => ({ ...prev, [cajero_id]: true }));
      try {
          const res = await API.get(`/pagos?fecha_inicio=${dates.fechaInicio}&fecha_fin=${dates.fechaFin}&cajero_id=${cajero_id}`);
          if (res.data && res.data.length > 0) {
              const updatedEmp = res.data[0];
              setNomina(prev => prev.map(emp => emp.cajero_id === cajero_id ? updatedEmp : emp));
          }
      } catch (err: any) {
          alert("Error al recalcular: " + (err.response?.data?.error || err.message));
      } finally {
          setLoadingEmp(prev => ({ ...prev, [cajero_id]: false }));
      }
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  useEffect(() => {
    if (ticketData) {
      setTimeout(() => {
        reactToPrintFn();
      }, 200);
    }
  }, [ticketData, reactToPrintFn]);

  const handlePagar = async (empleado: any) => {
    const dates = empDates[empleado.cajero_id] || { fechaInicio, fechaFin };
    const diasLiquidados = getDiasComerciales(dates.fechaInicio, dates.fechaFin);
    const valorDiario = empleado.salario_base / 30;
    const salarioProporcional = valorDiario * diasLiquidados;

    const isComisionesIncluidas = incluirComisiones[empleado.cajero_id] ?? true;
    const comisionesAPagar = isComisionesIncluidas ? empleado.comisiones : 0;
    const totalNeto = salarioProporcional + comisionesAPagar;

    if (!window.confirm(`¿Confirmar pago a ${empleado.nombre} por ${formatCOP(totalNeto)}?`)) return;

    try {
      await API.post("/pagos", {
        cajero_id: empleado.cajero_id,
        fecha_inicio: dates.fechaInicio,
        fecha_fin: dates.fechaFin,
        salario_base: salarioProporcional,
        comisiones: comisionesAPagar,
        total_pagado: totalNeto,
        metodo_pago: "Efectivo"
      });
      
      setTicketData({
        ...empleado,
        salario_base: salarioProporcional,
        salario_mensual_base: empleado.salario_base,
        dias_liquidados: diasLiquidados,
        comisiones: comisionesAPagar,
        total_a_pagar: totalNeto,
        periodoLabel: `${dates.fechaInicio} al ${dates.fechaFin}`,
        fecha_pago: new Date().toISOString()
      });

      // Refetch just this employee to update status
      recalculateEmployee(empleado.cajero_id);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al registrar el pago.");
    }
  };

  const handleReimprimirSoporte = (empleado: any) => {
     const dates = empDates[empleado.cajero_id] || { fechaInicio, fechaFin };
     const diasLiquidados = getDiasComerciales(dates.fechaInicio, dates.fechaFin);
     setTicketData({
        ...empleado,
        salario_base: empleado.salario_pagado !== null ? empleado.salario_pagado : (empleado.salario_base / 30) * diasLiquidados,
        dias_liquidados: diasLiquidados,
        salario_mensual_base: empleado.salario_base,
        periodoLabel: `${dates.fechaInicio} al ${dates.fechaFin}`
      });
  };

  const totalNominaCalculada = nomina.reduce((acc, emp) => {
      const dates = empDates[emp.cajero_id] || { fechaInicio, fechaFin };
      const diasLiquidados = getDiasComerciales(dates.fechaInicio, dates.fechaFin);
      
      let salarioProporcional = emp.salario_pagado;
      if (salarioProporcional === null || salarioProporcional === undefined) {
          const valorDiario = emp.salario_base / 30;
          salarioProporcional = valorDiario * diasLiquidados;
      }

      const isComisionesIncluidas = incluirComisiones[emp.cajero_id] ?? true;
      const comisionesAPagar = isComisionesIncluidas ? emp.comisiones : 0;
      return acc + (emp.estado === "Pagado" ? emp.total_a_pagar : salarioProporcional + comisionesAPagar);
  }, 0);

  return (
    <div className="max-w-[1400px] mx-auto animate-in fade-in duration-700 pb-20">
      
      <div className="no-print space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-200">
            <div className="space-y-1">
                <h1 className="text-4xl font-medium tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500">
                    Nómina y Comisiones
                </h1>
                <p className="text-slate-500 font-medium text-lg italic">Liquidación mensual de salarios fijos y bonificaciones por ventas.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            
            {/* Control Sidebar */}
            <div className="xl:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                    <h3 className="text-xl font-medium text-slate-900 flex items-center gap-2">
                        <span className="w-2 h-6 bg-indigo-600 rounded-full"></span> Periodo Fiscal
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Fecha Inicial Global</label>
                            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-widest ml-1">Fecha Final Global</label>
                            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all" />
                        </div>
                    </div>

                    <div className="pt-8 border-t border-slate-100">
                        <div className="p-6 bg-slate-950 rounded-3xl relative overflow-hidden group">
                            <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-widest mb-2 block relative z-10">Desembolso Proyectado</span>
                            <span className="text-3xl font-medium text-white tracking-tighter relative z-10">{formatCOP(totalNominaCalculada)}</span>
                            <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 group-hover:scale-125 transition-transform duration-700">💸</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Table Area */}
            <div className="xl:col-span-8">
                <div className="bg-white rounded-[48px] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-lg font-medium text-slate-900 tracking-tight uppercase flex items-center gap-2">
                            <span className="w-2 h-6 bg-slate-900 rounded-full"></span> Planilla de Liquidación
                        </h3>
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest px-4 py-1 bg-slate-50 rounded-full">{nomina.length} Empleados</span>
                    </div>

                    {error && (
                        <div className="m-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-medium animate-in slide-in-from-top-2">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[10px] font-medium text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                                    <th className="px-8 py-5">Colaborador</th>
                                    <th className="px-8 py-5 text-right">Devengado Fijo</th>
                                    <th className="px-8 py-5 text-right">Comisiones</th>
                                    <th className="px-8 py-5 text-right">Total Neto</th>
                                    <th className="px-8 py-5 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr><td colSpan={5} className="py-24 text-center text-slate-400 font-medium uppercase text-[10px] tracking-widest">Calculando compensaciones...</td></tr>
                                ) : nomina.length === 0 ? (
                                    <tr><td colSpan={5} className="py-24 text-center text-slate-300 font-medium italic opacity-50">No hay personal activo en este periodo.</td></tr>
                                ) : (
                                    nomina.map(emp => {
                                        const dates = empDates[emp.cajero_id] || { fechaInicio, fechaFin };
                                        const diasLiquidados = getDiasComerciales(dates.fechaInicio, dates.fechaFin);
                                        const valorDiario = emp.salario_base / 30;
                                        
                                        let salarioProporcional = emp.salario_pagado;
                                        if (salarioProporcional === null || salarioProporcional === undefined) {
                                            salarioProporcional = valorDiario * diasLiquidados;
                                        }

                                        const isComisionesIncluidas = incluirComisiones[emp.cajero_id] ?? true;
                                        const comisionesAPagar = isComisionesIncluidas ? emp.comisiones : 0;
                                        const totalNeto = salarioProporcional + comisionesAPagar;

                                        return (
                                        <React.Fragment key={emp.cajero_id}>
                                            <tr 
                                                className={`group hover:bg-slate-50 transition-colors cursor-pointer ${expandedRow === emp.cajero_id ? 'bg-indigo-50/30' : ''}`}
                                                onClick={() => setExpandedRow(expandedRow === emp.cajero_id ? null : emp.cajero_id)}
                                            >
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`transition-transform duration-200 text-slate-400 ${expandedRow === emp.cajero_id ? 'rotate-90 text-indigo-500' : ''}`}>▶</span>
                                                        <div>
                                                            <div className="font-medium text-slate-900 uppercase leading-tight group-hover:text-indigo-600 transition-colors">{emp.nombre}</div>
                                                            <div className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">ID: {emp.documento || "—"}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="font-medium text-slate-600 text-sm tracking-tight">{formatCOP(salarioProporcional)}</div>
                                                    <div className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-tighter">
                                                        {diasLiquidados} DÍAS A {formatCOP(valorDiario)}/DÍA
                                                    </div>
                                                    <div className="text-[8px] font-medium text-slate-400 uppercase tracking-tighter">
                                                        BASE MENS: {formatCOP(emp.salario_base)}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className={`font-medium text-sm ${emp.comisiones > 0 ? 'text-emerald-600' : 'text-slate-300'} ${!isComisionesIncluidas && emp.comisiones > 0 ? 'opacity-50 line-through' : ''}`}>
                                                        +{formatCOP(emp.comisiones)}
                                                    </div>
                                                    {emp.estado !== "Pagado" && emp.comisiones > 0 && (
                                                        <label className="flex items-center justify-end gap-1 mt-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={isComisionesIncluidas} 
                                                                onChange={(e) => setIncluirComisiones(prev => ({...prev, [emp.cajero_id]: e.target.checked}))}
                                                                className="w-3 h-3 text-indigo-600 rounded"
                                                            />
                                                            <span className="text-[9px] font-medium text-slate-500 uppercase">Incluir</span>
                                                        </label>
                                                    )}
                                                    {!isComisionesIncluidas && emp.comisiones > 0 && (
                                                        <div className="text-[8px] font-bold text-amber-500 uppercase mt-1">Acumuladas para después</div>
                                                    )}
                                                    {emp.porcentaje_comision > 0 && <div className="text-[8px] font-medium text-emerald-400 uppercase mt-1">Efec. {emp.porcentaje_comision}%</div>}
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="font-medium text-slate-900 text-lg tracking-tighter">
                                                        {loadingEmp[emp.cajero_id] ? "..." : formatCOP(emp.estado === "Pagado" ? emp.total_a_pagar : totalNeto)}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {emp.estado === "Pagado" ? (
                                                        <button onClick={() => handleReimprimirSoporte(emp)} className="px-5 py-2 bg-slate-100 text-[10px] font-medium text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all uppercase tracking-widest border border-slate-200">🖨️ Re-Imprimir</button>
                                                    ) : (
                                                        <button onClick={() => handlePagar(emp)} disabled={loadingEmp[emp.cajero_id]} className="px-8 py-3 bg-indigo-600 text-[10px] font-medium text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-1 transition-all uppercase tracking-widest disabled:opacity-50">💰 Pagar Salario</button>
                                                    )}
                                                </td>
                                            </tr>
                                            {expandedRow === emp.cajero_id && (
                                                <tr className="bg-indigo-50/10 border-b border-indigo-50 animate-in fade-in zoom-in-95 duration-200">
                                                    <td colSpan={5} className="px-8 py-6">
                                                        <div className="flex items-center gap-6 p-4 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                                                            <div className="space-y-1 flex-1">
                                                                <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest ml-1">Periodo a liquidar para este colaborador</label>
                                                                <div className="flex gap-4 items-center">
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1 block mb-1">Fecha Inicial</label>
                                                                        <input 
                                                                            type="date" 
                                                                            value={empDates[emp.cajero_id]?.fechaInicio || fechaInicio} 
                                                                            onChange={(e) => setEmpDates(prev => ({ ...prev, [emp.cajero_id]: { ...prev[emp.cajero_id], fechaInicio: e.target.value } }))} 
                                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs outline-none focus:bg-white focus:border-indigo-400 transition-all" 
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <label className="text-[9px] font-medium text-slate-400 uppercase ml-1 block mb-1">Fecha Final</label>
                                                                        <input 
                                                                            type="date" 
                                                                            value={empDates[emp.cajero_id]?.fechaFin || fechaFin} 
                                                                            onChange={(e) => setEmpDates(prev => ({ ...prev, [emp.cajero_id]: { ...prev[emp.cajero_id], fechaFin: e.target.value } }))} 
                                                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs outline-none focus:bg-white focus:border-indigo-400 transition-all" 
                                                                        />
                                                                    </div>
                                                                    <div className="pt-5">
                                                                        <button 
                                                                            onClick={() => recalculateEmployee(emp.cajero_id)}
                                                                            disabled={loadingEmp[emp.cajero_id]}
                                                                            className="px-6 py-2 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50"
                                                                        >
                                                                            {loadingEmp[emp.cajero_id] ? "Calculando..." : "Recalcular 🔄"}
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {emp.estado === "Pagado" && (
                                                                <div className="text-[10px] font-medium text-amber-600 bg-amber-50 px-4 py-2 rounded-xl">
                                                                    ⚠️ Ya tiene un pago registrado.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div style={{ display: 'none' }}>
        {ticketData && (
          <div ref={contentRef} className="w-[80mm] max-w-[300px] p-4 bg-white text-black font-sans box-border" style={{ margin: '0 auto' }}>
              <div className="text-center space-y-2 mb-3">
                  <h2 className="text-lg font-medium uppercase">Soporte de Pago</h2>
                  <div className="py-2 border-y border-dashed border-black my-2 text-xs font-medium uppercase">
                      Liquidación: {ticketData.periodoLabel}
                  </div>
                  <p className="text-[10px] uppercase font-medium opacity-70">Fecha: {new Date().toLocaleString()}</p>
              </div>

              <div className="text-xs space-y-1 border-b border-dashed border-black pb-3 mb-3">
                  <p><strong>Colaborador:</strong> {ticketData.nombre}</p>
                  <p><strong>Documento:</strong> {ticketData.documento || '—'}</p>
              </div>

              <table className="w-full text-xs mb-3">
                  <thead>
                      <tr className="border-b border-black">
                          <th className="py-1 text-left uppercase">Concepto</th>
                          <th className="py-1 text-right uppercase">Valor</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr className="border-b border-dashed border-gray-300">
                          <td className="py-2 font-medium">
                              Salario Proporcional<br/>
                              <span className="text-[8px] opacity-70 font-normal">
                                  {ticketData.dias_liquidados} DÍAS (BASE: {formatCOP(ticketData.salario_mensual_base || 0)})
                              </span>
                          </td>
                          <td className="py-2 text-right font-medium align-top">{formatCOP(ticketData.salario_base)}</td>
                      </tr>
                      <tr className="border-b border-dashed border-gray-300">
                          <td className="py-2 font-medium">Comisiones ({ticketData.porcentaje_comision}%)</td>
                          <td className="py-2 text-right font-medium text-emerald-700">+{formatCOP(ticketData.comisiones)}</td>
                      </tr>
                  </tbody>
              </table>

              <div className="pt-2 border-t border-black space-y-4">
                  <div className="flex justify-between font-medium text-sm mt-2">
                      <span>NETO PAGADO:</span>
                      <span>{formatCOP(ticketData.total_a_pagar)}</span>
                  </div>
                  
                  <div className="pt-10 flex flex-col items-center gap-1">
                      <div className="w-[80%] border-t border-black mb-1"></div>
                      <p className="text-[9px] font-medium uppercase">Firma de Conformidad</p>
                      <p className="text-[9px] uppercase font-medium">{ticketData.nombre}</p>
                  </div>
              </div>

              <p className="text-center text-[8px] pt-6 opacity-50 uppercase tracking-widest italic">Documento generado por ERP</p>
          </div>
        )}
      </div>

    </div>
  );
}

export default PagosEmpleados;
