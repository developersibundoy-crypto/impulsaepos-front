import React, { useState } from "react";
import * as XLSX from "xlsx";
import API from "../api/api";

interface ImportarProductosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ImportarProductosModal: React.FC<ImportarProductosModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const procesarArchivo = async () => {
    if (!file) return alert("Por favor, selecciona un archivo.");

    setLoading(true);
    setResults(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          throw new Error("El archivo está vacío o no tiene el formato correcto.");
        }

        // Mapear columnas del Excel a los nombres que espera el backend
        // Se asume que el Excel tiene columnas con nombres similares o exactos
        const mappedData = jsonData.map((row) => ({
          referencia: row.referencia || row.Referencia || row.codigo || "",
          nombre: row.nombre || row.Nombre || row.producto || row.Producto || "",
          categoria: row.categoria || row.Categoria || "General",
          cantidad: parseFloat(row.cantidad || row.Cantidad || row.stock || 0),
          precio_compra: parseFloat(row.precio_compra || row.PrecioCompra || row.costo || 0),
          precio_venta: parseFloat(row.precio_venta || row.PrecioVenta || row.precio || 0),
          porcentaje_ganancia: parseFloat(row.porcentaje_ganancia || row.Ganancia || 40),
          es_servicio: row.es_servicio === "Sí" || row.es_servicio === "si" || row.es_servicio === 1 || false,
          iva_porcentaje: parseFloat(row.iva || row.IVA || 0),
          permitir_venta_negativa: row.venta_negativa !== undefined ? (row.venta_negativa === "Sí" || row.venta_negativa === 1) : true
        }));

        // Validar campos obligatorios
        const validData = mappedData.filter(p => p.nombre.trim() !== "");
        
        if (validData.length === 0) {
          throw new Error("No se encontraron productos válidos (el nombre es obligatorio).");
        }

        const response = await API.post("/productos/batch", validData);
        setResults({ success: true, message: `Se importaron ${validData.length} productos correctamente.` });
        onSuccess();
      } catch (err: any) {
        console.error("Error al procesar el archivo:", err);
        setResults({ success: false, message: err.message || "Error al procesar el archivo." });
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 uppercase italic tracking-tight">
                Importar <span className="text-indigo-600">Masivo</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">Carga de inventario desde Excel</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
              <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-2">Instrucciones:</h3>
              <ul className="text-[11px] text-slate-600 space-y-1.5">
                <li>• El archivo debe ser <span className="font-bold text-slate-800">.xlsx</span> o <span className="font-bold text-slate-800">.csv</span>.</li>
                <li>• Columnas sugeridas: <span className="italic">referencia, nombre, categoria, cantidad, precio_compra, precio_venta, iva</span>.</li>
                <li>• Si la referencia ya existe, el stock se <span className="font-bold text-indigo-600">sumará</span> al actual.</li>
              </ul>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${file ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300'}`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <span className="text-4xl mb-2">{file ? '📄' : '📤'}</span>
                  <p className="text-sm text-slate-500 font-medium">
                    {file ? file.name : 'Haz clic para seleccionar archivo'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">XLSX, XLS o CSV (Máx. 10MB)</p>
                </div>
              </label>
            </div>

            {results && (
              <div className={`p-4 rounded-2xl border ${results.success ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'} text-xs font-medium animate-in slide-in-from-bottom-2`}>
                {results.message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={procesarArchivo}
                disabled={!file || loading}
                className={`flex-[2] py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg transition-all ${!file || loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 active:scale-95'}`}
              >
                {loading ? 'Procesando...' : 'Iniciar Importación'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportarProductosModal;
