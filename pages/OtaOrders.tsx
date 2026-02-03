
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  CloudLightning, RefreshCw, Calendar, ArrowRight, User, 
  CheckCircle, Clock, XCircle, CreditCard, DollarSign, BedDouble, AlertTriangle, MapPin, AlertCircle, AlertOctagon, MoreHorizontal, Bell, Search, Trash2, X, Archive, Users, Coffee, Utensils, Filter, Loader2, Layers, Link
} from 'lucide-react';
import { format, parseISO, isSameDay, isValid, differenceInCalendarDays, isSameMonth } from 'date-fns';
import { OtaOrder } from '../types';
import { OtaAssignModal } from '../components/OtaAssignModal';

// ... (Helper function processOtaGroups remains same - omitted for brevity) ...
// Gom nhóm các đơn hàng dựa trên Booking Code (Expedia) hoặc Tên khách + Ngày đến (Chung)
const processOtaGroups = (orders: OtaOrder[]) => {
    const groups: Record<string, OtaOrder[]> = {};
    const processedOrders: (OtaOrder & { groupInfo?: { index: number, total: number, id: string } })[] = [];

    // 1. Grouping Phase
    orders.forEach(order => {
        let groupKey = order.id; // Default unique key

        // Logic 1: Expedia Style (8 ký tự đầu giống nhau)
        if (order.platform === 'Expedia' && order.bookingCode.length >= 8) {
            const prefix = order.bookingCode.substring(0, 8);
            // Unique key combining platform + prefix + checkin (avoid collision with different dates)
            groupKey = `EXP_${prefix}_${order.checkIn.substring(0,10)}`; 
        } 
        // Logic 2: General (Same Guest + Same CheckIn + Same Platform)
        else {
            const safeName = (order.guestName || '').toLowerCase().trim();
            const safeDate = order.checkIn.substring(0, 10);
            groupKey = `GEN_${order.platform}_${safeName}_${safeDate}`;
        }

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(order);
    });

    // 2. Flattening & Indexing Phase
    // Duyệt qua các nhóm, nếu nhóm có > 1 phần tử thì đánh số
    Object.values(groups).forEach(group => {
        if (group.length > 1) {
            // Sort nội bộ nhóm theo mã booking để thứ tự Phòng 1, Phòng 2 đúng
            group.sort((a, b) => a.bookingCode.localeCompare(b.bookingCode));
            
            group.forEach((order, index) => {
                processedOrders.push({
                    ...order,
                    groupInfo: {
                        id: group[0].id, // Dùng ID thằng đầu làm Group ID chung
                        index: index + 1,
                        total: group.length
                    }
                });
            });
        } else {
            // Đơn lẻ
            processedOrders.push(group[0]);
        }
    });

    // 3. Sorting Phase 
    const finalResult: typeof processedOrders = [];
    const renderedGroupIds = new Set<string>();

    orders.forEach(orig => {
        const enriched = processedOrders.find(p => p.id === orig.id);
        if (!enriched) return;

        if (enriched.groupInfo) {
            if (!renderedGroupIds.has(enriched.groupInfo.id)) {
                // Render cả nhóm ngay tại vị trí xuất hiện đầu tiên
                const fullGroup = processedOrders.filter(p => p.groupInfo?.id === enriched.groupInfo?.id);
                finalResult.push(...fullGroup);
                renderedGroupIds.add(enriched.groupInfo.id);
            }
        } else {
            finalResult.push(enriched);
        }
    });

    return finalResult;
};

export const OtaOrders: React.FC = () => {
  const { otaOrders, syncOtaOrders, queryOtaOrders, isLoading: isSyncing, deleteOtaOrder, bookings, updateBooking, notify, confirmOtaCancellation, triggerWebhook, currentUser } = useAppContext();
  
  const isReadOnly = currentUser?.role === 'Buồng phòng';

  // -- LOCAL STATE FOR SERVER-SIDE DATA --
  const [listData, setListData] = useState<OtaOrder[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const observerTarget = useRef<HTMLTableRowElement>(null);

  // -- FILTERS --
  const [activeTab, setActiveTab] = useState<'Pending' | 'Today' | 'Processed' | 'Cancelled'>('Pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTimeMode, setFilterTimeMode] = useState<'all' | 'day' | 'month'>('all');
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd')); // For Day mode
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM')); // For Month mode

  // Modal State
  const [isAssignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OtaOrder | null>(null);

  // Computed Display Data (with Grouping)
  const displayData = useMemo(() => {
      return processOtaGroups(listData);
  }, [listData]);

  // Auto-sync on mount (Background sync to keep local caches fresh)
  useEffect(() => {
      syncOtaOrders(undefined, true); // Silent sync
  }, []);

  // -- FETCHING LOGIC --
  const fetchData = useCallback(async (reset = false) => {
      if (isFetching) return;
      setIsFetching(true);
      
      try {
          const currentPage = reset ? 0 : page;
          const { data, hasMore: more } = await queryOtaOrders({
              page: currentPage,
              pageSize: 20, // Load chunk size
              tab: activeTab,
              search: searchTerm,
              dateFilter: filterTimeMode !== 'all' ? { mode: filterTimeMode, value: filterTimeMode === 'day' ? filterDate : filterMonth } : undefined
          });

          // SORTING LOGIC FOR PENDING TAB
          if (activeTab === 'Pending') {
              data.sort((a, b) => {
                  // Cancelled first
                  if (a.status === 'Cancelled' && b.status !== 'Cancelled') return -1;
                  if (b.status === 'Cancelled' && a.status !== 'Cancelled') return 1;
                  // Then by email date desc (newest first)
                  return (b.emailDate || '').localeCompare(a.emailDate || '');
              });
          }

          if (reset) {
              setListData(data);
              setPage(1);
          } else {
              setListData(prev => {
                  // Avoid duplicates
                  const newIds = new Set(data.map(d => d.id));
                  return [...prev.filter(p => !newIds.has(p.id)), ...data];
              });
              setPage(prev => prev + 1);
          }
          setHasMore(more);
      } catch (e) {
          console.error("Fetch error", e);
      } finally {
          setIsFetching(false);
      }
  }, [page, activeTab, searchTerm, filterTimeMode, filterDate, filterMonth, isFetching, queryOtaOrders]);

  // -- DEBOUNCE SEARCH & FILTER EFFECT --
  useEffect(() => {
      const handler = setTimeout(() => {
          fetchData(true); // Reset and fetch
      }, 500); // 500ms debounce

      return () => clearTimeout(handler);
  }, [activeTab, searchTerm, filterTimeMode, filterDate, filterMonth]);

  // -- INFINITE SCROLL OBSERVER --
  useEffect(() => {
      const observer = new IntersectionObserver(
          entries => {
              if (entries[0].isIntersecting && hasMore && !isFetching) {
                  fetchData(false); // Load next page
              }
          },
          { threshold: 1.0 }
      );

      if (observerTarget.current) {
          observer.observe(observerTarget.current);
      }

      return () => {
          if (observerTarget.current) observer.unobserve(observerTarget.current);
      };
  }, [hasMore, isFetching, fetchData]);

  const handleSyncAndNotify = async () => {
      // 1. Sync
      await syncOtaOrders();
      
      // 2. Fetch fresh pending orders to send notification
      const { data: pendingOrders } = await queryOtaOrders({
          page: 0, 
          pageSize: 5, // Just get top 5 latest
          tab: 'Pending', 
          search: '',
      });

      // 3. Trigger General Notification (New Feature)
      if (pendingOrders && pendingOrders.length > 0) {
          triggerWebhook('general_notification', {
              type: 'NEW_OTA_ORDER', // Label for n8n Switch
              payload: {
                  count: pendingOrders.length,
                  latest_orders: pendingOrders.map(o => ({
                      code: o.bookingCode,
                      guest: o.guestName,
                      platform: o.platform,
                      amount: o.totalAmount,
                      checkIn: format(parseISO(o.checkIn), 'dd/MM/yyyy')
                  }))
              }
          });
      }
      
      // 4. Refresh list view
      fetchData(true);
  };

  // ... (Rest of component remains largely unchanged) ...
  const getPlatformConfig = (platform: string) => {
      switch (platform) {
          case 'Agoda': return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
          case 'Booking.com': return { color: 'text-indigo-800', bg: 'bg-indigo-50', border: 'border-indigo-100' };
          case 'Traveloka': return { color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' };
          default: return { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
      }
  };

  const handleAssignRoom = (order: OtaOrder) => {
      if (order.status === 'Cancelled') return;
      setSelectedOrder(order);
      setAssignModalOpen(true);
  };

  const handleConfirmCancel = async (order: OtaOrder) => {
      if(confirm(`Xác nhận đơn ${order.bookingCode} đã hủy? Hành động này sẽ chuyển đơn vào Lịch sử.`)) {
          await confirmOtaCancellation(order);
          if (activeTab === 'Pending') {
              setListData(prev => prev.filter(o => o.id !== order.id));
          }
      }
  };

  const handleResolveConflict = async (order: OtaOrder) => {
      if(!confirm(`Xác nhận hủy phòng ${order.assignedRoom} và xóa đơn OTA này?`)) return;
      
      const booking = bookings.find(b => 
          (b.roomCode === order.assignedRoom && b.status !== 'Cancelled' && b.status !== 'CheckedOut') ||
          (b.note && b.note.includes(order.bookingCode))
      );

      if(booking) {
          await updateBooking({ 
              ...booking, 
              status: 'Cancelled',
              note: booking.note + `\n[AUTO] Cancelled via OTA Sync on ${new Date().toLocaleDateString()}` 
          });
      } else {
          notify('info', 'Không tìm thấy Booking tương ứng trong hệ thống. Chỉ xử lý đơn OTA.');
      }
      
      await confirmOtaCancellation(order);
      setListData(prev => prev.filter(o => o.id !== order.id));
      notify('success', 'Đã giải phóng phòng và lưu vết hủy.');
  };

  const hasBreakfast = (order: OtaOrder) => {
      if (!order.breakfastStatus) return false;
      const s = order.breakfastStatus.toLowerCase();
      return s !== '' && s !== 'no' && s !== 'không' && s !== 'none';
  };

  const todayDateStr = format(new Date(), 'yyyy-MM-dd'); // Local date (VN)

  return (
    <div className="space-y-6 animate-enter pb-20">
        {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div>
                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                    <CloudLightning className="text-brand-600" /> Sảnh Chờ Booking (OTA)
                </h1>
                <p className="text-slate-500 text-sm font-medium">Đồng bộ và xử lý đơn hàng từ Agoda, Booking, Traveloka...</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center">
                {/* DATE FILTER GROUP */}
                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-full md:w-auto">
                    <div className="flex gap-1 pr-2 border-r border-slate-100">
                        <button 
                            onClick={() => setFilterTimeMode('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterTimeMode === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Tất cả
                        </button>
                        <button 
                            onClick={() => setFilterTimeMode('day')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterTimeMode === 'day' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Ngày
                        </button>
                        <button 
                            onClick={() => setFilterTimeMode('month')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterTimeMode === 'month' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Tháng
                        </button>
                    </div>
                    
                    {filterTimeMode !== 'all' && (
                        <div className="pl-2 animate-in slide-in-from-left-2 fade-in">
                            <input 
                                type={filterTimeMode === 'day' ? 'date' : 'month'} 
                                className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer w-[110px]"
                                value={filterTimeMode === 'day' ? filterDate : filterMonth}
                                onChange={(e) => filterTimeMode === 'day' ? setFilterDate(e.target.value) : setFilterMonth(e.target.value)}
                            />
                        </div>
                    )}
                    {filterTimeMode === 'all' && <div className="px-3 text-xs font-medium text-slate-400 italic">Toàn thời gian</div>}
                </div>

                {/* SEARCH & SYNC */}
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative group w-full md:w-56">
                        <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Tìm tên, mã OTA..." 
                            className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-white text-slate-900 shadow-sm"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {!isReadOnly && (
                        <button 
                            onClick={handleSyncAndNotify}
                            disabled={isSyncing}
                            className="bg-brand-600 text-white border border-brand-600 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-md shadow-brand-200 active:scale-95 disabled:opacity-50 shrink-0"
                        >
                            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                            <span className="hidden md:inline">{isSyncing ? 'Đang tải...' : 'Đồng bộ'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* TABS */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-fit overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('Pending')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Pending' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Clock size={16}/> Cần xử lý
                {/* Badge for Pending/Cancelled */}
                {otaOrders.filter(o => o.status === 'Pending' || o.status === 'Cancelled').length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{otaOrders.filter(o => o.status === 'Pending' || o.status === 'Cancelled').length}</span>}
            </button>
            <button onClick={() => setActiveTab('Today')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Today' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Calendar size={16}/> Check-in Hôm nay
            </button>
            <button onClick={() => setActiveTab('Processed')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Processed' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <CheckCircle size={16}/> Đã xếp
            </button>
            <button onClick={() => setActiveTab('Cancelled')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Cancelled' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <Archive size={16}/> Lịch sử Hủy
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
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider min-w-[200px]">Loại phòng & Chế độ</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center w-[150px]">Thời gian</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right w-[150px]">Tài chính</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] w-[160px]">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayData.length === 0 && !isFetching ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400">
                                    <CloudLightning size={48} className="mx-auto mb-2 opacity-30"/>
                                    <p className="text-sm font-medium">
                                        {searchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Không có đơn hàng nào.'}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            displayData.map((order, idx) => {
                                const checkin = parseISO(order.checkIn);
                                const checkout = parseISO(order.checkOut);
                                const isValidDates = isValid(checkin) && isValid(checkout);
                                const isToday = isValidDates && isSameDay(checkin, new Date());
                                const styles = getPlatformConfig(order.platform);
                                const nights = isValidDates ? differenceInCalendarDays(checkout, checkin) : 0;
                                
                                const orderEmailDate = parseISO(order.emailDate || '');
                                const isNewToday = isValid(orderEmailDate) && format(orderEmailDate, 'yyyy-MM-dd') === todayDateStr;
                                
                                const isCancelled = order.status === 'Cancelled';
                                const isConfirmed = order.status === 'Confirmed';
                                const isBreakfastIncluded = hasBreakfast(order);

                                // Row Styling: Highlight Cancelled rows if in Pending Tab
                                let rowClass = 'hover:bg-slate-50';
                                if (activeTab === 'Pending' && isCancelled) {
                                    rowClass = 'bg-red-50 hover:bg-red-100/50 border-l-4 border-l-red-500';
                                } else if (isToday) {
                                    rowClass = 'bg-blue-50/30 hover:bg-blue-50/50';
                                }

                                // GROUP STYLING
                                const isGroup = order.groupInfo && order.groupInfo.total > 1;
                                const groupBorderClass = isGroup ? 'border-l-4 border-l-purple-400' : '';

                                return (
                                    <tr key={order.id} className={`group transition-colors ${rowClass} ${groupBorderClass}`}>
                                        {/* COL 1: SOURCE & CODE */}
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-1.5">
                                                {/* BADGES */}
                                                {isNewToday && !isCancelled && !isConfirmed && (
                                                    <span className="flex items-center gap-1 w-fit bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                                        <Bell size={10} fill="white"/> MỚI VỀ
                                                    </span>
                                                )}
                                                {isCancelled && (
                                                    <span className="flex items-center gap-1 w-fit bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse shadow-sm">
                                                        <XCircle size={10} fill="white" className="text-red-600"/> CẢNH BÁO HỦY
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
                                            <div className="max-w-[200px]">
                                                {/* GROUP BADGE */}
                                                {isGroup && order.groupInfo && (
                                                    <span className="inline-flex items-center gap-1 mb-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-purple-200">
                                                        <Layers size={10}/> Nhóm: Phòng {order.groupInfo.index}/{order.groupInfo.total}
                                                    </span>
                                                )}

                                                <div className={`font-bold text-sm break-words whitespace-normal line-clamp-3 ${isCancelled ? 'text-red-700' : 'text-slate-800'}`} title={order.guestName}>
                                                    {order.guestName}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 font-medium group/guest">
                                                    <Users size={12} className="shrink-0 text-slate-400"/>
                                                    <span 
                                                        className="truncate max-w-[150px] cursor-help" 
                                                        title={order.guestDetails || `${order.guestCount} Khách`}
                                                    >
                                                        {order.guestDetails || `${order.guestCount} Khách`}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* COL 3: ROOM TYPE & BREAKFAST */}
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm font-medium text-slate-700 whitespace-normal leading-snug">
                                                    {order.roomType}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {order.roomQuantity > 1 && (
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                                            x{order.roomQuantity} Phòng
                                                        </span>
                                                    )}
                                                    {isBreakfastIncluded && (
                                                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded w-fit" title={order.breakfastStatus}>
                                                            <Coffee size={10} /> {order.breakfastStatus || 'Có ăn sáng'}
                                                        </span>
                                                    )}
                                                </div>
                                                {order.assignedRoom && isCancelled && (
                                                    <div className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded w-fit mt-1 border border-red-200">
                                                        <AlertOctagon size={12}/> Phòng {order.assignedRoom}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* COL 4: TIME */}
                                        <td className="p-4 align-top text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                {isToday && !isCancelled && !isConfirmed && (
                                                    <span className="text-[9px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded animate-pulse mb-0.5">
                                                        CHECK-IN HÔM NAY
                                                    </span>
                                                )}
                                                <div className={`text-xs font-bold ${isToday && !isCancelled ? 'text-red-600' : 'text-slate-700'}`}>
                                                    {isValidDates ? format(checkin, 'dd/MM') : '--'} <span className="text-slate-300 mx-1">➜</span> {isValidDates ? format(checkout, 'dd/MM') : '--'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    ({nights} đêm)
                                                </div>
                                                {order.cancellationDate && (
                                                    <div className="text-[9px] font-bold text-red-500 bg-white px-1 rounded border border-red-100 mt-1">
                                                        Hủy: {format(parseISO(order.cancellationDate), 'dd/MM')}
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* COL 5: FINANCIALS */}
                                        <td className="p-4 align-top text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className={`font-black text-sm ${isCancelled || isConfirmed ? 'text-slate-400 line-through' : 'text-brand-600'}`}>
                                                    {order.totalAmount.toLocaleString()} ₫
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 ${order.paymentStatus === 'Prepaid' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-orange-50 text-orange-700 border border-orange-100'}`}>
                                                    {order.paymentStatus === 'Prepaid' ? 'Prepaid' : 'Tại KS'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* COL 6: ACTIONS */}
                                        <td className="p-4 align-top text-center sticky right-0 bg-white group-hover:bg-white transition-colors z-10 border-l border-slate-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.02)]">
                                            {isCancelled ? (
                                                /* CANCELLED STATE ACTION */
                                                order.assignedRoom ? (
                                                    !isReadOnly && (
                                                    <button 
                                                        onClick={() => handleResolveConflict(order)}
                                                        className="w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold py-2 rounded-lg shadow-sm transition-all active:scale-95 flex flex-col items-center gap-0.5 animate-pulse"
                                                    >
                                                        <span>XÁC NHẬN HỦY</span>
                                                        <span className="opacity-80">(Giải phóng phòng)</span>
                                                    </button>
                                                    )
                                                ) : (
                                                    !isReadOnly && (
                                                    <button 
                                                        onClick={() => handleConfirmCancel(order)}
                                                        className="w-full bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 text-xs font-bold py-2 rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1"
                                                    >
                                                        <Trash2 size={14}/> Xác nhận Hủy
                                                    </button>
                                                    )
                                                )
                                            ) : isConfirmed ? (
                                                /* CONFIRMED (HISTORY) STATE */
                                                <span className="inline-block px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase w-full bg-slate-100 text-slate-500 border-slate-200">
                                                    Đã lưu
                                                </span>
                                            ) : order.status === 'Assigned' ? (
                                                /* ASSIGNED STATE */
                                                <span className="inline-block px-3 py-1.5 rounded-lg text-[10px] font-black border uppercase w-full truncate max-w-[100px] bg-green-50 text-green-700 border-green-200" title={order.assignedRoom}>
                                                    {order.assignedRoom || 'Đã xếp'}
                                                </span>
                                            ) : (
                                                /* PENDING STATE ACTION */
                                                !isReadOnly && (
                                                <button 
                                                    onClick={() => handleAssignRoom(order)}
                                                    className="w-full bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2 rounded-lg shadow-sm transition-all active:scale-95"
                                                >
                                                    Xếp phòng
                                                </button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                        {/* INFINITE SCROLL LOADER */}
                        <tr ref={observerTarget}>
                            <td colSpan={6} className="p-4 text-center">
                                {isFetching && (
                                    <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
                                        <Loader2 className="animate-spin" size={20}/> Đang tải thêm dữ liệu...
                                    </div>
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- MOBILE VIEW: OPTIMIZED CARDS --- */}
        <div className="md:hidden space-y-4">
            {displayData.length === 0 && !isFetching ? (
                <div className="text-center py-10 text-slate-400">
                    <CloudLightning size={40} className="mx-auto mb-2 opacity-50"/>
                    <p className="text-sm font-medium">Không có đơn hàng nào.</p>
                </div>
            ) : (
                displayData.map(order => {
                    // ... (Mobile item render same as desktop, omitted for brevity, logic follows OtaOrders original file)
                    const checkin = parseISO(order.checkIn);
                    const checkout = parseISO(order.checkOut);
                    const isValidDates = isValid(checkin) && isValid(checkout);
                    const isToday = isValidDates && isSameDay(checkin, new Date());
                    const styles = getPlatformConfig(order.platform);
                    const isCancelled = order.status === 'Cancelled';
                    const isConfirmed = order.status === 'Confirmed';
                    const isBreakfastIncluded = hasBreakfast(order);
                    
                    const orderEmailDate = parseISO(order.emailDate || '');
                    const isNewToday = isValid(orderEmailDate) && format(orderEmailDate, 'yyyy-MM-dd') === todayDateStr;

                    const isGroup = order.groupInfo && order.groupInfo.total > 1;
                    const groupBorderClass = isGroup ? 'border-l-4 border-l-purple-400' : '';

                    return (
                    <div key={order.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col relative ${isCancelled ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'} ${groupBorderClass}`}>
                        <div className={`h-1.5 w-full ${isCancelled ? 'bg-red-500' : isConfirmed ? 'bg-slate-400' : order.status === 'Pending' ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                        
                        {isToday && order.status === 'Pending' && !isCancelled && (
                            <div className="bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1 px-4 text-center animate-pulse flex items-center justify-center gap-2">
                                <AlertTriangle size={12} fill="white" /> Khách đến hôm nay
                            </div>
                        )}

                        <div className="p-4 flex-1 flex flex-col">
                            {/* ... Content same as before ... */}
                            <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-50">
                                <div className="flex items-center gap-2">
                                    <div className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${styles.bg} ${styles.color} ${styles.border}`}>
                                        {order.platform}
                                    </div>
                                    {isNewToday && !isCancelled && !isConfirmed && (
                                        <span className="flex items-center gap-1 bg-rose-100 text-rose-600 border border-rose-200 text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                            <Bell size={10}/> MỚI
                                        </span>
                                    )}
                                    {isCancelled && (
                                        <span className="flex items-center gap-1 bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse shadow-sm">
                                            CẢNH BÁO HỦY
                                        </span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 font-bold mr-1">#</span>
                                    <span className="font-mono text-sm font-black text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{order.bookingCode}</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    {isGroup && order.groupInfo && (
                                        <span className="inline-flex items-center gap-1 mb-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-black uppercase border border-purple-200">
                                            <Layers size={10}/> Nhóm: Phòng {order.groupInfo.index}/{order.groupInfo.total}
                                        </span>
                                    )}
                                    <h3 className={`font-black text-base leading-tight break-words line-clamp-3 ${isCancelled ? 'text-red-700' : isConfirmed ? 'text-slate-500 line-through' : 'text-slate-800'}`} title={order.guestName}>{order.guestName}</h3>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                                        <span className="flex items-center gap-1 truncate max-w-[200px]" title={order.guestDetails || `${order.guestCount} Khách`}>
                                            <Users size={12}/> {order.guestDetails || order.guestCount}
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-400 border-l border-slate-200 pl-2"><BedDouble size={12}/> {order.roomQuantity}</span>
                                    </div>
                                </div>
                                {/* ... etc ... */}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                                <div>
                                    <div className={`text-lg font-black ${isCancelled ? 'text-slate-400 line-through' : 'text-brand-700'}`}>{order.totalAmount.toLocaleString()}</div>
                                </div>

                                {/* ACTION BUTTONS MOBILE */}
                                {isCancelled ? (
                                    order.assignedRoom ? (
                                        !isReadOnly && (
                                        <button 
                                            onClick={() => handleResolveConflict(order)}
                                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-red-700 transition-colors animate-pulse"
                                        >
                                            XÁC NHẬN HỦY
                                        </button>
                                        )
                                    ) : (
                                        !isReadOnly && (
                                        <button 
                                            onClick={() => handleConfirmCancel(order)}
                                            className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-red-50 transition-colors"
                                        >
                                            Xác nhận Hủy
                                        </button>
                                        )
                                    )
                                ) : isConfirmed ? (
                                    <span className="px-3 py-1 rounded text-[10px] font-black border uppercase bg-slate-100 text-slate-500 border-slate-200">
                                        Đã lưu
                                    </span>
                                ) : order.status === 'Assigned' ? (
                                    <span className="px-3 py-1 rounded text-[10px] font-black border uppercase bg-green-50 text-green-700 border-green-200">
                                        Đã xếp
                                    </span>
                                ) : (
                                    !isReadOnly && (
                                    <button 
                                        onClick={() => handleAssignRoom(order)}
                                        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-brand-600 transition-colors"
                                    >
                                        Xếp phòng
                                    </button>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                    )
                })
            )}
            {/* Mobile Loading Indicator */}
            {isFetching && (
                <div className="flex justify-center p-4">
                    <Loader2 className="animate-spin text-slate-400" size={24}/>
                </div>
            )}
        </div>

        {/* MODAL */}
        {selectedOrder && (
            <OtaAssignModal 
                isOpen={isAssignModalOpen}
                onClose={() => setAssignModalOpen(false)}
                order={selectedOrder}
                onSuccess={() => {
                    // Update Local List immediately to hide the processed order
                    setListData(prev => prev.filter(o => o.id !== selectedOrder?.id));
                }}
            />
        )}
    </div>
  );
};
