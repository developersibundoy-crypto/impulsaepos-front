import React, { forwardRef } from 'react';
import { formatCOP } from '../utils/format';

interface PrintReceiptProps {
  empresa: any;
  numero: string | number;
  fecha: string | Date;
  cliente: string;
  cajero?: string;
  metodoPago?: string;
  items: Array<{ nombre: string; cantidad: number; precio_unitario?: number; precio_venta?: number; qty?: number; referencia?: string }>;
  iva?: number;
  total: number;
  vuelto?: number;
  efectivoRecibido?: number;
  isSeparado?: boolean;
  totalAbonado?: number;
  saldoPendiente?: number;
  historialPagos?: Array<{ fecha: string; monto: number; cajero_nombre?: string; [key: string]: any }>;
  pagoEfectivoMixto?: number;
  pagoTransferenciaMixto?: number;
  isCotizacion?: boolean;
  // Tipo y prefijo de documento tributario
  tipoFactura?: 'POS' | 'ELECTRONICA' | 'MAYORISTA' | 'SEPARADO' | string;
  prefijo?: string;
  // Nuevos campos para cierre de caja
  isCierreCaja?: boolean;
  cierreData?: {
    cajero_nombre?: string;
    base_caja: number;
    total_ventas: number;
    total_efectivo: number;
    total_transferencia: number;
    total_ingresos: number;
    total_salidas: number;
    valor_esperado: number;
    valor_reportado: number;
    diferencia: number;
    fecha_apertura: string | Date;
    fecha_cierre?: string | Date;
  };
}

const PrintReceipt = forwardRef<HTMLDivElement, PrintReceiptProps>(
  ({ empresa, numero, fecha, cliente, cajero, metodoPago, items, iva, total, vuelto, efectivoRecibido, isSeparado, totalAbonado, saldoPendiente, historialPagos, pagoEfectivoMixto, pagoTransferenciaMixto, isCierreCaja, cierreData, isCotizacion, tipoFactura, prefijo }, ref) => {

    // Construir etiqueta y número del documento
    const getTipoLabel = () => {
      if (isCotizacion) return 'COTIZACIÓN';
      if (isSeparado) return 'COMPROBANTE DE SEPARADO';
      switch (tipoFactura) {
        case 'ELECTRONICA': return 'FACTURA ELECTRÓNICA';
        case 'MAYORISTA': return 'FACTURA MAYORISTA';
        case 'POS':
        default: return 'FACTURA POS';
      }
    };

    const getNumeroDocumento = () => {
      if (isCotizacion) return `No. COT-${String(numero).padStart(6, '0')}`;
      if (isSeparado) return `No. SEP-${String(numero).padStart(6, '0')}`;
      switch (tipoFactura) {
        case 'ELECTRONICA':
          // numero_completo ya viene formateado (ej: FE-000123)
          return `No. ${numero}`;
        case 'MAYORISTA':
          return `No. MAY-${String(numero).padStart(6, '0')}`;
        case 'POS':
        default:
          return prefijo
            ? `No. ${prefijo}-${String(numero).padStart(6, '0')}`
            : `No. POS-${String(numero).padStart(6, '0')}`;
      }
    };

    const tipoLabel = getTipoLabel();
    const numeroDoc = getNumeroDocumento();
    
    if (isCierreCaja && cierreData) {
      return (
        <div 
          ref={ref} 
          className="w-[80mm] max-w-[300px] p-4 bg-white text-black font-sans box-border" 
          style={{ margin: '0 auto' }}
        >
          <div className="text-center mb-4">
            <h1 className="text-lg font-bold uppercase mb-1">{empresa?.nombre_empresa || "MI EMPRESA"}</h1>
            <p className="text-sm font-black border-y-2 border-black py-1 uppercase mt-2">Reporte de Cierre de Caja</p>
          </div>

          <div className="space-y-1.5 text-xs mb-4">
            <div className="flex justify-between">
              <span className="font-bold">Cajero:</span>
              <span className="uppercase">{cierreData.cajero_nombre || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Apertura:</span>
              <span>{new Date(cierreData.fecha_apertura).toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">Cierre:</span>
              <span>{cierreData.fecha_cierre ? new Date(cierreData.fecha_cierre).toLocaleString('es-CO') : new Date().toLocaleString('es-CO')}</span>
            </div>
          </div>

          <div className="border-t border-black pt-2 space-y-2">
            <div className="flex justify-between text-xs">
              <span>Base Inicial:</span>
              <span className="font-bold">{formatCOP(cierreData.base_caja)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>(+) Ventas Totales:</span>
              <span className="font-bold">{formatCOP(cierreData.total_ventas)}</span>
            </div>
            <div className="flex justify-between text-xs text-blue-700">
              <span className="pl-2">Efectivo:</span>
              <span>{formatCOP(cierreData.total_efectivo)}</span>
            </div>
            <div className="flex justify-between text-xs text-blue-700">
              <span className="pl-2">Transferencia:</span>
              <span>{formatCOP(cierreData.total_transferencia)}</span>
            </div>
            <div className="flex justify-between text-xs text-emerald-600">
              <span>(+) Otros Ingresos:</span>
              <span>{formatCOP(cierreData.total_ingresos)}</span>
            </div>
            <div className="flex justify-between text-xs text-rose-600">
              <span>(-) Salidas/Gastos:</span>
              <span>{formatCOP(cierreData.total_salidas)}</span>
            </div>
          </div>

          <div className="border-t-2 border-black mt-4 pt-3 space-y-3">
             <div className="flex justify-between text-sm font-black">
                <span>EFECTIVO ESPERADO:</span>
                <span>{formatCOP(cierreData.valor_esperado)}</span>
             </div>
             <div className="flex justify-between text-sm font-black border-b border-dashed border-black pb-2">
                <span>EFECTIVO REPORTADO:</span>
                <span>{formatCOP(cierreData.valor_reportado)}</span>
             </div>
             <div className={`flex justify-between text-sm font-black ${cierreData.diferencia === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                <span>DIFERENCIA:</span>
                <span>{formatCOP(cierreData.diferencia)}</span>
             </div>
          </div>

          <div className="mt-10 pt-10 border-t border-dashed border-gray-400 text-center text-[10px]">
             <div className="w-40 mx-auto border-t border-black mb-1"></div>
             <p className="font-bold uppercase">Firma del Cajero</p>
             <p className="mt-4">{new Date().toLocaleString()}</p>
          </div>
        </div>
      );
    }

    return (
      <div 
        ref={ref} 
        className="w-[80mm] max-w-[300px] p-2 bg-white text-black font-sans box-border relative overflow-hidden" 
        style={{ margin: '0 auto' }}
      >
        {isCotizacion && (
          <div className="absolute inset-0 pointer-events-none z-0 flex flex-col items-center justify-start overflow-hidden opacity-[0.15]">
             {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="text-[3rem] font-black uppercase -rotate-45 whitespace-nowrap tracking-widest text-black my-12">
                  COTIZACIÓN
                </div>
             ))}
          </div>
        )}
        
        <div className="relative z-10">
          {/* Encabezado Company */}
          <div className="text-center mb-3">
            <h1 className="text-lg font-bold uppercase mb-1">{empresa?.nombre_empresa || "MI EMPRESA"}</h1>
            {empresa?.nit && <p className="text-xs font-medium">NIT: {empresa.nit}</p>}
            {empresa?.direccion && <p className="text-xs">{empresa.direccion}</p>}
            {empresa?.telefono && <p className="text-xs">Tel: {empresa.telefono}</p>}
          </div>

          {/* === TIPO Y NÚMERO DE DOCUMENTO === */}
          <div className="border-y-2 border-black py-1.5 mb-3 text-center">
            <p className="text-[11px] font-black uppercase tracking-widest leading-tight">{tipoLabel}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5">{numeroDoc}</p>
          </div>

          {/* Info Venta */}
          <div className="border-b border-dashed border-black pb-2 mb-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-bold">Fecha:</span>
              <span>{new Date(fecha).toLocaleString('es-CO')}</span>
            </div>
            <div className="flex justify-between text-xs text-left">
              <span className="font-bold">Cliente:</span>
              <span className="truncate w-32 text-right">{cliente || 'Consumidor Final'}</span>
            </div>
            {cajero && (
              <div className="flex justify-between text-xs text-left">
                <span className="font-bold">Vendedor:</span>
                <span className="truncate w-32 text-right">{cajero}</span>
              </div>
            )}
          </div>

          {/* Listado Productos */}
          <table className="w-full text-[10px] mb-3">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left font-bold py-1">Ítem/Cant</th>
                <th className="text-right font-bold py-1">Precio</th>
                <th className="text-right font-bold py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const cantidadFacturada = item.qty !== undefined ? item.qty : (item.cantidad || 1);
                const precioOrig = item.precio_venta || item.precio_unitario || 0;
                const precioFin = item.precio_unitario !== undefined ? item.precio_unitario : precioOrig;
                const rowTotal = precioFin * cantidadFacturada;
                const hasDiscount = precioOrig > precioFin;

                return (
                  <tr key={idx} className="border-b border-dashed border-gray-300">
                    <td className="py-1.5 align-top w-[45%]">
                      <div className="uppercase font-medium break-words leading-tight">{item.nombre}</div>
                      {item.referencia && <div className="text-[11px] font-black mt-0.5 border-t border-gray-100 pt-0.5 mb-1">REF: {item.referencia}</div>}
                      <div className="text-[9px] mt-0.5">{cantidadFacturada} UND</div>
                    </td>
                    <td className="text-right py-1.5 align-top w-[30%]">
                      {hasDiscount ? (
                          <div className="flex flex-col items-end">
                             <span className="line-through text-[8px] text-gray-500">{formatCOP(precioOrig)}</span>
                             <span className="font-bold">{formatCOP(precioFin)}</span>
                          </div>
                      ) : (
                          <div className="font-bold">{formatCOP(precioFin)}</div>
                      )}
                    </td>
                    <td className="text-right py-1.5 align-bottom w-[25%] font-black">
                      {formatCOP(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totales */}
          <div className="space-y-1 border-t-2 border-black pt-2 mb-4">
            <div className="flex justify-between text-[11px] mt-1">
              <span>Subtotal:</span>
              <span>{formatCOP(total - (iva || 0))}</span>
            </div>
            {iva !== undefined && iva > 0 && (
              <div className="flex justify-between text-[11px] border-b border-dashed border-gray-300 pb-1">
                <span>IVA:</span>
                <span>{formatCOP(iva)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-sm font-black mt-1">
              <span>TOTAL A PAGAR:</span>
              <span>{formatCOP(total)}</span>
            </div>

            {!isCotizacion && metodoPago && (
              <div className="flex justify-between text-xs mt-2 border-t border-dashed border-gray-300 pt-1">
                <span>Método Pago:</span>
                <span className="uppercase">{metodoPago}</span>
              </div>
            )}
            {metodoPago === 'Mixto' && pagoEfectivoMixto !== undefined && pagoTransferenciaMixto !== undefined && (
              <div className="pt-1 space-y-0.5">
                 <div className="flex justify-between text-[11px] text-gray-700">
                    <span>Monto Efectivo:</span>
                    <span>{formatCOP(pagoEfectivoMixto)}</span>
                 </div>
                 <div className="flex justify-between text-[11px] text-gray-700">
                    <span>Monto Transf/App:</span>
                    <span>{formatCOP(pagoTransferenciaMixto)}</span>
                 </div>
              </div>
            )}
            {metodoPago === 'Efectivo' && efectivoRecibido !== undefined && (
              <div className="flex justify-between text-xs">
                <span>Efectivo:</span>
                <span>{formatCOP(efectivoRecibido)}</span>
              </div>
            )}
            {!isCotizacion && metodoPago === 'Efectivo' && vuelto !== undefined && (
              <div className="flex justify-between text-xs font-bold">
                <span>Cambio:</span>
                <span>{formatCOP(vuelto)}</span>
              </div>
            )}
            {isSeparado && totalAbonado !== undefined && (
              <div className="flex justify-between text-xs text-emerald-700 mt-2">
                <span>TOTAL ABONADO:</span>
                <span className="font-bold">+{formatCOP(totalAbonado)}</span>
              </div>
            )}
            {isSeparado && saldoPendiente !== undefined && (
               <div className="flex justify-between font-black text-lg border-t-2 border-black pt-2 mt-2">
                  <span>SALDO:</span>
                  <span>{formatCOP(saldoPendiente)}</span>
               </div>
            )}
          </div>

          {/* Historial de Pagos (Separados) */}
          {isSeparado && historialPagos && historialPagos.length > 0 && (
            <div className="mt-4 mb-4">
               <div className="text-[11px] font-bold text-center border-y border-black py-1 mb-2 uppercase">Historial de Abonos</div>
               <table className="w-full text-[9px]">
                 <thead>
                   <tr className="border-b border-gray-300">
                     <th className="text-left font-bold py-1">Fecha</th>
                     <th className="text-right font-bold py-1">Monto</th>
                   </tr>
                 </thead>
                 <tbody>
                    {historialPagos.map((pago: any, pIdx: number) => {
                      const paymentDate = pago.fecha ? new Date(pago.fecha) : new Date();
                      return (
                        <tr key={pIdx} className="border-b border-dashed border-gray-300">
                          <td className="py-1">
                            <div className="text-[9px] uppercase text-gray-800">
                              {paymentDate.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                            {pago.cajero_nombre && (
                              <div className="text-[7px] text-gray-500 italic">Cajero: {pago.cajero_nombre}</div>
                            )}
                          </td>
                          <td className="text-right py-1 font-bold">{formatCOP(pago.monto)}</td>
                        </tr>
                      );
                    })}
                 </tbody>
               </table>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-[10px] mt-4 mb-2">
            {isCotizacion && (
               <p className="mb-2 font-bold uppercase border-y border-black py-2 mt-4 text-[11px]">Documento no válido como factura.<br/>Validez de la oferta: 15 días.</p>
            )}
            {isSeparado && (
               <p className="mb-2 opacity-80">Guarde este recibo para futuros abonos o retiro de mercancía.</p>
            )}
            {!isCotizacion && <p className="font-bold mb-1">¡Gracias por su compra!</p>}
            {empresa?.resolucion && !isCotizacion && <p className="text-gray-600">{empresa.resolucion}</p>}
          </div>
        </div>
      </div>
    );
  }
);

export default PrintReceipt;
