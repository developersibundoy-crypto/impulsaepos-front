import React, { useState, useEffect } from 'react';

interface RuletaDescuentosProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_OPCIONES = [
  "5%\nDescuento",
  "10%\nDescuento",
  "15%\nDescuento",
  "Producto\nGratis",
  "Vuelve a\nintentarlo",
  "Descuento\nSorpresa",
  "Gracias por\nparticipar",
  "Premio\nEspecial"
];

const COLORS = [
  "#4f46e5", // Indigo 600
  "#0ea5e9", // Sky 500
  "#10b981", // Emerald 500
  "#f59e0b", // Amber 500
  "#ef4444", // Red 500
  "#8b5cf6", // Violet 500
  "#ec4899", // Pink 500
  "#f97316"  // Orange 500
];

export const RuletaDescuentos: React.FC<RuletaDescuentosProps> = ({ isOpen, onClose }) => {
  const [opciones, setOpciones] = useState<string[]>(() => {
    const saved = localStorage.getItem('ruleta_opciones');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 8) return parsed;
      } catch (e) {}
    }
    return DEFAULT_OPCIONES;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [tempOpciones, setTempOpciones] = useState<string[]>([...opciones]);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [premio, setPremio] = useState<string | null>(null);

  const handleSaveConfig = () => {
    setOpciones(tempOpciones);
    localStorage.setItem('ruleta_opciones', JSON.stringify(tempOpciones));
    setIsEditing(false);
  };

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setRotation(0);
        setPremio(null);
        setIsSpinning(false);
      }, 300);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setPremio(null);

    const randomIndex = Math.floor(Math.random() * opciones.length);
    const sliceAngle = 360 / opciones.length;
    
    // Calculate the angle so that the pointer (top, 0 degrees) points to the selected slice
    const targetAngle = (opciones.length - randomIndex) * sliceAngle;
    
    const spins = Math.floor(Math.random() * 5) + 5; 
    const randomOffset = (Math.random() * sliceAngle * 0.8) - (sliceAngle * 0.4); 
    
    const finalRotation = rotation + (spins * 360) + targetAngle - (rotation % 360) + randomOffset;

    setRotation(finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      setPremio(opciones[randomIndex]);
    }, 5000); // 5 seconds animation
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={() => { if (!isSpinning) onClose(); }}
      ></div>
      
      <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in duration-300">
        
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
            🎡 Ruleta de Descuentos
            {!isEditing && (
              <button 
                onClick={() => {
                  setTempOpciones([...opciones]);
                  setIsEditing(true);
                }}
                disabled={isSpinning}
                className="w-8 h-8 bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-300 transition-all text-sm disabled:opacity-50"
                title="Configurar opciones"
              >
                ⚙️
              </button>
            )}
          </h2>
          <button 
            onClick={onClose}
            disabled={isSpinning}
            className="w-10 h-10 bg-white text-slate-400 rounded-2xl flex items-center justify-center hover:text-rose-500 shadow-sm border border-slate-100 transition-all font-black text-lg disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {isEditing ? (
          <div className="p-8 flex flex-col items-center bg-slate-50/50 flex-1 overflow-y-auto">
            <h3 className="text-lg font-bold mb-2 w-full text-left text-slate-800">Configurar Opciones (8 segmentos)</h3>
            <p className="text-xs text-slate-500 mb-6 w-full text-left">Presiona <span className="font-bold bg-slate-200 px-1 rounded">Enter</span> en cada recuadro para crear una segunda línea de texto.</p>
            <div className="grid grid-cols-2 gap-4 w-full">
              {tempOpciones.map((op, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Opción {i + 1}</label>
                  <textarea
                    value={op}
                    onChange={(e) => {
                      const newOps = [...tempOpciones];
                      newOps[i] = e.target.value;
                      setTempOpciones(newOps);
                    }}
                    rows={2}
                    className="w-full border-2 border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none resize-none transition-all text-center leading-relaxed"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end w-full gap-3 mt-8">
              <button
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 rounded-xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-6 py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center justify-center relative bg-gradient-to-br from-indigo-50/50 to-purple-50/50">
          
          {/* Pointer */}
          <div className="absolute top-8 z-20 w-0 h-0 border-l-[15px] border-r-[15px] border-t-[30px] border-transparent border-t-slate-800 drop-shadow-md -translate-y-4"></div>
          
          {/* Wheel */}
          <div className="relative w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] md:w-[480px] md:h-[480px] rounded-full overflow-hidden shadow-[0_0_40px_rgba(79,70,229,0.2)] border-[8px] border-white z-10 bg-white">
            <div 
              className="w-full h-full rounded-full relative transition-all"
              style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: '5s',
                transitionTimingFunction: 'cubic-bezier(0.2, 0.8, 0.1, 1)'
              }}
            >
              <div 
                className="absolute inset-0 rounded-full"
                style={{
                  background: `conic-gradient(
                    ${opciones.map((_, i) => `${COLORS[i % COLORS.length]} ${(i * 360) / opciones.length}deg ${((i + 1) * 360) / opciones.length}deg`).join(', ')}
                  )`
                }}
              ></div>
              
              {opciones.map((opcion, i) => {
                const angle = (360 / opciones.length) * i + (360 / opciones.length) / 2;
                return (
                  <div 
                    key={i} 
                    className="absolute w-full h-full flex items-start justify-center pt-2 sm:pt-3"
                    style={{ transform: `rotate(${angle}deg)` }}
                  >
                    <span className="text-black text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-wider drop-shadow-sm whitespace-pre-line text-center" style={{ writingMode: 'vertical-rl' }}>
                      {opcion}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Center Logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full shadow-lg border-4 border-slate-100 flex flex-col items-center justify-center z-20">
              <span className="text-xs font-black text-indigo-900 uppercase tracking-tighter text-center leading-none">SUMAK<br/>TECH</span>
              <span className="text-[9px] font-bold text-slate-500 mt-1">3152796683</span>
            </div>
          </div>
          
          <button 
            onClick={handleSpin}
            disabled={isSpinning}
            className="mt-10 px-10 py-4 bg-indigo-600 text-white rounded-full font-black uppercase tracking-widest hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:scale-100"
          >
            {isSpinning ? 'Girando...' : '¡Girar Ruleta!'}
          </button>
          
            {/* Result */}
            <div className="h-16 mt-4 flex items-center justify-center w-full">
              {premio && (
                <div className="animate-in slide-in-from-bottom-2 fade-in duration-500 bg-emerald-50 border border-emerald-100 text-emerald-700 px-6 py-3 rounded-2xl text-center w-full max-w-sm">
                  <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">¡Premio Obtenido!</p>
                  <p className="text-lg font-black">{premio}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
