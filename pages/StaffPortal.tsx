
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, CheckCircle, Clock, MapPin, 
  ChevronRight, CheckSquare, Square, 
  ArrowLeft, ListChecks, Info, Shirt, Loader2, Beer, Package, Plus, Minus, RefreshCw, ArchiveRestore, LayoutDashboard,
  BedDouble, Brush
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, isValid } from 'date-fns';
import { HousekeepingTask, ChecklistItem, RoomRecipeItem, ServiceItem, LendingItem, Booking } from '../types';
import { storageService } from '../services/storage';
import { ROOM_RECIPES } from '../constants';

const DEFAULT_CHECKLIST: ChecklistItem[] = [
    { id: '1', text: 'Thay ga giường và vỏ gối', completed: false },
    { id: '2', text: 'Lau dọn nhà vệ sinh', completed: false },
    { id: '3', text: 'Hút bụi và Lau sàn', completed: false },
    { id: '4', text: 'Xịt thơm phòng', completed: false },
];

const PlayIcon = ({ size = 20, fill = "currentColor", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

export const StaffPortal: React.FC = () => {
  const { 
    facilities, rooms, housekeepingTasks, syncHousekeepingTasks, services, bookings,
    currentUser, setCurrentUser, notify, upsertRoom, 
    refreshData, isLoading, processMinibarUsage, processRoomRestock
  } = useAppContext();
  
  const [activeTask, setActiveTask] = useState<(HousekeepingTask & { facilityName: string, roomType?: string }) | null>(null);
  const [localChecklist, setLocalChecklist] = useState<ChecklistItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [consumedItems, setConsumedItems] = useState<Record<string, number>>({});
  const [returnedLinenCounts, setReturnedLinenCounts] = useState<Record<string, number>>({});

  const [activeTab, setActiveTab] = useState<'Checkout' | 'Stayover' | 'Others'>('Checkout');

  const navigate = useNavigate();
  
  const handleLogout = () => {
    setCurrentUser(null);
    storageService.saveUser(null);
    navigate('/login');
  };

  const handleRefresh = async () => {
    try {
        await refreshData(false);
        notify('success', 'Đã cập nhật dữ liệu mới nhất');
    } catch (err) {
        notify('error', 'Không thể kết nối máy chủ');
    }
  };

  const myTasks = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const taskList: (HousekeepingTask & { facilityName: string, roomStatus: string, roomType: string })[] = [];

    // ANTI-GHOST LOGIC:
    const recentDoneMap = new Map<string, number>();
    housekeepingTasks.forEach(t => {
        if (t.status === 'Done') {
            const key = `${t.facility_id}_${t.room_code}`;
            const time = t.completed_at && isValid(parseISO(t.completed_at)) ? parseISO(t.completed_at).getTime() : parseISO(t.created_at).getTime();
            const current = recentDoneMap.get(key) || 0;
            if (time > current) recentDoneMap.set(key, time);
        }
    });

    // Map existing active tasks from DB
    const dbTasksMap = new Map<string, HousekeepingTask>();
    housekeepingTasks.forEach(t => {
        const created = parseISO(t.created_at);
        if (isValid(created)) {
            const tDate = format(created, 'yyyy-MM-dd');
            // Include active tasks OR completed tasks for today (to show history)
            if (t.status !== 'Done' || tDate === todayStr) {
                dbTasksMap.set(`${t.facility_id}_${t.room_code}`, t);
            }
        }
    });

    rooms.forEach(room => {
        const facility = facilities.find(f => f.id === room.facility_id);
        if (!facility) return;
        
        const uniqueKey = `${room.facility_id}_${room.name}`;
        const existingTask = dbTasksMap.get(uniqueKey);

        // PRIORITY 1: Show Existing Task (DB)
        if (existingTask) {
             taskList.push({
                ...existingTask,
                // If room is 'Đang dọn' but task is 'Pending', optimistic update UI to In Progress
                status: room.status === 'Đang dọn' && existingTask.status === 'Pending' ? 'In Progress' : existingTask.status,
                facilityName: facility.facilityName,
                roomStatus: room.status,
                roomType: room.type || '1GM8'
            });
            return;
        }

        // PRIORITY 2: Auto-Generate Virtual Tasks
        const lastDoneTime = recentDoneMap.get(uniqueKey);
        if (lastDoneTime && differenceInMinutes(today, new Date(lastDoneTime)) < 120) {
            return; 
        }

        // A. Dirty Room
        if (room.status === 'Bẩn' || room.status === 'Đang dọn') {
             taskList.push({
                id: `VIRTUAL_${uniqueKey}`,
                facility_id: room.facility_id,
                room_code: room.name,
                task_type: 'Dirty', 
                status: room.status === 'Đang dọn' ? 'In Progress' : 'Pending',
                assignee: currentUser?.collaboratorName || null,
                priority: 'High',
                created_at: new Date().toISOString(),
                note: 'Phòng báo Bẩn (Tự động đồng bộ)',
                facilityName: facility.facilityName,
                roomStatus: room.status,
                roomType: room.type || '1GM8'
            });
            return;
        }

        // B. Stayover
        const activeBooking = bookings.find(b => 
            b.facilityName === facility.facilityName && 
            b.roomCode === room.name && 
            b.status === 'CheckedIn'
        );

        if (activeBooking) {
            const checkIn = format(parseISO(activeBooking.checkinDate), 'yyyy-MM-dd');
            const checkOut = format(parseISO(activeBooking.checkoutDate), 'yyyy-MM-dd');
            
            if (todayStr > checkIn && todayStr < checkOut) {
                 taskList.push({
                    id: `AUTO_STAYOVER_${uniqueKey}`,
                    facility_id: room.facility_id,
                    room_code: room.name,
                    task_type: 'Stayover',
                    status: 'Pending',
                    assignee: null,
                    priority: 'Normal',
                    created_at: new Date().toISOString(),
                    note: 'Khách đang ở (Tự động)',
                    facilityName: facility.facilityName,
                    roomStatus: room.status,
                    roomType: room.type || '1GM8'
                });
            }
        }
    });

    return taskList.sort((a,b) => {
        const sOrder = { 'In Progress': 0, 'Pending': 1, 'Done': 2 };
        if (sOrder[a.status] !== sOrder[b.status]) return (sOrder[a.status] ?? 3) - (sOrder[b.status] ?? 3);
        const pOrder = { 'Checkout': 0, 'Dirty': 1, 'Stayover': 2, 'Vacant': 3 };
        return (pOrder[a.task_type] ?? 4) - (pOrder[b.task_type] ?? 4);
    });
  }, [facilities, rooms, housekeepingTasks, currentUser, bookings]);

  const workloadStats = useMemo(() => {
    const total = myTasks.length;
    const completed = myTasks.filter(t => t.status === 'Done').length;
    return { total, completed, pending: total - completed };
  }, [myTasks]);

  const tabCounts = useMemo(() => {
      const counts = { Checkout: 0, Stayover: 0, Others: 0 };
      if (myTasks) {
          myTasks.forEach(t => {
              if (t.status === 'Done') return; 
              if (t.task_type === 'Checkout') counts.Checkout++;
              else if (t.task_type === 'Stayover') counts.Stayover++;
              else if (t.task_type === 'Dirty' || t.task_type === 'Vacant') counts.Others++;
          });
      }
      return counts;
  }, [myTasks]);

  const filteredTasks = useMemo(() => {
      if (!myTasks) return [];
      return myTasks.filter(t => {
          if (activeTab === 'Checkout') return t.task_type === 'Checkout';
          if (activeTab === 'Stayover') return t.task_type === 'Stayover';
          if (activeTab === 'Others') return t.task_type === 'Dirty' || t.task_type === 'Vacant';
          return true;
      });
  }, [myTasks, activeTab]);

  const recipeItems = useMemo(() => {
      if (!activeTask || !activeTask.roomType) return [];
      const recipe = ROOM_RECIPES[activeTask.roomType];
      if (!recipe) return [];
      return recipe.items.map(rItem => {
          const service = services.find(s => s.id === rItem.itemId || s.name === rItem.itemId);
          return {
              ...service,
              requiredQty: rItem.quantity,
              fallbackName: rItem.itemId
          };
      });
  }, [activeTask, services]);

  const checkoutReturnList = useMemo(() => {
      if (!activeTask) return [];
      const combinedMap = new Map<string, { id: string, name: string, totalQty: number, standardQty: number, lendingQty: number }>();

      if (activeTask.task_type === 'Checkout') {
          recipeItems.forEach(item => {
              if (item.category === 'Linen' || item.category === 'Asset') {
                  const id = item.id || item.fallbackName;
                  combinedMap.set(id, {
                      id: id,
                      name: item.name || item.fallbackName,
                      totalQty: item.requiredQty,
                      standardQty: item.requiredQty,
                      lendingQty: 0
                  });
              }
          });
      }

      const sortedBookings = bookings
          .filter(b => b.facilityName === activeTask.facilityName && b.roomCode === activeTask.room_code)
          .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

      let booking: Booking | undefined;
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      if (activeTask.task_type === 'Checkout') {
          booking = sortedBookings.find(b => {
              if (b.status !== 'CheckedOut') return false;
              const outDate = b.actualCheckOut ? b.actualCheckOut : b.checkoutDate;
              return isValid(parseISO(outDate)) && outDate.startsWith(todayStr);
          });
      } else if (activeTask.task_type === 'Stayover' || activeTask.task_type === 'Dirty') {
          booking = sortedBookings.find(b => b.status === 'CheckedIn');
      }

      if (booking && booking.lendingJson) {
          try {
              const lends: LendingItem[] = JSON.parse(booking.lendingJson);
              lends.forEach(l => {
                  if (l.quantity > 0) {
                      const existing = combinedMap.get(l.item_id);
                      if (existing) {
                          existing.totalQty += l.quantity;
                          existing.lendingQty += l.quantity;
                      } else {
                          combinedMap.set(l.item_id, {
                              id: l.item_id,
                              name: l.item_name,
                              totalQty: l.quantity,
                              standardQty: 0,
                              lendingQty: l.quantity
                          });
                      }
                  }
              });
          } catch(e) { }
      }
      return Array.from(combinedMap.values());
  }, [activeTask, recipeItems, bookings]);

  useEffect(() => {
      if (activeTask?.task_type === 'Checkout' && checkoutReturnList.length > 0) {
          const initialCounts: Record<string, number> = {};
          checkoutReturnList.forEach(item => { initialCounts[item.id] = item.totalQty; });
          setReturnedLinenCounts(initialCounts);
      } else {
          setReturnedLinenCounts({});
      }
  }, [activeTask, checkoutReturnList]);

  const openTaskDetail = (task: typeof myTasks[0]) => {
      if (task.status === 'Done') return;
      setActiveTask(task);
      const savedChecklist = task.checklist ? JSON.parse(task.checklist) : [...DEFAULT_CHECKLIST];
      setLocalChecklist(savedChecklist);
      setConsumedItems({}); 
  };

  const toggleCheckItem = (id: string) => {
      setLocalChecklist(prev => prev.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const updateConsumed = (itemId: string, delta: number) => {
      setConsumedItems(prev => {
          const current = prev[itemId] || 0;
          const next = Math.max(0, current + delta);
          return { ...prev, [itemId]: next };
      });
  };

  const updateReturnedLinen = (itemId: string, delta: number) => {
      setReturnedLinenCounts(prev => {
          const current = prev[itemId] || 0;
          const next = Math.max(0, current + delta);
          return { ...prev, [itemId]: next };
      });
  };

  const handleStartTask = async () => {
      if (!activeTask || isProcessing) return;
      setIsProcessing(true);
      try {
        const isVirtual = activeTask.id.startsWith('VIRTUAL_') || activeTask.id.startsWith('AUTO_STAYOVER_');
        const taskToSync: HousekeepingTask = {
            ...activeTask,
            id: isVirtual ? crypto.randomUUID() : activeTask.id,
            status: 'In Progress',
            started_at: new Date().toISOString(),
            assignee: currentUser?.collaboratorName || activeTask.assignee,
            points: activeTask.task_type === 'Checkout' ? 4 : activeTask.task_type === 'Dirty' ? 2 : 1
        };
        await Promise.all([
            syncHousekeepingTasks([taskToSync]),
            (async () => {
                const room = rooms.find(r => r.facility_id === activeTask.facility_id && r.name === activeTask.room_code);
                if (room && room.status !== 'Đang dọn') await upsertRoom({ ...room, status: 'Đang dọn' });
            })()
        ]);
        setActiveTask({ ...taskToSync, facilityName: activeTask.facilityName, roomType: activeTask.roomType });
        notify('info', `Đã bắt đầu dọn phòng ${activeTask.room_code}`);
      } catch (e) {
        notify('error', 'Có lỗi xảy ra, vui lòng thử lại');
      } finally {
        setIsProcessing(false);
      }
  };

  const handleComplete = async () => {
      if (!activeTask || isProcessing) return;
      
      if (localChecklist.some(i => !i.completed)) {
          if (!confirm('Bạn chưa hoàn thành hết checklist. Vẫn muốn hoàn tất?')) return;
      }

      setIsProcessing(true);
      try {
        const itemsToProcess = (Object.entries(consumedItems) as [string, number][])
            .filter(([_, qty]) => qty > 0)
            .map(([itemId, qty]) => ({ itemId, qty }));
        
        await processMinibarUsage(activeTask.facilityName, activeTask.room_code, itemsToProcess);

        let linenNote = '';
        if (activeTask.task_type === 'Checkout' || activeTask.task_type === 'Dirty') {
            const missingItems: string[] = [];
            const restockPayload: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[] = [];

            checkoutReturnList.forEach(item => {
                const actualDirtyCount = returnedLinenCounts[item.id] ?? item.totalQty;
                const replenishCount = item.standardQty;

                if (actualDirtyCount > 0 || replenishCount > 0) {
                    restockPayload.push({
                        itemId: item.id,
                        dirtyReturnQty: actualDirtyCount,
                        cleanRestockQty: replenishCount
                    });
                }

                if (actualDirtyCount < item.totalQty) {
                    missingItems.push(`${item.name} x${item.totalQty - actualDirtyCount}`);
                }
            });

            if (restockPayload.length > 0) {
                await processRoomRestock(activeTask.facilityName, activeTask.room_code, restockPayload);
            }
            
            if (missingItems.length > 0) {
                linenNote += `\n[BÁO MẤT/HỎNG]: ${missingItems.join(', ')}`;
            }
        }
        
        const updatedTask: HousekeepingTask = {
            ...activeTask,
            status: 'Done',
            checklist: JSON.stringify(localChecklist),
            completed_at: new Date().toISOString(),
            linen_exchanged: activeTask.task_type === 'Checkout' ? checkoutReturnList.reduce((sum, i) => sum + (returnedLinenCounts[i.id] ?? i.totalQty), 0) : 0,
            note: (activeTask.note || '') + linenNote
        };

        const updates: Promise<any>[] = [syncHousekeepingTasks([updatedTask])];
        const roomObj = rooms.find(r => r.facility_id === activeTask.facility_id && r.name === activeTask.room_code);
        if (roomObj) {
            updates.push(upsertRoom({ ...roomObj, status: 'Đã dọn' }));
        }

        await Promise.all(updates);
        notify('success', `Hoàn thành P.${activeTask.room_code}.`);
        setActiveTask(null);
      } catch (e) {
        console.error(e);
        notify('error', 'Có lỗi xử lý. Vui lòng thử lại.');
      } finally {
        setIsProcessing(false);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans max-w-md mx-auto shadow-2xl relative">
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-50 shadow-sm flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-200">
                    {currentUser?.collaboratorName?.charAt(0) || 'U'}
                </div>
                <div>
                    <h1 className="text-sm font-black text-slate-800 tracking-tight uppercase">Housekeeper App</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{currentUser?.collaboratorName}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => (currentUser?.role === 'Nhân viên' || currentUser?.role === 'Buồng phòng') ? navigate('/bookings') : navigate('/dashboard')} 
                    className="p-2 text-slate-400 hover:text-brand-600 transition-colors" 
                    title={(currentUser?.role === 'Nhân viên' || currentUser?.role === 'Buồng phòng') ? "Về Lịch đặt phòng" : "Về Dashboard"}
                >
                    <LayoutDashboard size={20} />
                </button>
                <button onClick={handleRefresh} disabled={isLoading} className={`p-2 transition-colors ${isLoading ? 'text-brand-600 animate-spin' : 'text-slate-400 hover:text-brand-600'}`}>
                    <RefreshCw size={20} />
                </button>
                <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                    <LogOut size={20} />
                </button>
            </div>
        </header>

        <div className="p-4 pt-6">
            <div className={`rounded-2xl p-4 shadow-sm border bg-white border-slate-100`}>
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle className="text-green-500" size={16}/> Tiến độ dọn dẹp
                    </h3>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-brand-100 text-brand-700`}>
                        {workloadStats.completed}/{workloadStats.total}
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 bg-brand-500`} style={{ width: `${(workloadStats.completed / (workloadStats.total || 1)) * 100}%` }}></div>
                </div>
            </div>
        </div>

        {/* TAB SWITCHER */}
        <div className="px-4 pb-2 sticky top-[73px] z-40 bg-slate-50 pt-2">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('Checkout')}
                    className={`flex-1 min-w-[70px] py-2.5 rounded-lg text-xs font-black uppercase transition-all flex flex-col items-center gap-1 shrink-0
                        ${activeTab === 'Checkout' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100' : 'text-slate-400 hover:bg-slate-50'}
                    `}
                >
                    <div className="flex items-center gap-1.5">
                        <LogOut size={14}/> Trả
                    </div>
                    {tabCounts.Checkout > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{tabCounts.Checkout}</span>}
                </button>
                
                <button
                    onClick={() => setActiveTab('Stayover')}
                    className={`flex-1 min-w-[70px] py-2.5 rounded-lg text-xs font-black uppercase transition-all flex flex-col items-center gap-1 shrink-0
                        ${activeTab === 'Stayover' ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100' : 'text-slate-400 hover:bg-slate-50'}
                    `}
                >
                    <div className="flex items-center gap-1.5">
                        <BedDouble size={14}/> Ở
                    </div>
                    {tabCounts.Stayover > 0 && <span className="bg-blue-500 text-white text-[9px] px-1.5 rounded-full">{tabCounts.Stayover}</span>}
                </button>

                <button
                    onClick={() => setActiveTab('Others')}
                    className={`flex-1 min-w-[70px] py-2.5 rounded-lg text-xs font-black uppercase transition-all flex flex-col items-center gap-1 shrink-0
                        ${activeTab === 'Others' ? 'bg-amber-50 text-amber-600 shadow-sm border border-amber-100' : 'text-slate-400 hover:bg-slate-50'}
                    `}
                >
                    <div className="flex items-center gap-1.5">
                        <Brush size={14}/> Bẩn
                    </div>
                    {tabCounts.Others > 0 && <span className="bg-amber-500 text-white text-[9px] px-1.5 rounded-full">{tabCounts.Others}</span>}
                </button>
            </div>
        </div>

        <div className="flex-1 px-4 pb-24 space-y-4 overflow-y-auto pt-2">
            {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${activeTab === 'Checkout' ? 'bg-red-50' : activeTab === 'Stayover' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                        {activeTab === 'Checkout' ? <LogOut size={40} className="text-red-300"/> : 
                         activeTab === 'Stayover' ? <BedDouble size={40} className="text-blue-300"/> : 
                         <Brush size={40} className="text-amber-300"/>}
                    </div>
                    <p className="font-bold text-sm">Không có phòng nào trong mục này.</p>
                </div>
            ) : (
                filteredTasks.map(task => (
                    <div 
                        key={task.id} 
                        onClick={() => openTaskDetail(task)}
                        className={`
                            bg-white rounded-2xl p-5 shadow-sm border-2 transition-all active:scale-[0.97] relative group
                            ${task.status === 'Done' ? 'border-slate-100 opacity-60' : 
                              task.status === 'In Progress' ? 'border-brand-500 shadow-brand-100 ring-2 ring-brand-500/10' : 'border-white'}
                        `}
                    >
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            task.task_type === 'Checkout' ? 'bg-red-500' : 
                            task.task_type === 'Stayover' ? 'bg-blue-500' : 'bg-amber-500'
                        }`}></div>
                        
                        <div className="flex justify-between items-center mb-3">
                             <div className="flex items-center gap-4">
                                 <h2 className="text-3xl font-black text-slate-800">{task.room_code}</h2>
                                 <div className="space-y-1">
                                     <div className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase border w-fit 
                                        ${task.task_type === 'Checkout' ? 'bg-red-50 text-red-600 border-red-100' : 
                                          task.task_type === 'Stayover' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                          'bg-amber-50 text-amber-600 border-amber-100'}
                                     `}>
                                         {task.task_type === 'Stayover' && task.note?.includes('hỏi') ? 'HỎI DỌN' : task.task_type}
                                     </div>
                                     <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
                                         <MapPin size={10}/> {task.facilityName} - {task.roomType}
                                     </div>
                                 </div>
                             </div>
                             {task.status !== 'Done' && <ChevronRight className="text-slate-300" size={20} />}
                        </div>
                        {task.note && <p className="text-xs text-slate-500 italic mb-2 line-clamp-1 border-l-2 border-slate-200 pl-2">{task.note}</p>}
                        {task.status === 'In Progress' && <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600 font-bold animate-pulse"><Clock size={10}/> Đang dọn...</div>}
                    </div>
                ))
            )}
        </div>

        {/* TASK DETAIL OVERLAY */}
        {activeTask && (
            <div className="fixed inset-0 z-[100] bg-white animate-in slide-in-from-bottom duration-300 flex flex-col">
                <div className="bg-white border-b border-slate-100 p-4 flex items-center gap-4 shrink-0">
                    <button onClick={() => setActiveTask(null)} disabled={isProcessing} className="p-2 -ml-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-slate-800">Phòng {activeTask.room_code}</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{activeTask.roomType} ({ROOM_RECIPES[activeTask.roomType || '1GM8']?.description})</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar pb-32">
                    {/* INFO BOX */}
                    <div className="bg-slate-50 rounded-2xl p-4 flex items-start gap-3 border border-slate-200/50">
                        <div className="bg-white p-2 rounded-xl text-slate-400 shadow-sm"><Info size={20}/></div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Ghi chú</span>
                            <p className="text-sm font-bold text-slate-700 italic">"{activeTask.note || 'Không có ghi chú'}"</p>
                        </div>
                    </div>

                    {/* SECTION 1: Checklist */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <ListChecks size={18} className="text-brand-600"/> 1. Checklist Dọn Dẹp
                            </h3>
                            <span className="text-[10px] font-black text-slate-400">{localChecklist.filter(i => i.completed).length}/{localChecklist.length}</span>
                        </div>
                        <div className="space-y-3">
                            {localChecklist.map(item => (
                                <button key={item.id} onClick={() => toggleCheckItem(item.id)} className={`w-full p-4 rounded-xl border-2 flex items-center justify-between transition-all ${item.completed ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100'}`}>
                                    <span className={`text-sm font-bold ${item.completed ? 'text-emerald-700 line-through opacity-60' : 'text-slate-700'}`}>{item.text}</span>
                                    {item.completed ? <CheckSquare className="text-emerald-600" size={20}/> : <Square className="text-slate-300" size={20}/>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 2 & 3: Minibar & Linen (Only if In Progress) */}
                    {activeTask.status === 'In Progress' && (
                        <>
                            <div className="h-px bg-slate-100 my-4"></div>
                            
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <Beer size={18} className="text-orange-500"/> 2. Kiểm tra Minibar & Đồ dùng
                            </h3>
                            <div className="space-y-3">
                                {recipeItems.filter(i => i.category === 'Minibar' || i.category === 'Amenity').map((item, idx) => {
                                    const consumed = consumedItems[item.id || item.fallbackName] || 0;
                                    return (
                                        <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div>
                                                <div className="font-bold text-slate-700 text-sm">{item.name || item.fallbackName}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase">
                                                    Setup chuẩn: {item.requiredQty} {item.unit} {item.category === 'Minibar' && <span className="text-orange-500 font-bold ml-1">(Có phí)</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateConsumed(item.id || item.fallbackName, -1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-transform"><Minus size={16}/></button>
                                                <span className={`w-6 text-center font-black ${consumed > 0 ? 'text-red-600' : 'text-slate-300'}`}>{consumed}</span>
                                                <button onClick={() => updateConsumed(item.id || item.fallbackName, 1)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-transform"><Plus size={16}/></button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="h-px bg-slate-100 my-4"></div>

                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
                                <ArchiveRestore size={18} className="text-blue-500"/> 3. Thu hồi Đồ vải (Linen)
                            </h3>
                            {activeTask.task_type === 'Checkout' ? (
                                <div className="space-y-3">
                                    <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-xs font-bold border border-blue-100 flex items-center gap-2 mb-2">
                                        <Info size={16}/> Thu hồi cả Đồ mượn và Đồ chuẩn.
                                    </div>
                                    {checkoutReturnList.map((item, idx) => {
                                        const actual = returnedLinenCounts[item.id] ?? item.totalQty;
                                        const diff = actual - item.totalQty;
                                        return (
                                        <div key={idx} className={`flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm ${diff < 0 ? 'border-red-200 bg-red-50' : 'border-blue-100'}`}>
                                            <div className="flex items-center gap-3">
                                                <Shirt size={20} className={diff < 0 ? "text-red-400" : "text-blue-400"}/>
                                                <div>
                                                    <div className="font-bold text-slate-700 text-sm">{item.name}</div>
                                                    <div className="text-[10px] text-slate-500 font-medium">
                                                        Tổng thu: <b className="text-slate-800 text-xs">{item.totalQty}</b> 
                                                        <span className="text-slate-400 ml-1">(Chuẩn: {item.standardQty}{item.lendingQty > 0 ? `, Mượn: ${item.lendingQty}` : ''})</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateReturnedLinen(item.id, -1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-transform"><Minus size={16}/></button>
                                                <div className="flex flex-col items-center w-12">
                                                    <span className={`text-lg font-black ${diff < 0 ? 'text-red-600' : 'text-blue-600'}`}>{actual}</span>
                                                    {diff !== 0 && (
                                                        <span className={`text-[8px] font-bold uppercase ${diff < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                            {diff < 0 ? `Thiếu ${Math.abs(diff)}` : `Dư ${diff}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <button onClick={() => updateReturnedLinen(item.id, 1)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-transform"><Plus size={16}/></button>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-[10px] text-slate-400 mb-2 italic">Stayover: Nhập số lượng đồ bẩn bạn mang ra khỏi phòng.</p>
                                    {recipeItems.filter(i => i.category === 'Linen').map((item, idx) => {
                                        const consumed = consumedItems[item.id || item.fallbackName] || 0;
                                        return (
                                            <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                <div>
                                                    <div className="font-bold text-slate-700 text-sm">{item.name || item.fallbackName}</div>
                                                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium uppercase">Setup chuẩn: {item.requiredQty}</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => updateConsumed(item.id || item.fallbackName, -1)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-transform"><Minus size={16}/></button>
                                                    <span className={`w-6 text-center font-black ${consumed > 0 ? 'text-blue-600' : 'text-slate-300'}`}>{consumed}</span>
                                                    <button onClick={() => updateConsumed(item.id || item.fallbackName, 1)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 active:scale-90 transition-transform"><Plus size={16}/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-100 flex gap-3 pb-8">
                    {activeTask.status === 'Pending' ? (
                        <button 
                            onClick={handleStartTask}
                            disabled={isProcessing}
                            className={`w-full bg-brand-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all text-sm tracking-widest ${isProcessing ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                            {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <PlayIcon size={20} fill="white" />} 
                            {isProcessing ? 'ĐANG XỬ LÝ...' : 'BẮT ĐẦU DỌN'}
                        </button>
                    ) : (
                        <button 
                            onClick={handleComplete}
                            disabled={isProcessing}
                            className={`w-full py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all text-sm tracking-widest bg-emerald-600 text-white shadow-emerald-100 ${isProcessing ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                             {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />} 
                             {isProcessing ? 'ĐANG CẬP NHẬT...' : 'HOÀN TẤT & TRỪ KHO'}
                        </button>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
