
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Collaborator, ShiftSchedule, AttendanceAdjustment, LeaveRequest, TimeLog, Expense } from '../types';
import { CollaboratorModal } from '../components/CollaboratorModal';
import { 
  Pencil, Trash2, Plus, Search, ClipboardList,
  ChevronLeft, ChevronRight, Calendar, Edit2, FileDown, Wallet, DollarSign, Sun, Moon, 
  CheckCircle, AlertCircle, Send, User, HeartPulse, ShieldCheck, UserCheck, Loader2, X, Check, Clock, MapPin, QrCode, AlertTriangle, Gavel, Banknote, PiggyBank, History, CalendarDays, Palmtree, ArrowRight
} from 'lucide-react';
import { HRTabs, HRTabType } from '../components/HRTabs';
import { ListFilter, FilterOption } from '../components/ListFilter';
import { ShiftScheduleModal } from '../components/ShiftScheduleModal';
import { AttendanceAdjustmentModal } from '../components/AttendanceAdjustmentModal';
import { PayrollQrModal } from '../components/PayrollQrModal';
import { format, addDays, isSameDay, isWithinInterval, parseISO, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Modal } from '../components/Modal';
import { storageService } from '../services/storage';
import { timeToMinutes } from '../utils/shiftLogic';

export const Collaborators: React.FC = () => {
  const { 
    collaborators, deleteCollaborator, schedules, adjustments, notify, 
    currentUser, leaveRequests, addLeaveRequest, updateLeaveRequest, 
    triggerWebhook, timeLogs, salaryAdvances, approveAdvance, requestAdvance, 
    addViolation, refreshData, calculateShift, shiftDefinitions 
  } = useAppContext();
  
  const [activeTab, setActiveTab] = useState<HRTabType>('overview'); // Default is Overview
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingCollab, setEditingCollab] = useState<Collaborator | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  const [currentDate, setCurrentDate] = useState(new Date());
  const selectedMonthStr = format(currentDate, 'yyyy-MM');

  // VIEW MODE FOR TIMESHEET
  const [timesheetMode, setTimesheetMode] = useState<'schedule' | 'realtime'>('schedule');

  // MOBILE STATE
  const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date());

  // MODAL STATES
  const [isScheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Collaborator | null>(null);
  const [selectedDateSlot, setSelectedDateSlot] = useState<Date>(new Date());
  const [activeSchedule, setActiveSchedule] = useState<ShiftSchedule | null>(null);

  const [isAdjModalOpen, setAdjModalOpen] = useState(false);
  const [selectedAdjStaff, setSelectedAdjStaff] = useState<Collaborator | null>(null);

  const [isPayrollModalOpen, setPayrollModalOpen] = useState(false);
  const [selectedPayrollStaff, setSelectedPayrollStaff] = useState<{staff: Collaborator, amount: number} | null>(null);

  const [isLeaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState<Partial<LeaveRequest>>({
      leave_type: 'Nghỉ phép năm',
      reason: '',
      start_date: new Date().toISOString().substring(0, 10),
      end_date: new Date().toISOString().substring(0, 10)
  });
  
  const [isFineModalOpen, setFineModalOpen] = useState(false);
  const [fineStaff, setFineStaff] = useState<Collaborator | null>(null);
  const [fineAmount, setFineAmount] = useState<number>(0);
  const [fineReason, setFineReason] = useState('');
  const [fineEvidence, setFineEvidence] = useState('');

  const [isAdvanceModalOpen, setAdvanceModalOpen] = useState(false);
  const [advanceStaff, setAdvanceStaff] = useState<Collaborator | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceReason, setAdvanceReason] = useState('');
  const [isSelfRequest, setIsSelfRequest] = useState(false); 

  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);
  const [processingAdvanceId, setProcessingAdvanceId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isRestricted = currentUser?.role === 'Nhân viên' || currentUser?.role === 'Buồng phòng';

  // --- MEMOS & LOGIC ---

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0,0,0,0);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  useEffect(() => {
      const start = weekDays[0];
      const end = weekDays[6];
      if (!isWithinInterval(mobileSelectedDate, { start, end })) {
          setMobileSelectedDate(start);
      }
  }, [weekDays, mobileSelectedDate]);

  const timesheetData = useMemo(() => {
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
            const monthlySchedules = schedules.filter(s => 
               s.staff_id === staff.id && 
               isWithinInterval(new Date(s.date), { start, end })
            );

            monthlySchedules.forEach(s => {
                const def = shiftDefinitions.find(d => d.name === s.shift_type);
                if (def) {
                    standardDays += (def.coefficient || 1.0);
                    if (def.code === 'TOI' || def.code === 'NIGHT') nightShifts += 1;
                    else dayShifts += 1;
                } else {
                    if (s.shift_type === 'Sáng' || s.shift_type === 'Chiều') {
                        standardDays += 1;
                        dayShifts += 1;
                    } else if (s.shift_type === 'Tối') {
                        standardDays += 1.2; 
                        nightShifts += 1;
                    }
                }
            });
        } else {
            const validLogs = timeLogs.filter(l => 
                l.staff_id === staff.id && 
                isSameMonth(parseISO(l.check_in_time), currentDate) &&
                (l.status === 'Valid' || l.status === 'Pending') 
            );

            validLogs.forEach(log => {
                const checkInDate = parseISO(log.check_in_time);
                const shift = calculateShift(log.check_in_time, checkInDate);

                if (shift) {
                    standardDays += (shift.coefficient || 1.0);
                    if (shift.code === 'TOI' || shift.code === 'NIGHT') nightShifts += 1;
                    else dayShifts += 1;

                    const checkInMinutes = timeToMinutes(log.check_in_time);
                    const startMinutes = timeToMinutes(shift.start_time);
                    const gracePeriod = shift.grace_period_minutes || 15;

                    if (checkInMinutes !== -1 && startMinutes !== -1) {
                        let diff = checkInMinutes - startMinutes;
                        if (diff < -720) diff += 1440;
                        if (diff > gracePeriod) {
                            lateCount++;
                            totalLateMinutes += diff;
                        }
                    }
                } else {
                    const hour = checkInDate.getHours();
                    if (hour >= 14) {
                        nightShifts += 1;
                        standardDays += 1.2;
                    } else {
                        dayShifts += 1;
                        standardDays += 1;
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
  }, [collaborators, schedules, adjustments, currentDate, selectedMonthStr, timesheetMode, timeLogs, calculateShift, shiftDefinitions]);

  const myFinancialStats = useMemo(() => {
      if (!currentUser) return { estimatedSalary: 0, standardDays: 0 };
      const myData = timesheetData.find(d => d.staff.id === currentUser.id);
      return {
          estimatedSalary: myData?.calculatedSalary || 0,
          standardDays: myData?.standardDays || 0
      };
  }, [timesheetData, currentUser]);

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
      const pendingAdvances = salaryAdvances.filter(a => a.status === 'Pending');
      const totalSalaryEstimate = timesheetData.reduce((acc, curr) => acc + curr.calculatedSalary, 0);

      const todayLogs = timeLogs.filter(l => isSameDay(parseISO(l.check_in_time), today));
      const morningStaff: (Collaborator & { isWorking: boolean })[] = [];
      const nightStaff: (Collaborator & { isWorking: boolean })[] = [];

      collaborators.forEach(c => {
          const userLogs = todayLogs.filter(l => l.staff_id === c.id);
          const hasLogs = userLogs.length > 0;
          const allCheckedOut = hasLogs && userLogs.every(l => !!l.check_out_time);
          if (allCheckedOut) return; 

          const activeLog = userLogs.find(l => !l.check_out_time);
          const isWorking = !!activeLog;
          const schedule = schedules.find(s => s.staff_id === c.id && s.date === todayStr);
          
          let shiftCode = '';
          if (isWorking && activeLog) {
              const checkInDate = parseISO(activeLog.check_in_time);
              const dynamicShift = calculateShift(activeLog.check_in_time, checkInDate);
              shiftCode = dynamicShift ? dynamicShift.code : (parseISO(activeLog.check_in_time).getHours() < 14 ? 'SANG' : 'TOI');
          } else if (schedule) {
              const def = shiftDefinitions.find(d => d.name === schedule.shift_type);
              shiftCode = def ? def.code : (schedule.shift_type === 'Sáng' ? 'SANG' : schedule.shift_type === 'Tối' ? 'TOI' : 'CHIEU');
          }

          if (shiftCode) {
              const staffWithStatus = { ...c, isWorking };
              if (shiftCode === 'SANG' || shiftCode === 'CHIEU') morningStaff.push(staffWithStatus);
              else if (shiftCode === 'TOI' || shiftCode === 'NIGHT') nightStaff.push(staffWithStatus);
          }
      });

      return { totalStaff, onLeaveToday, pendingLeaves, pendingAdvances, totalSalaryEstimate, morningStaff, nightStaff };
  }, [collaborators, leaveRequests, timesheetData, schedules, salaryAdvances, timeLogs, calculateShift, shiftDefinitions]);

  // --- ACTIONS ---

  const handleEdit = (c: Collaborator) => { setEditingCollab(c); setModalOpen(true); };
  const handleAdd = () => { setEditingCollab(null); setModalOpen(true); };

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

  const handleOpenPayroll = (staff: Collaborator, amount: number) => {
      setSelectedPayrollStaff({ staff, amount });
      setPayrollModalOpen(true);
  };

  const handleOpenFine = (staff: Collaborator) => {
      setFineStaff(staff);
      setFineAmount(0);
      setFineReason('');
      setFineEvidence('');
      setFineModalOpen(true);
  };

  const handleSubmitFine = async () => {
      if (!fineStaff || fineAmount <= 0 || !fineReason) { notify('error', 'Vui lòng nhập đủ thông tin phạt.'); return; }
      await addViolation(fineStaff.id, fineAmount, fineReason, fineEvidence);
      setFineModalOpen(false);
  };

  const handleOpenManualAdvance = (staff: Collaborator) => {
      setAdvanceStaff(staff);
      setAdvanceAmount(0);
      setAdvanceReason('');
      setIsSelfRequest(false);
      setAdvanceModalOpen(true);
  };

  const handleOpenRequestAdvance = () => {
      if (!currentUser) return;
      setAdvanceStaff(currentUser);
      setAdvanceAmount(0);
      setAdvanceReason('');
      setIsSelfRequest(true);
      setAdvanceModalOpen(true);
  };

  const handleSubmitAdvance = async () => {
      if (!advanceStaff || advanceAmount <= 0 || !advanceReason) { notify('error', 'Vui lòng nhập đủ thông tin.'); return; }
      setIsProcessing(true);
      try {
          if (isSelfRequest) {
              if (advanceAmount > myFinancialStats.estimatedSalary * 0.7) {
                  if (!confirm('Số tiền ứng vượt quá 70% lương. Tiếp tục?')) { setIsProcessing(false); return; }
              }
              await requestAdvance(advanceAmount, advanceReason);
          } else {
              const item = { id: `ADV-${Date.now()}`, staff_id: advanceStaff.id, amount: advanceAmount, reason: advanceReason, status: 'Approved' as const, request_date: new Date().toISOString(), created_at: new Date().toISOString() };
              await storageService.addSalaryAdvance(item);
              const expense: Expense = { id: `EXP-ADV-${Date.now()}`, expenseDate: new Date().toISOString().substring(0, 10), facilityName: 'General', expenseCategory: 'Lương nhân viên', expenseContent: `Ứng lương cho ${advanceStaff.collaboratorName}`, amount: advanceAmount, note: `Admin tạo thủ công: ${advanceReason}` };
              await storageService.addExpense(expense);
              await refreshData();
              notify('success', `Đã tạo phiếu ứng ${advanceAmount.toLocaleString()}đ`);
          }
          setAdvanceModalOpen(false);
      } finally { setIsProcessing(false); }
  };

  const submitLeaveRequest = async () => {
      if (!leaveForm.reason || !currentUser) { notify('error', 'Vui lòng nhập lý do nghỉ.'); return; }
      const req: LeaveRequest = { id: `LR${Date.now()}`, staff_id: currentUser.id, staff_name: currentUser.collaboratorName, start_date: leaveForm.start_date!, end_date: leaveForm.end_date!, leave_type: leaveForm.leave_type as any, reason: leaveForm.reason, status: 'Pending', created_at: new Date().toISOString() };
      await addLeaveRequest(req);
      setLeaveModalOpen(false);
      setLeaveForm({ ...leaveForm, reason: '' }); 
      notify('success', 'Đã gửi đơn xin nghỉ.');
      triggerWebhook('leave_update', { event: 'new_request', staff: req.staff_name, type: req.leave_type, dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`, reason: req.reason, status: 'Chờ duyệt' });
      triggerWebhook('general_notification', { type: 'STAFF_LEAVE', payload: { staff_name: req.staff_name, reason: req.reason, dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`, status: 'PENDING' } });
  };

  const handleApproveLeave = async (req: LeaveRequest, isApproved: boolean) => {
      if (currentUser?.role !== 'Admin' && currentUser?.role !== 'Quản lý') { notify('error', 'Không có quyền duyệt.'); return; }
      setProcessingLeaveId(req.id);
      try {
          const status = isApproved ? 'Approved' : 'Rejected';
          await updateLeaveRequest({ ...req, status });
          isApproved ? notify('success', `Đã duyệt đơn của ${req.staff_name}.`) : notify('info', `Đã từ chối đơn của ${req.staff_name}.`);
          triggerWebhook('leave_update', { event: 'status_update', staff: req.staff_name, status: isApproved ? 'ĐÃ DUYỆT ✅' : 'ĐÃ TỪ CHỐI ❌', dates: `${format(parseISO(req.start_date), 'dd/MM')} - ${format(parseISO(req.end_date), 'dd/MM')}`, approver: currentUser?.collaboratorName || 'Admin' });
          triggerWebhook('general_notification', { type: 'STAFF_LEAVE_UPDATE', payload: { staff_name: req.staff_name, status: isApproved ? 'APPROVED' : 'REJECTED', approver: currentUser?.collaboratorName } });
      } catch (err) { notify('error', 'Lỗi cập nhật.'); } finally { setProcessingLeaveId(null); }
  };

  const handleApproveAdvance = async (id: string, isApproved: boolean) => {
      setProcessingAdvanceId(id);
      try { await approveAdvance(id, isApproved); } finally { setProcessingAdvanceId(null); }
  };

  const getShiftColor = (shiftName: string) => {
    const def = shiftDefinitions.find(d => d.name === shiftName);
    const code = def ? def.code : '';
    if (shiftName === 'Sáng' || code === 'SANG') return 'bg-amber-500 text-white shadow-amber-200';
    if (shiftName === 'Tối' || code === 'TOI' || code === 'NIGHT') return 'bg-indigo-700 text-white shadow-indigo-200';
    if (shiftName === 'Chiều' || code === 'CHIEU') return 'bg-orange-500 text-white shadow-orange-200';
    if (shiftName === 'OFF') return 'bg-slate-200 text-slate-500';
    return 'bg-brand-500 text-white shadow-brand-200';
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
    <div className="space-y-6 animate-enter pb-24 md:pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Quản Lý Nhân Sự</h1>
          <p className="text-slate-500 text-sm mt-1">Hệ thống quản lý chấm công & nghỉ phép tập trung.</p>
        </div>
        {!isRestricted && activeTab === 'employees' && (
            <button onClick={handleAdd} className="bg-brand-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-brand-700 transition-all shadow-md font-bold active:scale-95">
                <Plus size={20} /> <span className="inline">Thêm nhân viên</span>
            </button>
        )}
      </div>

      <HRTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  {/* COL 1: SHIFT MONITOR */}
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
                          <div className="relative">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shadow-sm"><Sun size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Sáng / Ngày</div>
                                      <div className="text-[10px] text-slate-400 font-medium">Theo cấu hình</div>
                                  </div>
                              </div>
                              <div className="bg-amber-50/30 rounded-xl p-3 border border-amber-100 space-y-2 min-h-[80px]">
                                  {overviewStats.morningStaff.length > 0 ? (
                                      overviewStats.morningStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-amber-50/50 shadow-sm relative">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm relative" style={{backgroundColor: s.color}}>
                                                  {s.collaboratorName.charAt(0)}
                                                  {s.isWorking && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" title="Đang làm việc"></div>}
                                              </div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>}
                              </div>
                          </div>
                          <div className="relative pt-2">
                              <div className="absolute left-4 top-[-10px] bottom-full w-[2px] bg-slate-100 -z-10"></div>
                              <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm"><Moon size={16}/></div>
                                  <div>
                                      <div className="text-xs font-bold text-slate-700 uppercase">Ca Tối / Đêm</div>
                                      <div className="text-[10px] text-slate-400 font-medium">Theo cấu hình</div>
                                  </div>
                              </div>
                              <div className="bg-indigo-50/30 rounded-xl p-3 border border-indigo-100 space-y-2 min-h-[80px]">
                                  {overviewStats.nightStaff.length > 0 ? (
                                      overviewStats.nightStaff.map(s => (
                                          <div key={s.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-indigo-50/50 shadow-sm relative">
                                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm relative" style={{backgroundColor: s.color}}>
                                                  {s.collaboratorName.charAt(0)}
                                                  {s.isWorking && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" title="Đang làm việc"></div>}
                                              </div>
                                              <div>
                                                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1">{s.collaboratorName}</div>
                                                  <div className="text-[9px] text-slate-400 uppercase font-medium">{s.role}</div>
                                              </div>
                                          </div>
                                      ))
                                  ) : <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa phân ca</div>}
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* COL 2: ADVANCE APPROVALS */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <Wallet size={18} className="text-brand-600"/> Duyệt Ứng Lương
                          </h3>
                          <span className="bg-brand-50 text-brand-600 px-2 py-0.5 rounded text-xs font-black">{overviewStats.pendingAdvances.length}</span>
                      </div>
                      <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                          {overviewStats.pendingAdvances.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                  <CheckCircle size={32} className="mb-2 opacity-50"/>
                                  <span className="text-xs font-medium">Không có yêu cầu mới</span>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  {overviewStats.pendingAdvances.map(req => {
                                      const staff = collaborators.find(c => c.id === req.staff_id);
                                      return (
                                          <div key={req.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                                              <div className="flex justify-between items-start mb-2">
                                                  <div className="flex items-center gap-2">
                                                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 font-bold text-xs shadow-sm border border-slate-100">
                                                          {staff?.collaboratorName.charAt(0)}
                                                      </div>
                                                      <div>
                                                          <div className="font-bold text-sm text-slate-800">{staff?.collaboratorName}</div>
                                                          <div className="text-[10px] text-slate-500">{format(parseISO(req.request_date), 'dd/MM/yyyy')}</div>
                                                      </div>
                                                  </div>
                                                  <div className="text-right">
                                                      <div className="font-black text-brand-600">{req.amount.toLocaleString()} ₫</div>
                                                  </div>
                                              </div>
                                              <div className="text-xs text-slate-600 italic mb-3 bg-white p-2 rounded border border-slate-100">"{req.reason}"</div>
                                              <div className="flex gap-2">
                                                  <button onClick={() => handleApproveAdvance(req.id, false)} disabled={processingAdvanceId === req.id} className="flex-1 py-1.5 bg-white border border-rose-200 text-rose-600 text-[10px] font-bold uppercase rounded-lg hover:bg-rose-50">Từ chối</button>
                                                  <button onClick={() => handleApproveAdvance(req.id, true)} disabled={processingAdvanceId === req.id} className="flex-1 py-1.5 bg-brand-600 text-white text-[10px] font-bold uppercase rounded-lg hover:bg-brand-700 shadow-sm flex items-center justify-center gap-1">
                                                      {processingAdvanceId === req.id ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} Duyệt
                                                  </button>
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  </div>

                  {/* COL 3: LEAVE STATUS */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full min-h-[400px]">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-50">
                          <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                              <UserCheck size={18} className="text-brand-600"/> Trạng thái Nghỉ phép
                          </h3>
                      </div>
                      <div className="flex-1 flex flex-col gap-4">
                          <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Đang nghỉ hôm nay</div>
                              {overviewStats.onLeaveToday.length === 0 ? (
                                  <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                      <div className="bg-white p-1.5 rounded-full text-emerald-500 shadow-sm"><CheckCircle size={16}/></div>
                                      <span className="text-xs font-bold text-emerald-700">Đầy đủ quân số!</span>
                                  </div>
                              ) : (
                                  <div className="space-y-2">
                                      {overviewStats.onLeaveToday.map(req => (
                                          <div key={req.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-rose-600 font-bold text-xs shadow-sm">{req.staff_name.charAt(0)}</div>
                                                  <div>
                                                      <div className="font-bold text-slate-800 text-xs">{req.staff_name}</div>
                                                      <div className="text-[10px] text-slate-500">{req.leave_type}</div>
                                                  </div>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                          <div className="flex-1 flex flex-col">
                              <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex justify-between items-center">
                                  <span>Đơn nghỉ chờ duyệt ({overviewStats.pendingLeaves.length})</span>
                                  {overviewStats.pendingLeaves.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                              </div>
                              <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100 overflow-y-auto max-h-[200px] custom-scrollbar">
                                  {overviewStats.pendingLeaves.length === 0 ? (
                                      <div className="h-full flex flex-col items-center justify-center text-slate-300 py-4">
                                          <ShieldCheck size={24} className="mb-1 opacity-50"/>
                                          <span className="text-[10px] font-medium">Không có đơn mới</span>
                                      </div>
                                  ) : (
                                      <div className="space-y-2">
                                          {overviewStats.pendingLeaves.map(req => (
                                              <div key={req.id} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:border-brand-200 transition-colors cursor-pointer group" onClick={() => setActiveTab('leave')}>
                                                  <div className="flex justify-between items-start">
                                                      <div className="font-bold text-slate-800 text-xs">{req.staff_name}</div>
                                                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded font-medium">{format(parseISO(req.start_date), 'dd/MM')}</span>
                                                  </div>
                                                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-1">{req.leave_type}: {req.reason}</div>
                                              </div>
                                          ))}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* TAB 2: EMPLOYEES */}
      {activeTab === 'employees' && !isRestricted && (
          <div className="animate-in fade-in">
              <ListFilter 
                searchTerm={searchTerm} onSearchChange={setSearchTerm}
                options={roleOptions} selectedFilter={roleFilter} onFilterChange={setRoleFilter}
                placeholder="Tìm theo tên nhân viên..."
              />
              
              {/* Desktop Table (Isolate) */}
              <div className="hidden md:block bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th className="p-4 text-slate-500 text-xs uppercase font-extrabold tracking-wider">Họ và tên</th>
                        <th className="p-4 text-slate-500 text-xs uppercase font-extrabold tracking-wider">Vai trò</th>
                        <th className="p-4 text-slate-500 text-xs uppercase font-extrabold tracking-wider">Lương cứng</th>
                        <th className="p-4 text-slate-500 text-xs uppercase font-extrabold tracking-wider text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredCollaborators.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shadow-md" style={{ backgroundColor: c.color || '#3b82f6' }}>{(c.collaboratorName || '?').charAt(0)}</div>
                              <div>
                                <div className="font-bold text-slate-800">{c.collaboratorName}</div>
                                <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">@{c.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4"><span className={`px-3 py-1 rounded-full text-[11px] font-extrabold ${getRoleBadgeColor(c.role)}`}>{c.role}</span></td>
                          <td className="p-4"><div className="text-slate-700 font-black flex items-center gap-1">{(Number(c.baseSalary) || 0).toLocaleString()} <span className="text-[9px] font-bold text-slate-400 uppercase">VND</span></div></td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleOpenManualAdvance(c)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Ứng lương"><Banknote size={18}/></button>
                              <button onClick={() => handleOpenFine(c)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Phạt"><AlertTriangle size={18}/></button>
                              <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Sửa"><Pencil size={18} /></button>
                              <button onClick={() => { if(confirm('Xóa nhân viên?')) deleteCollaborator(c.id); }} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-all" title="Xóa"><Trash2 size={18} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card List (New) */}
              <div className="md:hidden space-y-4">
                 {filteredCollaborators.map(c => (
                     <div key={c.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-sm" style={{ backgroundColor: c.color || '#3b82f6' }}>{(c.collaboratorName || '?').charAt(0)}</div>
                           <div>
                              <h3 className="font-bold text-slate-800 text-lg">{c.collaboratorName}</h3>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getRoleBadgeColor(c.role)}`}>{c.role}</span>
                              <div className="text-xs text-slate-500 mt-1 font-mono">{Number(c.baseSalary).toLocaleString()} đ</div>
                           </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100">
                           <button onClick={() => handleEdit(c)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100">
                              <Pencil size={16} /> <span className="text-[10px] font-bold">Sửa</span>
                           </button>
                           <button onClick={() => handleOpenManualAdvance(c)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100">
                              <Banknote size={16} /> <span className="text-[10px] font-bold">Ứng</span>
                           </button>
                           <button onClick={() => handleOpenFine(c)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100">
                              <AlertTriangle size={16} /> <span className="text-[10px] font-bold">Phạt</span>
                           </button>
                           <button onClick={() => { if(confirm('Xóa?')) deleteCollaborator(c.id); }} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-slate-500 bg-slate-100 hover:bg-slate-200">
                              <Trash2 size={16} /> <span className="text-[10px] font-bold">Xóa</span>
                           </button>
                        </div>
                     </div>
                 ))}
              </div>
          </div>
      )}

      {/* TAB 3: SHIFTS */}
      {activeTab === 'shifts' && (
        <div className="animate-in fade-in space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm gap-4">
             <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Calendar size={24} /></div>
                <div><h2 className="text-lg font-bold text-slate-800">Lịch phân ca tuần</h2><p className="text-xs text-slate-500 font-medium">Hệ thống phân ca theo Mùa vụ.</p></div>
             </div>
             <div className="hidden md:flex items-center gap-3">
                 <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-2 hover:bg-white text-slate-500 border-r border-slate-200 transition-colors"><ChevronLeft size={18}/></button>
                    <span className="px-4 py-2 text-sm font-bold text-slate-700 min-w-[180px] text-center">{format(weekDays[0], 'dd/MM')} - {format(weekDays[6], 'dd/MM')}</span>
                    <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-2 hover:bg-white text-slate-500 border-l border-slate-200 transition-colors"><ChevronRight size={18}/></button>
                 </div>
             </div>
          </div>
          <div className="hidden md:block bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden relative">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50/80 backdrop-blur-md border-b border-slate-200">
                  <tr>
                    <th className="p-4 sticky left-0 z-20 bg-slate-50 border-r border-slate-200 w-52 font-black text-[10px] text-slate-400 uppercase tracking-widest">Nhân viên / Ngày</th>
                    {weekDays.map(day => (
                      <th key={day.toISOString()} className={`p-4 text-center border-r border-slate-100 ${isSameDay(day, new Date()) ? 'bg-brand-50/50' : ''}`}>
                         <div className={`text-xs font-black uppercase tracking-wider ${isSameDay(day, new Date()) ? 'text-brand-600' : 'text-slate-400'}`}>{format(day, 'EEEE', { locale: vi })}</div>
                         <div className={`text-lg font-black mt-1 ${isSameDay(day, new Date()) ? 'text-brand-700' : 'text-slate-700'}`}>{format(day, 'dd/MM')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collaborators.filter(c => c.role !== 'Nhà đầu tư').map(staff => (
                    <tr key={staff.id} className="group">
                      <td className="p-4 sticky left-0 z-10 bg-white border-r border-slate-200 group-hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-inner" style={{ backgroundColor: staff.color || '#3b82f6' }}>{(staff.collaboratorName || '?').charAt(0)}</div>
                          <div><div className="font-bold text-slate-800 text-sm">{staff.collaboratorName}</div><div className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{staff.role}</div></div>
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const schedule = schedules.find(s => s.staff_id === staff.id && s.date === dateStr);
                        return (
                          <td key={day.toISOString()} className={`p-2 border-r border-slate-100 text-center relative group/cell hover:bg-brand-50/30 transition-all cursor-pointer min-h-[80px]`} onClick={() => !isRestricted && openScheduleSlot(staff, day)}>
                            {schedule ? (
                              <div className={`mx-auto w-full max-w-[90px] p-2.5 rounded-xl text-[10px] font-black shadow-sm flex flex-col items-center gap-1 animate-in zoom-in-95 duration-200 ${getShiftColor(schedule.shift_type)}`}>
                                <span>{schedule.shift_type}</span>
                              </div>
                            ) : (!isRestricted && (
                                <div className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-2 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 text-slate-300 flex items-center justify-center hover:border-brand-400 hover:text-brand-500"><Plus size={16} /></div></div>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="md:hidden space-y-4">
              <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar px-1">
                  {weekDays.map(day => {
                      const isSelected = isSameDay(day, mobileSelectedDate);
                      const isToday = isSameDay(day, new Date());
                      return (
                          <button key={day.toISOString()} onClick={() => setMobileSelectedDate(day)} className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[70px] border-2 transition-all ${isSelected ? 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-200 scale-105' : 'bg-white border-slate-100 text-slate-500'}`}>
                              <span className="text-[10px] font-bold uppercase">{format(day, 'EEE', {locale: vi})}</span>
                              <span className="text-lg font-black">{format(day, 'dd')}</span>
                              {isToday && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-brand-500'}`}></div>}
                          </button>
                      )
                  })}
              </div>
              <div className="space-y-4">
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-3 text-slate-800 font-black uppercase text-xs tracking-widest"><Clock size={16}/> Lịch trực ngày {format(mobileSelectedDate, 'dd/MM')}</div>
                      <div className="grid grid-cols-1 gap-2">
                          {collaborators.filter(c => schedules.some(sch => sch.staff_id === c.id && sch.date === format(mobileSelectedDate, 'yyyy-MM-dd'))).map(c => {
                              const s = schedules.find(sch => sch.staff_id === c.id && sch.date === format(mobileSelectedDate, 'yyyy-MM-dd'));
                              return (
                                  <div key={c.id} onClick={() => !isRestricted && openScheduleSlot(c, mobileSelectedDate)} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: c.color }}>{c.collaboratorName.charAt(0)}</div>
                                          <div><div className="font-bold text-slate-800">{c.collaboratorName}</div><div className="text-xs text-slate-400 font-bold uppercase">{c.role}</div></div>
                                      </div>
                                      {s && <div className={`px-3 py-1 rounded-lg text-xs font-bold ${getShiftColor(s.shift_type)}`}>{s.shift_type}</div>}
                                  </div>
                              );
                          })}
                          {collaborators.filter(c => schedules.some(sch => sch.staff_id === c.id && sch.date === format(mobileSelectedDate, 'yyyy-MM-dd'))).length === 0 && (
                              <div className="text-center text-slate-400 text-sm italic py-4">Chưa có lịch phân ca cho ngày này.</div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE REQUESTS */}
      {activeTab === 'leave' && (
          <div className="animate-in fade-in space-y-6">
              {!isRestricted && (
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-start gap-3">
                      <ShieldCheck className="text-blue-600 shrink-0" size={24} />
                      <div>
                          <h3 className="font-bold text-blue-800">Quản lý Nghỉ Phép</h3>
                          <p className="text-sm text-blue-600">Duyệt đơn nghỉ phép của nhân viên. Các đơn được duyệt sẽ tự động cập nhật vào bảng công.</p>
                      </div>
                  </div>
              )}
              {isRestricted && (
                  <div className="bg-white p-6 rounded-xl border border-slate-200 text-center">
                      <button onClick={() => setLeaveModalOpen(true)} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-brand-700 transition-all flex items-center gap-2 mx-auto">
                          <Palmtree size={20}/> Gửi Đơn Xin Nghỉ
                      </button>
                  </div>
              )}
              
              {/* Desktop Table (Isolated) */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                              <tr>
                                  <th className="p-4">Nhân viên</th>
                                  <th className="p-4">Loại nghỉ</th>
                                  <th className="p-4">Thời gian</th>
                                  <th className="p-4">Lý do</th>
                                  <th className="p-4 text-center">Trạng thái</th>
                                  {!isRestricted && <th className="p-4 text-center">Thao tác</th>}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                              {leaveRequests.filter(req => isRestricted ? req.staff_id === currentUser?.id : true).map(req => (
                                  <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 font-bold text-slate-800">{req.staff_name}</td>
                                      <td className="p-4"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">{req.leave_type}</span></td>
                                      <td className="p-4 font-mono text-slate-600">{format(parseISO(req.start_date), 'dd/MM')} - {format(parseISO(req.end_date), 'dd/MM')}</td>
                                      <td className="p-4 text-slate-600 italic max-w-xs truncate" title={req.reason}>{req.reason}</td>
                                      <td className="p-4 text-center">
                                          {req.status === 'Approved' ? <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center justify-center gap-1 w-fit mx-auto"><CheckCircle size={12}/> Đã duyệt</span> :
                                           req.status === 'Rejected' ? <span className="text-rose-600 font-bold bg-rose-50 px-3 py-1 rounded-full border border-rose-100 flex items-center justify-center gap-1 w-fit mx-auto"><X size={12}/> Từ chối</span> :
                                           <span className="text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-100 flex items-center justify-center gap-1 w-fit mx-auto"><Clock size={12}/> Chờ duyệt</span>}
                                      </td>
                                      {!isRestricted && (
                                          <td className="p-4 text-center">
                                              {req.status === 'Pending' && (
                                                  <div className="flex items-center justify-center gap-2">
                                                      <button onClick={() => handleApproveLeave(req, true)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><Check size={16}/></button>
                                                      <button onClick={() => handleApproveLeave(req, false)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"><X size={16}/></button>
                                                  </div>
                                              )}
                                          </td>
                                      )}
                                  </tr>
                              ))}
                              {leaveRequests.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Chưa có đơn nghỉ phép nào.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Mobile Card List (New) */}
              <div className="md:hidden space-y-4">
                 {leaveRequests.filter(req => isRestricted ? req.staff_id === currentUser?.id : true).map(req => (
                     <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-sm">
                                 {req.staff_name.charAt(0)}
                              </div>
                              <div>
                                 <div className="font-bold text-slate-800">{req.staff_name}</div>
                                 <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 inline-block mt-1">{req.leave_type}</div>
                              </div>
                           </div>
                           <div>
                              {req.status === 'Approved' ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 uppercase">Đã duyệt</span> :
                               req.status === 'Rejected' ? <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 uppercase">Từ chối</span> :
                               <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 uppercase">Chờ duyệt</span>}
                           </div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-100">
                           <div className="flex justify-between items-center text-xs mb-2">
                              <span className="text-slate-400 font-bold uppercase">Thời gian</span>
                              <span className="font-bold text-slate-800">{format(parseISO(req.start_date), 'dd/MM')} - {format(parseISO(req.end_date), 'dd/MM')}</span>
                           </div>
                           <div className="bg-slate-50 p-2 rounded text-xs italic text-slate-600">
                              "{req.reason}"
                           </div>
                        </div>

                        {!isRestricted && req.status === 'Pending' && (
                           <div className="grid grid-cols-2 gap-3 mt-3">
                              <button onClick={() => handleApproveLeave(req, false)} className="py-2 bg-slate-100 text-slate-500 font-bold text-xs uppercase rounded-lg">Từ chối</button>
                              <button onClick={() => handleApproveLeave(req, true)} className="py-2 bg-emerald-600 text-white font-bold text-xs uppercase rounded-lg shadow-sm">Duyệt</button>
                           </div>
                        )}
                     </div>
                 ))}
                 {leaveRequests.length === 0 && <div className="text-center text-slate-400 py-8 italic">Không có đơn nghỉ phép nào.</div>}
              </div>
          </div>
      )}

      {/* TAB 5: ADVANCE REQUESTS */}
      {activeTab === 'advance' && (
          <div className="animate-in fade-in space-y-6">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Wallet size={20} className="text-brand-600"/> Quản lý Tạm Ứng Lương</h2>
                  {isRestricted && (
                      <button onClick={handleOpenRequestAdvance} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-brand-700 transition-all flex items-center gap-2">
                          <Plus size={16}/> Xin Ứng Lương
                      </button>
                  )}
              </div>
              
              {/* Desktop Table (Isolated) */}
              <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                              <tr>
                                  <th className="p-4">Nhân viên</th>
                                  <th className="p-4 text-right">Số tiền</th>
                                  <th className="p-4">Ngày yêu cầu</th>
                                  <th className="p-4">Lý do</th>
                                  <th className="p-4 text-center">Trạng thái</th>
                                  {!isRestricted && <th className="p-4 text-center">Thao tác</th>}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                              {salaryAdvances.filter(req => isRestricted ? req.staff_id === currentUser?.id : true).map(req => {
                                  const staff = collaborators.find(c => c.id === req.staff_id);
                                  return (
                                      <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                                          <td className="p-4 font-bold text-slate-800">{staff?.collaboratorName}</td>
                                          <td className="p-4 text-right font-black text-brand-600">{req.amount.toLocaleString()} ₫</td>
                                          <td className="p-4 font-mono text-slate-600">{format(parseISO(req.request_date), 'dd/MM/yyyy')}</td>
                                          <td className="p-4 text-slate-600 italic max-w-xs truncate">{req.reason}</td>
                                          <td className="p-4 text-center">
                                              {req.status === 'Approved' ? <span className="text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Đã duyệt</span> :
                                               req.status === 'Paid' ? <span className="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Đã chi tiền</span> :
                                               req.status === 'Rejected' ? <span className="text-rose-600 font-bold bg-rose-50 px-3 py-1 rounded-full border border-rose-100">Từ chối</span> :
                                               <span className="text-amber-600 font-bold bg-amber-50 px-3 py-1 rounded-full border border-amber-100">Chờ duyệt</span>}
                                          </td>
                                          {!isRestricted && req.status === 'Pending' && (
                                              <td className="p-4 text-center">
                                                  <div className="flex items-center justify-center gap-2">
                                                      <button onClick={() => handleApproveAdvance(req.id, true)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><Check size={16}/></button>
                                                      <button onClick={() => handleApproveAdvance(req.id, false)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100"><X size={16}/></button>
                                                  </div>
                                              </td>
                                          )}
                                      </tr>
                                  );
                              })}
                              {salaryAdvances.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Chưa có phiếu ứng nào.</td></tr>}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Mobile Card List (New) */}
              <div className="md:hidden space-y-4">
                 {salaryAdvances.filter(req => isRestricted ? req.staff_id === currentUser?.id : true).map(req => {
                     const staff = collaborators.find(c => c.id === req.staff_id);
                     return (
                         <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                               <div>
                                  <div className="font-bold text-slate-800 text-sm">{staff?.collaboratorName}</div>
                                  <div className="text-[10px] text-slate-400">{format(parseISO(req.request_date), 'dd/MM/yyyy')}</div>
                               </div>
                               <div className="text-xl font-black text-brand-600">{req.amount.toLocaleString()} <span className="text-[10px] text-slate-400 font-medium">đ</span></div>
                            </div>
                            
                            <div className="bg-slate-50 p-2 rounded text-xs italic text-slate-600 mb-3 border border-slate-100">
                               "{req.reason}"
                            </div>

                            <div className="flex justify-between items-center">
                               <div>
                                  {req.status === 'Approved' ? <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 uppercase">Đã duyệt</span> :
                                   req.status === 'Rejected' ? <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 uppercase">Từ chối</span> :
                                   <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100 uppercase">Chờ duyệt</span>}
                               </div>
                               {!isRestricted && req.status === 'Pending' && (
                                   <div className="flex gap-2">
                                       <button onClick={() => handleApproveAdvance(req.id, false)} className="px-3 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase rounded-lg">Từ chối</button>
                                       <button onClick={() => handleApproveAdvance(req.id, true)} className="px-3 py-1.5 bg-brand-600 text-white text-[10px] font-bold uppercase rounded-lg shadow-sm">Duyệt</button>
                                   </div>
                               )}
                            </div>
                         </div>
                     )
                 })}
                 {salaryAdvances.length === 0 && <div className="text-center text-slate-400 py-8 italic">Chưa có phiếu ứng nào.</div>}
              </div>
          </div>
      )}

      {/* TAB 6: TIMESHEET */}
      {activeTab === 'timesheet' && !isRestricted && (
          <div className="animate-in fade-in space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-col md:flex-row gap-3 md:gap-0">
                  <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><ClipboardList size={20}/></div>
                      <div>
                          <h2 className="text-lg font-bold text-slate-800">Bảng Chấm Công</h2>
                          <p className="text-xs text-slate-500">Kỳ lương: <span className="font-bold text-brand-600">{selectedMonthStr}</span></p>
                      </div>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                          <button onClick={() => setTimesheetMode('schedule')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${timesheetMode === 'schedule' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>Theo Lịch</button>
                          <button onClick={() => setTimesheetMode('realtime')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${timesheetMode === 'realtime' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500'}`}>Theo GPS</button>
                      </div>
                      <input type="month" className="border rounded-lg px-3 py-2 text-sm font-bold bg-white outline-none cursor-pointer" value={selectedMonthStr} onChange={e => setCurrentDate(new Date(e.target.value))} />
                  </div>
              </div>

              {/* Desktop Table (Isolated) */}
              <div className="hidden md:block bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50/50 border-b border-slate-200">
                              <tr>
                                  <th className="p-4 text-xs font-extrabold uppercase text-slate-500 tracking-wider">Nhân viên</th>
                                  <th className="p-4 text-center text-xs font-extrabold uppercase text-slate-500 tracking-wider">Công chuẩn (Ngày)</th>
                                  <th className="p-4 text-center text-xs font-extrabold uppercase text-slate-500 tracking-wider">Ca Sáng / Tối</th>
                                  <th className="p-4 text-center text-xs font-extrabold uppercase text-slate-500 tracking-wider text-rose-500">Đi muộn (Phút)</th>
                                  <th className="p-4 text-right text-xs font-extrabold uppercase text-slate-500 tracking-wider">Lương ước tính</th>
                                  <th className="p-4 text-center text-xs font-extrabold uppercase text-slate-500 tracking-wider">Thao tác</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                              {timesheetData.map(d => (
                                  <tr key={d.staff.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 font-bold text-slate-800">{d.staff.collaboratorName}</td>
                                      <td className="p-4 text-center">
                                          <span className="font-black text-lg text-slate-700">{d.standardDays.toFixed(1)}</span>
                                          {d.adjustment && <span className="text-[10px] text-blue-500 block font-bold">Disclaimer: Đã bù chéo</span>}
                                      </td>
                                      <td className="p-4 text-center">
                                          <div className="flex justify-center gap-2 text-xs font-bold">
                                              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">{d.dayShifts} S</span>
                                              <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{d.nightShifts} T</span>
                                          </div>
                                      </td>
                                      <td className="p-4 text-center">
                                          {d.totalLateMinutes > 0 ? <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded border border-rose-100">{d.totalLateMinutes}p ({d.lateCount} lần)</span> : <span className="text-emerald-500 font-bold">-</span>}
                                      </td>
                                      <td className="p-4 text-right font-black text-brand-600">{Math.round(d.calculatedSalary).toLocaleString()} ₫</td>
                                      <td className="p-4 text-center flex justify-center gap-2">
                                          <button onClick={() => openAdjustment(d.staff)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all" title="Điều chỉnh công"><Edit2 size={16}/></button>
                                          <button onClick={() => handleOpenPayroll(d.staff, d.calculatedSalary)} className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all" title="Chi lương / QR"><QrCode size={16}/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

              {/* Mobile "Mini Payslip" Cards (New) */}
              <div className="md:hidden space-y-4">
                 {timesheetData.map(d => (
                     <div key={d.staff.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                           <div className="font-bold text-slate-800 text-sm">{d.staff.collaboratorName}</div>
                           <div className="text-lg font-black text-emerald-600">{Math.round(d.calculatedSalary).toLocaleString()} <span className="text-[10px] text-slate-400">đ</span></div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                           <div className="bg-white p-2 rounded border border-slate-50 text-center">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">Công Chuẩn</div>
                              <div className="font-black text-slate-700">{d.standardDays.toFixed(1)}</div>
                           </div>
                           <div className="bg-white p-2 rounded border border-slate-50 text-center">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">Đi Muộn</div>
                              <div className={`font-black ${d.totalLateMinutes > 0 ? 'text-red-500' : 'text-slate-700'}`}>{d.totalLateMinutes > 0 ? `${d.totalLateMinutes}p` : '-'}</div>
                           </div>
                           <div className="bg-white p-2 rounded border border-slate-50 text-center">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">Ca Làm</div>
                              <div className="text-xs font-bold flex justify-center gap-1">
                                 <span className="text-amber-600">{d.dayShifts}S</span> / <span className="text-indigo-600">{d.nightShifts}T</span>
                              </div>
                           </div>
                           <div className="bg-white p-2 rounded border border-slate-50 text-center">
                              <div className="text-[10px] text-slate-400 uppercase font-bold">Điều chỉnh</div>
                              <div className="text-xs font-bold text-blue-600">{d.adjustment ? 'Có' : 'Không'}</div>
                           </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-50">
                           <button onClick={() => openAdjustment(d.staff)} className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                              <Edit2 size={18} />
                           </button>
                           <button onClick={() => handleOpenPayroll(d.staff, d.calculatedSalary)} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                              <QrCode size={18} />
                           </button>
                        </div>
                     </div>
                 ))}
              </div>
          </div>
      )}

      {/* MODALS */}
      <CollaboratorModal isOpen={isModalOpen} onClose={() => setModalOpen(false)} collaborator={editingCollab} />
      {selectedStaff && <ShiftScheduleModal isOpen={isScheduleModalOpen} onClose={() => setScheduleModalOpen(false)} staff={selectedStaff} date={selectedDateSlot} existingSchedule={activeSchedule} />}
      {selectedAdjStaff && <AttendanceAdjustmentModal isOpen={isAdjModalOpen} onClose={() => setAdjModalOpen(false)} staff={selectedAdjStaff} month={selectedMonthStr} adjustment={adjustments.find(a => a.staff_id === selectedAdjStaff.id && a.month === selectedMonthStr)} />}
      {selectedPayrollStaff && <PayrollQrModal isOpen={isPayrollModalOpen} onClose={() => setPayrollModalOpen(false)} staff={selectedPayrollStaff.staff} amount={selectedPayrollStaff.amount} month={format(currentDate, 'MM/yyyy')} />}
      
      {/* Fine Modal */}
      <Modal isOpen={isFineModalOpen} onClose={() => setFineModalOpen(false)} title="Tạo Phiếu Phạt Vi Phạm" size="sm">
          <div className="space-y-4">
              <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-sm border border-rose-100 font-bold">{fineStaff?.collaboratorName.charAt(0)}</div>
                  <div>
                      <div className="text-sm font-bold text-rose-800">Phạt: {fineStaff?.collaboratorName}</div>
                      <div className="text-xs text-rose-600">Số tiền sẽ trừ vào kỳ lương này.</div>
                  </div>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Số tiền phạt</label>
                  <input type="number" className="w-full border-2 border-slate-200 rounded-xl p-3 text-lg font-black text-rose-600 outline-none focus:border-rose-500" placeholder="0" value={fineAmount} onChange={e => setFineAmount(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lý do</label>
                  <textarea className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm h-24 outline-none focus:border-rose-500" placeholder="VD: Đi muộn, làm vỡ đồ..." value={fineReason} onChange={e => setFineReason(e.target.value)}></textarea>
              </div>
              <div className="flex gap-2 pt-2">
                  <button onClick={() => setFineModalOpen(false)} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold text-xs uppercase hover:bg-slate-200">Hủy</button>
                  <button onClick={handleSubmitFine} className="flex-[2] py-3 bg-rose-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-rose-700 shadow-lg flex items-center justify-center gap-2"><Gavel size={16}/> Xác Nhận Phạt</button>
              </div>
          </div>
      </Modal>

      {/* Advance Modal */}
      <Modal isOpen={isAdvanceModalOpen} onClose={() => setAdvanceModalOpen(false)} title={isSelfRequest ? "Xin Ứng Lương" : "Tạo Phiếu Ứng Lương"} size="sm">
          <div className="space-y-4">
              {isSelfRequest && <div className="bg-brand-50 border border-brand-200 rounded-xl p-3"><p className="text-xs text-brand-800 font-medium">Lương ước tính hiện tại: <b>{myFinancialStats.estimatedSalary.toLocaleString()} ₫</b></p></div>}
              {!isSelfRequest && advanceStaff && (
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-500 shadow-sm border border-emerald-100 font-bold">{advanceStaff.collaboratorName.charAt(0)}</div>
                      <div><div className="text-sm font-bold text-emerald-800">Ứng lương: {advanceStaff.collaboratorName}</div><div className="text-xs text-emerald-600">Số tiền sẽ được ghi nhận là Đã Ứng.</div></div>
                  </div>
              )}
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Số tiền ứng</label>
                  <input type="number" className="w-full border-2 border-slate-200 rounded-xl p-3 text-lg font-black text-emerald-600 outline-none focus:border-emerald-500" placeholder="0" value={advanceAmount} onChange={e => setAdvanceAmount(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lý do</label>
                  <textarea className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm h-24 outline-none focus:border-emerald-500" placeholder="VD: Cần tiền gấp..." value={advanceReason} onChange={e => setAdvanceReason(e.target.value)}></textarea>
              </div>
              <div className="flex gap-2 pt-2">
                  <button onClick={() => setAdvanceModalOpen(false)} disabled={isProcessing} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold text-xs uppercase hover:bg-slate-200">Hủy</button>
                  <button onClick={handleSubmitAdvance} disabled={isProcessing} className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-2">
                      {isProcessing ? <Loader2 size={16} className="animate-spin"/> : isSelfRequest ? <Send size={16}/> : <Banknote size={16}/>} {isSelfRequest ? 'Gửi Yêu Cầu' : 'Xác Nhận Ứng'}
                  </button>
              </div>
          </div>
      </Modal>

      {/* Leave Modal */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="Gửi đơn xin nghỉ phép" size="sm">
          <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 border border-blue-100"><span className="font-bold">Lưu ý:</span> Đơn sẽ được gửi cho Quản lý và tự động báo Zalo sau khi duyệt.</div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Từ ngày</label>
                      <input type="date" className="w-full border rounded-lg p-2.5 text-sm" value={leaveForm.start_date} min={leaveForm.leave_type === 'Nghỉ ốm' ? undefined : format(new Date(), 'yyyy-MM-dd')} onChange={e => { const newStart = e.target.value; setLeaveForm(prev => ({ ...prev, start_date: newStart, end_date: (prev.end_date && prev.end_date < newStart) ? newStart : prev.end_date })); }} />
                  </div>
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Đến ngày</label>
                      <input type="date" className="w-full border rounded-lg p-2.5 text-sm" value={leaveForm.end_date} min={leaveForm.start_date} onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} />
                  </div>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Loại nghỉ</label>
                  <select className="w-full border rounded-lg p-2.5 text-sm" value={leaveForm.leave_type} onChange={e => setLeaveForm({...leaveForm, leave_type: e.target.value as any})}>
                      <option value="Nghỉ phép năm">Nghỉ phép năm</option>
                      <option value="Nghỉ ốm">Nghỉ ốm</option>
                      <option value="Việc riêng">Việc riêng</option>
                      <option value="Không lương">Không lương</option>
                      <option value="Chế độ">Chế độ</option>
                  </select>
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Lý do</label>
                  <textarea className="w-full border rounded-lg p-2.5 text-sm h-24" placeholder="Nhập lý do cụ thể..." value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}></textarea>
              </div>
              <div className="flex gap-2 pt-2">
                  <button onClick={() => setLeaveModalOpen(false)} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200">Hủy</button>
                  <button onClick={submitLeaveRequest} className="flex-[2] py-3 bg-brand-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-700 shadow-lg">Gửi Đơn</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
