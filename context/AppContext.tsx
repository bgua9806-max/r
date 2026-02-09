
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { 
  Collaborator, Facility, Room, Booking, ServiceItem, Expense, FinanceTransaction,
  Shift, ShiftSchedule, AttendanceAdjustment, LeaveRequest, 
  HousekeepingTask, WebhookConfig, InventoryTransaction, 
  Settings, RoomRecipe, BankAccount, TimeLog, OtaOrder, 
  ToastMessage, GuestProfile, LendingItem, SalaryAdvance, Violation, BulkImportItem, Payment
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
  // expenses: Expense[]; // Deprecated
  transactions: FinanceTransaction[]; // Replaces expenses
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

  refreshData: (full?: boolean) => Promise<void>;
  canAccess: (path: string) => boolean;
  notify: (type: 'success' | 'error' | 'info', message: string) => void;
  removeToast: (id: number) => void;
  
  addFacility: (item: Facility) => Promise<void>;
  updateFacility: (item: Facility) => Promise<void>;
  deleteFacility: (id: string) => Promise<void>;
  
  upsertRoom: (item: Room) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  
  addBooking: (item: Booking) => Promise<boolean>;
  updateBooking: (item: Booking) => Promise<boolean>;
  cancelBooking: (booking: Booking, reason: string, penaltyFee: number) => Promise<void>; // NEW FUNCTION
  checkAvailability: (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => boolean;
  
  addService: (item: ServiceItem) => Promise<void>;
  updateService: (item: ServiceItem) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  
  addTransaction: (item: FinanceTransaction) => Promise<void>;
  updateTransaction: (item: FinanceTransaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Legacy support wrappers if needed, but better to migrate usage
  addExpense: (item: Expense) => Promise<void>; 
  
  addCollaborator: (item: Collaborator) => Promise<void>;
  updateCollaborator: (item: Collaborator) => Promise<void>;
  deleteCollaborator: (id: string) => Promise<void>;
  
  syncHousekeepingTasks: (tasks: HousekeepingTask[]) => Promise<void>;
  addInventoryTransaction: (item: InventoryTransaction) => Promise<void>;
  processBulkImport: (items: BulkImportItem[], totalAmount: number, note: string, facilityName: string, evidenceUrl?: string) => Promise<void>;
  
  openShift: (startCash: number) => Promise<void>;
  closeShift: (endCash: number, note: string, stats: { revenue: number; expense: number; expected: number }) => Promise<void>;
  
  clockIn: (facilityId: string, lat: number, lng: number) => Promise<{success: boolean, message: string}>;
  clockOut: () => Promise<{success: boolean, message: string}>;
  
  addLeaveRequest: (item: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (item: LeaveRequest) => Promise<void>;
  
  requestAdvance: (amount: number, reason: string) => Promise<void>;
  approveAdvance: (advanceId: string, isApproved: boolean) => Promise<void>;
  addViolation: (staffId: string, amount: number, reason: string, evidence?: string) => Promise<void>;

  upsertSchedule: (item: ShiftSchedule) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  upsertAdjustment: (item: AttendanceAdjustment) => Promise<void>;
  
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
  
  syncOtaOrders: (orders?: OtaOrder[], silent?: boolean) => Promise<void>;
  queryOtaOrders: (params: { page: number, pageSize: number, tab: string, search: string, dateFilter?: any }) => Promise<{ data: OtaOrder[], hasMore: boolean }>;
  updateOtaOrder: (id: string, updates: Partial<OtaOrder>) => Promise<void>;
  deleteOtaOrder: (id: string) => Promise<void>;
  confirmOtaCancellation: (order: OtaOrder) => Promise<void>;
  
  addBankAccount: (b: BankAccount) => Promise<void>;
  updateBankAccount: (b: BankAccount) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;

  processMinibarUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processLendingUsage: (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => Promise<void>;
  processRoomRestock: (facilityName: string, roomCode: string, items: { itemId: string, dirtyReturnQty: number, cleanRestockQty: number }[]) => Promise<void>;
  processCheckoutLinenReturn: (facilityName: string, roomCode: string) => Promise<void>; 
  handleLinenExchange: (facilityName: string, roomCode: string, items: any[]) => Promise<void>; 
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

const calculateTotalPaid = (booking: Booking): number => {
    try {
        const payments: Payment[] = JSON.parse(booking.paymentsJson || '[]');
        return payments.reduce((sum, p) => sum + Number(p.soTien), 0);
    } catch(e) { return 0; }
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
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
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]); // New State
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

  useEffect(() => {
    const init = async () => {
        const user = storageService.getUser();
        if (user) setCurrentUser(user);
        
        await storageService.checkConnection();
        const [sets, recipes, banks] = await Promise.all([
            storageService.getSettings(),
            storageService.getRoomRecipes(),
            storageService.getBankAccounts()
        ]);
        setSettings(sets);
        setRoomRecipes(recipes);
        setBankAccounts(banks);
        
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
              facs, rms, bks, svcs, trans, collabs, tasks, invTrans, shfts, schs, adjs, leaves, logs, whs, advs, vios
          ] = await Promise.all([
              storageService.getFacilities(),
              storageService.getRooms(),
              storageService.getBookings(),
              storageService.getServices(),
              storageService.getTransactions(),
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
          setTransactions(trans);
          setCollaborators(collabs);
          setHousekeepingTasks(tasks);
          setInventoryTransactions(invTrans);
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

  const addFacility = async (item: Facility) => { await storageService.addFacility(item); refreshData(); };
  const updateFacility = async (item: Facility) => { await storageService.updateFacility(item); refreshData(); };
  const deleteFacility = async (id: string) => { await storageService.deleteFacility(id); refreshData(); };

  const upsertRoom = async (item: Room) => { await storageService.upsertRoom(item); refreshData(); };
  const deleteRoom = async (id: string) => { await storageService.deleteRoom(id); refreshData(); };

  const addBooking = async (item: Booking) => { 
      // 1. Lưu Booking (Logic cũ giữ nguyên)
      await storageService.addBooking(item); 
      
      // 2. [MỚI] Tự động ghi Sổ Quỹ (Transaction) nếu có thanh toán trước
      try {
          const payments = JSON.parse(item.paymentsJson || '[]');
          // Chỉ xử lý nếu có thanh toán và booking mới được tạo
          if (Array.isArray(payments) && payments.length > 0) {
              const facilityId = facilities.find(f => f.facilityName === item.facilityName)?.id;
              
              for (const p of payments) {
                  // Chỉ ghi nhận nếu số tiền > 0
                  const amount = Number(p.soTien);
                  if (amount > 0) {
                      const trans: FinanceTransaction = {
                          id: `TR-AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                          transactionDate: p.ngayThanhToan || new Date().toISOString(),
                          amount: amount,
                          type: 'REVENUE',
                          category: p.category || 'Doanh thu phòng',
                          description: `Thu ${p.category || 'tiền phòng'} ${item.roomCode} - ${item.customerName}`,
                          status: 'Verified',
                          bookingId: item.id,
                          paymentMethod: p.method || 'Cash',
                          facilityId: facilityId,
                          facilityName: item.facilityName,
                          note: p.ghiChu || 'Thanh toán ban đầu (Tự động)',
                          created_by: currentUser?.id,
                          pic: currentUser?.collaboratorName || 'System'
                      };
                      // Gọi hàm addTransaction của storage để không trigger refreshData nhiều lần
                      await storageService.addTransaction(trans);
                  }
              }
          }
      } catch (e) {
          console.error("Lỗi tự động ghi sổ quỹ:", e);
      }

      // 3. Refresh dữ liệu (Logic cũ giữ nguyên)
      await refreshData(); 
      return true; 
  };

  // UPDATED: SYNC REVENUE LOGIC
  const updateBooking = async (item: Booking) => { 
      // 1. Calculate difference in payment to record revenue
      const oldBooking = bookings.find(b => b.id === item.id);
      if (oldBooking) {
          const oldPaid = calculateTotalPaid(oldBooking);
          const newPaid = calculateTotalPaid(item);
          const diff = newPaid - oldPaid;

          if (diff > 0) {
              // Auto-record Revenue Transaction
              const facilityId = facilities.find(f => f.facilityName === item.facilityName)?.id;
              
              // Find the category from the last payment item if available
              let category = 'Doanh thu phòng';
              let method = 'Cash';
              try {
                  const payments: Payment[] = JSON.parse(item.paymentsJson || '[]');
                  if (payments.length > 0) {
                      const lastPayment = payments[payments.length - 1];
                      if (lastPayment.category) category = lastPayment.category;
                      if (lastPayment.method) method = lastPayment.method;
                  }
              } catch (e) {}

              await addTransaction({
                  id: `TR-AUTO-${Date.now()}`,
                  transactionDate: new Date().toISOString(),
                  amount: diff,
                  type: 'REVENUE',
                  category: category,
                  description: `Thu ${category} - Phòng ${item.roomCode} - ${item.customerName}`,
                  status: 'Verified',
                  bookingId: item.id,
                  paymentMethod: method, 
                  facilityId: facilityId,
                  facilityName: item.facilityName,
                  created_by: currentUser?.id
              });
          }
      }

      await storageService.updateBooking(item); 
      refreshData(); 
      return true; 
  };

  // NEW: CANCEL BOOKING LOGIC WITH FUND REFUND
  const cancelBooking = async (booking: Booking, reason: string, penaltyFee: number) => {
      // 1. Calculate Financials
      let payments: Payment[] = [];
      try {
          payments = JSON.parse(booking.paymentsJson || '[]');
      } catch (e) { payments = []; }

      const totalPaid = payments.reduce((sum, p) => sum + Number(p.soTien), 0);
      const refundAmount = totalPaid - penaltyFee;

      // 2. Record Expense (Refund) if applicable
      if (refundAmount > 0) {
          const facilityId = facilities.find(f => f.facilityName === booking.facilityName)?.id;
          
          await addTransaction({
              id: `REFUND-${Date.now()}`,
              transactionDate: new Date().toISOString(),
              amount: refundAmount,
              type: 'EXPENSE',
              category: 'Hoàn tiền',
              description: `Hoàn tiền hủy phòng ${booking.roomCode} - ${booking.customerName}`,
              status: 'Verified',
              facilityId: facilityId,
              facilityName: booking.facilityName,
              note: `Lý do hủy: ${reason}`,
              created_by: currentUser?.id,
              pic: currentUser?.collaboratorName || 'System'
          });
      }

      // 3. Update Booking
      const newPayments = [...payments];
      
      // Only add negative payment if there is a refund
      if (refundAmount > 0) {
          newPayments.push({
              ngayThanhToan: new Date().toISOString(),
              soTien: -refundAmount,
              method: 'Cash',
              ghiChu: `Hoàn tiền hủy phòng (Lý do: ${reason})`,
              category: 'Hoàn tiền'
          });
      }

      const updatedBooking: Booking = {
          ...booking,
          status: 'Cancelled',
          totalRevenue: penaltyFee,
          remainingAmount: 0,
          paymentsJson: JSON.stringify(newPayments),
          note: `${booking.note || ''}\n[HỦY PHÒNG] Lý do: ${reason} - Phạt: ${penaltyFee.toLocaleString()} - Hoàn: ${refundAmount > 0 ? refundAmount.toLocaleString() : '0'}`
      };

      await storageService.updateBooking(updatedBooking);
      await refreshData();
      notify('success', 'Đã hủy phòng và xử lý hoàn tiền.');
  };

  const addService = async (item: ServiceItem) => { await storageService.addService(item); refreshData(); };
  const updateService = async (item: ServiceItem) => { await storageService.updateService(item); refreshData(); };
  const deleteService = async (id: string) => { await storageService.deleteService(id); refreshData(); };

  // --- TRANSACTION CRUD ---
  const addTransaction = async (item: FinanceTransaction) => {
      const transWithUser = {
          ...item,
          created_by: item.created_by || currentUser?.id,
          pic: item.pic || currentUser?.collaboratorName || 'System'
      };
      await storageService.addTransaction(transWithUser);
      refreshData();
  };
  const updateTransaction = async (item: FinanceTransaction) => { await storageService.updateTransaction(item); refreshData(); };
  const deleteTransaction = async (id: string) => { await storageService.deleteTransaction(id); refreshData(); };

  // Compatibility Wrapper for old code using addExpense
  const addExpense = async (item: Expense) => { 
      const facilityId = facilities.find(f => f.facilityName === item.facilityName)?.id;
      const trans: FinanceTransaction = {
          id: item.id,
          transactionDate: item.expenseDate,
          amount: item.amount,
          type: 'EXPENSE',
          category: item.expenseCategory,
          description: item.expenseContent,
          status: 'Verified',
          note: item.note,
          facilityId: facilityId,
          facilityName: item.facilityName,
          created_by: item.created_by
      };
      await addTransaction(trans); 
  };
  
  const updateExpense = async (item: Expense) => { 
      console.warn("Update Expense called on legacy interface");
  };
  const deleteExpense = async (id: string) => { await deleteTransaction(id); };

  const addCollaborator = async (item: Collaborator) => { await storageService.addCollaborator(item); refreshData(); };
  const updateCollaborator = async (item: Collaborator) => { await storageService.updateCollaborator(item); refreshData(); };
  const deleteCollaborator = async (id: string) => { await storageService.deleteCollaborator(id); refreshData(); };

  const syncHousekeepingTasks = async (tasks: HousekeepingTask[]) => { await storageService.syncHousekeepingTasks(tasks); refreshData(); };
  
  const addInventoryTransaction = async (item: InventoryTransaction) => { await storageService.addInventoryTransaction(item); refreshData(); };

  const processBulkImport = async (items: BulkImportItem[], totalAmount: number, note: string, facilityName: string, evidenceUrl?: string) => {
      const batchId = `IMP-${Date.now()}`;
      const fullNote = `${note} (Mã phiếu: ${batchId})`;
      const facilityId = facilities.find(f => f.facilityName === facilityName)?.id;

      // 1. Create Transaction (Expense)
      if (totalAmount > 0) {
          await addTransaction({
              id: `EXP-${batchId}`,
              transactionDate: new Date().toISOString(),
              amount: totalAmount,
              type: 'EXPENSE',
              category: 'Nhập hàng',
              description: `Nhập kho hàng loạt (${items.length} món)`,
              status: 'Verified',
              note: `Bằng chứng: ${evidenceUrl || 'N/A'}. ${fullNote}`,
              facilityId: facilityId,
              facilityName: facilityName,
              created_by: currentUser?.id
          });
      }

      // 2. Loop Items
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              const newStock = (service.stock || 0) + item.importQuantity;
              let newTotalAssets = service.totalassets || 0;
              if (service.category === 'Linen' || service.category === 'Asset') {
                   newTotalAssets = (service.totalassets || 0) + item.importQuantity;
              } else {
                   newTotalAssets = newStock; 
              }

              const updatedService: ServiceItem = {
                  ...service,
                  stock: newStock,
                  costPrice: item.importPrice, 
                  totalassets: newTotalAssets
              };

              await storageService.updateService(updatedService);

              const trans: InventoryTransaction = {
                  id: `TR-${batchId}-${item.itemId}`,
                  created_at: new Date().toISOString(),
                  staff_id: currentUser?.id || 'SYS',
                  staff_name: currentUser?.collaboratorName || 'System',
                  item_id: item.itemId,
                  item_name: item.itemName,
                  type: 'IN',
                  quantity: item.importQuantity,
                  price: item.importPrice,
                  total: item.importQuantity * item.importPrice,
                  evidence_url: evidenceUrl,
                  note: fullNote,
                  facility_name: facilityName
              };
              await storageService.addInventoryTransaction(trans);
          }
      }
      
      await refreshData();
  };

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

  const closeShift = async (endCash: number, note: string, stats: { revenue: number; expense: number; expected: number }) => {
      const active = shifts.find(s => s.staff_id === currentUser?.id && s.status === 'Open');
      if (active && currentUser) {
          await storageService.updateShift({
              ...active,
              end_time: new Date().toISOString(),
              end_cash_actual: endCash,
              total_revenue_cash: stats.revenue,
              total_expense_cash: stats.expense,
              end_cash_expected: stats.expected,
              difference: endCash - stats.expected,
              note,
              status: 'Closed',
              closed_by_id: currentUser.id,
              closed_by_name: currentUser.collaboratorName
          });
          refreshData();
      }
  };

  const currentShift = React.useMemo(() => shifts.find(s => s.staff_id === currentUser?.id && s.status === 'Open') || null, [shifts, currentUser]);

  const checkAvailability = (facilityName: string, roomCode: string, checkIn: string, checkOut: string, excludeId?: string) => {
      const start = new Date(checkIn).getTime();
      const end = new Date(checkOut).getTime();
      
      return !bookings.some(b => {
          if (b.id === excludeId) return false;
          if (b.facilityName !== facilityName || b.roomCode !== roomCode) return false;
          if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false;
          
          const bStart = new Date(b.checkinDate).getTime();
          const bEnd = new Date(b.checkoutDate).getTime();
          
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
          // Auto-create Transaction (Expense)
          const staffName = collaborators.find(c => c.id === advance.staff_id)?.collaboratorName || 'N/A';
          await addTransaction({
              id: `EXP-ADV-${Date.now()}`,
              transactionDate: new Date().toISOString(),
              amount: advance.amount,
              type: 'EXPENSE',
              category: 'Lương nhân viên',
              description: `Chi ứng lương cho ${staffName}`,
              status: 'Verified',
              note: `Tự động tạo từ yêu cầu ứng lương ${advance.id}`,
              facilityName: 'General',
              created_by: currentUser?.id
          });
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

  const syncOtaOrders = async (orders?: OtaOrder[], silent = false) => {
      if (storageService.isUsingMock()) return;
      if (!silent) setIsLoading(true);
      try {
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

      if (params.tab === 'Pending') query = query.in('status', ['Pending', 'Cancelled']);
      else if (params.tab === 'Processed') query = query.eq('status', 'Assigned');
      else if (params.tab === 'Cancelled') query = query.eq('status', 'Confirmed'); 
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
      setOtaOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const deleteOtaOrder = async (id: string) => {
      if (storageService.isUsingMock()) return;
      await supabase.from('ota_orders').delete().eq('id', id);
      setOtaOrders(prev => prev.filter(o => o.id !== id));
  };

  const confirmOtaCancellation = async (order: OtaOrder) => {
      await supabase.from('ota_orders').update({
          status: 'Confirmed'
      }).eq('id', order.id);
      
      setOtaOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'Confirmed' } : o));
      
      triggerWebhook('ota_import', {
          action: 'confirm_cancel',
          bookingCode: order.bookingCode,
          status: 'Đã hủy & Xác nhận'
      });
  };

  const processMinibarUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
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
                  type: service.price > 0 ? 'MINIBAR_SOLD' : 'AMENITY_USED',
                  quantity: item.qty,
                  price: service.costPrice || 0,
                  total: (service.costPrice || 0) * item.qty,
                  facility_name: facilityName,
                  note: `Khách dùng tại phòng ${roomCode}`
              });
          }
      }

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
      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (service) {
              let updatedService = { ...service };
              
              if (item.dirtyReturnQty > 0) {
                  updatedService.in_circulation = Math.max(0, (updatedService.in_circulation || 0) - item.dirtyReturnQty);
                  
                  if (service.category === 'Linen') {
                      updatedService.laundryStock = (updatedService.laundryStock || 0) + item.dirtyReturnQty;
                  } else {
                      updatedService.stock = (updatedService.stock || 0) + item.dirtyReturnQty;
                  }
              }

              if (item.cleanRestockQty > 0) {
                  updatedService.stock = Math.max(0, (updatedService.stock || 0) - item.cleanRestockQty);
                  updatedService.in_circulation = (updatedService.in_circulation || 0) + item.cleanRestockQty;
              }

              await updateService(updatedService);
          }
      }
  };

  const processLendingUsage = async (facilityName: string, roomCode: string, items: { itemId: string, qty: number }[]) => {
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

  const processCheckoutLinenReturn = async () => {};
  const handleLinenExchange = async () => {};

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser, isLoading, isInitialized,
      facilities, rooms, bookings, services, transactions, collaborators,
      housekeepingTasks, inventoryTransactions, shifts, schedules, adjustments,
      leaveRequests, otaOrders, timeLogs, bankAccounts, salaryAdvances, violations,
      settings, roomRecipes, webhooks, currentShift, toasts,
      
      refreshData, canAccess, notify, removeToast,
      addFacility, updateFacility, deleteFacility,
      upsertRoom, deleteRoom,
      addBooking, updateBooking, cancelBooking, checkAvailability,
      addService, updateService, deleteService,
      addTransaction, updateTransaction, deleteTransaction, addExpense,
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
      processCheckoutLinenReturn, handleLinenExchange, processBulkImport
    }}>
      {children}
    </AppContext.Provider>
  );
};