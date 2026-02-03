
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Collaborator, Facility, Room, Booking, ServiceItem, Expense, 
  Shift, ShiftSchedule, AttendanceAdjustment, LeaveRequest, 
  HousekeepingTask, WebhookConfig, InventoryTransaction, 
  Settings, RoomRecipe, BankAccount, TimeLog, OtaOrder, 
  ToastMessage, GuestProfile, LendingItem, SalaryAdvance, Violation
} from '../types';
import { ROLE_PERMISSIONS, DEFAULT_SETTINGS } from '../constants';
import { storageService } from '../services/storage';
import { supabase } from '../services/supabaseClient';

interface AppContextType {
  currentUser: Collaborator | null;
  setCurrentUser: (user: Collaborator | null) => void;
  isLoading: boolean;
  isInitialized: boolean;
  
  facilities: Facility[];
  rooms: Room[];
  bookings: Booking[];
  services: ServiceItem[];
  expenses: Expense[];
  collaborators: Collaborator[];
  housekeepingTasks: HousekeepingTask[];
  inventoryTransactions: InventoryTransaction[];
  shifts: Shift[];
  schedules: ShiftSchedule[];
  adjustments: AttendanceAdjustment[];
  leaveRequests: LeaveRequest[];
  otaOrders: OtaOrder[];
  timeLogs: TimeLog[];
  bankAccounts: BankAccount[];
  salaryAdvances: SalaryAdvance[];
  violations: Violation[];
  
  settings: Settings;
  roomRecipes: Record<string, RoomRecipe>;
  webhooks: WebhookConfig[];
  currentShift: Shift | null;
  toasts: ToastMessage[];

  // Methods
  refreshData: (full?: boolean) => Promise<void>;
  canAccess: (path: string) => boolean;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: number) => void;
  
  // CRUD
  addFacility: (item: Facility) => Promise<void>;
  updateFacility: (item: Facility) => Promise<void>;
  deleteFacility: (id: string) => Promise<void>;
  
  upsertRoom: (item: Room) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  
  addBooking: (item: Booking) => Promise<boolean>;
  updateBooking: (item: Booking) => Promise<boolean>;
  checkAvailability: (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => boolean;
  
  addService: (item: ServiceItem) => Promise<void>;
  updateService: (item: ServiceItem) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  
  addExpense: (item: Expense) => Promise<void>;
  updateExpense: (item: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  addCollaborator: (item: Collaborator) => Promise<void>;
  updateCollaborator: (item: Collaborator) => Promise<void>;
  deleteCollaborator: (id: string) => Promise<void>;
  
  syncHousekeepingTasks: (tasks: HousekeepingTask[]) => Promise<void>;
  addInventoryTransaction: (item: InventoryTransaction) => Promise<void>;
  
  openShift: (startCash: number) => Promise<void>;
  closeShift: (endCash: number, note: string) => Promise<void>;
  
  clockIn: (facilityId: string, lat: number, lng: number) => Promise<{success: boolean, message: string}>;
  clockOut: () => Promise<{success: boolean, message: string}>;
  
  addLeaveRequest: (item: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (item: LeaveRequest) => Promise<void>;
  
  // Phase 2: Salary Advances & Violations
  requestAdvance: (amount: number, reason: string) => Promise<void>;
  approveAdvance: (advanceId: string, isApproved: boolean) => Promise<void>;
  addViolation: (staffId: string, amount: number, reason: string, evidence?: string) => Promise<void>;

  upsertSchedule: (item: ShiftSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  upsertAdjustment: (item: AttendanceAdjustment) => Promise<void>;
  
  // Settings & Config
  updateSettings: (s: Settings) => Promise<void>;
  updateRoomRecipe: (id: string, recipe: RoomRecipe) => Promise<void>;
  deleteRoomRecipe: (id: string) => Promise<void>;
  addWebhook: (w: WebhookConfig) => Promise<void>;
  updateWebhook: (w: WebhookConfig) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  triggerWebhook: (eventType: string, payload: any) => Promise<void>;
  
  getGeminiApiKey: () => Promise<string | null>;
  setAppConfig: (config: {key: string, value: string, description?: string}) => Promise<void>;
  
  addGuestProfile: (p: GuestProfile) => Promise<void>;
  
  // OTA
  syncOtaOrders: (orders?: OtaOrder[], silent?: boolean) => Promise<void>;
  queryOtaOrders: (params: { page: number, pageSize: number, tab: string, search: string, dateFilter?: any }) => Promise<{ data: OtaOrder[], hasMore: boolean }>;
  updateOtaOrder: (id: string, updates: Partial<OtaOrder>) => Promise<void>;
  deleteOtaOrder: (id: string) => Promise<void>;
  confirmOtaCancellation: (order: OtaOrder) => Promise<void>;
  
  // Bank Accounts
  addBankAccount: (b: BankAccount) => Promise<void>;
  updateBankAccount: (b: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  // Processors
  processMinibarUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processLendingUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processRoomRestock: (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => Promise<void>;
  processCheckoutLinenReturn: (facilityName: string, roomCode: string) => Promise<void>; // Legacy placeholder
  handleLinenExchange: (facilityName: string, roomCode: string, items: any[]) => Promise<void>; // Legacy placeholder
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapOtaData = (data: any[]): OtaOrder[] => {
  return data.map(d => ({
    id: d.id,
    platform: d.platform,
    bookingCode: d.booking_code,
    guestName: d.guest_name,
    guestPhone: d.guest_phone,
    emailDate: d.email_date,
    checkIn: d.check_in,
    checkOut: d.check_out,
    roomType: d.room_type,
    roomQuantity: d.room_quantity,
    guestCount: d.guest_count,
    guestDetails: d.guest_details,
    breakfastStatus: d.breakfast_status,
    totalAmount: d.total_amount,
    netAmount: d.net_amount,
    paymentStatus: d.payment_status,
    status: d.status,
    assignedRoom: d.assigned_room,
    cancellationDate: d.cancellation_date,
    notes: d.notes,
    rawJson: d.raw_json
  }));
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Data States
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [otaOrders, setOtaOrders] = useState<OtaOrder[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvance[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [roomRecipes, setRoomRecipes] = useState<Record<string, RoomRecipe>>({});
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);

  // Auth & Init
  useEffect(() => {
    const init = async () => {
        const user = storageService.getUser();
        if (user) setCurrentUser(user);
        
        await storageService.checkConnection();
        // Load settings first as they are critical
        const [sets, recipes, banks] = await Promise.all([
            storageService.getSettings(),
            storageService.getRoomRecipes(),
            storageService.getBankAccounts()
        ]);
        setSettings(sets);
        setRoomRecipes(recipes);
        setBankAccounts(banks);
        
        // Load data if user is logged in
        if (user) {
            await refreshData(true);
        }
        setIsInitialized(true);
    };
    init();
  }, []);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const refreshData = async (full = false) => {
      setIsLoading(true);
      try {
          const [
              facs, rms, bks, svcs, exps, collabs, tasks, trans, shfts, schs, adjs, leaves, logs, whs, advs, vios
          ] = await Promise.all([
              storageService.getFacilities(),
              storageService.getRooms(),
              storageService.getBookings(),
              storageService.getServices(),
              storageService.getExpenses(),
              storageService.getCollaborators(),
              storageService.getHousekeepingTasks(),
              storageService.getInventoryTransactions(),
              storageService.getShifts(),
              storageService.getSchedules(),
              storageService.getAdjustments(),
              storageService.getLeaveRequests(),
              storageService.getTimeLogs(),
              storageService.getWebhooks(),
              storageService.getSalaryAdvances(),
              storageService.getViolations()
          ]);

          setFacilities(facs);
          setRooms(rms);
          setBookings(bks);
          setServices(svcs);
          setExpenses(exps);
          setCollaborators(collabs);
          setHousekeepingTasks(tasks);
          setInventoryTransactions(trans);
          setShifts(shfts);
          setSchedules(schs);
          setAdjustments(adjs);
          setLeaveRequests(leaves);
          setTimeLogs(logs);
          setWebhooks(whs);
          setSalaryAdvances(advs);
          setViolations(vios);
          
          if (full) {
              await syncOtaOrders(undefined, true);
          }
      } catch (e) {
          console.error("Refresh Error", e);
          if(!storageService.isUsingMock()) notify('error', 'Lỗi tải dữ liệu');
      } finally {
          setIsLoading(false);
      }
  };

  const canAccess = (path: string) => {
      if (!currentUser) return false;
      const allowed = ROLE_PERMISSIONS[currentUser.role] || [];
      return allowed.some(p => path.startsWith(p));
  };

  // --- CRUD WRAPPERS ---
  const addFacility = async (item: Facility) => { await storageService.addFacility(item); refreshData(); };
  const updateFacility = async (item: Facility) => { await storageService.updateFacility(item); refreshData(); };
  const deleteFacility = async (id: string) => { await storageService.deleteFacility(id); refreshData(); };

  const upsertRoom = async (item: Room) => { await storageService.upsertRoom(item); refreshData(); };
  const deleteRoom = async (id: string) => { await storageService.deleteRoom(id); refreshData(); };

  const addBooking = async (item: Booking) => { await storageService.addBooking(item); refreshData(); return true; };
  const updateBooking = async (item: Booking) => { await storageService.updateBooking(item); refreshData(); return true; };

  const addService = async (item: ServiceItem) => { await storageService.addService(item); refreshData(); };
  const updateService = async (item: ServiceItem) => { await storageService.updateService(item); refreshData(); };
  const deleteService = async (id: string) => { await storageService.deleteService(id); refreshData(); };

  const addExpense = async (item: Expense) => { await storageService.addExpense(item); refreshData(); };
  const updateExpense = async (item: Expense) => { await storageService.updateExpense(item); refreshData(); };
  const deleteExpense = async (id: string) => { await storageService.deleteExpense(id); refreshData(); };

  const addCollaborator = async (item: Collaborator) => { await storageService.addCollaborator(item); refreshData(); };
  const updateCollaborator = async (item: Collaborator) => { await storageService.updateCollaborator(item); refreshData(); };
  const deleteCollaborator = async (id: string) => { await storageService.deleteCollaborator(id); refreshData(); };

  const syncHousekeepingTasks = async (tasks: HousekeepingTask[]) => { await storageService.syncHousekeepingTasks(tasks); refreshData(); };
  
  const addInventoryTransaction = async (item: InventoryTransaction) => { await storageService.addInventoryTransaction(item); refreshData(); };

  // --- SHIFTS ---
  const openShift = async (startCash: number) => {
      if (!currentUser) return;
      const shift: Shift = {
          id: `SH-${Date.now()}`,
          staff_id: currentUser.id,
          staff_name: currentUser.collaboratorName,
          start_time: new Date().toISOString(),
          start_cash: startCash,
          total_revenue_cash: 0,
          total_expense_cash: 0,
          end_cash_expected: startCash,
          status: 'Open'
      };
      await storageService.addShift(shift);
      refreshData();
  };

  const closeShift = async (endCash: number, note: string) => {
      const active = shifts.find(s => s.staff_id === currentUser?.id && s.status === 'Open');
      if (active) {
          await storageService.updateShift({
              ...active,
              end_time: new Date().toISOString(),
              end_cash_actual: endCash,
              difference: endCash - active.end_cash_expected,
              note,
              status: 'Closed'
          });
          refreshData();
      }
  };

  const currentShift = React.useMemo(() => shifts.find(s => s.staff_id === currentUser?.id && s.status === 'Open') || null, [shifts, currentUser]);

  // --- OTHER FEATURES ---
  const checkAvailability = (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => {
      const start = new Date(checkIn).getTime();
      const end = new Date(checkOut).getTime();
      
      return !bookings.some(b => {
          if (b.id === excludeId) return false;
          if (b.facilityName !== facilityName || b.roomCode !== roomCode) return false;
          if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
          
          const bStart = new Date(b.checkinDate).getTime();
          const bEnd = new Date(b.checkoutDate).getTime();
          
          // Check overlap
          return (start < bEnd && end > bStart);
      });
  };

  const clockIn = async (facilityId: string, lat: number, lng: number) => {
      if (!currentUser) return { success: false, message: 'No user' };
      const res = await storageService.clockIn(currentUser.id, facilityId, lat, lng);
      refreshData();
      notify(res.success ? 'success' : 'info', res.message);
      return res;
  };

  const clockOut = async () => {
      if (!currentUser) return { success: false, message: 'No user' };
      const res = await storageService.clockOut(currentUser.id);
      refreshData();
      notify(res.success ? 'success' : 'info', res.message);
      return res;
  };

  const addLeaveRequest = async (item: LeaveRequest) => { await storageService.addLeaveRequest(item); refreshData(); };
  const updateLeaveRequest = async (item: LeaveRequest) => { await storageService.updateLeaveRequest(item); refreshData(); };

  // --- PHASE 2: SALARY ADVANCE & VIOLATIONS ---
  const requestAdvance = async (amount: number, reason: string) => {
      if (!currentUser) return;
      const item: SalaryAdvance = {
          id: `ADV-${Date.now()}`,
          staff_id: currentUser.id,
          amount,
          reason,
          status: 'Pending',
          request_date: new Date().toISOString(),
          created_at: new Date().toISOString()
      };
      await storageService.addSalaryAdvance(item);
      refreshData();
      notify('success', 'Đã gửi yêu cầu ứng lương.');
  };

  const approveAdvance = async (advanceId: string, isApproved: boolean) => {
      const advance = salaryAdvances.find(a => a.id === advanceId);
      if (!advance) return;

      const newStatus = isApproved ? 'Approved' : 'Rejected';
      await storageService.updateSalaryAdvance({ ...advance, status: newStatus });

      if (isApproved) {
          // Auto-create Expense (Business Logic)
          const staffName = collaborators.find(c => c.id === advance.staff_id)?.collaboratorName || 'N/A';
          const expense: Expense = {
              id: `EXP-ADV-${Date.now()}`,
              expenseDate: new Date().toISOString().substring(0, 10), // Today YYYY-MM-DD
              facilityName: facilities[0]?.facilityName || 'General', // Fallback to first facility
              expenseCategory: 'Lương nhân viên',
              expenseContent: `Chi ứng lương cho ${staffName}`,
              amount: advance.amount,
              note: `Tự động tạo từ yêu cầu ứng lương ${advance.id}`
          };
          await storageService.addExpense(expense);
          notify('success', `Đã duyệt và tạo phiếu chi ${advance.amount.toLocaleString()}đ`);
      } else {
          notify('info', 'Đã từ chối yêu cầu ứng lương.');
      }
      refreshData();
  };

  const addViolation = async (staffId: string, amount: number, reason: string, evidence?: string) => {
      const item: Violation = {
          id: `VIO-${Date.now()}`,
          staff_id: staffId,
          type: 'Manual',
          violation_name: reason,
          fine_amount: amount,
          evidence_url: evidence,
          status: 'Pending_Deduction',
          date: new Date().toISOString(),
          created_at: new Date().toISOString()
      };
      await storageService.addViolation(item);
      refreshData();
      notify('success', 'Đã ghi nhận lỗi vi phạm.');
  };

  const upsertSchedule = async (item: ShiftSchedule) => { await storageService.upsertSchedule(item); refreshData(); };
  const deleteSchedule = async (id: string) => { await storageService.deleteSchedule(id); refreshData(); };
  const upsertAdjustment = async (item: AttendanceAdjustment) => { await storageService.upsertAdjustment(item); refreshData(); };

  const updateSettings = async (s: Settings) => { await storageService.saveSettings(s); setSettings(s); };
  const updateRoomRecipe = async (id: string, recipe: RoomRecipe) => { await storageService.upsertRoomRecipe(recipe); setRoomRecipes(await storageService.getRoomRecipes()); };
  const deleteRoomRecipe = async (id: string) => { await storageService.deleteRoomRecipe(id); setRoomRecipes(await storageService.getRoomRecipes()); };

  const addWebhook = async (w: WebhookConfig) => { await storageService.addWebhook(w); refreshData(); };
  const updateWebhook = async (w: WebhookConfig) => { await storageService.updateWebhook(w); refreshData(); };
  const deleteWebhook = async (id: string) => { await storageService.deleteWebhook(id); refreshData(); };

  const triggerWebhook = async (eventType: string, payload: any) => {
      const targets = webhooks.filter(w => w.is_active && w.event_type === eventType);
      targets.forEach(w => {
          fetch(w.url, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          }).catch(e => console.error("Webhook trigger failed", e));
      });
  };

  const getGeminiApiKey = async () => await storageService.getAppConfig('GEMINI_API_KEY');
  const setAppConfig = async (config: {key: string, value: string, description?: string}) => { await storageService.setAppConfig(config); };
  const addGuestProfile = async (p: GuestProfile) => { await storageService.addGuestProfile(p); };

  const addBankAccount = async (b: BankAccount) => { await storageService.addBankAccount(b); setBankAccounts(await storageService.getBankAccounts()); };
  const updateBankAccount = async (b: BankAccount) => { await storageService.updateBankAccount(b); setBankAccounts(await storageService.getBankAccounts()); };
  const deleteBankAccount = async (id: string) => { await storageService.deleteBankAccount(id); setBankAccounts(await storageService.getBankAccounts()); };

  // --- OTA LOGIC (UPDATED) ---
  const syncOtaOrders = async (orders?: OtaOrder[], silent = false) => {
      if (storageService.isUsingMock()) return;
      if (!silent) setIsLoading(true);
      try {
          // Fetch Pending or Cancelled (Active Attention Needed)
          const { data, error } = await supabase
              .from('ota_orders')
              .select('*')
              .in('status', ['Pending', 'Cancelled'])
              .order('email_date', { ascending: false });

          if (error) throw error;
          
          if (data) {
              const mapped = mapOtaData(data);
              setOtaOrders(mapped);
              if (!silent) notify('success', 'Đã đồng bộ đơn OTA');
          }
      } catch (e) {
          console.error(e);
          if (!silent) notify('error', 'Lỗi đồng bộ OTA');
      } finally {
          if (!silent) setIsLoading(false);
      }
  };

  const queryOtaOrders = async (params: { page: number, pageSize: number, tab: string, search: string, dateFilter?: any }) => {
      if (storageService.isUsingMock()) return { data: [], hasMore: false };
      
      let query = supabase.from('ota_orders').select('*').order('email_date', { ascending: false });

      // Filters based on new logic
      if (params.tab === 'Pending') query = query.in('status', ['Pending', 'Cancelled']);
      else if (params.tab === 'Processed') query = query.eq('status', 'Assigned');
      else if (params.tab === 'Cancelled') query = query.eq('status', 'Confirmed'); // History tab shows confirmed cancellations
      else if (params.tab === 'Today') {
          const today = new Date().toISOString().substring(0, 10);
          query = query.gte('check_in', `${today}T00:00:00`).lte('check_in', `${today}T23:59:59`);
      }

      if (params.search) {
          query = query.or(`guest_name.ilike.%${params.search}%,booking_code.ilike.%${params.search}%`);
      }

      if (params.dateFilter) {
          if (params.dateFilter.mode === 'day') {
              query = query.gte('check_in', `${params.dateFilter.value}T00:00:00`).lte('check_in', `${params.dateFilter.value}T23:59:59`);
          } else if (params.dateFilter.mode === 'month') {
              const [y, m] = params.dateFilter.value.split('-');
              const start = new Date(Number(y), Number(m) - 1, 1).toISOString();
              const end = new Date(Number(y), Number(m), 0, 23, 59, 59).toISOString();
              query = query.gte('check_in', start).lte('check_in', end);
          }
      }

      const from = params.page * params.pageSize;
      const to = from + params.pageSize - 1;
      
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      
      return { 
          data: data ? mapOtaData(data) : [], 
          hasMore: (data || []).length === params.pageSize 
      };
  };

  const updateOtaOrder = async (id: string, updates: Partial<OtaOrder>) => {
      // Optimistic update
      setOtaOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteOtaOrder = async (id: string) => {
      if (storageService.isUsingMock()) return;
      await supabase.from('ota_orders').delete().eq('id', id);
      setOtaOrders(prev => prev.filter(o => o.id !== id));
  };

  const confirmOtaCancellation = async (order: OtaOrder) => {
      // Update status to 'Confirmed'
      await supabase.from('ota_orders').update({
          status: 'Confirmed'
      }).eq('id', order.id);
      
      // Update local state
      setOtaOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Confirmed' } : o));
      
      // Trigger Webhook to update Sheet
      triggerWebhook('ota_import', {
          action: 'confirm_cancel',
          bookingCode: order.bookingCode,
          status: 'Đã hủy & Xác nhận'
      });
  };

  // --- SPECIAL PROCESSORS ---
  const processMinibarUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      // 1. Deduct Inventory & Create Transaction
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const newStock = Math.max(0, (service.stock || 0) - item.qty);
              await updateService({ ...service, stock: newStock });
              
              await addInventoryTransaction({
                  id: `TR-MB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYS',
                  staff_name: currentUser?.collaboratorName || 'System',
                  item_id: service.id,
                  item_name: service.name,
                  type: 'MINIBAR_SOLD',
                  quantity: item.qty,
                  price: service.costPrice || 0,
                  total: (service.costPrice || 0) * item.qty,
                  facility_name: facilityName,
                  note: `Khách dùng tại phòng ${roomCode}`
              });
          }
      }

      // 2. Add to Booking Services (Bill)
      const booking = bookings.find(b => b.facilityName === facilityName && b.roomCode === roomCode && (b.status === 'CheckedIn' || b.status === 'Confirmed'));
      if (booking) {
          const currentServices = booking.servicesJson ? JSON.parse(booking.servicesJson) : [];
          for (const item of items) {
              const service = services.find(s => s.id === item.itemId);
              if (service && service.price > 0) {
                  const existing = currentServices.find((s: any) => s.serviceId === item.itemId);
                  if (existing) {
                      existing.quantity += item.qty;
                      existing.total = existing.quantity * existing.price;
                  } else {
                      currentServices.push({
                          serviceId: service.id,
                          name: service.name,
                          price: service.price,
                          quantity: item.qty,
                          total: service.price * item.qty,
                          time: new Date().toISOString()
                      });
                  }
              }
          }
          await updateBooking({ ...booking, servicesJson: JSON.stringify(currentServices) });
      }
  };

  const processRoomRestock = async (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => {
      // 1. Return Dirty: In Room -> Laundry (Dirty)
      // 2. Restock Clean: Stock (Clean) -> In Room
      
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              let updatedService = { ...service };
              
              // Return Dirty Logic
              if (item.dirtyReturnQty > 0) {
                  updatedService.in_circulation = Math.max(0, (updatedService.in_circulation || 0) - item.dirtyReturnQty);
                  updatedService.laundryStock = (updatedService.laundryStock || 0) + item.dirtyReturnQty;
              }

              // Restock Clean Logic
              if (item.cleanRestockQty > 0) {
                  updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.cleanRestockQty);
                  updatedService.in_circulation = (updatedService.in_circulation || 0) + item.cleanRestockQty;
              }

              await updateService(updatedService);
          }
      }
  };

  const processLendingUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      // Stock -> In Circulation
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const updatedService = { ...service };
              updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.qty);
              updatedService.in_circulation = (updatedService.in_circulation || 0) + item.qty;
              await updateService(updatedService);

              // LOG TRANSACTION
              const trans: InventoryTransaction = {
                  id: `TR-LEND-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYS',
                  staff_name: currentUser?.collaboratorName || 'System',
                  item_id: service.id,
                  item_name: service.name,
                  type: 'OUT',
                  quantity: item.qty,
                  price: service.costPrice || 0,
                  total: (service.costPrice || 0) * item.qty,
                  facility_name: facilityName,
                  note: `Khách mượn tại phòng ${roomCode} (Booking)`
              };
              await addInventoryTransaction(trans);
          }
      }
  };

  // Placeholders for legacy compatibility
  const processCheckoutLinenReturn = async () => {};
  const handleLinenExchange = async () => {};

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, isLoading, isInitialized,
      facilities, rooms, bookings, services, expenses, collaborators,
      housekeepingTasks, inventoryTransactions, shifts, schedules, adjustments,
      leaveRequests, otaOrders, timeLogs, bankAccounts, salaryAdvances, violations,
      settings, roomRecipes, webhooks, currentShift, toasts,
      
      refreshData, canAccess, notify, removeToast,
      addFacility, updateFacility, deleteFacility,
      upsertRoom, deleteRoom,
      addBooking, updateBooking, checkAvailability,
      addService, updateService, deleteService,
      addExpense, updateExpense, deleteExpense,
      addCollaborator, updateCollaborator, deleteCollaborator,
      syncHousekeepingTasks, addInventoryTransaction,
      openShift, closeShift, clockIn, clockOut,
      addLeaveRequest, updateLeaveRequest,
      requestAdvance, approveAdvance, addViolation,
      upsertSchedule, deleteSchedule, upsertAdjustment,
      updateSettings, updateRoomRecipe, deleteRoomRecipe,
      addWebhook, updateWebhook, deleteWebhook, triggerWebhook,
      getGeminiApiKey, setAppConfig, addGuestProfile,
      addBankAccount, updateBankAccount, deleteBankAccount,
      
      syncOtaOrders, queryOtaOrders, updateOtaOrder, deleteOtaOrder, confirmOtaCancellation,
      
      processMinibarUsage, processLendingUsage, processRoomRestock,
      processCheckoutLinenReturn, handleLinenExchange
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
