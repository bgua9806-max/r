
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { format, parseISO, differenceInMinutes, isValid } from 'date-fns';
import { 
  Brush, CheckCircle, Calculator, Copy, User, Filter, 
  CheckSquare, Square, LogOut, BedDouble, AlertCircle, X, Zap, RotateCcw, BarChart3, Clock, RefreshCw, AlertTriangle, Flame, Star, HelpCircle, ThumbsUp, ThumbsDown, Calendar, Trophy, Medal, Award
} from 'lucide-react';
import { Modal } from '../components/Modal';
import { HousekeepingTask } from '../types';

// Trọng số công việc để tính lương/điểm
const WORKLOAD_POINTS = {
    Checkout: 4, 
    Dirty: 2,   
    Stayover: 1,
    Vacant: 0
};

type ExtendedTask = HousekeepingTask & { 
    facilityName: string, 
    availableStaff: string[],
    isInquiry?: boolean // New flag for Stayover Inquiry
};

type PerformanceData = { 
    name: string;
    points: number; 
    tasks: number; 
    checkout: number;
    stayover: number;
    other: number;
};

export const Housekeeping: React.FC = () => {
  const { 
    facilities, rooms, bookings, housekeepingTasks, 
    syncHousekeepingTasks, updateFacility, collaborators, 
    notify, refreshData, upsertRoom, isLoading, currentUser 
  } = useAppContext();
  
  const getTodayStr = () => format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Done'>('All');
  const [filterType, setFilterType] = useState<'All' | 'Checkout' | 'Stayover' | 'Dirty'>('All');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  
  const [showStats, setShowStats] = useState(false);
  const [statsTimeFilter, setStatsTimeFilter] = useState<'today' | 'month'>('today');
  const [selectedStatsMonth, setSelectedStatsMonth] = useState(format(new Date(), 'yyyy-MM'));

  // Tự động làm mới dữ liệu khi vào trang để đảm bảo đồng bộ
  useEffect(() => {
      refreshData(true);
  }, []);

  const housekeepingStaffNames = useMemo(() => {
      return collaborators
          .filter(c => c.role === 'Buồng phòng')
          .map(c => c.collaboratorName);
  }, [collaborators]);

  const displayTasks = useMemo(() => {
    const taskList: ExtendedTask[] = [];
    const todayStr = getTodayStr();
    const isViewingToday = selectedDate === todayStr;
    const now = new Date();

    // 0. ANTI-GHOST MAP: Lưu vết các phòng vừa dọn xong
    // Key: facility_id_room_code -> Value: Timestamp of completion
    const recentCompletedMap = new Map<string, number>();
    housekeepingTasks.forEach(t => {
        if (t.status === 'Done') {
            const key = `${t.facility_id}_${t.room_code}`;
            const time = t.completed_at && isValid(parseISO(t.completed_at)) ? parseISO(t.completed_at).getTime() : parseISO(t.created_at).getTime();
            const current = recentCompletedMap.get(key) || 0;
            if (time > current) recentCompletedMap.set(key, time);
        }
    });

    // 1. Map actual tasks from DB
    const existingTasksMap = new Map<string, HousekeepingTask>();
    const sortedTasks = [...housekeepingTasks].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedTasks.forEach(t => {
        const created = parseISO(t.created_at);
        if (!isValid(created)) return;

        const key = `${t.facility_id}_${t.room_code}`;
        const taskDateStr = format(created, 'yyyy-MM-dd');
        const isDateMatch = taskDateStr === selectedDate;
        const isBacklog = isViewingToday && t.status !== 'Done' && taskDateStr < selectedDate;

        if (isDateMatch || isBacklog) {
            // ANTI-GHOST: Bỏ qua task tự động nếu phòng vừa được dọn xong < 2 giờ
            const isAutoTask = (t.note || '').includes('tự động'); 
            if (t.status === 'Pending' && isAutoTask) {
                const lastDoneTime = recentCompletedMap.get(key);
                if (lastDoneTime && differenceInMinutes(now, new Date(lastDoneTime)) < 120) {
                    return; // SKIP GHOST TASK
                }
            }
            existingTasksMap.set(key, t);
        }
    });

    // 2. Iterate Rooms to match tasks or create Virtual ones
    rooms.forEach((r) => {
      const f = facilities.find(fac => fac.id === r.facility_id);
      if (!f) return;

      const uniqueKey = `${f.id}_${r.name}`;
      const existingTask = existingTasksMap.get(uniqueKey);

      let validFacilityStaff = housekeepingStaffNames;
      if (f.staff && f.staff.length > 0) {
          validFacilityStaff = f.staff.filter(name => housekeepingStaffNames.includes(name));
          if (validFacilityStaff.length === 0) validFacilityStaff = housekeepingStaffNames;
      }

      // --- STAYOVER INQUIRY LOGIC ---
      let inquiryTask: ExtendedTask | null = null;
      if (isViewingToday && !existingTask && r.status !== 'Sửa chữa' && r.status !== 'Bẩn' && r.status !== 'Đang dọn') {
           const activeBooking = bookings.find(b => {
               return b.facilityName === f.facilityName && b.roomCode === r.name && b.status === 'CheckedIn';
           });

           if (activeBooking) {
               const checkInDate = parseISO(activeBooking.checkinDate);
               const checkoutDate = parseISO(activeBooking.checkoutDate);
               
               if (isValid(checkInDate) && isValid(checkoutDate)) {
                   const isStayover = format(checkInDate, 'yyyy-MM-dd') < todayStr && format(checkoutDate, 'yyyy-MM-dd') > todayStr;

                   if (isStayover) {
                       inquiryTask = {
                           id: `INQUIRY_${uniqueKey}`,
                           facility_id: f.id,
                           room_code: r.name,
                           task_type: 'Stayover',
                           status: 'Pending',
                           assignee: null,
                           priority: 'Normal',
                           created_at: new Date().toISOString(),
                           note: 'Khách đang ở - Cần hỏi dọn phòng?',
                           facilityName: f.facilityName,
                           availableStaff: validFacilityStaff,
                           points: 1,
                           isInquiry: true
                       } as ExtendedTask;
                   }
               }
           }
      }

      // --- DISPLAY LOGIC ---
      if (existingTask) {
          const isRefusal = existingTask.status === 'Done' && existingTask.note === 'Khách từ chối dọn phòng';
          if (!isRefusal) {
              taskList.push({
                  ...existingTask,
                  facilityName: f.facilityName,
                  availableStaff: validFacilityStaff
              });
          }
      }
      else if (inquiryTask) {
          taskList.push(inquiryTask);
      }
      else if (isViewingToday && (r.status === 'Bẩn' || r.status === 'Đang dọn')) {
          // Case 3: Virtual Task (Auto Generate)
          // ANTI-GHOST LOGIC: Kiểm tra lần nữa trước khi tạo task ảo
          let shouldCreate = true;
          if (r.status === 'Bẩn') {
              const lastDoneTime = recentCompletedMap.get(uniqueKey);
              if (lastDoneTime && differenceInMinutes(now, new Date(lastDoneTime)) < 120) {
                  shouldCreate = false;
              }
          }

          if (shouldCreate) {
              taskList.push({
                  id: `VIRTUAL_${uniqueKey}_${Date.now()}`,
                  facility_id: f.id,
                  room_code: r.name,
                  task_type: 'Dirty',
                  status: r.status === 'Đang dọn' ? 'In Progress' : 'Pending',
                  assignee: null,
                  priority: 'High',
                  created_at: new Date().toISOString(),
                  note: 'Phòng báo Bẩn (Tự động đồng bộ)',
                  facilityName: f.facilityName,
                  availableStaff: validFacilityStaff,
                  points: 2
              });
          }
      }
      else {
          // Case 4: Future Forecast
          const activeBooking = bookings.find(b => {
              if (b.facilityName !== f.facilityName || b.roomCode !== r.name) return false;
              if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
              const checkin = parseISO(b.checkinDate);
              const checkout = parseISO(b.checkoutDate);
              if (!isValid(checkin) || !isValid(checkout)) return false;
              const checkinStr = format(checkin, 'yyyy-MM-dd');
              const checkoutStr = format(checkout, 'yyyy-MM-dd');
              return (selectedDate >= checkinStr && selectedDate <= checkoutStr);
          });

          if (activeBooking) {
              const checkoutDate = parseISO(activeBooking.checkoutDate);
              if (isValid(checkoutDate)) {
                  const checkoutDay = format(checkoutDate, 'yyyy-MM-dd');
                  let type: HousekeepingTask['task_type'] = 'Stayover';
                  let note = 'Dọn phòng khách đang ở';
                  
                  if (checkoutDay === selectedDate) {
                      type = 'Checkout';
                      note = `Khách sẽ trả phòng lúc ${format(checkoutDate, 'HH:mm')}`;
                  }

                  if (r.status !== 'Sửa chữa') {
                      taskList.push({
                          id: `PREDICT_${uniqueKey}`,
                          facility_id: f.id,
                          room_code: r.name,
                          task_type: type,
                          status: 'Pending',
                          assignee: null,
                          priority: type === 'Checkout' ? 'High' : 'Normal',
                          created_at: new Date().toISOString(),
                          note: note,
                          facilityName: f.facilityName,
                          availableStaff: validFacilityStaff,
                          points: WORKLOAD_POINTS[type]
                      });
                  }
              }
          }
      }
    });

    return taskList.sort((a, b) => {
       if (a.isInquiry && !b.isInquiry) return -1;
       if (!a.isInquiry && b.isInquiry) return 1;
       const sOrder = { 'In Progress': 0, 'Pending': 1, 'Done': 2 };
       if (sOrder[a.status] !== sOrder[b.status]) return (sOrder[a.status] ?? 3) - (sOrder[b.status] ?? 3);
       const priMap = { 'High': 0, 'Normal': 1, 'Low': 2 };
       const priA = priMap[a.priority] ?? 1;
       const priB = priMap[b.priority] ?? 1;
       if (priA !== priB) return priA - priB;
       const pOrder = { 'Checkout': 0, 'Dirty': 1, 'Stayover': 2, 'Vacant': 3 };
       return (pOrder[a.task_type] ?? 4) - (pOrder[b.task_type] ?? 4);
    });
  }, [facilities, rooms, bookings, selectedDate, housekeepingTasks, housekeepingStaffNames]);

  const workload = useMemo(() => {
      const stats: Record<string, PerformanceData> = {};
      const staffList = collaborators.filter(c => c.role === 'Buồng phòng').map(c => c.collaboratorName);
      
      // Initialize
      staffList.forEach(name => {
          stats[name] = { name, points: 0, tasks: 0, checkout: 0, stayover: 0, other: 0 };
      });

      const todayStr = format(new Date(), 'yyyy-MM-dd');

      housekeepingTasks.forEach(t => {
          if (t.status === 'Done' && t.assignee && stats[t.assignee]) {
              const dateStr = t.completed_at || t.created_at;
              if (!dateStr) return;
              const taskDate = parseISO(dateStr);
              if (!isValid(taskDate)) return;

              let isMatch = false;
              if (statsTimeFilter === 'today') {
                  isMatch = format(taskDate, 'yyyy-MM-dd') === todayStr;
              } else {
                  // Compare with the specific selected month
                  isMatch = format(taskDate, 'yyyy-MM') === selectedStatsMonth;
              }

              if (isMatch) {
                  const points = t.points || WORKLOAD_POINTS[t.task_type] || 0;
                  stats[t.assignee].points += points;
                  stats[t.assignee].tasks += 1;
                  
                  if (t.task_type === 'Checkout') stats[t.assignee].checkout += 1;
                  else if (t.task_type === 'Stayover') stats[t.assignee].stayover += 1;
                  else stats[t.assignee].other += 1;
              }
          }
      });

      const sortedStats = Object.values(stats).sort((a, b) => b.points - a.points);
      const maxPoints = sortedStats.length > 0 ? sortedStats[0].points : 1;

      return { sortedStats, maxPoints };
  }, [collaborators, housekeepingTasks, statsTimeFilter, selectedStatsMonth]);

  const filteredTasks = useMemo(() => {
     return displayTasks.filter(t => {
        if (filterStatus !== 'All' && t.status !== filterStatus) return false;
        if (filterType !== 'All') {
            if (filterType === 'Dirty') return t.task_type === 'Dirty'; 
            return t.task_type === filterType;
        }
        return true;
     });
  }, [displayTasks, filterStatus, filterType]);

  const handleTaskUpdate = async (task: typeof displayTasks[0], updates: Partial<HousekeepingTask>) => {
      const relatedTasks = housekeepingTasks.filter(t => 
          t.facility_id === task.facility_id && 
          t.room_code === task.room_code &&
          t.status !== 'Done' && 
          t.id !== task.id
      );

      const cleanupUpdates: HousekeepingTask[] = relatedTasks.map(t => ({
          ...t,
          status: 'Done',
          note: (t.note || '') + ' (Auto-closed by system cleanup)'
      }));

      const taskToSave: HousekeepingTask = {
          id: (task.id.startsWith('VIRTUAL_') || task.id.startsWith('PREDICT_')) ? crypto.randomUUID() : task.id,
          facility_id: task.facility_id,
          room_code: task.room_code,
          task_type: task.task_type,
          status: updates.status || task.status,
          assignee: updates.assignee !== undefined ? updates.assignee : task.assignee,
          priority: updates.priority || task.priority,
          created_at: task.id.startsWith('VIRTUAL_') ? new Date().toISOString() : task.created_at,
          completed_at: updates.status === 'Done' ? new Date().toISOString() : task.completed_at,
          note: task.note,
          points: WORKLOAD_POINTS[task.task_type]
      };

      if (updates.assignee && taskToSave.status === 'Pending') {
          taskToSave.status = 'In Progress';
      }

      // 1. UPDATE TASKS
      const allUpdates = [taskToSave, ...cleanupUpdates];
      const promises: Promise<any>[] = [syncHousekeepingTasks(allUpdates)];

      // 2. DUAL-WRITE: UPDATE ROOM
      const roomObj = rooms.find(r => r.facility_id === task.facility_id && r.name === task.room_code);
      if (roomObj) {
         let newRoomStatus = roomObj.status;
         
         if (taskToSave.status === 'Done') {
             // Admin manually marked done -> Room is Clean
             newRoomStatus = 'Đã dọn';
         } else if (taskToSave.status === 'In Progress') {
             newRoomStatus = 'Đang dọn';
         } else if (taskToSave.status === 'Pending' && roomObj.status === 'Đã dọn') {
             newRoomStatus = 'Bẩn'; 
         }
         
         if (newRoomStatus !== roomObj.status) {
            promises.push(upsertRoom({ ...roomObj, status: newRoomStatus }));
         }
      }
      
      await Promise.all(promises);
      notify('success', 'Đã cập nhật nhiệm vụ.');
  };

  const handleStayoverResponse = async (task: ExtendedTask, isConfirmed: boolean) => {
      if (isConfirmed) {
          const realTask: HousekeepingTask = {
              id: crypto.randomUUID(),
              facility_id: task.facility_id,
              room_code: task.room_code,
              task_type: 'Stayover',
              status: 'Pending',
              priority: 'Normal',
              created_at: new Date().toISOString(),
              note: 'Khách yêu cầu dọn (Stayover)',
              points: 1,
              assignee: null
          };
          await syncHousekeepingTasks([realTask]);
          notify('success', `Đã tạo yêu cầu dọn phòng ${task.room_code}`);
      } else {
          const realTask: HousekeepingTask = {
              id: crypto.randomUUID(),
              facility_id: task.facility_id,
              room_code: task.room_code,
              task_type: 'Stayover',
              status: 'Done', 
              priority: 'Low',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              note: 'Khách từ chối dọn phòng',
              points: 0, 
              assignee: currentUser?.collaboratorName || 'System'
          };
          await syncHousekeepingTasks([realTask]);
          notify('info', `Đã ghi nhận khách từ chối dọn phòng ${task.room_code}`);
      }
  };

  const handleBulkAction = async (action: 'Assign' | 'Status', value: string) => {
      if (selectedTaskIds.length === 0) return;
      
      const tasksToUpdate = displayTasks.filter(t => selectedTaskIds.includes(t.id));
      const updates: HousekeepingTask[] = [];
      const roomUpdates: Promise<any>[] = [];

      for (const task of tasksToUpdate) {
          const isVirtual = task.id.startsWith('VIRTUAL_') || task.id.startsWith('PREDICT_') || task.id.startsWith('INQUIRY_');
          
          const realTask: HousekeepingTask = {
              id: isVirtual ? crypto.randomUUID() : task.id,
              facility_id: task.facility_id,
              room_code: task.room_code,
              task_type: task.task_type,
              status: action === 'Status' ? (value as any) : task.status,
              assignee: action === 'Assign' ? value : task.assignee,
              priority: task.priority,
              created_at: isVirtual ? new Date().toISOString() : task.created_at,
              completed_at: action === 'Status' && value === 'Done' ? new Date().toISOString() : task.completed_at,
              note: task.note,
              points: task.points
          };
          updates.push(realTask);

          // DUAL-WRITE: If bulk marking as Done, update rooms to Clean
          if (action === 'Status' && value === 'Done') {
              const room = rooms.find(r => r.facility_id === task.facility_id && r.name === task.room_code);
              if (room && room.status !== 'Đã dọn') {
                  roomUpdates.push(upsertRoom({ ...room, status: 'Đã dọn' }));
              }
          }
      }

      await Promise.all([
          syncHousekeepingTasks(updates),
          ...roomUpdates
      ]);

      setSelectedTaskIds([]);
      notify('success', `Đã cập nhật ${updates.length} nhiệm vụ.`);
  };

  const getCardStyle = (type: string, status: string, isInquiry?: boolean) => {
      if (isInquiry) return 'bg-sky-50 border-sky-200';
      if (status === 'Done') return 'bg-slate-50 border-slate-200 opacity-60';
      if (status === 'In Progress') return 'bg-white border-brand-500 shadow-md ring-1 ring-brand-100';
      
      switch (type) {
          case 'Checkout': return 'bg-red-50 border-red-100';
          case 'Dirty': return 'bg-yellow-50 border-yellow-100';
          case 'Stayover': return 'bg-blue-50 border-blue-100';
          default: return 'bg-white border-slate-200';
      }
  };
  
  return (
    <div className="space-y-6 animate-enter h-[calc(100vh-100px)] flex flex-col">
      {/* TOOLBAR - MOBILE OPTIMIZED (COMPACT HORIZONTAL SCROLL) */}
      <div className="md:hidden bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0 mb-2">
          {/* Row 1: Header & Tools */}
          <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-lg shrink-0"><Brush size={18} /></div>
                  <div>
                      <h1 className="text-sm font-bold text-slate-800 leading-tight">Điều phối BP</h1>
                      <div className="flex items-center gap-1 mt-0.5">
                          <Calendar size={10} className="text-slate-400"/>
                          <input type="date" className="text-xs font-medium text-slate-500 bg-transparent outline-none p-0 w-[85px]" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                      </div>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <button onClick={() => refreshData()} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors" title="Reload"><RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /></button>
                  <button onClick={() => setShowStats(true)} className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" title="Thống kê"><Trophy size={18} /></button>
              </div>
          </div>

          {/* Row 2: Scrollable Actions/Filters OR Bulk Actions */}
          {selectedTaskIds.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 animate-in slide-in-from-right-5 fade-in">
                  <span className="shrink-0 text-[10px] font-black text-brand-600 bg-brand-50 px-2 py-1.5 rounded-lg border border-brand-100">{selectedTaskIds.length} chọn</span>
                  <select className="shrink-0 text-xs border border-brand-200 rounded-lg px-2 py-1.5 outline-none bg-white min-w-[100px]" onChange={(e) => handleBulkAction('Assign', e.target.value)} value="">
                      <option value="" disabled>-- Giao --</option>
                      {workload.sortedStats.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                      <option value="">(Hủy)</option>
                  </select>
                  <button onClick={() => handleBulkAction('Status', 'Done')} className="shrink-0 px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm">Xong</button>
                  <button onClick={() => setSelectedTaskIds([])} className="shrink-0 p-1.5 text-slate-400 bg-slate-50 rounded-lg"><X size={16}/></button>
              </div>
          ) : (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  <div className="w-[1px] h-5 bg-slate-200 flex-shrink-0 mx-1"></div>
                  {(['All', 'Checkout', 'Stayover', 'Dirty'] as const).map(t => (
                      <button key={t} onClick={() => setFilterType(t)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${filterType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                          {t === 'All' ? 'Tất cả' : t}
                      </button>
                  ))}
              </div>
          )}
      </div>

      {/* DESKTOP TOOLBAR */}
      <div className="hidden md:block bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Brush size={24} /></div>
               <div>
                  <h1 className="text-xl font-bold text-slate-800">Điều phối Buồng phòng</h1>
                  <input type="date" className="text-sm font-medium text-slate-500 bg-transparent outline-none cursor-pointer" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
               </div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={() => refreshData()} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100" title="Đồng bộ lại DB"><RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} /></button>
               <button onClick={() => setShowStats(true)} className="p-2.5 text-amber-600 hover:bg-amber-50 rounded-lg border border-amber-200" title="Bảng xếp hạng"><Trophy size={20} /></button>
            </div>
         </div>
         <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-slate-400 uppercase mr-1 flex items-center gap-1"><Filter size={12}/> Lọc:</span>
               {(['All', 'Checkout', 'Stayover', 'Dirty'] as const).map(t => (
                  <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${filterType === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>{t === 'All' ? 'Tất cả' : t}</button>
               ))}
            </div>

            {/* ADDED: Bulk Actions for Desktop */}
            {selectedTaskIds.length > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                    <span className="text-xs font-black text-brand-600 bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-100">{selectedTaskIds.length} đã chọn</span>
                    
                    <div className="flex items-center border border-slate-200 rounded-lg p-1 gap-1">
                        <select 
                            className="text-xs font-bold text-slate-600 bg-transparent outline-none px-2 py-1 cursor-pointer hover:text-brand-600"
                            onChange={(e) => handleBulkAction('Assign', e.target.value)} 
                            value=""
                        >
                            <option value="" disabled>-- Phân công --</option>
                            {workload.sortedStats.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            <option value="">(Hủy phân công)</option>
                        </select>
                    </div>

                    <button 
                        onClick={() => handleBulkAction('Status', 'Done')} 
                        className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                    >
                        <CheckCircle size={14}/> Xong
                    </button>
                    
                    <button 
                        onClick={() => setSelectedTaskIds([])} 
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Hủy chọn"
                    >
                        <X size={16}/>
                    </button>
                </div>
            )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
         {Object.entries(filteredTasks.reduce((acc, t) => {
             acc[t.facilityName] = acc[t.facilityName] || [];
             acc[t.facilityName].push(t);
             return acc;
         }, {} as Record<string, ExtendedTask[]>)).map(([facName, tasks]: [string, ExtendedTask[]]) => (
            <div key={facName} className="mb-6">
               <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm sticky top-0 bg-[#f8fafc] py-2 z-10">
                  <div className="w-1 h-4 bg-brand-500 rounded-full"></div> {facName} <span className="text-slate-400 font-normal text-xs">({tasks.length})</span>
               </h3>
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {tasks.map(task => {
                     const isSelected = selectedTaskIds.includes(task.id);
                     const isVirtual = task.id.startsWith('VIRTUAL_');
                     return (
                        <div key={task.id} onClick={() => !task.isInquiry && setSelectedTaskIds(prev => prev.includes(task.id) ? prev.filter(i => i !== task.id) : [...prev, task.id])}
                           className={`relative p-3 rounded-xl border-2 transition-all cursor-pointer select-none group flex flex-col justify-between min-h-[120px] ${getCardStyle(task.task_type, task.status, task.isInquiry)} ${isSelected ? 'ring-2 ring-brand-500 ring-offset-2 border-brand-500 z-10' : 'hover:-translate-y-1 hover:shadow-md'}`}
                        >
                           {!task.isInquiry && (
                               <div className="absolute top-2 right-2 flex items-center gap-1">
                                  {isSelected ? <CheckSquare size={18} className="text-brand-600 fill-brand-100"/> : <div className="w-4 h-4 rounded border border-slate-300 group-hover:border-brand-400 bg-white/50"></div>}
                               </div>
                           )}
                           
                           {task.priority === 'High' && task.status !== 'Done' && !task.isInquiry && (
                                <span className="absolute -top-2 -left-2 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-lg z-20 shadow-md flex items-center gap-1 animate-pulse border border-white">
                                    <Flame size={10} fill="currentColor" /> GẤP
                                </span>
                           )}

                           {/* Task Info */}
                           <div>
                              <div className="flex items-center gap-2 mb-1 mt-1">
                                  <span className={`text-xl font-bold ${task.isInquiry ? 'text-sky-700' : 'text-slate-800'}`}>{task.room_code}</span>
                                  {isVirtual && <span title="Đồng bộ tự động từ trạng thái phòng" className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>}
                                  {task.isInquiry && <span title="Cần hỏi ý kiến khách" className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>}
                              </div>
                              <div className="flex items-center gap-1.5 mb-1">
                                 {task.task_type === 'Checkout' && <LogOut size={14} className="text-red-500"/>}
                                 {task.task_type === 'Stayover' && <BedDouble size={14} className="text-blue-500"/>}
                                 {task.task_type === 'Dirty' && <AlertCircle size={14} className="text-yellow-500"/>}
                                 <span className={`text-xs font-bold uppercase ${task.task_type === 'Checkout' ? 'text-red-600' : task.isInquiry ? 'text-sky-600' : 'text-blue-600'}`}>
                                     {task.isInquiry ? 'Khách ở' : task.task_type}
                                 </span>
                              </div>
                              {task.note && <p className="text-[10px] text-slate-500 line-clamp-1 italic">{task.note}</p>}
                              {task.status === 'In Progress' && <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-bold animate-pulse"><Clock size={10}/> Đang dọn...</div>}
                           </div>

                           {/* ACTION AREA */}
                           {task.isInquiry ? (
                               <div className="mt-2 pt-2 border-t border-sky-200 flex items-center justify-between gap-2">
                                   <button onClick={(e) => { e.stopPropagation(); handleStayoverResponse(task, false); }} className="flex-1 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1"><ThumbsDown size={12}/> Từ chối</button>
                                   <button onClick={(e) => { e.stopPropagation(); handleStayoverResponse(task, true); }} className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 shadow-sm"><ThumbsUp size={12}/> Cần dọn</button>
                               </div>
                           ) : (
                               <div className="mt-2 pt-2 border-t border-black/5 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1 max-w-[60%]">
                                     <User size={12} className="text-slate-400 shrink-0"/>
                                     <select className="bg-transparent text-xs font-medium text-slate-700 outline-none w-full truncate cursor-pointer hover:text-brand-600" value={task.assignee || ''} onChange={(e) => handleTaskUpdate(task, { assignee: e.target.value })}>
                                        <option value="">--</option>
                                        {task.availableStaff.map(s => <option key={s} value={s}>{s}</option>)}
                                     </select>
                                  </div>
                                  <button onClick={() => handleTaskUpdate(task, { status: task.status === 'Done' ? 'Pending' : 'Done' })} className={`p-1.5 rounded-full transition-colors ${task.status === 'Done' ? 'text-green-600 bg-green-100' : 'text-slate-300 hover:text-brand-600 hover:bg-brand-50'}`}><CheckCircle size={16} fill={task.status === 'Done' ? 'currentColor' : 'none'} /></button>
                               </div>
                           )}
                        </div>
                     );
                  })}
               </div>
            </div>
         ))}
      </div>
      
      {/* Modal Performance Leaderboard */}
      <Modal isOpen={showStats} onClose={() => setShowStats(false)} title={`Bảng Xếp Hạng Năng Suất`} size="lg">
         <div className="space-y-6">
            <div className="flex justify-center items-center bg-slate-100 p-1.5 rounded-xl w-fit mx-auto mb-6 gap-2">
                <button 
                    onClick={() => setStatsTimeFilter('today')} 
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${statsTimeFilter === 'today' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Hôm nay
                </button>
                <div className={`flex items-center px-3 py-2 rounded-lg transition-all ${statsTimeFilter === 'month' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <button 
                        onClick={() => setStatsTimeFilter('month')}
                        className="text-sm font-bold mr-2"
                    >
                        Tháng
                    </button>
                    <input 
                        type="month" 
                        className="bg-transparent text-sm font-bold outline-none border-none p-0 w-[110px] cursor-pointer"
                        value={selectedStatsMonth}
                        onChange={(e) => {
                            setSelectedStatsMonth(e.target.value);
                            setStatsTimeFilter('month');
                        }}
                    />
                </div>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 font-bold text-slate-500 text-xs uppercase">
                        <tr>
                            <th className="p-3 text-center w-12">#</th>
                            <th className="p-3">Nhân viên</th>
                            <th className="p-3 text-center text-red-600 bg-red-50/50">Checkout (4đ)</th>
                            <th className="p-3 text-center">Stayover (1đ)</th>
                            <th className="p-3 text-center">Khác (2đ)</th>
                            <th className="p-3 text-right">Tổng Điểm KPI</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {workload.sortedStats.map((data, index) => {
                            let rankIcon = <span className="font-bold text-slate-400">{index + 1}</span>;
                            if (index === 0) rankIcon = <span className="text-xl">🥇</span>;
                            if (index === 1) rankIcon = <span className="text-xl">🥈</span>;
                            if (index === 2) rankIcon = <span className="text-xl">🥉</span>;

                            const percent = Math.round((data.points / workload.maxPoints) * 100);

                            return (
                                <tr key={data.name} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-3 text-center">{rankIcon}</td>
                                    <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs border border-brand-200">
                                            {data.name.charAt(0)}
                                        </div>
                                        {data.name}
                                    </td>
                                    <td className="p-3 text-center font-bold text-red-600 bg-red-50/20 text-lg">{data.checkout}</td>
                                    <td className="p-3 text-center text-slate-600">{data.stayover}</td>
                                    <td className="p-3 text-center text-slate-400">{data.other}</td>
                                    <td className="p-3 text-right">
                                        <div className="font-black text-brand-700 text-lg">{data.points}</div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full mt-1 overflow-hidden ml-auto max-w-[80px]">
                                            <div className="h-full bg-brand-500" style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {workload.sortedStats.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">Chưa có dữ liệu cho thời gian này.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
         </div>
      </Modal>
    </div>
  );
};
