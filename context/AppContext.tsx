import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Booking, Room, Facility, Collaborator, ServiceItem, Expense, Settings, 
  InventoryTransaction, TimeLog, ShiftSchedule, AttendanceAdjustment, 
  LeaveRequest, OtaOrder, HousekeepingTask, GuestProfile, Shift, RoomRecipe, 
  BankAccount, ToastMessage, WebhookConfig, AppConfig, Role 
} from '../types';
import { storageService, IS_USING_MOCK } from '../services/storage';
import { DEFAULT_SETTINGS, ROLE_PERMISSIONS, ROOM_RECIPES } from '../constants';
import { parseISO, isValid } from 'date-fns';

interface AppContextType {
  // Data
  bookings: Booking[];
  rooms: Room[];
  facilities: Facility[];
  collaborators: Collaborator[];
  services: ServiceItem[];
  expenses: Expense[];
  settings: Settings;
  inventoryTransactions: InventoryTransaction[];
  timeLogs: TimeLog[];
  schedules: ShiftSchedule[];
  adjustments: AttendanceAdjustment[];
  leaveRequests: LeaveRequest[];
  otaOrders: OtaOrder[];
  housekeepingTasks: HousekeepingTask[];
  shifts: Shift[];
  roomRecipes: Record<string, RoomRecipe>;
  bankAccounts: BankAccount[];
  webhooks: WebhookConfig[];
  
  // User & Auth
  currentUser: Collaborator | null;
  setCurrentUser: (user: Collaborator | null) => void;
  canAccess: (path: string) => boolean;
  
  // State
  isLoading: boolean;
  isInitialized: boolean;
  toasts: ToastMessage[];
  currentShift: Shift | null;

  // Actions - Core
  refreshData: (force?: boolean) => Promise<void>;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: number) => void;

  // Actions - Booking
  addBooking: (booking: Booking) => Promise<boolean>;
  updateBooking: (booking: Booking) => Promise<boolean>;
  deleteBooking: (id: string) => Promise<boolean>;
  checkAvailability: (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => boolean;

  // Actions - Room & Facility
  addFacility: (facility: Facility) => Promise<void>;
  updateFacility: (facility: Facility) => Promise<void>;
  deleteFacility: (id: string) => Promise<void>;
  upsertRoom: (room: Room) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;

  // Actions - Collaborator
  addCollaborator: (collaborator: Collaborator) => Promise<void>;
  updateCollaborator: (collaborator: Collaborator) => Promise<void>;
  deleteCollaborator: (id: string) => Promise<void>;

  // Actions - Service & Inventory
  addService: (service: ServiceItem) => Promise<void>;
  updateService: (service: ServiceItem) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  addInventoryTransaction: (transaction: InventoryTransaction) => Promise<void>;
  
  // Actions - Expenses
  addExpense: (expense: Expense) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  // Actions - Settings & Config
  updateSettings: (settings: Settings) => Promise<void>;
  getGeminiApiKey: () => Promise<string | null>;
  setAppConfig: (config: AppConfig) => Promise<void>;
  updateRoomRecipe: (key: string, recipe: RoomRecipe) => Promise<void>;
  deleteRoomRecipe: (key: string) => Promise<void>;
  
  // Actions - Bank Accounts
  addBankAccount: (account: BankAccount) => Promise<void>;
  updateBankAccount: (account: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  // Actions - Webhooks
  addWebhook: (webhook: WebhookConfig) => Promise<void>;
  updateWebhook: (webhook: WebhookConfig) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  triggerWebhook: (eventType: string, payload: any) => Promise<void>;

  // Actions - Timekeeping & Shifts
  clockIn: (facilityId: string, lat: number, lng: number) => Promise<{success: boolean, message: string}>;
  clockOut: () => Promise<{success: boolean, message: string}>;
  upsertSchedule: (schedule: ShiftSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  upsertAdjustment: (adjustment: AttendanceAdjustment) => Promise<void>;
  addLeaveRequest: (request: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (request: LeaveRequest) => Promise<void>;
  openShift: (startCash: number) => Promise<void>;
  closeShift: (endCashActual: number, note: string) => Promise<void>;
  getShifts: () => Promise<Shift[]>;

  // Actions - Housekeeping & Guests
  syncHousekeepingTasks: (tasks: HousekeepingTask[]) => Promise<void>;
  addGuestProfile: (profile: GuestProfile) => Promise<void>;
  
  // Actions - OTA
  syncOtaOrders: (orders?: OtaOrder[], silent?: boolean) => Promise<void>;
  queryOtaOrders: (params: any) => Promise<{data: OtaOrder[], hasMore: boolean}>;
  updateOtaOrder: (id: string, updates: Partial<OtaOrder>) => Promise<void>;
  confirmOtaCancellation: (order: OtaOrder) => Promise<void>;
  deleteOtaOrder: (id: string) => Promise<void>;

  // Specialized Processes
  processLendingUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processMinibarUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processCheckoutLinenReturn: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processRoomRestock: (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => Promise<void>;
  handleLinenExchange: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [otaOrders, setOtaOrders] = useState<OtaOrder[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [roomRecipes, setRoomRecipes] = useState<Record<string, RoomRecipe>>(ROOM_RECIPES);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);

  // Auth & State
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initial Load
  useEffect(() => {
    const init = async () => {
      // 1. Check Connection
      await storageService.checkConnection();
      
      // 2. Load User from LocalStorage
      const savedUser = storageService.getUser();
      if (savedUser) setCurrentUser(savedUser);

      // 3. Load Data
      await refreshData();
      setIsInitialized(true);
    };
    init();
  }, []);

  const refreshData = async (force = false) => {
    if (isLoading && !force) return;
    setIsLoading(true);
    try {
        const [
            bs, rs, fs, cs, ss, es, sett, inv, tls, sch, adj, lrs, hks, sh, rr, ba, wh
        ] = await Promise.all([
            storageService.getBookings(),
            storageService.getRooms(),
            storageService.getFacilities(),
            storageService.getCollaborators(),
            storageService.getServices(),
            storageService.getExpenses(),
            storageService.getSettings(),
            storageService.getInventoryTransactions(),
            storageService.getTimeLogs(),
            storageService.getSchedules(),
            storageService.getAdjustments(),
            storageService.getLeaveRequests(),
            storageService.getHousekeepingTasks(),
            storageService.getShifts(),
            storageService.getRoomRecipes(),
            storageService.getBankAccounts(),
            storageService.getWebhooks()
        ]);

        setBookings(bs);
        setRooms(rs);
        setFacilities(fs);
        setCollaborators(cs);
        setServices(ss);
        setExpenses(es);
        setSettings(sett);
        setInventoryTransactions(inv);
        setTimeLogs(tls);
        setSchedules(sch);
        setAdjustments(adj);
        setLeaveRequests(lrs);
        setHousekeepingTasks(hks);
        setShifts(sh);
        setRoomRecipes(rr);
        setBankAccounts(ba);
        setWebhooks(wh);
    } catch (e) {
        console.error("Failed to refresh data", e);
        notify('error', 'Lỗi đồng bộ dữ liệu. Đang dùng chế độ offline.');
    } finally {
        setIsLoading(false);
    }
  };

  const currentShift = useMemo(() => {
      if (!currentUser) return null;
      return shifts.find(s => s.staff_id === currentUser.id && s.status === 'Open') || null;
  }, [shifts, currentUser]);

  const notify = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 3000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const canAccess = (path: string): boolean => {
    if (!currentUser) return false;
    const allowed = ROLE_PERMISSIONS[currentUser.role];
    if (!allowed) return false;
    return allowed.some(p => path.startsWith(p) || p === path);
  };

  // --- CRUD ACTIONS ---

  const checkAvailability = (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => {
      if (!checkIn || !checkOut) return true;
      const start = parseISO(checkIn);
      const end = parseISO(checkOut);
      
      if (!isValid(start) || !isValid(end)) return true;

      // Check overlaps
      const hasConflict = bookings.some(b => {
          if (b.id === excludeId) return false;
          if (b.facilityName !== facilityName || b.roomCode !== roomCode) return false;
          if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;

          const bStart = parseISO(b.checkinDate);
          const bEnd = parseISO(b.checkoutDate);
          if (!isValid(bStart) || !isValid(bEnd)) return false;

          // Logic trùng: (StartA < EndB) and (EndA > StartB)
          // Standard hotel logic usually: CheckIn time 14:00, CheckOut 12:00.
          // Simple overlap logic:
          return (start < bEnd && end > bStart);
      });

      return !hasConflict;
  };

  const addBooking = async (booking: Booking) => {
      await storageService.addBooking(booking);
      setBookings(prev => [...prev, booking]);
      return true;
  };

  const updateBooking = async (booking: Booking) => {
      await storageService.updateBooking(booking);
      setBookings(prev => prev.map(b => b.id === booking.id ? booking : b));
      return true;
  };

  const deleteBooking = async (id: string) => {
      // In this system we usually cancel instead of delete, but this might be used for cleanup
      // storageService doesn't have deleteBooking, assuming we update status to Cancelled usually
      // If we need hard delete, implement in storage service.
      return false; 
  };

  const addFacility = async (item: Facility) => {
      await storageService.addFacility(item);
      setFacilities(prev => [...prev, item]);
  };

  const updateFacility = async (item: Facility) => {
      await storageService.updateFacility(item);
      setFacilities(prev => prev.map(f => f.id === item.id ? item : f));
  };

  const deleteFacility = async (id: string) => {
      await storageService.deleteFacility(id);
      setFacilities(prev => prev.filter(f => f.id !== id));
      setRooms(prev => prev.filter(r => r.facility_id !== id)); // Cascade
  };

  const upsertRoom = async (item: Room) => {
      await storageService.upsertRoom(item);
      setRooms(prev => {
          const idx = prev.findIndex(r => r.id === item.id);
          if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = item;
              return copy;
          }
          return [...prev, item];
      });
  };

  const deleteRoom = async (id: string) => {
      await storageService.deleteRoom(id);
      setRooms(prev => prev.filter(r => r.id !== id));
  };

  const addCollaborator = async (item: Collaborator) => {
      await storageService.addCollaborator(item);
      setCollaborators(prev => [...prev, item]);
  };

  const updateCollaborator = async (item: Collaborator) => {
      await storageService.updateCollaborator(item);
      setCollaborators(prev => prev.map(c => c.id === item.id ? item : c));
  };

  const deleteCollaborator = async (id: string) => {
      await storageService.deleteCollaborator(id);
      setCollaborators(prev => prev.filter(c => c.id !== id));
  };

  const addService = async (item: ServiceItem) => {
      await storageService.addService(item);
      setServices(prev => [...prev, item]);
  };

  const updateService = async (item: ServiceItem) => {
      await storageService.updateService(item);
      setServices(prev => prev.map(s => s.id === item.id ? item : s));
  };

  const deleteService = async (id: string) => {
      await storageService.deleteService(id);
      setServices(prev => prev.filter(s => s.id !== id));
  };

  const addInventoryTransaction = async (item: InventoryTransaction) => {
      await storageService.addInventoryTransaction(item);
      setInventoryTransactions(prev => [item, ...prev]);
  };

  const addExpense = async (item: Expense) => {
      await storageService.addExpense(item);
      setExpenses(prev => [item, ...prev]);
  };

  const updateExpense = async (item: Expense) => {
      await storageService.updateExpense(item);
      setExpenses(prev => prev.map(e => e.id === item.id ? item : e));
  };

  const deleteExpense = async (id: string) => {
      await storageService.deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const updateSettings = async (newSettings: Settings) => {
      await storageService.saveSettings(newSettings);
      setSettings(newSettings);
  };

  const getGeminiApiKey = async () => {
      return await storageService.getAppConfig('GEMINI_API_KEY');
  };

  const setAppConfig = async (config: AppConfig) => {
      await storageService.setAppConfig(config);
  };

  const updateRoomRecipe = async (key: string, recipe: RoomRecipe) => {
      await storageService.upsertRoomRecipe(recipe);
      setRoomRecipes(prev => ({ ...prev, [key]: recipe }));
  };

  const deleteRoomRecipe = async (key: string) => {
      await storageService.deleteRoomRecipe(key);
      setRoomRecipes(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
      });
  };

  const addBankAccount = async (item: BankAccount) => {
      await storageService.addBankAccount(item);
      await refreshData(); // Refresh to handle is_default logic from server
  };

  const updateBankAccount = async (item: BankAccount) => {
      await storageService.updateBankAccount(item);
      await refreshData();
  };

  const deleteBankAccount = async (id: string) => {
      await storageService.deleteBankAccount(id);
      setBankAccounts(prev => prev.filter(b => b.id !== id));
  };

  const addWebhook = async (item: WebhookConfig) => {
      await storageService.addWebhook(item);
      setWebhooks(prev => [...prev, item]);
  };

  const updateWebhook = async (item: WebhookConfig) => {
      await storageService.updateWebhook(item);
      setWebhooks(prev => prev.map(w => w.id === item.id ? item : w));
  };

  const deleteWebhook = async (id: string) => {
      await storageService.deleteWebhook(id);
      setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  const triggerWebhook = async (eventType: string, payload: any) => {
      const hooks = webhooks.filter(w => w.is_active && w.event_type === eventType);
      for (const hook of hooks) {
          try {
              fetch(hook.url, {
                  method: 'POST',
                  mode: 'no-cors', // Often needed for Google Apps Script
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
          } catch(e) { console.error(e); }
      }
  };

  // --- TIMEKEEPING ---
  const clockIn = async (facilityId: string, lat: number, lng: number) => {
      if (!currentUser) return { success: false, message: 'Not logged in' };
      const res = await storageService.clockIn(currentUser.id, facilityId, lat, lng);
      if (res.success && res.data) {
          setTimeLogs(prev => [res.data!, ...prev]);
          notify('success', res.message);
      } else {
          notify('error', res.message);
      }
      return res;
  };

  const clockOut = async () => {
      if (!currentUser) return { success: false, message: 'Not logged in' };
      const res = await storageService.clockOut(currentUser.id);
      if (res.success) {
          await refreshData(); // Reload logs to get updated checkout time
          notify('success', res.message);
      } else {
          notify('error', res.message);
      }
      return res;
  };

  const upsertSchedule = async (item: ShiftSchedule) => {
      await storageService.upsertSchedule(item);
      setSchedules(prev => {
          const idx = prev.findIndex(s => s.id === item.id);
          if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = item;
              return copy;
          }
          return [...prev, item];
      });
  };

  const deleteSchedule = async (id: string) => {
      await storageService.deleteSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const upsertAdjustment = async (item: AttendanceAdjustment) => {
      await storageService.upsertAdjustment(item);
      setAdjustments(prev => {
          const idx = prev.findIndex(a => a.staff_id === item.staff_id && a.month === item.month);
          if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = item;
              return copy;
          }
          return [...prev, item];
      });
  };

  const addLeaveRequest = async (item: LeaveRequest) => {
      await storageService.addLeaveRequest(item);
      setLeaveRequests(prev => [item, ...prev]);
  };

  const updateLeaveRequest = async (item: LeaveRequest) => {
      await storageService.updateLeaveRequest(item);
      setLeaveRequests(prev => prev.map(r => r.id === item.id ? item : r));
  };

  const openShift = async (startCash: number) => {
      if (!currentUser) return;
      const newShift: Shift = {
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
      await storageService.addShift(newShift);
      setShifts(prev => [newShift, ...prev]);
      notify('success', 'Đã mở ca làm việc mới');
  };

  const closeShift = async (endCashActual: number, note: string) => {
      if (!currentShift) return;
      const updatedShift: Shift = {
          ...currentShift,
          end_time: new Date().toISOString(),
          end_cash_actual: endCashActual,
          difference: endCashActual - currentShift.end_cash_expected,
          note: note,
          status: 'Closed'
      };
      await storageService.updateShift(updatedShift);
      setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
      notify('success', 'Đã chốt ca thành công');
  };

  const getShifts = async () => {
      return await storageService.getShifts();
  };

  // --- HOUSEKEEPING ---
  const syncHousekeepingTasks = async (tasks: HousekeepingTask[]) => {
      await storageService.syncHousekeepingTasks(tasks);
      // Merge updates into local state
      setHousekeepingTasks(prev => {
          const newMap = new Map(prev.map(t => [t.id, t]));
          tasks.forEach(t => newMap.set(t.id, t));
          return Array.from(newMap.values());
      });
  };

  const addGuestProfile = async (profile: GuestProfile) => {
      await storageService.addGuestProfile(profile);
  };

  // --- OTA ---
  const syncOtaOrders = async (orders?: OtaOrder[], silent = false) => {
      // Mock sync for now or fetch from API if implemented
      // storageService doesn't have explicit OTA table yet in types provided initially, 
      // but let's assume we handle it via webhooks/local state or future implementation.
      // For now, we rely on `queryOtaOrders` from a hypothetical backend or just mock it.
      if (!silent) notify('info', 'Đang đồng bộ OTA...');
      // Logic would go here.
  };

  const queryOtaOrders = async (params: any) => {
      // Mock implementation
      return { data: otaOrders, hasMore: false };
  };

  const updateOtaOrder = async (id: string, updates: Partial<OtaOrder>) => {
      setOtaOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const confirmOtaCancellation = async (order: OtaOrder) => {
      await updateOtaOrder(order.id, { status: 'Cancelled' });
  };

  const deleteOtaOrder = async (id: string) => {
      setOtaOrders(prev => prev.filter(o => o.id !== id));
  };

  // --- SPECIALIZED PROCESSES ---
  
  const processLendingUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      // Stock -> In Circulation
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const updatedService = { ...service };
              updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.qty);
              updatedService.in_circulation = (updatedService.in_circulation || 0) + item.qty;
              await updateService(updatedService);

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

  const processMinibarUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      // Consumed -> Reduce Stock or In Circulation depending on item type
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              // Minibar/Amenity: Stock -> Gone
              // Linen/Asset: In Circulation -> Gone (Lost/Damage) or Stayover usage? 
              // Usually Housekeeping reports consumption of minibar/amenity.
              
              const updatedService = { ...service };
              updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.qty);
              
              // Only update DB if stock changed
              await updateService(updatedService);

              const trans: InventoryTransaction = {
                  id: `TR-USE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYS',
                  staff_name: currentUser?.collaboratorName || 'HK App',
                  item_id: service.id,
                  item_name: service.name,
                  type: 'OUT',
                  quantity: item.qty,
                  price: service.costPrice || 0,
                  total: (service.costPrice || 0) * item.qty,
                  facility_name: facilityName,
                  note: `Tiêu hao tại phòng ${roomCode}`
              };
              await addInventoryTransaction(trans);
          }
      }
  };

  const processCheckoutLinenReturn = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      // In Circulation -> Dirty (Laundry)
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const updatedService = { ...service };
              // Reduce In Circulation
              updatedService.in_circulation = Math.max(0, (updatedService.in_circulation || 0) - item.qty);
              // Increase Dirty/Laundry Stock
              updatedService.laundryStock = (updatedService.laundryStock || 0) + item.qty;
              
              await updateService(updatedService);
          }
      }
  };

  const processRoomRestock = async (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => {
      // Complex Cycle:
      // 1. Return Dirty: In Circulation -> Laundry (dirtyReturnQty)
      // 2. Restock Clean: Stock -> In Circulation (cleanRestockQty)
      
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const updatedService = { ...service };
              
              // 1. Return
              if (item.dirtyReturnQty > 0) {
                  // If linen is tracked in circulation, reduce it. 
                  // Note: Some systems track linen strictly assigned to room vs general circulation. 
                  // Here assume In Circulation is global pool currently in rooms.
                  updatedService.in_circulation = Math.max(0, (updatedService.in_circulation || 0) - item.dirtyReturnQty);
                  updatedService.laundryStock = (updatedService.laundryStock || 0) + item.dirtyReturnQty;
              }

              // 2. Restock
              if (item.cleanRestockQty > 0) {
                  updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.cleanRestockQty);
                  updatedService.in_circulation = (updatedService.in_circulation || 0) + item.cleanRestockQty;
              }

              await updateService(updatedService);
          }
      }
  };

  const handleLinenExchange = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      // 1-1 Exchange: Dirty Out, Clean In (Same Quantity)
      // In Circulation stays same.
      // Stock - qty, Laundry + qty
      
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const updatedService = { ...service };
              updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.qty);
              updatedService.laundryStock = (updatedService.laundryStock || 0) + item.qty;
              await updateService(updatedService);
              
              const trans: InventoryTransaction = {
                  id: `TR-EX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYS',
                  staff_name: currentUser?.collaboratorName || 'HK App',
                  item_id: service.id,
                  item_name: service.name,
                  type: 'EXCHANGE',
                  quantity: item.qty,
                  price: 0,
                  total: 0,
                  facility_name: facilityName,
                  note: `Đổi đồ dơ tại phòng ${roomCode}`
              };
              await addInventoryTransaction(trans);
          }
      }
  };

  return (
    <AppContext.Provider value={{
      bookings, rooms, facilities, collaborators, services, expenses, settings, inventoryTransactions,
      timeLogs, schedules, adjustments, leaveRequests, otaOrders, housekeepingTasks, shifts,
      roomRecipes, bankAccounts, webhooks,
      
      currentUser, setCurrentUser, canAccess, isLoading, isInitialized, toasts, currentShift,
      
      refreshData, notify, removeToast,
      
      addBooking, updateBooking, deleteBooking, checkAvailability,
      
      addFacility, updateFacility, deleteFacility, upsertRoom, deleteRoom,
      
      addCollaborator, updateCollaborator, deleteCollaborator,
      
      addService, updateService, deleteService, addInventoryTransaction,
      
      addExpense, updateExpense, deleteExpense,
      
      updateSettings, getGeminiApiKey, setAppConfig, updateRoomRecipe, deleteRoomRecipe,
      
      addBankAccount, updateBankAccount, deleteBankAccount,
      
      addWebhook, updateWebhook, deleteWebhook, triggerWebhook,
      
      clockIn, clockOut, upsertSchedule, deleteSchedule, upsertAdjustment, addLeaveRequest, updateLeaveRequest,
      openShift, closeShift, getShifts,
      
      syncHousekeepingTasks, addGuestProfile,
      
      syncOtaOrders, queryOtaOrders, updateOtaOrder, confirmOtaCancellation, deleteOtaOrder,
      
      processLendingUsage, processMinibarUsage, processCheckoutLinenReturn, processRoomRestock, handleLinenExchange
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};