import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { HousekeepingTask, Booking, LendingItem, ServiceItem } from '../types';
import { CheckCircle, Clock, AlertTriangle, LogOut, BedDouble, Brush, ChevronLeft, Save, Camera, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export const StaffPortal: React.FC = () => {
  const { 
    currentUser, housekeepingTasks, rooms, bookings, facilities, services, roomRecipes,
    syncHousekeepingTasks, upsertRoom, processCheckoutLinenReturn, processRoomRestock, notify, refreshData
  } = useAppContext();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  // Extend tasks with facility name
  const myTasks = useMemo(() => {
      if (!currentUser) return [];
      
      // Filter tasks assigned to current user OR unassigned (if configured)
      // For simplicity, let's show tasks assigned to this user.
      const assigned = housekeepingTasks.filter(t => t.assignee === currentUser.collaboratorName && t.status !== 'Done');
      
      return assigned.map(t => {
          const f = facilities.find(fac => fac.id === t.facility_id);
          return { ...t, facilityName: f?.facilityName || 'Unknown' };
      }).sort((a,b) => {
          // Sort priority: In Progress > Priority High > Normal
          if (a.status === 'In Progress' && b.status !== 'In Progress') return -1;
          if (a.status !== 'In Progress' && b.status === 'In Progress') return 1;
          if (a.priority === 'High' && b.priority !== 'High') return -1;
          if (a.priority !== 'High' && b.priority === 'High') return 1;
          return 0;
      });
  }, [housekeepingTasks, currentUser, facilities]);

  const activeTask = useMemo(() => 
      myTasks.find(t => t.id === selectedTaskId) || null
  , [myTasks, selectedTaskId]);

  const currentRoom = useMemo(() => {
      if (!activeTask) return null;
      return rooms.find(r => r.facility_id === activeTask.facility_id && r.name === activeTask.room_code);
  }, [activeTask, rooms]);

  const recipeItems = useMemo(() => {
      if (!currentRoom || !currentRoom.type || !roomRecipes[currentRoom.type]) return [];
      const recipe = roomRecipes[currentRoom.type];
      
      return recipe.items.map(ri => {
          const service = services.find(s => s.id === ri.itemId);
          return {
              ...ri,
              name: service?.name,
              category: service?.category,
              fallbackName: ri.itemId,
              requiredQty: ri.quantity,
              id: service?.id
          };
      });
  }, [currentRoom, roomRecipes, services]);

  // --- LOGIC LẤY DANH SÁCH THU HỒI (RECIPE + LENDING) ---
  const checkoutReturnList = useMemo(() => {
      if (!activeTask) return [];
      
      const combinedMap = new Map<string, { id: string, name: string, qty: number, isExtra: boolean }>();

      // 1. Add Recipe Items (Standard) - Only for Checkout Context
      if (activeTask.task_type === 'Checkout') {
          recipeItems.forEach(item => {
              if (item.category === 'Linen' || item.category === 'Asset') {
                  const id = item.id || item.fallbackName;
                  combinedMap.set(id, {
                      id: id,
                      name: item.name || item.fallbackName,
                      qty: item.requiredQty,
                      isExtra: false
                  });
              }
          });
      }

      // 2. Add Extra Lending Items from Booking (Task-Driven Logic)
      
      // Step 1: Filter Bookings for this room and sort by created date (newest first)
      const sortedBookings = bookings
          .filter(b => b.facilityName === activeTask.facilityName && b.roomCode === activeTask.room_code)
          .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

      let booking: Booking | undefined;
      
      // Step 2: Context-Aware Selection (Turnover Day Fix)
      if (activeTask.task_type === 'Checkout') {
          // Rule: Lấy booking đã CheckedOut gần nhất. 
          booking = sortedBookings.find(b => b.status === 'CheckedOut');
      } else if (activeTask.task_type === 'Stayover' || activeTask.task_type === 'Dirty') {
          // Rule: If Stayover/Dirty task, find the CheckedIn booking (The one staying)
          booking = sortedBookings.find(b => b.status === 'CheckedIn');
      }

      // Step 3: Extract Lending
      if (booking && booking.lendingJson) {
          try {
              const lends: LendingItem[] = JSON.parse(booking.lendingJson);
              lends.forEach(l => {
                  if (l.quantity > 0) {
                      const existing = combinedMap.get(l.item_id);
                      if (existing) {
                          existing.qty += l.quantity;
                          existing.isExtra = true; // Mark as having extra
                      } else {
                          combinedMap.set(l.item_id, {
                              id: l.item_id,
                              name: l.item_name,
                              qty: l.quantity,
                              isExtra: true
                          });
                      }
                  }
              });
          } catch(e) {
              console.warn("Error parsing lendingJson", e);
          }
      }

      return Array.from(combinedMap.values());
  }, [activeTask, recipeItems, bookings]);

  const handleStartTask = async () => {
      if (!activeTask) return;
      const updated = { ...activeTask, status: 'In Progress' as const, started_at: new Date().toISOString() };
      // Remove local 'facilityName' before syncing if necessary, but syncHousekeepingTasks sanitizes usually or Supabase ignores extra fields?
      // Better to be safe and use exact HousekeepingTask type
      const { facilityName, ...taskData } = updated;
      await syncHousekeepingTasks([taskData as HousekeepingTask]);
      
      if (currentRoom) {
          await upsertRoom({ ...currentRoom, status: 'Đang dọn' });
      }
      notify('success', 'Bắt đầu dọn phòng');
  };

  const handleCompleteTask = async () => {
      if (!activeTask) return;
      
      // 1. Return Dirty Linen (Inventory Logic)
      if (activeTask.task_type === 'Checkout') {
          // Items from checklist/recipe -> Dirty Stock
          const returnItems = checkoutReturnList.map(i => ({ itemId: i.id, qty: i.qty }));
          if (returnItems.length > 0) {
              await processCheckoutLinenReturn(activeTask.facilityName, activeTask.room_code, returnItems);
          }
      }

      // 2. Restock Clean Linen (Inventory Logic)
      // For now, assume full restock to par level if recipe exists
      if (recipeItems.length > 0) {
          const restockItems = recipeItems
              .filter(i => i.category === 'Linen' || i.category === 'Amenity' || i.category === 'Minibar')
              .map(i => ({ itemId: i.id || i.fallbackName, qty: i.requiredQty }));
          
          if (restockItems.length > 0) {
              await processRoomRestock(activeTask.facilityName, activeTask.room_code, restockItems);
          }
      }

      // 3. Update Task Status
      const updated = { 
          ...activeTask, 
          status: 'Done' as const, 
          completed_at: new Date().toISOString() 
      };
      const { facilityName, ...taskData } = updated;
      
      await syncHousekeepingTasks([taskData as HousekeepingTask]);

      // 4. Update Room Status
      if (currentRoom) {
          await upsertRoom({ ...currentRoom, status: 'Đã dọn' });
      }

      notify('success', 'Hoàn thành nhiệm vụ!');
      setSelectedTaskId(null);
  };

  if (!currentUser) return <div className="p-4 text-center">Vui lòng đăng nhập</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50 md:rounded-2xl overflow-hidden">
        {/* HEADER */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-10 sticky top-0">
            {selectedTaskId ? (
                <button onClick={() => setSelectedTaskId(null)} className="flex items-center gap-1 text-slate-500 font-bold text-sm">
                    <ChevronLeft size={20}/> Quay lại
                </button>
            ) : (
                <h1 className="font-bold text-lg text-slate-800">Danh sách nhiệm vụ</h1>
            )}
            <div className="flex items-center gap-2">
                <button onClick={() => refreshData()} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200"><RotateCcw size={18}/></button>
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                    {currentUser.collaboratorName.charAt(0)}
                </div>
            </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
            {!selectedTaskId ? (
                // LIST VIEW
                <div className="space-y-3">
                    {myTasks.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <CheckCircle size={48} className="mx-auto mb-2 opacity-50"/>
                            <p className="text-sm font-medium">Không có nhiệm vụ nào!</p>
                        </div>
                    ) : (
                        myTasks.map(task => (
                            <div 
                                key={task.id} 
                                onClick={() => setSelectedTaskId(task.id)}
                                className={`bg-white p-4 rounded-xl border-l-4 shadow-sm active:scale-95 transition-all cursor-pointer
                                    ${task.status === 'In Progress' ? 'border-l-blue-500 ring-1 ring-blue-100' : 'border-l-slate-300'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-2xl font-black text-slate-800">{task.room_code}</div>
                                        <div className="text-xs text-slate-500">{task.facilityName}</div>
                                    </div>
                                    {task.priority === 'High' && <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase">Gấp</span>}
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border
                                        ${task.task_type === 'Checkout' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                          task.task_type === 'Stayover' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                          'bg-amber-50 text-amber-600 border-amber-100'}
                                    `}>
                                        {task.task_type}
                                    </span>
                                    {task.status === 'In Progress' && <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Clock size={10}/> Đang làm</span>}
                                </div>
                                {task.note && <div className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded">{task.note}</div>}
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // DETAIL VIEW
                activeTask && (
                    <div className="space-y-6">
                        {/* TASK HEADER */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-3xl font-black text-slate-800">{activeTask.room_code}</div>
                                    <div className="text-sm font-medium text-slate-500">{activeTask.facilityName}</div>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase border
                                    ${activeTask.task_type === 'Checkout' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'}
                                `}>
                                    {activeTask.task_type}
                                </div>
                            </div>
                            
                            {activeTask.status === 'Pending' ? (
                                <button 
                                    onClick={handleStartTask}
                                    className="w-full mt-4 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-lg shadow-brand-200 active:scale-95 transition-transform"
                                >
                                    Bắt đầu dọn
                                </button>
                            ) : (
                                <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-xl text-center font-bold text-sm border border-blue-100">
                                    Đang thực hiện...
                                </div>
                            )}
                        </div>

                        {/* ITEMS TO COLLECT / CHECK */}
                        {activeTask.status === 'In Progress' && (
                            <div className="space-y-4">
                                <div className="bg-white p-4 rounded-xl border border-slate-200">
                                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                        <LogOut size={16} className="text-rose-500"/> 
                                        {activeTask.task_type === 'Checkout' ? 'Thu hồi & Kiểm tra' : 'Kiểm tra đồ'}
                                    </h3>
                                    <div className="space-y-2">
                                        {checkoutReturnList.length === 0 ? (
                                            <div className="text-xs text-slate-400 italic text-center py-2">Không có đồ cần thu hồi đặc biệt</div>
                                        ) : (
                                            checkoutReturnList.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        {item.isExtra && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold">Mượn thêm</span>}
                                                        <span className="font-black text-slate-800">x{item.qty}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-slate-200">
                                    <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                                        <BedDouble size={16} className="text-emerald-500"/> 
                                        Setup mới (Restock)
                                    </h3>
                                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {recipeItems.filter(i => i.category !== 'Asset').map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 border-b border-slate-50 last:border-0">
                                                <span className="text-sm text-slate-600">{item.name}</span>
                                                <span className="font-bold text-emerald-600">x{item.requiredQty}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={handleCompleteTask}
                                    className="w-full py-4 bg-green-600 text-white rounded-xl font-black shadow-xl shadow-green-200 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                                >
                                    <CheckCircle size={20}/> Hoàn thành & Báo sạch
                                </button>
                            </div>
                        )}
                    </div>
                )
            )}
        </div>
    </div>
  );
};
