
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  CloudLightning, RefreshCw, Calendar, ArrowRight, User, 
  CheckCircle, Clock, XCircle, CreditCard, DollarSign, BedDouble, AlertTriangle, MapPin, AlertCircle, AlertOctagon, MoreHorizontal, Bell, Search
} from 'lucide-react';
import { format, parseISO, isSameDay, isValid, differenceInCalendarDays } from 'date-fns';
import { OtaOrder } from '../types';
import { OtaAssignModal } from '../components/OtaAssignModal';

export const OtaOrders: React.FC = () => {
  const { otaOrders, syncOtaOrders, isLoading } = useAppContext();
  const [activeTab, setActiveTab] = useState<'Pending' | 'Today' | 'Processed'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OtaOrder | null>(null);

  // Auto-sync on mount
  useEffect(() => {
      syncOtaOrders();
  }, []);

  // Filter Logic
  const displayOrders = useMemo(() => {
      const today = new Date();
      return otaOrders.filter(o => {
          // 1. Tab Filter
          let matchesTab = true;
          if (activeTab === 'Pending') matchesTab = o.status === 'Pending';
          else if (activeTab === 'Processed') matchesTab = o.status === 'Assigned' || o.status === 'Cancelled';
          else if (activeTab === 'Today') {
              // Check-in Today
              const checkin = parseISO(o.checkIn);
              matchesTab = isValid(checkin) && isSameDay(checkin, today);
          }

          if (!matchesTab) return false;

          // 2. Search Filter (Name or Booking Code)
          if (searchTerm.trim()) {
              const term = searchTerm.toLowerCase();
              const matchesName = (o.guestName || '').toLowerCase().includes(term);
              const matchesCode = (o.bookingCode || '').toLowerCase().includes(term);
              if (!matchesName && !matchesCode) return false;
          }

          return true;
      });
  }, [otaOrders, activeTab, searchTerm]);

  const getPlatformConfig = (platform: string) => {
      switch (platform) {
          case 'Agoda': return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
          case 'Booking.com': return { color: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-100' };
          case 'Traveloka': return { color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' };
          default: return { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
      }
  };

  const handleAssignRoom = (order: OtaOrder) => {
      setSelectedOrder(order);
      setAssignModalOpen(true);
  };

  const todayDateStr = format(new Date(), 'yyyy-MM-dd'); // Local date (VN)

  return (
    <div className="space-y-6 animate-enter pb-20">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <CloudLightning className="text-brand-600" /> Sảnh Chờ Booking (OTA)
                </h1>
                <p className="text-slate-500 text-sm font-medium">Đồng bộ và xử lý đơn hàng từ Agoda, Booking, Traveloka...</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="relative group w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                    <input 
                        type="text" 
                        placeholder="Tìm tên khách, mã OTA..." 
                        className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-white text-slate-900 shadow-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <button 
                    onClick={() => syncOtaOrders()}
                    disabled={isLoading}
                    className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-brand-600 transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0"
                >
                    <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    {isLoading ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                </button>
            </div>
        </div>

        {/* TABS */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('Pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Pending' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Clock size={16}/> Cần xếp phòng
                {otaOrders.filter(o => o.status === 'Pending').length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{otaOrders.filter(o => o.status === 'Pending').length}</span>}
            </button>
            <button onClick={() => setActiveTab('Today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Today' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Calendar size={16}/> Check-in Hôm nay
            </button>
            <button onClick={() => setActiveTab('Processed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Processed' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <CheckCircle size={16}/> Đã xử lý
            </button>
        </div>

        {/* --- DESKTOP VIEW: DATA TABLE --- */}
        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                        <tr>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider w-[140px]">Nguồn / Mã</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider w-[200px]">Khách hàng</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider min-w-[200px]">Loại phòng</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center w-[150px]">Thời gian</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right w-[150px]">Tài chính</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] w-[140px]">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayOrders.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400">
                                    <CloudLightning size={48} className="mx-auto mb-2 opacity-30"/>
                                    <p className="text-sm font-medium">Không có đơn hàng nào phù hợp.</p>
                                </td>
                            </tr>
                        ) : (
                            displayOrders.map(order => {
                                const checkin = parseISO(order.checkIn);
                                const checkout = parseISO(order.checkOut);
                                const isValidDates = isValid(checkin) && isValid(checkout);
                                const isToday = isValidDates && isSameDay(checkin, new Date());
                                const styles = getPlatformConfig(order.platform);
                                const nights = isValidDates ? differenceInCalendarDays(checkout, checkin) : 0;
                                
                                // LOGIC FIX: Compare Date Strings to ignore time/timezone issues
                                const orderEmailDate = parseISO(order.emailDate || '');
                                const isNewToday = isValid(orderEmailDate) && format(orderEmailDate, 'yyyy-MM-dd') === todayDateStr;

                                return (
                                    <tr key={order.id} className={`group transition-colors ${isToday ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-blue-50/30'}`}>
                                        {/* COL 1: SOURCE & CODE */}
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-1.5">
                                                {isNewToday && (
                                                    <span className="flex items-center gap-1 w-fit bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                                        <Bell size={10} fill="white"/> MỚI VỀ
                                                    </span>
                                                )}
                                                <span className={`inline-block w-fit px-2 py-0.5 rounded text-[10px] font-black uppercase border ${styles.bg} ${styles.color} ${styles.border}`}>
                                                    {order.platform}
                                                </span>
                                                <span className="font-mono text-xs font-black text-slate-700 break-all select-all">
                                                    #{order.bookingCode}
                                                </span>
                                                {order.notes && (
                                                    <div className="group/note relative w-fit">
                                                        <AlertCircle size={14} className="text-amber-500 cursor-help"/>
                                                        <div className="absolute left-0 top-full mt-1 w-64 bg-slate-800 text-white text-xs p-2 rounded shadow-xl z-50 hidden group-hover/note:block pointer-events-none">
                                                            {order.notes}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* COL 2: CUSTOMER */}
                                        <td className="p-4 align-top">
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 line-clamp-2" title={order.guestName}>
                                                    {order.guestName}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs font-medium">
                                                    <User size={12}/> {order.guestDetails || `${order.guestCount} Khách`}
                                                </div>
                                            </div>
                                        </td>

                                        {/* COL 3: ROOM TYPE */}
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                {/* Allow text wrap for long room names */}
                                                <div className="text-sm font-medium text-slate-700 whitespace-normal leading-snug">
                                                    {order.roomType}
                                                </div>
                                                {order.roomQuantity > 1 && (
                                                    <span className="w-fit bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                                        x{order.roomQuantity} Phòng
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* COL 4: TIME */}
                                        <td className="p-4 align-top text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {isToday && (
                                                    <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded animate-pulse mb-0.5">
                                                        CHECK-IN HÔM NAY
                                                    </span>
                                                )}
                                                <div className={`text-xs font-bold ${isToday ? 'text-red-600' : 'text-slate-700'}`}>
                                                    {isValidDates ? format(checkin, 'dd/MM') : '--'} <span className="text-slate-300 mx-1">➜</span> {isValidDates ? format(checkout, 'dd/MM') : '--'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    ({nights} đêm)
                                                </div>
                                            </div>
                                        </td>

                                        {/* COL 5: FINANCIALS */}
                                        <td className="p-4 align-top text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="font-black text-sm text-brand-600">
                                                    {order.totalAmount.toLocaleString()} ₫
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 ${order.paymentStatus === 'Prepaid' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
                                                    {order.paymentStatus === 'Prepaid' ? 'Prepaid' : 'Tại KS'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* COL 6: ACTIONS (STICKY) */}
                                        <td className="p-4 align-top text-center sticky right-0 bg-white group-hover:bg-blue-50/30 transition-colors z-10 border-l border-slate-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.02)]">
                                            {order.status === 'Pending' ? (
                                                <button 
                                                    onClick={() => handleAssignRoom(order)}
                                                    className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2 rounded-lg shadow-sm transition-all active:scale-95"
                                                >
                                                    Xếp phòng
                                                </button>
                                            ) : (
                                                <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase w-full ${order.status === 'Assigned' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    {order.status === 'Assigned' ? 'Đã xếp' : 'Đã hủy'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- MOBILE VIEW: OPTIMIZED CARDS --- */}
        <div className="md:hidden grid grid-cols-1 gap-4">
            {displayOrders.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <CloudLightning size={40} className="mx-auto mb-2 opacity-50"/>
                    <p className="text-sm font-medium">Không có đơn hàng nào phù hợp.</p>
                </div>
            ) : (
                displayOrders.map(order => {
                    const checkin = parseISO(order.checkIn);
                    const checkout = parseISO(order.checkOut);
                    const isValidDates = isValid(checkin) && isValid(checkout);
                    const isToday = isValidDates && isSameDay(checkin, new Date());
                    const styles = getPlatformConfig(order.platform);
                    
                    // FIX: Strict date string comparison
                    const orderEmailDate = parseISO(order.emailDate || '');
                    const isNewToday = isValid(orderEmailDate) && format(orderEmailDate, 'yyyy-MM-dd') === todayDateStr;

                    return (
                    <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                        {/* Status Strip */}
                        <div className={`h-1.5 w-full ${order.status === 'Pending' ? 'bg-orange-500' : order.status === 'Assigned' ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                        
                        {/* Today Banner */}
                        {isToday && order.status === 'Pending' && (
                            <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 text-center animate-pulse flex items-center justify-center gap-2">
                                <AlertTriangle size={12} fill="white" /> Khách đến hôm nay
                            </div>
                        )}

                        <div className="p-4 flex-1 flex flex-col">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                                <div className="flex items-center gap-2">
                                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${styles.bg} ${styles.color} ${styles.border}`}>
                                        {order.platform}
                                    </div>
                                    {isNewToday && (
                                        <span className="flex items-center gap-1 bg-rose-100 text-rose-600 border border-rose-200 text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                            <Bell size={10}/> MỚI
                                        </span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 font-bold mr-1">#</span>
                                    <span className="font-mono text-sm font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{order.bookingCode}</span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="space-y-3">
                                <div>
                                    <h3 className="font-black text-slate-800 text-base leading-tight line-clamp-2" title={order.guestName}>{order.guestName}</h3>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                                        <span className="flex items-center gap-1"><User size={12}/> {order.guestDetails || order.guestCount}</span>
                                        <span className="flex items-center gap-1"><BedDouble size={12}/> {order.roomQuantity}</span>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Loại phòng</div>
                                    <div className="text-sm font-bold text-slate-700 leading-tight whitespace-normal mb-2">
                                        {order.roomType}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs border-t border-slate-200 pt-2">
                                        <div className="flex-1 text-center border-r border-slate-200">
                                            <div className="font-bold text-slate-700">{isValidDates ? format(checkin, 'dd/MM') : '--'}</div>
                                            <div className="text-[9px] text-slate-400">In</div>
                                        </div>
                                        <div className="flex-1 text-center">
                                            <div className="font-bold text-slate-700">{isValidDates ? format(checkout, 'dd/MM') : '--'}</div>
                                            <div className="text-[9px] text-slate-400">Out</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                <div>
                                    <div className="text-lg font-black text-brand-700">{order.totalAmount.toLocaleString()}</div>
                                    <div className={`text-[9px] font-bold uppercase flex items-center gap-1 ${order.paymentStatus === 'Prepaid' ? 'text-green-600' : 'text-orange-600'}`}>
                                        {order.paymentStatus === 'Prepaid' ? <CheckCircle size={10}/> : <CreditCard size={10}/>}
                                        {order.paymentStatus === 'Prepaid' ? 'Prepaid' : 'Tại KS'}
                                    </div>
                                </div>

                                {order.status === 'Pending' ? (
                                    <button 
                                        onClick={() => handleAssignRoom(order)}
                                        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-brand-600 transition-colors"
                                    >
                                        Xếp phòng
                                    </button>
                                ) : (
                                    <span className={`px-3 py-1 rounded text-[10px] font-black border uppercase ${order.status === 'Assigned' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {order.status === 'Assigned' ? 'Đã xếp' : 'Hủy'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    )
                })
            )}
        </div>

        {/* MODAL */}
        {selectedOrder && (
            <OtaAssignModal 
                isOpen={isAssignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                order={selectedOrder}
            />
        )}
    </div>
  );
};
