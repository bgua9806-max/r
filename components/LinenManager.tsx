
import React, { useState } from 'react';
import { Shirt, LayoutList, PieChart } from 'lucide-react';
import { LinenTable } from './LinenTable';
import { LinenDashboard } from './LinenDashboard';

export const LinenManager: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'analytics'>('list');

  return (
    <div className="flex flex-col min-h-screen h-auto md:h-full bg-slate-50 md:bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 md:overflow-hidden">
        {/* Main Header with Toggle */}
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm md:relative md:bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 transition-all">
            <div className="flex items-center gap-2 w-full md:w-auto">
                <Shirt className="text-brand-600" size={24} />
                <div>
                    <h2 className="font-bold text-slate-800 text-lg">Quản lý Đồ Vải (Linen)</h2>
                    <p className="text-xs text-slate-500 font-medium hidden md:block">Theo dõi tồn kho, công nợ nhà giặt và hư hao</p>
                </div>
            </div>
            
            <div className="flex bg-slate-100 md:bg-slate-200/50 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
                <button
                    onClick={() => setViewMode('list')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        viewMode === 'list' 
                        ? 'bg-white text-brand-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <LayoutList size={16} /> Danh sách
                </button>
                <button
                    onClick={() => setViewMode('analytics')}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        viewMode === 'analytics' 
                        ? 'bg-white text-brand-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <PieChart size={16} /> Phân tích
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 md:overflow-hidden relative">
            {viewMode === 'list' ? <LinenTable /> : <LinenDashboard />}
        </div>
    </div>
  );
};
