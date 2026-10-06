import React, { useState } from 'react';
import Barcode from 'react-barcode';
import { formatCOP } from '../utils/format';

interface BarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  producto: {
    nombre: string;
    referencia: string;
    precio_venta: number | string;
  };
}

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({ isOpen, onClose, producto }) => {
  const [cantidad, setCantidad] = useState(3); // Por defecto 1 fila de 3 etiquetas
  const [mostrarPrecio, setMostrarPrecio] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    const printContent = document.getElementById('printable-barcode-container');
    if (printContent) {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '0px';
      iframe.style.height = '0px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const printDocument = iframe.contentWindow?.document;
      if (printDocument) {
        printDocument.write(`
          <html>
            <head>
              <style>
                @page {
                  size: 104mm 15mm;
                  margin: 0;
                }
                body, html { 
                  margin: 0;
                  padding: 0;
                  background: white;
                }
                .page-row {
                  width: 104mm !important;
                  height: 15mm !important;
                  page-break-after: always !important;
                  overflow: hidden !important;
                  display: block !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  box-sizing: border-box;
                }
                .label-item {
                  width: 34.6mm !important;
                  height: 15mm !important;
                  float: left !important;
                  text-align: center !important;
                  box-sizing: border-box !important;
                  padding: 1mm 0 !important;
                  margin: 0 !important;
                  display: inline-block !important;
                  overflow: hidden !important;
                }
                .label-item svg {
                  max-width: 100% !important;
                  max-height: 100% !important;
                  vertical-align: middle;
                }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printDocument.close();

        iframe.contentWindow?.focus();
        setTimeout(() => {
          iframe.contentWindow?.print();
          document.body.removeChild(iframe);
          onClose(); // Cerrar el modal sin recargar la página
        }, 500);
      }
    }
  };

  // Calcular cuántas filas de 3 necesitamos
  const rows = Math.ceil(cantidad / 3);
  const totalItems = Array.from({ length: cantidad });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            🖨️ Imprimir Etiqueta
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col items-center bg-white">
          <div className="w-full mb-6 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cantidad de Etiquetas</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="300"
                value={cantidad}
                onChange={e => setCantidad(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:ring-4 focus:ring-blue-50"
              />
              <span className="text-xs text-slate-500 font-bold whitespace-nowrap">
                ({rows} {rows === 1 ? 'fila' : 'filas'})
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-slate-400">Configuración: 104x15mm (3 columnas)</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mostrarPrecio}
                  onChange={e => setMostrarPrecio(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Incluir Precio</span>
              </label>
            </div>
          </div>

          <div className="bg-slate-100 p-4 rounded-xl w-full flex justify-center items-center overflow-hidden border border-slate-200">
            {/* Contenedor Oculto que será impreso */}
            <div id="printable-barcode-container" className="hidden" style={{ width: '104mm' }}>
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={rowIndex} className="page-row" style={{ width: '104mm', height: '15mm', pageBreakAfter: 'always', display: 'block' }}>
                  {[0, 1, 2].map(colIndex => {
                    const itemIndex = rowIndex * 3 + colIndex;
                    if (itemIndex < cantidad) {
                      return (
                        <div key={colIndex} className="label-item" style={{ width: '34.6mm', height: '15mm', float: 'left', textAlign: 'center' }}>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            height: '100%',
                            justifyContent: 'center',
                            alignItems: 'center',
                            transform: colIndex === 0 ? 'translateX(-0.5cm)' : colIndex === 2 ? 'translateX(0.5cm)' : 'none'
                          }}>
                            {mostrarPrecio && (
                              <span style={{ fontSize: '9px', fontWeight: 'bold', fontFamily: 'sans-serif', marginBottom: '1px' }}>
                                {formatCOP(producto.precio_venta)}
                              </span>
                            )}
                            <Barcode
                              value={producto.referencia}
                              width={1.2}
                              height={mostrarPrecio ? 20 : 30}
                              fontSize={9}
                              margin={0}
                              displayValue={true}
                            />
                          </div>
                        </div>
                      );
                    }
                    // Espacio en blanco si la cantidad no es múltiplo de 3
                    return <div key={colIndex} className="label-item" style={{ width: '34.6mm', height: '15mm', float: 'left' }}></div>;
                  })}
                </div>
              ))}
            </div>

            {/* Vista Previa para la Web (Solo muestra 1 fila como ejemplo) */}
            <div className="flex gap-2 opacity-80 scale-90 origin-center">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-[100px] h-[50px] bg-white border border-slate-300 flex flex-col justify-center items-center rounded-sm">
                  {mostrarPrecio && (
                    <span className="text-[8px] font-black mb-0.5">
                      {formatCOP(producto.precio_venta)}
                    </span>
                  )}
                  <Barcode
                    value={producto.referencia}
                    width={1}
                    height={mostrarPrecio ? 15 : 20}
                    fontSize={8}
                    margin={0}
                    displayValue={true}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={handlePrint}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md shadow-blue-200"
          >
            🖨️ Imprimir {cantidad}
          </button>
        </div>
      </div>
    </div>
  );
};
