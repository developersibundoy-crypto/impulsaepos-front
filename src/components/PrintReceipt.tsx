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
}

const PrintReceipt = forwardRef<HTMLDivElement, PrintReceiptProps>(
  ({ empresa, numero, fecha, cliente, cajero, metodoPago, items, iva, total, vuelto, efectivoRecibido, isSeparado, totalAbonado, saldoPendiente, historialPagos, pagoEfectivoMixto, pagoTransferenciaMixto }, ref) => {
    return (
      <div 
        ref={ref} 
        className="w-[80mm] max-w-[300px] p-2 bg-white text-black font-sans box-border" 
        style={{ margin: '0 auto' }}
      >
        {/* Encabezado Company */}
        <div className="text-center mb-3">
          <h1 className="text-lg font-bold uppercase mb-1">{empresa?.nombre_empresa || "MI EMPRESA"}</h1>
          {empresa?.nit && <p className="text-xs font-medium">NIT: {empresa.nit}</p>}
          {empresa?.direccion && <p className="text-xs">{empresa.direccion}</p>}
          {empresa?.telefono && <p className="text-xs">Tel: {empresa.telefono}</p>}
        </div>

        {/* Info Venta */}
        <div className="border-t border-b border-dashed border-black py-2 mb-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-bold">Factura No:</span>
            <span>{numero}</span>
          </div>
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

          {metodoPago && (
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
          {metodoPago === 'Efectivo' && vuelto !== undefined && (
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
          {isSeparado && (
             <p className="mb-2 opacity-80">Guarde este recibo para futuros abonos o retiro de mercancía.</p>
          )}
          <p className="font-bold mb-1">¡Gracias por su compra!</p>
          {empresa?.resolucion && <p className="text-gray-600">{empresa.resolucion}</p>}
        </div>
      </div>
    );
  }
);

export default PrintReceipt;
