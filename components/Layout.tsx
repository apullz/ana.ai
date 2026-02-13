
import React from 'react';
import { ModelID, ModelConfig } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeModel: ModelID;
  onModelChange: (id: ModelID) => void;
}

export const MODELS: ModelConfig[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
  { id: 'gemma-3-4b', name: 'Gemma 3 4B (Local)', provider: 'local', huggingFaceId: 'google/gemma-3-4b-it' }
];

const Layout: React.FC<LayoutProps> = ({ children, activeModel, onModelChange }) => {
  const currentModel = MODELS.find(m => m.id === activeModel);

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden text-slate-200 flex-col font-mono-code">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-black/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-6 h-6 bg-cyan-600 rounded flex items-center justify-center shadow-lg shadow-cyan-900/20 group-hover:bg-cyan-500 transition-colors">
              <span className="text-[10px] font-black text-white">A</span>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter text-white">ANA.AI</h1>
              <div className="h-[1px] w-full bg-cyan-500/30"></div>
            </div>
          </div>
          
          <div className="h-4 w-[1px] bg-slate-800"></div>
          
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Selected Brain</span>
            <select 
              value={activeModel}
              onChange={(e) => onModelChange(e.target.value as ModelID)}
              className="bg-slate-900 text-[10px] border border-slate-800 rounded px-2 py-0.5 focus:outline-none focus:border-cyan-500 text-slate-300 font-bold cursor-pointer transition-colors"
            >
              {MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Provider Status</span>
                <span className={`text-[10px] font-black tracking-widest ${currentModel?.provider === 'google' ? 'text-cyan-400' : 'text-purple-400'}`}>
                  {currentModel?.provider === 'google' ? 'GEMINI_CLOUD' : 'HF_LOCAL_ONNX'}
                </span>
             </div>
          </div>
          <div className="h-6 w-[1px] bg-slate-800"></div>
          <div className={`px-2 py-0.5 rounded text-[10px] font-black border transition-all ${
            currentModel?.provider === 'google' 
              ? 'border-cyan-500/20 text-cyan-500 bg-cyan-500/5' 
              : 'border-purple-500/20 text-purple-500 bg-purple-500/5'
          }`}>
             {currentModel?.provider.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {/* Visual Grids */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        
        <div className="relative z-10 flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
