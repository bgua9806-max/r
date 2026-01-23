import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  Facility, Room, Booking, Collaborator, Expense, ServiceItem, 
  InventoryTransaction, HousekeepingTask, WebhookConfig, Shift, 
  ShiftSchedule, AttendanceAdjustment, LeaveRequest, OtaOrder, 
  Settings, RoomRecipe, BankAccount, ToastMessage, GuestProfile,
  LendingItem, AppConfig, Guest, TimeLog
} from '../types';
import { 
  MOCK_FACILITIES, MOCK_ROOMS, MOCK_COLLABORATORS, MOCK_BOOKINGS, 
  MOCK_SERVICES, DEFAULT_SETTINGS, ROOM_RECIPES, ROLE_PERMISSIONS 
} from '../constants';
import { storageService } from '../services/storage';
import { supabase } from '../services/supabaseClient';
import { parseISO, areIntervalsOverlapping, isValid, format } from 'date-fns';

interface AppContextType {
  currentUser: Collaborator | null;
  setCurrentUser: (user: Collaborator | null) => void;
  isInitialized: boolean; // NEW: Flag to check if app has finished loading initial state
  facilities: Facility[];
  rooms: Room[];
  bookings: Booking[];
  collaborators: Collaborator[];
  expenses: Expense[];
  services: ServiceItem[];
  inventoryTransactions: InventoryTransaction[];
  housekeepingTasks: HousekeepingTask[];
  webhooks: WebhookConfig[];
  shifts: Shift[];
  schedules: ShiftSchedule[];
  adjustments: AttendanceAdjustment[];
  leaveRequests: LeaveRequest[];
  otaOrders: OtaOrder[];
  settings: Settings;
  roomRecipes: Record<string, RoomRecipe>;
  bankAccounts: BankAccount[];
  timeLogs: TimeLog[];
  toasts: ToastMessage[];
  isLoading: boolean;
  currentShift: Shift | null;
  
  refreshData: (force?: boolean) => Promise<void>;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: number) => void;
  canAccess: (path: string) => boolean;
  
  // Actions
  checkAvailability: (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeBookingId?: string) => boolean;
  addBooking: (booking: Booking) => Promise<boolean>;
  updateBooking: (booking: Booking) => Promise<boolean>;
  
  addFacility: (item: Facility) => Promise<void>;
  updateFacility: (item: Facility) => Promise<void>;
  deleteFacility: (id: string) => Promise<void>;
  
  upsertRoom: (item: Room) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  
  addCollaborator: (item: Collaborator) => Promise<void>;
  updateCollaborator: (item: Collaborator) => Promise<void>;
  deleteCollaborator: (id: string) => Promise<void>;
  
  addExpense: (item: Expense) => Promise<void>;
  updateExpense: (item: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  addService: (item: ServiceItem) => Promise<void>;
  updateService: (item: ServiceItem) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  
  addInventoryTransaction: (item: InventoryTransaction) => Promise<void>;
  syncHousekeepingTasks: (tasks: HousekeepingTask[]) => Promise<void>;
  
  addWebhook: (item: WebhookConfig) => Promise<void>;
  updateWebhook: (item: WebhookConfig) => Promise<void>;
  deleteWebhook: (id: string) => Promise<void>;
  triggerWebhook: (eventType: string, payload: any) => Promise<void>;
  
  openShift: (startCash: number) => Promise<void>;
  closeShift: (endCashActual: number, note: string) => Promise<void>;
  upsertSchedule: (item: ShiftSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  upsertAdjustment: (item: AttendanceAdjustment) => Promise<void>;
  
  addLeaveRequest: (item: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (item: LeaveRequest) => Promise<void>;
  
  syncOtaOrders: (overrideWebhooks?: WebhookConfig[], silent?: boolean) => Promise<void>;
  updateOtaOrder: (id: string, updates: Partial<OtaOrder>) => Promise<void>;
  deleteOtaOrder: (id: string) => Promise<void>;
  confirmOtaCancellation: (order: OtaOrder) => Promise<void>;
  
  updateSettings: (newSettings: Settings) => Promise<void>;
  updateRoomRecipe: (key: string, recipe: RoomRecipe) => Promise<void>;
  deleteRoomRecipe: (key: string) => Promise<void>;
  
  addBankAccount: (account: BankAccount) => Promise<void>;
  updateBankAccount: (account: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
  
  getGeminiApiKey: () => Promise<string | null>;
  setAppConfig: (config: AppConfig) => Promise<void>;
  addGuestProfile: (profile: GuestProfile) => Promise<void>;
  
  // GPS Timekeeping Actions
  clockIn: (facilityId: string, lat: number, lng: number, photo?: string) => Promise<{ success: boolean, message: string }>;
  clockOut: () => Promise<{ success: boolean, message: string }>;
  refreshTimeLogs: () => Promise<void>;

  // Specific Logic
  processMinibarUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processCheckoutLinenReturn: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processRoomRestock: (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => Promise<void>;
  processLendingUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  handleLinenExchange: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Collaborator | null>(null);
  const [isInitialized, setIsInitialized] = useState(false); // NEW: Init state
  
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [housekeepingTasks, setHousekeepingTasks] = useState<HousekeepingTask[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [adjustments, setAdjustments] = useState<AttendanceAdjustment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [otaOrders, setOtaOrders] = useState<OtaOrder[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [roomRecipes, setRoomRecipes] = useState<Record<string, RoomRecipe>>(ROOM_RECIPES);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
      const storedUser = storageService.getUser();
      if (storedUser) setCurrentUser(storedUser);
      setIsInitialized(true); // Mark as initialized after checking storage
      refreshData();
  }, []);

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
      const allowedRoutes = ROLE_PERMISSIONS[currentUser.role] || [];
      // Simple path matching
      return allowedRoutes.some(route => path.startsWith(route) || path === route);
  };

  const refreshData = async (force = false) => {
      if (isLoading && !force) return;
      setIsLoading(true);
      try {
          // Check connection first
          const isConnected = await storageService.checkConnection();
          if (!isConnected) {
              notify('error', 'Không thể kết nối Database. Đang dùng chế độ Offline/Mock.');
          }

          const [
              f, r, b, c, e, s, it, hk, wh, sh, sch, adj, lr, sett, rec, ba, tl
          ] = await Promise.all([
              storageService.getFacilities(),
              storageService.getRooms(),
              storageService.getBookings(),
              storageService.getCollaborators(),
              storageService.getExpenses(),
              storageService.getServices(),
              storageService.getInventoryTransactions(),
              storageService.getHousekeepingTasks(),
              storageService.getWebhooks(),
              storageService.getShifts(),
              storageService.getSchedules(),
              storageService.getAdjustments(),
              storageService.getLeaveRequests(),
              storageService.getSettings(),
              storageService.getRoomRecipes(),
              storageService.getBankAccounts(),
              storageService.getTimeLogs()
          ]);

          setFacilities(f);
          setRooms(r);
          setBookings(b);
          setCollaborators(c);
          setExpenses(e);
          setServices(s);
          setInventoryTransactions(it);
          setHousekeepingTasks(hk);
          setWebhooks(wh);
          setShifts(sh);
          setSchedules(sch);
          setAdjustments(adj);
          setLeaveRequests(lr);
          setSettings(sett);
          setRoomRecipes(rec);
          setBankAccounts(ba);
          setTimeLogs(tl);

          // Trigger OTA Sync immediately in background (Silent Mode)
          // Pass 'wh' directly because state setWebhooks(wh) might not be ready yet
          syncOtaOrders(wh, true);

      } catch (err) {
          console.error("Refresh Error", err);
          notify('error', 'Lỗi tải dữ liệu.');
      } finally {
          setIsLoading(false);
      }
  };

  const refreshTimeLogs = async () => {
      const logs = await storageService.getTimeLogs();
      setTimeLogs(logs);
  };

  const clockIn = async (facilityId: string, lat: number, lng: number, photo?: string) => {
      if (!currentUser) return { success: false, message: 'Chưa đăng nhập' };
      const res = await storageService.clockIn(currentUser.id, facilityId, lat, lng, photo);
      if (res.success && res.data) {
          setTimeLogs(prev => [res.data!, ...prev]);
          notify('success', res.message);
      } else {
          notify('error', res.message);
      }
      return res;
  };

  const clockOut = async () => {
      if (!currentUser) return { success: false, message: 'Chưa đăng nhập' };
      const res = await storageService.clockOut(currentUser.id);
      if (res.success) {
          await refreshTimeLogs();
          notify('success', res.message);
      } else {
          notify('error', res.message);
      }
      return res;
  };

  const checkAvailability = (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeBookingId?: string) => {
      const start = parseISO(checkIn);
      const end = parseISO(checkOut);
      
      return !bookings.some(b => {
          if (b.id === excludeBookingId) return false;
          if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
          if (b.facilityName !== facilityName || b.roomCode !== roomCode) return false;
          
          const bStart = parseISO(b.checkinDate);
          const bEnd = parseISO(b.checkoutDate);
          
          return areIntervalsOverlapping({ start, end }, { start: bStart, end: bEnd });
      });
  };

  // --- CRUD WRAPPERS ---
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

  const addFacility = async (item: Facility) => {
      await storageService.addFacility(item);
      setFacilities(prev => [...prev, item]);
  };

  const updateFacility = async (item: Facility) => {
      await storageService.updateFacility(item);
      setFacilities(prev => prev.map(f => f.id === item.id ? item : f));
  };

  const deleteFacility = async (id: string) => {
      const f = facilities.find(fac => fac.id === id);
      await storageService.deleteFacility(id, f?.facilityName);
      setFacilities(prev => prev.filter(f => f.id !== id));
  };

  const upsertRoom = async (item: Room) => {
      await storageService.upsertRoom(item);
      setRooms(prev => {
          const exists = prev.some(r => r.id === item.id);
          if (exists) return prev.map(r => r.id === item.id ? item : r);
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

  const syncHousekeepingTasks = async (tasks: HousekeepingTask[]) => {
      await storageService.syncHousekeepingTasks(tasks);
      setHousekeepingTasks(prev => {
          const map = new Map(prev.map(t => [t.id, t]));
          tasks.forEach(t => map.set(t.id, t));
          return Array.from(map.values());
      });
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
      const hook = webhooks.find(w => w.event_type === eventType && w.is_active);
      if (hook) {
          try {
              fetch(hook.url, {
                  method: 'POST',
                  mode: 'no-cors',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              }).catch(e => console.error("Webhook trigger failed", e));
          } catch(e) { console.error(e); }
      }
  };

  // SHIFTS
  const currentShift = React.useMemo(() => {
      return shifts.find(s => s.status === 'Open') || null;
  }, [shifts]);

  const openShift = async (startCash: number) => {
      if (!currentUser) return;
      // Close any existing open shifts first (just in case)
      if (currentShift) await closeShift(currentShift.end_cash_expected || 0, 'Auto close due to new shift');

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
      notify('success', 'Đã mở ca làm việc');
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
      notify('success', 'Đã chốt ca làm việc');
  };

  const upsertSchedule = async (item: ShiftSchedule) => {
      await storageService.upsertSchedule(item);
      setSchedules(prev => {
          const exists = prev.some(s => s.id === item.id);
          if (exists) return prev.map(s => s.id === item.id ? item : s);
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
          const exists = prev.some(a => a.staff_id === item.staff_id && a.month === item.month);
          if (exists) return prev.map(a => a.staff_id === item.staff_id && a.month === item.month ? item : a);
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

  // OTA ORDERS
  const detectPaymentStatus = (raw: string): 'Prepaid' | 'Pay at hotel' => {
      const r = (raw || '').toLowerCase();
      if (r.includes('prepaid') || r.includes('đã thanh toán') || r.includes('thanh toán ngay') || r.includes('chuyển khoản')) return 'Prepaid';
      return 'Pay at hotel';
  };

  const syncOtaOrders = async (overrideWebhooks?: WebhookConfig[], silent = false) => {
      if (!silent) setIsLoading(true);
      try {
          // 1. TRUY VẤN TRỰC TIẾP TỪ SUPABASE
          const { data, error } = await supabase
              .from('ota_orders')
              .select('*')
              .order('email_date', { ascending: false })
              .limit(200);

          if (error) throw error;

          // 2. MAP DỮ LIỆU (DB snake_case -> App camelCase)
          const mappedOrders: OtaOrder[] = data.map((item: any) => ({
              id: item.id,
              bookingCode: item.booking_code, // Key quan trọng nhất
              platform: item.platform || 'Direct',
              
              guestName: item.guest_name || 'No Name',
              guestPhone: item.guest_phone,
              
              // Xử lý số lượng khách (DB có thể lưu text "2 người lớn")
              guestCount: parseInt(item.guest_count) || 1, 
              guestDetails: item.guest_count,
              
              roomType: item.room_type,
              roomQuantity: item.room_quantity || 1,
              
              checkIn: item.check_in,   // DB đã là chuẩn ISO
              checkOut: item.check_out, // DB đã là chuẩn ISO
              emailDate: item.email_date,
              
              totalAmount: item.total_amount || 0,
              netAmount: item.net_amount || 0,
              paymentStatus: item.payment_status || 'Pay at hotel',
              
              // TRẠNG THÁI: App sẽ dùng trực tiếp trạng thái từ DB
              status: item.status as any, // 'Pending' | 'Assigned' | 'Cancelled'
              assignedRoom: item.assigned_room,
              appConfirmStatus: item.app_confirm_status, // Để hiện nút "Đã lưu"
              
              notes: item.notes,
              rawJson: JSON.stringify(item)
          }));

          setOtaOrders(mappedOrders);
          if (!silent) notify('success', `Đã tải ${mappedOrders.length} đơn từ Database.`);

      } catch (err: any) {
          console.error("Sync Error:", err);
          if (!silent) notify('error', `Lỗi tải dữ liệu: ${err.message}`);
      } finally {
          if (!silent) setIsLoading(false);
      }
  };

  const updateOtaOrder = async (id: string, updates: Partial<OtaOrder>) => {
      setOtaOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteOtaOrder = async (id: string) => {
      setOtaOrders(prev => prev.filter(o => o.id !== id));
  };

  // Hàm Xác nhận Hủy (Update DB)
  const confirmOtaCancellation = async (order: OtaOrder) => {
      // 1. Optimistic Update Local
      setOtaOrders(prev => prev.map(o => o.id === order.id ? {...o, appConfirmStatus: 'CONFIRMED'} : o));
      
      // 2. Update Supabase
      const { error } = await supabase
          .from('ota_orders')
          .update({ app_confirm_status: 'CONFIRMED' })
          .eq('id', order.id);

      if (error) {
          notify('error', 'Lỗi cập nhật trạng thái hủy trên Database.');
      } else {
          notify('success', 'Đã xác nhận hủy đơn hàng.');
      }
  };

  const updateSettings = async (newSettings: Settings) => {
      await storageService.saveSettings(newSettings);
      setSettings(newSettings);
  };

  const updateRoomRecipe = async (key: string, recipe: RoomRecipe) => {
      await storageService.upsertRoomRecipe(recipe);
      setRoomRecipes(prev => ({ ...prev, [key]: recipe }));
  };

  const deleteRoomRecipe = async (key: string) => {
      await storageService.deleteRoomRecipe(key);
      const copy = { ...roomRecipes };
      delete copy[key];
      setRoomRecipes(copy);
  };

  const addBankAccount = async (account: BankAccount) => {
      await storageService.addBankAccount(account);
      setBankAccounts(prev => [...prev, account]);
      if(account.is_default) refreshData();
  };

  const updateBankAccount = async (account: BankAccount) => {
      await storageService.updateBankAccount(account);
      setBankAccounts(prev => prev.map(b => b.id === account.id ? account : b));
      if(account.is_default) refreshData();
  };

  const deleteBankAccount = async (id: string) => {
      await storageService.deleteBankAccount(id);
      setBankAccounts(prev => prev.filter(b => b.id !== id));
  };

  const getGeminiApiKey = async () => {
      return storageService.getAppConfig('GEMINI_API_KEY');
  };

  const setAppConfig = async (config: AppConfig) => {
      await storageService.setAppConfig(config);
  };

  const addGuestProfile = async (profile: GuestProfile) => {
      await storageService.addGuestProfile(profile);
  };

  // --- SPECIFIC OPERATIONAL LOGIC ---
  const processMinibarUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId || s.name === item.itemId);
          if (service) {
              const newStock = (service.stock || 0) - item.qty;
              await updateService({ ...service, stock: newStock });
              await addInventoryTransaction({
                  id: `TR-${Date.now()}-${Math.random()}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'STAFF',
                  staff_name: currentUser?.collaboratorName || 'Housekeeping',
                  item_id: service.id,
                  item_name: service.name,
                  type: service.price > 0 ? 'MINIBAR_SOLD' : 'AMENITY_USED',
                  quantity: item.qty,
                  price: service.costPrice || 0,
                  total: (service.costPrice || 0) * item.qty,
                  facility_name: facilityName,
                  note: `HK Báo dùng tại ${roomCode}`
              });
          }
      }

      const booking = bookings.find(b => b.facilityName === facilityName && b.roomCode === roomCode && b.status === 'CheckedIn');
      if (booking) {
          const currentServices = booking.servicesJson ? JSON.parse(booking.servicesJson) : [];
          items.forEach(newItem => {
              const service = services.find(s => s.id === newItem.itemId || s.name === newItem.itemId);
              if (service) {
                  const existing = currentServices.find((s: any) => s.serviceId === service.id);
                  if (existing) {
                      existing.quantity += newItem.qty;
                      existing.total = existing.quantity * existing.price;
                  } else {
                      currentServices.push({
                          serviceId: service.id,
                          name: service.name,
                          price: service.price,
                          quantity: newItem.qty,
                          total: service.price * newItem.qty,
                          time: new Date().toISOString()
                      });
                  }
              }
          });
          
          const newTotal = booking.totalRevenue + items.reduce((sum, i) => {
                  const s = services.find(srv => srv.id === i.itemId || srv.name === i.itemId);
                  return sum + (s ? s.price * i.qty : 0);
          }, 0);

          await updateBooking({
              ...booking,
              servicesJson: JSON.stringify(currentServices),
              remainingAmount: booking.remainingAmount + (newTotal - booking.totalRevenue),
              totalRevenue: newTotal
          });
      }
  };

  const processCheckoutLinenReturn = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const newLaundry = (service.laundryStock || 0) + item.qty;
              const newInCirculation = Math.max(0, (service.in_circulation || 0) - item.qty);
              await updateService({ ...service, laundryStock: newLaundry, in_circulation: newInCirculation });
              
              await addInventoryTransaction({
                  id: `TR-${Date.now()}-${Math.random()}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYSTEM',
                  staff_name: currentUser?.collaboratorName || 'Housekeeping',
                  item_id: service.id,
                  item_name: service.name,
                  type: 'LAUNDRY_SEND',
                  quantity: item.qty,
                  price: 0,
                  total: 0,
                  facility_name: facilityName,
                  note: `Thu hồi bẩn từ phòng ${roomCode}`
              });
          }
      }
  };

  const processRoomRestock = async (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => {
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              let laundry = (service.laundryStock || 0) + item.dirtyReturnQty;
              let inCirculation = Math.max(0, (service.in_circulation || 0) - item.dirtyReturnQty);
              
              let stock = (service.stock || 0) - item.cleanRestockQty;
              inCirculation += item.cleanRestockQty;

              await updateService({ ...service, stock, laundryStock: laundry, in_circulation: inCirculation });
              
              if (item.cleanRestockQty > 0 || item.dirtyReturnQty > 0) {
                  await addInventoryTransaction({
                      id: `TR-${Date.now()}-${Math.random()}`,
                      created_at: new Date().toISOString(),
                      staff_id: currentUser?.id || 'SYSTEM',
                      staff_name: currentUser?.collaboratorName || 'Housekeeping',
                      item_id: service.id,
                      item_name: service.name,
                      type: 'EXCHANGE',
                      quantity: Math.max(item.cleanRestockQty, item.dirtyReturnQty),
                      price: 0,
                      total: 0,
                      facility_name: facilityName,
                      note: `Phòng ${roomCode}: Thu ${item.dirtyReturnQty} Bẩn / Bù ${item.cleanRestockQty} Sạch`
                  });
              }
          }
      }
  };

  const processLendingUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const newStock = Math.max(0, (service.stock || 0) - item.qty);
              const newInCirculation = (service.in_circulation || 0) + item.qty;
              await updateService({ ...service, stock: newStock, in_circulation: newInCirculation });
              
              await addInventoryTransaction({
                  id: `TR-${Date.now()}-${Math.random()}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYSTEM',
                  staff_name: currentUser?.collaboratorName || 'Housekeeping',
                  item_id: service.id,
                  item_name: service.name,
                  type: 'OUT',
                  quantity: item.qty,
                  price: 0,
                  total: 0,
                  facility_name: facilityName,
                  note: `Cho mượn tại ${roomCode}`
              });
          }
      }
  };

  const handleLinenExchange = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
      const payload = items.map(i => ({ itemId: i.itemId, dirtyReturnQty: i.qty, cleanRestockQty: i.qty }));
      await processRoomRestock(facilityName, roomCode, payload);
  };

  const value = {
    currentUser, setCurrentUser,
    isInitialized, // Export the state
    facilities, rooms, bookings, collaborators, expenses, services,
    inventoryTransactions, housekeepingTasks, webhooks, shifts,
    schedules, adjustments, leaveRequests, otaOrders, settings, roomRecipes, bankAccounts, timeLogs,
    toasts, isLoading, currentShift,
    refreshData, notify, removeToast, canAccess,
    checkAvailability, addBooking, updateBooking,
    addFacility, updateFacility, deleteFacility,
    upsertRoom, deleteRoom,
    addCollaborator, updateCollaborator, deleteCollaborator,
    addExpense, updateExpense, deleteExpense,
    addService, updateService, deleteService,
    addInventoryTransaction, syncHousekeepingTasks,
    addWebhook, updateWebhook, deleteWebhook, triggerWebhook,
    openShift, closeShift, upsertSchedule, deleteSchedule, upsertAdjustment,
    addLeaveRequest, updateLeaveRequest,
    syncOtaOrders, updateOtaOrder, deleteOtaOrder, confirmOtaCancellation,
    updateSettings, updateRoomRecipe, deleteRoomRecipe,
    addBankAccount, updateBankAccount, deleteBankAccount,
    getGeminiApiKey, setAppConfig, addGuestProfile,
    clockIn, clockOut, refreshTimeLogs,
    processMinibarUsage, processCheckoutLinenReturn, processRoomRestock, processLendingUsage, handleLinenExchange
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};