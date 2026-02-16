import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
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
              <h1 className="text-sm font-black tracking-tighter text-white uppercase italic">Dev-Assistant</h1>
              <div className="h-[1px] w-full bg-cyan-500/30"></div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Latency Mode</span>
                <span className="text-[10px] font-black tracking-widest text-cyan-400">
                  CLOUD (WEB-SYNC)
                </span>
             </div>
          </div>
          <div className="h-6 w-[1px] bg-slate-800"></div>
          <div className="px-2 py-0.5 rounded text-[10px] font-black border transition-all border-cyan-500/20 text-cyan-500 bg-cyan-500/5">
             GOOGLE
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #334155 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        <div className="relative z-10 flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;