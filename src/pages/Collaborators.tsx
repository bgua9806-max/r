import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Collaborator, ShiftSchedule, AttendanceAdjustment, LeaveRequest, TimeLog } from '../types';
import { CollaboratorModal } from '../components/CollaboratorModal';
import { 
  Pencil, Trash2, Plus, Search, ClipboardList,
  ChevronLeft, ChevronRight, Calendar, Edit2, FileDown, Wallet, DollarSign, Sun, Moon, 
  CheckCircle, AlertCircle, Send, User, Cake, HeartPulse, ShieldCheck, CalendarDays, Palmtree, UserCheck, Loader2, X, Check, Clock, MapPin, ToggleLeft, ToggleRight, List
} from 'lucide-react';
import { HRTabs, HRTabType } from '../components/HRTabs';
import { ListFilter, FilterOption } from '../components/ListFilter';
import { ShiftScheduleModal } from '../components/ShiftScheduleModal';
import { AttendanceAdjustmentModal } from '../components/AttendanceAdjustmentModal';
import { format, addDays, isSameDay, isWithinInterval, parseISO, startOfWeek, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Modal } from '../components/Modal';

export const Collaborators: React.FC = () => {
  const { collaborators, deleteCollaborator, schedules, adjustments, notify, currentUser, leaveRequests, addLeaveRequest, updateLeaveRequest, triggerWebhook, timeLogs } = useAppContext();
  const [activeTab, setActiveTab] = useState<HRTabType>('overview'); // Default is Overview
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedMonthStr = format(currentDate, 'yyyy-MM');

  // NEW: View Mode for Timesheet (Schedule vs GPS)
  const [timesheetMode, setTimesheetMode] = useState<'schedule' | 'realtime'>('schedule');

  // NEW: Mobile specific state for Shift Agenda
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date());

  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Collaborator | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<Date>(new Date());
  const [activeSchedule, setActiveSchedule] = useState<ShiftSchedule | null>(null);

  const [isAdjModalOpen, setAdjModalOpen] = useState(false);
  const [selectedAdjStaff, setSelectedAdjStaff] = useState<Collaborator | null>(null);

  // Leave Request States
  const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveRequest>>({
      leave_type: 'Nghỉ phép năm',
      reason: '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date().toISOString().substring(0, 10)
  });
  
  // Loading state for approval actions
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  // Permission Check Helper - UPDATED: Include 'Buồng phòng'
  const isRestricted = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Buồng phòng';

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);

    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  // Effect to sync mobile selection when week changes
  useEffect(() => {
      const start = weekDays[0];
      const end = weekDays[6];
      // If currently selected mobile date is out of view, reset to first day of week
      if (!isWithinInterval(mobileSelectedDate, { start, end })) {
          setMobileSelectedDate(start);
      }
  }, [weekDays, mobileSelectedDate]);

  const timesheetData = useMemo(() => {
     // Use native Date to get start and end of month
     const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
     const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
     end.setHours(23, 59, 59, 999);
     
     return collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => {
        let standardDays = 0;
        let nightShifts = 0;
        let dayShifts = 0;
        let lateCount = 0;
        let totalLateMinutes = 0;

        if (timesheetMode === 'schedule') {
            // MODE 1: SCHEDULE BASED
            const monthlySchedules = schedules.filter(s => 
               s.staff_id === staff.id && 
               isWithinInterval(new Date(s.date), { start, end })
            );

            monthlySchedules.forEach(s => {
               if (s.shift_type === 'Sáng' || s.shift_type === 'Chiều' as any) {
                   standardDays += 1;
                   dayShifts += 1;
               } else if (s.shift_type === 'Tối') {
                   standardDays += 1.2; // Ca tối tính hệ số 1.2
                   nightShifts += 1;
               }
            });
        } else {
            // MODE 2: GPS REAL-TIME BASED
            const validLogs = timeLogs.filter(l => 
                l.staff_id === staff.id && 
                isSameMonth(parseISO(l.check_in_time), currentDate) &&
                (l.status === 'Valid' || l.status === 'Pending') // Count Pending as well for now
            );

            validLogs.forEach(log => {
                const checkIn = parseISO(log.check_in_time);
                const hour = checkIn.getHours();
                const minutes = checkIn.getMinutes();
                
                // Determine Shift based on Check-in Time
                // Morning: 05:00 - 14:00 (Start ~06:00)
                // Night: 14:00 - 23:00 (Start ~18:00)
                
                if (hour >= 14) {
                    // Night Shift
                    nightShifts += 1;
                    standardDays += 1.2;
                    
                    // Late Check: After 18:15
                    if (hour > 18 || (hour === 18 && minutes > 15)) {
                        lateCount++;
                        totalLateMinutes += ((hour - 18) * 60 + (minutes - 0)); // Approximate relative to 18:00
                    }
                } else {
                    // Morning Shift
                    dayShifts += 1;
                    standardDays += 1;

                    // Late Check: After 06:15
                    if (hour > 6 || (hour === 6 && minutes > 15)) {
                        lateCount++;
                        totalLateMinutes += ((hour - 6) * 60 + (minutes - 0)); // Approximate relative to 06:00
                    }
                }
            });
        }

        const adj = adjustments.find(a => a.staff_id === staff.id && a.month === selectedMonthStr);
        if (adj) {
            standardDays += Number(adj.standard_days_adj || 0);
        }

        const baseSalary = Number(staff.baseSalary) || 0;
        const dailyWage = baseSalary / 26; 
        const calculatedSalary = dailyWage * standardDays;

        return {
           staff,
           standardDays,
           dayShifts,
           nightShifts,
           lateCount,
           totalLateMinutes,
           calculatedSalary,
           adjustment: adj
        };
     });
  }, [collaborators, schedules, adjustments, currentDate, selectedMonthStr, timesheetMode, timeLogs]);

  const roleOptions: FilterOption[] = useMemo(() => {
    const counts = collaborators.reduce((acc, c) => {
      acc[c.role] = (acc[c.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { label: 'Tất cả', value: 'All', count: collaborators.length },
      { label: 'Admin', value: 'Admin', count: counts['Admin'] || 0 },
      { label: 'Quản lý', value: 'Quản lý', count: counts['Quản lý'] || 0 },
      { label: 'Lễ tân', value: 'Nhân viên', count: counts['Nhân viên'] || 0 },
      { label: 'Buồng phòng', value: 'Buồng phòng', count: counts['Buồng phòng'] || 0 },
    ];
  }, [collaborators]);

  const filteredCollaborators = useMemo(() => {
    return collaborators.filter(c => {
      const nameMatch = (c.collaboratorName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'All' || c.role === roleFilter;
      return nameMatch && matchesRole;
    });
  }, [collaborators, searchTerm, roleFilter]);

  const overviewStats = useMemo(() => {
      const totalStaff = collaborators.length;
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      
      const onLeaveToday = leaveRequests.filter(lr => 
          lr.status === 'Approved' && 
          todayStr >= lr.start_date && 
          todayStr <= lr.end_date
      );

      const pendingLeaves = leaveRequests.filter(lr => lr.status === 'Pending');
      const totalSalaryEstimate = timesheetData.reduce((acc, curr) => acc + curr.calculatedSalary, 0);

      // Get shifts for today
      const todayShifts = schedules.filter(s => s.date === todayStr);
      const morningStaff = collaborators.filter(c => todayShifts.some(s => s.staff_id === c.id && s.shift_type === 'Sáng'));
      const nightStaff = collaborators.filter(c => todayShifts.some(s => s.staff_id === c.id && s.shift_type === 'Tối'));

      return { totalStaff, onLeaveToday, pendingLeaves, totalSalaryEstimate, morningStaff, nightStaff };
  }, [collaborators, leaveRequests, timesheetData, schedules]);

  const handleEdit = (c: Collaborator) => {
    setEditingCollab(c);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingCollab(null);
    setModalOpen(true);
  };

  const openScheduleSlot = (staff: Collaborator, date: Date) => {
    const existing = schedules.find(s => s.staff_id === staff.id && s.date === format(date, 'yyyy-MM-dd'));
    setSelectedStaff(staff);
    setSelectedDateSlot(date);
    setActiveSchedule(existing || null);
    setScheduleModalOpen(true);
  };

  const openAdjustment = (staff: Collaborator) => {
      setSelectedAdjStaff(staff);
      setAdjModalOpen(true);
  };

  const submitLeaveRequest = async () => {
      if (!leaveForm.reason || !currentUser) {
          notify('error', 'Vui lòng nhập lý do nghỉ.');
          return;
      }
      
      const req: LeaveRequest = {
          id: `LR${Date.now()}`,
          staff_id: currentUser.id,
          staff_name: currentUser.collaboratorName,
          start_date: leaveForm.start_date!,
          end_date: leaveForm.end_date!,
          leave_type: leaveForm.leave_type as any,
          reason: leaveForm.reason,
          status: 'Pending',
          created_at: new Date().toISOString()
      };

      await addLeaveRequest(req);
      setLeaveModalOpen(false);
      setLeaveForm({ ...leaveForm, reason: '' }); // Reset partial
      notify('success', 'Đã gửi đơn xin nghỉ.');
      
      // 1. Send Zalo Specific (Legacy)
      triggerWebhook('leave_update', {
          event: 'new_request',
          staff: req.staff_name,
          type: req.leave_type,
          dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
          reason: req.reason,
          status: 'Chờ duyệt'
      });

      // 2. Send General Notification (New Feature)
      triggerWebhook('general_notification', {
          type: 'STAFF_LEAVE', // Label for n8n Switch
          payload: {
              staff_name: req.staff_name,
              reason: req.reason,
              dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
              status: 'PENDING'
          }
      });
  };

  const handleApproveLeave = async (req: LeaveRequest, isApproved: boolean) => {
      // SECURITY GUARD: Only Admin or Manager can approve
      if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Quản lý') {
          notify('error', 'Bạn không có quyền duyệt đơn này.');
          return;
      }

      // One-click action: No blocking confirm dialog
      setProcessingLeaveId(req.id);
      try {
          const status = isApproved ? 'Approved' : 'Rejected';
          // Optimistic update: Context will update UI immediately
          await updateLeaveRequest({ ...req, status });
          
          if (isApproved) {
              notify('success', `Đã duyệt đơn của ${req.staff_name}.`);
          } else {
              notify('info', `Đã từ chối đơn của ${req.staff_name}.`);
          }

          // 1. Legacy Zalo
          triggerWebhook('leave_update', {
              event: 'status_update',
              staff: req.staff_name,
              status: isApproved ? 'ĐÃ DUYỆT ✅' : 'ĐÃ TỪ CHỐI ❌',
              dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`,
              approver: currentUser?.collaboratorName || 'Admin'
          });

          // 2. General Notification (New Feature)
          // Also notifying on status change
          triggerWebhook('general_notification', {
              type: 'STAFF_LEAVE_UPDATE', 
              payload: {
                  staff_name: req.staff_name,
                  status: isApproved ? 'APPROVED' : 'REJECTED',
                  approver: currentUser?.collaboratorName
              }
          });
      } catch (err) {
          notify('error', 'Có lỗi khi cập nhật trạng thái.');
      } finally {
          setProcessingLeaveId(null);
      }
  };

  const getShiftColor = (type: string) => {
    switch(type) {
      case 'Sáng': return 'bg-amber-500 text-white shadow-amber-200';
      case 'Tối': return 'bg-indigo-700 text-white shadow-indigo-200';
      case 'OFF': return 'bg-slate-200 text-slate-500';
      default: return 'bg-slate-100 text-slate-400';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'Admin': return 'bg-rose-50 text-rose-600 border border-rose-100';
      case 'Quản lý': return 'bg-violet-50 text-violet-600 border border-violet-100';
      case 'Buồng phòng': return 'bg-blue-50 text-blue-600 border border-blue-100';
      default: return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    }
  };

  return (
    <div className="space-y-6 animate-enter pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Quản Lý Nhân Sự</h1>
          <p className="text-slate-500 text-sm mt-1">Hệ thống quản lý chấm công & nghỉ phép tập trung.</p>
        </div>
        
        {/* HIDE ADD BUTTON FOR STAFF */}
        {!isRestricted && activeTab === 'employees' && (
            <button 
            onClick={handleAdd} 
            className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-all shadow-md font-bold active:scale-95"
            >
            <Plus size={20} /> <span className="inline">Thêm nhân viên</span>
            </button>
        )}
      </div>

      <HRTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* --- TAB 1: OVERVIEW DASHBOARD --- */}
      {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              {/* TOP CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:border-blue-200 transition-all relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><User size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><User size={20}/></div>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">Total</span>
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.totalStaff}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Tổng nhân sự</div>
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:border-rose-200 transition-all relative overflow-hidden group">
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><HeartPulse size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><HeartPulse size={20}/></div>
                          {overviewStats.onLeaveToday.length > 0 && <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span></span>}
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.onLeaveToday.length}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Nghỉ hôm nay</div>
                      </div>
                  </div>

                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-32 cursor-pointer hover:border-amber-200 hover:shadow-md transition-all relative overflow-hidden group" onClick={() => setActiveTab('leave')}>
                      <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><ShieldCheck size={64}/></div>
                      <div className="flex justify-between items-start relative z-10">
                          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><ShieldCheck size={20}/></div>
                          {overviewStats.pendingLeaves.length > 0 && (
                              <span className="text-xs font-black bg-red-500 text-white px-2 py-0.5 rounded-full shadow-md animate-bounce">
                                  {overviewStats.pendingLeaves.length}
                              </span>
                          )}
                      </div>
                      <div className="relative z-10">
                          <div className="text-3xl font-black text-slate-800">{overviewStats.pendingLeaves.length}</div>
                          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">Đơn chờ duyệt <ChevronRight size={12}/></div>
                      </div>
                  </div>

                  {/* Hide Financial Card for Staff */}
                  {!isRestricted && (
                      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl shadow-lg flex flex-col justify-between h-32 text-white relative overflow-hidden">
                          <div className="absolute right-0 top-0 p-4 opacity-10"><Wallet size={64}/></div>
                          <div className="flex justify-between items-start relative z-10">
                              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm"><Wallet size={20}/></div>
                          </div>
                          <div className="relative z-10">
                              <div className="text-2xl font-black">{overviewStats.totalSalaryEstimate.toLocaleString()} ₫</div>
                              <div className="text-xs text-emerald-100 font-bold uppercase tracking-wider mt-1">Lương dự tính T{format(currentDate, 'MM')}</div>
                          </div>
                      </div>
                  )}
              </div>

              {/* MAIN CONTENT GRID (3 COLUMNS) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* COL 1: SHIFT MONITOR (Operations) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <Clock size={18} className="text-brand-600"/> Ca Trực Hôm Nay
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                              {format(new Date(), 'EEEE, dd/MM', {locale: vi})}
                          </span>
                      </div>
                      
                      <div className="space-y-4 flex-1">
                          {/* Ca Sáng */}
                          <div className="relative">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Sun size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Sáng</div>
                                      <div className="text-[10px] text-slate-400 font-medium">06:00 - 18:00</div>
                                  </div>
                              </div>
                              <div className="bg-amber-50/30 rounded-xl p-3 border border-amber-100 space-y-2 min-h-[80px]">
                                  {overviewStats.morningStaff.length > 0 ? (
                                      overviewStats.morningStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-amber-50/50 shadow-sm">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: s.color}}>{s.collaboratorName.charAt(0)}</div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>
                                  )}
                              </div>
                          </div>

                          {/* Ca Tối */}
                          <div className="relative pt-2">
                              <div className="absolute left-4 top-[-10px] bottom-full w-[2px] bg-slate-100 -z-10"></div>
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><Moon size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Tối</div>
                                      <div className="text-[10px] text-slate-400 font-medium">18:00 - 06:00</div>
                                  </div>
                              </div>
                              <div className="bg-indigo-50/30 rounded-xl p-3 border border-indigo-100 space-y-2 min-h-[80px]">
                                  {overviewStats.nightStaff.length > 0 ? (
                                      overviewStats.nightStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-50/50 shadow-sm">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{backgroundColor: s.color}}>{s.collaboratorName.charAt(0)}</div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : (
                                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* COL 2: LEAVE STATUS (Management) */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-