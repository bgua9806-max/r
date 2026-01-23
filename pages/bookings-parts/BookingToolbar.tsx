
import React from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, Calendar, LayoutGrid, User, RotateCw, LogIn, LogOut, Brush, Home, Briefcase } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarViewMode } from '../../hooks/useBookingLogic';
import { Facility } from '../../types';

interface BookingToolbarProps {
  viewMode: 'timeline' | 'grid';
  setViewMode: (mode: 'timeline' | 'grid') => void;
  calendarMode: CalendarViewMode;
  setCalendarMode: (mode: CalendarViewMode) => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  navigateDate: (direction: number) => void;
  dateRange: { start: Date; end: Date };
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterFacility: string;
  setFilterFacility: (facility: string) => void;
  facilities: Facility[];
  roomStats: { total: number; available: number; occupied: number; dirty: number; incoming: number; outgoing: number };
  refreshData: () => void;
  onAddBooking: () => void;
}

export const BookingToolbar: React.FC<BookingToolbarProps> = ({
  viewMode, setViewMode,
  calendarMode, setCalendarMode,
  currentDate, setCurrentDate,
  navigateDate, dateRange,
  searchTerm, setSearchTerm,
  filterFacility, setFilterFacility,
  facilities,
  roomStats,
  refreshData,
  onAddBooking
}) => {

  const CompactStatsBar = () => (
      <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-x-3 gap-y-2 w-full pb-2 md:hidden">
         <div className="flex items-center gap-2 bg-slate-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-slate-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-slate-400 shadow-sm"><Home size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-slate-500 uppercase">Trống:</span>
                 <span className="font-black text-slate-700 text-sm">{roomStats.available}</span>
             </div>
         </div>
         <div className="flex items-center gap-2 bg-emerald-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-emerald-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-emerald-600 shadow-sm"><User size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-emerald-600 uppercase">Đang ở:</span>
                 <span className="font-black text-emerald-700 text-sm">{roomStats.occupied}</span>
             </div>
         </div>
         <div className="flex items-center gap-2 bg-amber-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-amber-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-amber-600 shadow-sm"><Brush size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-amber-600 uppercase">Bẩn:</span>
                 <span className="font-black text-amber-700 text-sm">{roomStats.dirty}</span>
             </div>
         </div>
         <div className="flex items-center gap-2 bg-blue-50 rounded-lg pr-3 pl-1.5 py-1.5 border border-blue-100 shrink-0">
             <div className="p-1 bg-white rounded-md text-blue-600 shadow-sm"><Briefcase size={14}/></div>
             <div className="flex items-baseline gap-1.5">
                 <span className="text-[10px] font-bold text-blue-600 uppercase">Đến/Đi:</span>
                 <span className="font-black text-blue-700 text-sm">{roomStats.incoming} / {roomStats.outgoing}</span>
             </div>
         </div>
      </div>
  );

  if (viewMode === 'grid') {
    return (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-center shrink-0 z-20 relative animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-1 flex-wrap items-center gap-4 w-full xl:w-auto">
                 <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                     <button onClick={() => setViewMode('timeline')} className="p-2 rounded-md transition-all text-slate-500 hover:text-slate-700" title="Xem Lịch Timeline"><Calendar size={18}/></button>
                     <button onClick={() => setViewMode('grid')} className="p-2 rounded-md transition-all bg-white text-brand-600 shadow-sm font-medium" title="Sơ đồ phòng (Grid)"><LayoutGrid size={18}/></button>
                 </div>
                 
                 {/* DATE NAVIGATOR FOR GRID VIEW */}
                 <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden w-full md:w-auto">
                    <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-2 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft size={18} className="text-slate-500" /></button>
                    <span className="flex-1 px-4 text-sm font-semibold text-slate-700 min-w-[120px] text-center capitalize whitespace-nowrap">
                        {format(currentDate, 'EEEE, dd/MM', { locale: vi })}
                    </span>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 hover:bg-slate-50 border-l border-slate-100"><ChevronRight size={18} className="text-slate-500"/></button>
                 </div>
                 
                 <button onClick={() => setCurrentDate(new Date())} className="hidden md:block text-xs font-semibold text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg border border-brand-200 transition-colors shrink-0">Hôm nay</button>

                 <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                 
                 {/* Stats */}
                 <div className="flex flex-nowrap overflow-x-auto no-scrollbar items-center gap-x-3 md:gap-x-6 gap-y-2 w-full md:w-auto pb-1 md:pb-0">
                     <div className="flex items-center gap-2 bg-slate-50 rounded-lg pr-3 pl-1.5 py-1 border border-slate-100 shrink-0">
                         <div className="p-1 bg-white rounded-md text-slate-400 shadow-sm"><Home size={14}/></div>
                         <div className="flex items-baseline gap-1.5">
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Trống:</span>
                             <span className="font-black text-slate-700 text-sm">{roomStats.available}</span>
                         </div>
                     </div>
                     <div className="flex items-center gap-2 bg-emerald-50 rounded-lg pr-3 pl-1.5 py-1 border border-emerald-100 shrink-0">
                         <div className="p-1 bg-white rounded-md text-emerald-600 shadow-sm"><User size={14}/></div>
                         <div className="flex items-baseline gap-1.5">
                             <span className="text-[10px] font-bold text-emerald-600 uppercase">Đang ở:</span>
                             <span className="font-black text-emerald-700 text-sm">{roomStats.occupied}</span>
                         </div>
                     </div>
                     <div className="flex items-center gap-2 bg-amber-50 rounded-lg pr-3 pl-1.5 py-1 border border-amber-100 shrink-0">
                         <div className="p-1 bg-white rounded-md text-amber-600 shadow-sm"><Brush size={14}/></div>
                         <div className="flex items-baseline gap-1.5">
                             <span className="text-[10px] font-bold text-amber-600 uppercase">Bẩn:</span>
                             <span className="font-black text-amber-700 text-sm">{roomStats.dirty}</span>
                         </div>
                     </div>
                 </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3 w-full xl:w-auto justify-end">
                <div className="relative group w-full md:max-w-[200px]">
                    <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                    <input type="text" placeholder="Tìm..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-slate-50 focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <select className="appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer text-slate-700 font-medium min-w-[100px] md:min-w-[120px]" value={filterFacility} onChange={e => setFilterFacility(e.target.value)}>
                    <option value="">Tất cả</option>
                    {facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}
                </select>
                <button onClick={() => refreshData()} className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200 shrink-0" title="Làm mới"><RotateCw size={18} /></button>
                <button onClick={onAddBooking} className="bg-brand-600 text-white px-3 md:px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-brand-700 shadow-md shadow-brand-500/20 transition-all active:scale-95 whitespace-nowrap shrink-0">
                    <Plus size={18} /> <span className="hidden sm:inline">Đặt phòng</span>
                </button>
            </div>
        </div>
    );
  }

  // Timeline View Header
  return (
    <>
        {/* 1. COMPACT STATS FOR MOBILE (Hidden on Desktop) */}
        <CompactStatsBar />

        {/* 2. BIG STATS FOR DESKTOP (Hidden on Mobile) */}
        <div className="hidden md:grid grid-cols-4 gap-4 shrink-0">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                <div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Phòng trống</div>
                    <div className="text-2xl font-black text-slate-800">{roomStats.available} <span className="text-sm font-medium text-slate-400">/ {roomStats.total}</span></div>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><Home size={20}/></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div>
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">Đang ở</div>
                    <div className="text-2xl font-black text-slate-800">{roomStats.occupied}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600"><User size={20}/></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-amber-100 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                <div>
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Phòng bẩn</div>
                    <div className="text-2xl font-black text-slate-800">{roomStats.dirty}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><Brush size={20}/></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex-1">
                    <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Sắp đến / Đi</div>
                    <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                        <span className="flex items-center gap-1"><LogIn size={14} className="text-blue-500"/> {roomStats.incoming}</span>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center gap-1"><LogOut size={14} className="text-rose-500"/> {roomStats.outgoing}</span>
                    </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Briefcase size={20}/></div>
            </div>
        </div>

        {/* 3. COMPACT TOOLBAR FOR TIMELINE */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-3 justify-between items-start xl:items-center shrink-0 z-20 relative">
            <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 w-full xl:w-auto">
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                        <button onClick={() => setViewMode('timeline')} className="p-2 rounded-md transition-all bg-white text-brand-600 shadow-sm font-medium"><Calendar size={18}/></button>
                        <button onClick={() => setViewMode('grid')} className="p-2 rounded-md transition-all text-slate-500 hover:text-slate-700"><LayoutGrid size={18}/></button>
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0 flex-1 md:flex-none justify-center">
                        {(['Day', 'Week', 'Month'] as CalendarViewMode[]).map(m => (
                            <button key={m} onClick={() => setCalendarMode(m)} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${calendarMode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                {m === 'Day' ? 'Ngày' : m === 'Week' ? 'Tuần' : 'Tháng'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden w-full md:w-auto">
                    <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-slate-50 border-r border-slate-100"><ChevronLeft size={18} className="text-slate-500" /></button>
                    <span className="flex-1 px-4 text-sm font-semibold text-slate-700 min-w-[120px] text-center capitalize whitespace-nowrap">
                    {calendarMode === 'Day' ? format(currentDate, 'EEEE, dd/MM', { locale: vi }) : 
                        calendarMode === 'Month' ? format(currentDate, 'MMMM yyyy', { locale: vi }) : 
                        `${format(dateRange.start, 'dd/MM')} - ${format(dateRange.end, 'dd/MM')}`}
                    </span>
                    <button onClick={() => navigateDate(1)} className="p-2 hover:bg-slate-50 border-l border-slate-100"><ChevronRight size={18} className="text-slate-500"/></button>
                </div>
                
                <button onClick={() => setCurrentDate(new Date())} className="hidden md:block text-xs font-semibold text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg border border-brand-200 transition-colors shrink-0">Hôm nay</button>
            </div>

            <div className="flex items-center gap-2 w-full xl:w-auto">
                <div className="relative group flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input type="text" placeholder="Tìm..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-slate-50 focus:bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                
                <select className="hidden md:block appearance-none border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer text-slate-900 min-w-[120px]" value={filterFacility} onChange={e => setFilterFacility(e.target.value)}>
                    <option value="">Tất cả cơ sở</option>
                    {facilities.map(f => <option key={f.id} value={f.facilityName}>{f.facilityName}</option>)}
                </select>

                <button onClick={() => refreshData()} className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200" title="Làm mới"><RotateCw size={18} /></button>

                <button onClick={onAddBooking} className="bg-brand-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-bold hover:bg-brand-700 shadow-md transition-all active:scale-95 whitespace-nowrap">
                    <Plus size={18} /> <span className="hidden md:inline">Đặt phòng</span>
                </button>
            </div>
        </div>
    </>
  );
};
