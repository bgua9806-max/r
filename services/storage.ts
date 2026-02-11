
import { supabase } from './supabaseClient';
import { Facility, Room, Booking, Collaborator, FinanceTransaction, ServiceItem, HousekeepingTask, WebhookConfig, Shift, ShiftSchedule, AttendanceAdjustment, InventoryTransaction, GuestProfile, LeaveRequest, AppConfig, Settings, RoomRecipe, BankAccount, TimeLog, SalaryAdvance, Violation, Expense, Season, ShiftDefinition } from '../types';
import { MOCK_FACILITIES, MOCK_ROOMS, MOCK_COLLABORATORS, MOCK_BOOKINGS, MOCK_SERVICES, DEFAULT_SETTINGS, ROOM_RECIPES, MOCK_TIME_LOGS } from '../constants';

const logError = (message: string, error: any) => {
  if (error?.message?.includes('Could not find the') || error?.code === 'PGRST204') {
      console.warn(`[SCHEMA MISMATCH] ${message}. Using fallback.`);
      return;
  }
  if (error?.message?.includes('Failed to fetch') || error?.toString().includes('TypeError: Failed to fetch')) {
      console.warn(`[NETWORK ERROR] ${message}.`);
      return;
  }
  console.error(`[STORAGE ERROR] ${message}:`, error);
  if (error?.message) console.error("Details:", error.message);
  if (error?.hint) console.error("Hint:", error.hint);
};

const isTableMissingError = (error: any) => {
    return error?.code === '42P01' || error?.code === 'PGRST205';
};

const isColumnMissingError = (error: any) => {
    return error?.code === 'PGRST204' || (error?.message && error.message.includes('Could not find the'));
};

const isNetworkError = (error: any) => {
    return error?.message?.includes('Failed to fetch') || error?.toString().includes('TypeError: Failed to fetch');
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let IS_USING_MOCK = false;
let connectionChecked = false;

const safeFetch = async <T>(promise: PromiseLike<{ data: T[] | null; error: any }>, fallback: T[], tableName: string): Promise<T[]> => {
    if (IS_USING_MOCK) return fallback;

    try {
        const { data, error } = await promise;
        if (error) {
            if (isColumnMissingError(error)) {
                logError(`Schema mismatch fetching ${tableName}`, error);
                return fallback;
            }
            if (isNetworkError(error)) {
                logError(`Failed to fetch ${tableName} (Network)`, error);
                return fallback;
            }
            
            logError(`Failed to fetch ${tableName}`, error);
            if (isTableMissingError(error)) IS_USING_MOCK = true; 
            return fallback;
        }
        if (!data) return fallback;
        if (!connectionChecked) connectionChecked = true;
        return data;
    } catch (err) {
        logError(`Network Exception fetching ${tableName}`, err);
        return fallback;
    }
};

const getDataStartDate = () => {
    const d = new Date();
    d.setDate(1); 
    d.setMonth(d.getMonth() - 1); 
    return d.toISOString();
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180; 
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

const MOCK_SEASONS: Season[] = [
    { code: 'PEAK', name: 'Mùa Cao Điểm (Hè/Lễ)', start_month: 5, start_day: 1, end_month: 9, end_day: 30, is_active: true },
    { code: 'LOW', name: 'Mùa Thấp Điểm', start_month: 10, start_day: 1, end_month: 4, end_day: 30, is_active: true }
];

const MOCK_SHIFTS: ShiftDefinition[] = [
    { id: 'S1', code: 'SANG', name: 'Ca Sáng (Hè)', start_time: '07:00:00', end_time: '16:00:00', coefficient: 1.0, season_code: 'PEAK', grace_period_minutes: 15, is_active: true },
    { id: 'S2', code: 'CHIEU', name: 'Ca Chiều (Hè)', start_time: '13:00:00', end_time: '22:00:00', coefficient: 1.0, season_code: 'PEAK', grace_period_minutes: 15, is_active: true },
    { id: 'S3', code: 'TOI', name: 'Ca Tối (Hè)', start_time: '18:00:00', end_time: '08:00:00', coefficient: 1.2, season_code: 'PEAK', grace_period_minutes: 15, is_active: true },
    { id: 'S4', code: 'SANG', name: 'Ca Sáng (Đông)', start_time: '08:00:00', end_time: '17:00:00', coefficient: 1.0, season_code: 'LOW', grace_period_minutes: 15, is_active: true },
    { id: 'S5', code: 'TOI', name: 'Ca Tối (Đông)', start_time: '17:00:00', end_time: '08:00:00', coefficient: 1.2, season_code: 'LOW', grace_period_minutes: 15, is_active: true },
];

export const storageService = {
  checkConnection: async () => {
      if (IS_USING_MOCK) return false;
      const MAX_RETRIES = 3;
      for (let i = 0; i < MAX_RETRIES; i++) {
          try {
              const { data, error } = await supabase.from('app_configs').select('count').limit(1).single();
              if (!error) return true; 
              if (isNetworkError(error)) {
                  console.warn(`Connection attempt ${i + 1}/${MAX_RETRIES} failed. Retrying in 1.5s...`);
                  if (i < MAX_RETRIES - 1) await delay(1500); 
              } else {
                  return true;
              }
          } catch (e) {
              if (i < MAX_RETRIES - 1) await delay(1500);
          }
      }
      IS_USING_MOCK = true;
      return false;
  },

  checkSchema: async () => {
      if (IS_USING_MOCK) return { missing: false };
      const { error } = await supabase.from('bookings').select('lendingjson, guestsjson, groupid').limit(1);
      const { error: tableError } = await supabase.from('settings').select('id').limit(1);
      const { error: bankError } = await supabase.from('bank_accounts').select('id').limit(1);
      const { error: financeError } = await supabase.from('finance_transactions').select('id').limit(1);

      if ((error && isColumnMissingError(error)) || (tableError && isTableMissingError(tableError)) || (bankError && isTableMissingError(bankError)) || (financeError && isTableMissingError(financeError))) {
          return { missing: true, table: 'bookings_or_settings' };
      }
      return { missing: false };
  },

  isUsingMock: () => IS_USING_MOCK,

  getUser: (): Collaborator | null => {
    try {
        const local = localStorage.getItem('currentUser');
        if (local) return JSON.parse(local);
        const session = sessionStorage.getItem('currentUser');
        if (session) return JSON.parse(session);
    } catch (e) {
        console.warn('Error parsing user from storage', e);
    }
    return null;
  },

  saveUser: (user: Collaborator | null, remember = true) => {
    if (user) {
        if (remember) localStorage.setItem('currentUser', JSON.stringify(user));
        else sessionStorage.setItem('currentUser', JSON.stringify(user));
    } else {
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
    }
  },

  getAppConfig: async (key: string): Promise<string | null> => {
      if (IS_USING_MOCK) return null;
      try {
          const { data, error } = await supabase.from('app_configs').select('value').eq('key', key).single();
          if (error) return null;
          return data?.value || null;
      } catch (e) {
          return null;
      }
  },
  
  setAppConfig: async (config: AppConfig) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('app_configs').upsert(config);
      if (error) logError('Error setting config', error);
      return { error };
  },

  getSettings: async (): Promise<Settings> => {
      if (IS_USING_MOCK) return DEFAULT_SETTINGS;
      try {
          const { data, error } = await supabase.from('settings').select('*').eq('id', 'global').single();
          if (error || !data) return DEFAULT_SETTINGS;
          return { ...DEFAULT_SETTINGS, ...(data.raw_json as Settings) };
      } catch (e) {
          return DEFAULT_SETTINGS;
      }
  },

  saveSettings: async (settings: Settings) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('settings').upsert({
          id: 'global',
          raw_json: settings
      });
      if (error) logError('Error saving settings', error);
  },

  getTimeLogs: async (staffId?: string, month?: string): Promise<TimeLog[]> => {
      const limitDate = getDataStartDate();
      let query = supabase.from('time_logs').select('*').order('created_at', { ascending: false });
      if (staffId) query = query.eq('staff_id', staffId);
      if (!month) query = query.gte('created_at', limitDate);
      const data = await safeFetch(query, MOCK_TIME_LOGS, 'time_logs');
      return data;
  },

  clockIn: async (staffId: string, facilityId: string, currentLat: number, currentLng: number, photoUrl?: string): Promise<{ success: boolean, message: string, data?: TimeLog }> => {
      const facilities = await storageService.getFacilities();
      const facility = facilities.find(f => f.id === facilityId);
      
      if (!facility) return { success: false, message: 'Không tìm thấy thông tin cơ sở!' };

      let distance = 0;
      let status: TimeLog['status'] = 'Invalid';
      const allowedRadius = facility.allowed_radius || 100;

      if (facility.latitude && facility.longitude) {
          distance = calculateDistance(currentLat, currentLng, facility.latitude, facility.longitude);
          if (distance <= allowedRadius) {
              status = 'Valid';
          }
      } else {
          status = 'Pending';
      }

      const newLog: Partial<TimeLog> = {
          staff_id: staffId,
          facility_id: facilityId,
          check_in_time: new Date().toISOString(),
          status: status,
          location_lat: currentLat,
          location_lng: currentLng,
          distance: Math.round(distance),
          check_in_img: photoUrl
      };

      if (IS_USING_MOCK) {
          return { success: true, message: status === 'Valid' ? 'Chấm công thành công' : `Vị trí quá xa (${Math.round(distance)}m)`, data: { id: `TL-MOCK-${Date.now()}`, ...newLog } as TimeLog };
      }

      const { data, error } = await supabase.from('time_logs').insert(newLog).select().single();
      
      if (error) {
          logError('Clock In Failed', error);
          return { success: false, message: 'Lỗi lưu dữ liệu chấm công.' };
      }

      return { 
          success: true, 
          message: status === 'Valid' ? 'Chấm công thành công' : `Cảnh báo: Bạn đang cách ${Math.round(distance)}m (Quy định: ${allowedRadius}m)`,
          data: data
      };
  },

  clockOut: async (staffId: string): Promise<{ success: boolean, message: string }> => {
      if (IS_USING_MOCK) {
          return { success: true, message: 'Checkout thành công' };
      }

      const { data: activeLogs } = await supabase.from('time_logs')
          .select('*')
          .eq('staff_id', staffId)
          .is('check_out_time', null)
          .order('check_in_time', { ascending: false })
          .limit(1);

      if (!activeLogs || activeLogs.length === 0) {
          return { success: false, message: 'Không tìm thấy ca làm việc đang mở.' };
      }

      const logToClose = activeLogs[0];
      const { error } = await supabase.from('time_logs')
          .update({ check_out_time: new Date().toISOString() })
          .eq('id', logToClose.id);

      if (error) {
          logError('Clock Out Failed', error);
          return { success: false, message: 'Lỗi cập nhật giờ ra.' };
      }

      return { success: true, message: 'Kết thúc ca làm việc thành công.' };
  },

  getBankAccounts: async (): Promise<BankAccount[]> => {
      if (IS_USING_MOCK) return [];
      const rawData = await safeFetch(supabase.from('bank_accounts').select('*').order('created_at', { ascending: true }), [], 'bank_accounts');
      return rawData.map((b: any) => ({
          id: b.id,
          bankId: b.bank_id,
          accountNo: b.account_no,
          accountName: b.account_name,
          branch: b.branch,
          template: b.template,
          is_default: b.is_default,
          created_at: b.created_at
      }));
  },

  addBankAccount: async (account: BankAccount) => {
      if (IS_USING_MOCK) return;
      const existing = await storageService.getBankAccounts();
      const isDefault = existing.length === 0 ? true : account.is_default;

      if (isDefault) {
          await supabase.from('bank_accounts').update({ is_default: false }).neq('id', '0'); 
      }

      const payload = {
          id: account.id,
          bank_id: account.bankId,
          account_no: account.accountNo,
          account_name: account.accountName,
          branch: account.branch || '',
          template: account.template,
          is_default: isDefault
      };

      const { error } = await supabase.from('bank_accounts').insert(payload);
      if (error) logError('Error adding bank account', error);
  },

  updateBankAccount: async (account: BankAccount) => {
      if (IS_USING_MOCK) return;
      
      if (account.is_default) {
          await supabase.from('bank_accounts').update({ is_default: false }).neq('id', account.id);
      }

      const payload = {
          bank_id: account.bankId,
          account_no: account.accountNo,
          account_name: account.accountName,
          branch: account.branch || '',
          template: account.template,
          is_default: account.is_default
      };

      const { error } = await supabase.from('bank_accounts').update(payload).eq('id', account.id);
      if (error) logError('Error updating bank account', error);
  },

  deleteBankAccount: async (id: string) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) logError('Error deleting bank account', error);
  },

  getRoomRecipes: async (): Promise<Record<string, RoomRecipe>> => {
      try {
          const data = await safeFetch(supabase.from('room_recipes').select('*'), [], 'room_recipes');
          const recipes: Record<string, RoomRecipe> = { ...ROOM_RECIPES };
          
          if (data && Array.isArray(data) && data.length > 0) {
              data.forEach((r: any) => {
                  let items = r.items_json;
                  if (typeof items === 'string') {
                      try { items = JSON.parse(items); } catch(e) { items = []; }
                  }

                  recipes[r.id] = {
                      roomType: r.id,
                      description: r.description,
                      items: items || []
                  };
              });
          }
          return recipes;
      } catch (e) {
          console.error("Error parsing room recipes", e);
          return ROOM_RECIPES;
      }
  },

  upsertRoomRecipe: async (recipe: RoomRecipe) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('room_recipes').upsert({
          id: recipe.roomType,
          description: recipe.description,
          items_json: recipe.items
      });
      if (error) logError('Error saving recipe', error);
  },

  deleteRoomRecipe: async (id: string) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('room_recipes').delete().eq('id', id);
      if (error) logError('Error deleting recipe', error);
  },

  getFacilities: async (): Promise<Facility[]> => {
    return safeFetch(supabase.from('facilities').select('*').order('id', { ascending: true }), MOCK_FACILITIES, 'facilities');
  },
  addFacility: async (item: Facility) => {
    if (IS_USING_MOCK) return;
    const { staff, ...payload } = item; 
    const { error } = await supabase.from('facilities').insert(payload);
    if (error) logError('Error adding facility', error);
  },
  updateFacility: async (item: Facility) => {
    if (IS_USING_MOCK) return;
    const { staff, ...payload } = item;
    const { error } = await supabase.from('facilities').update(payload).eq('id', item.id);
    if (error) logError('Error updating facility', error);
  },
  
  deleteFacility: async (id: string, facilityName?: string) => {
    if (IS_USING_MOCK) return { error: null };
    try {
        await supabase.from('housekeeping_tasks').delete().eq('facility_id', id);
        await supabase.from('rooms').delete().eq('facility_id', id);
        if (facilityName) {
            await supabase.from('bookings').delete().eq('facilityName', facilityName);
            await supabase.from('finance_transactions').delete().eq('facility_id', id);
        }
        const { error } = await supabase.from('facilities').delete().eq('id', id);
        return { error: error || null };
    } catch (err) {
        return { error: err };
    }
  },

  getRooms: async (): Promise<Room[]> => {
     return safeFetch(supabase.from('rooms').select('*'), MOCK_ROOMS, 'rooms');
  },
  upsertRoom: async (item: Room) => {
     if (IS_USING_MOCK) return;
     const { error } = await supabase.from('rooms').upsert(item);
     if (error) logError('Error upserting room', error);
  },
  deleteRoom: async (id: string) => {
     if (IS_USING_MOCK) return { error: null };
     const { error } = await supabase.from('rooms').delete().eq('id', id);
     return { error: error || null };
  },
  
  getCollaborators: async (): Promise<Collaborator[]> => {
    const rawData = await safeFetch(supabase.from('collaborators').select('*'), MOCK_COLLABORATORS, 'collaborators');
    return rawData.map((c: any) => ({
      ...c,
      bankId: c.bank_id,
      accountNo: c.account_no,
      accountName: c.account_name
    }));
  },
  addCollaborator: async (item: Collaborator) => {
    if (IS_USING_MOCK) return;
    const payload = {
        ...item,
        bank_id: item.bankId,
        account_no: item.accountNo,
        account_name: item.accountName
    };
    delete (payload as any).bankId;
    delete (payload as any).accountNo;
    delete (payload as any).accountName;

    const { error } = await supabase.from('collaborators').insert(payload);
    if (error) logError('Error adding collaborator', error);
  },
  updateCollaborator: async (item: Collaborator) => {
    if (IS_USING_MOCK) return;
    const payload = {
        ...item,
        bank_id: item.bankId,
        account_no: item.accountNo,
        account_name: item.accountName
    };
    delete (payload as any).bankId;
    delete (payload as any).accountNo;
    delete (payload as any).accountName;

    const { error } = await supabase.from('collaborators').update(payload).eq('id', item.id);
    if (error) logError('Error updating collaborator', error);
  },
  deleteCollaborator: async (id: string) => {
    if (IS_USING_MOCK) return { error: null };
    await supabase.from('shifts').delete().eq('staff_id', id);
    const { error } = await supabase.from('collaborators').delete().eq('id', id);
    return { error: error || null };
  },

  getSchedules: async (): Promise<ShiftSchedule[]> => {
    const startYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const data = await safeFetch(supabase.from('shift_schedules').select('*').gte('date', startYear), [], 'shift_schedules');
    return data.map((s: any) => {
        let type = s.shift_type;
        if (type === 'Ca 1' || type === 'Morning') type = 'Sáng';
        if (type === 'Ca 2' || type === 'Night') type = 'Tối';
        if (type === 'Afternoon') type = 'Chiều';
        return { ...s, shift_type: type };
    });
  },
  upsertSchedule: async (item: ShiftSchedule) => {
    if (IS_USING_MOCK) return { error: null };
    const sanitized = { ...item };
    if (sanitized.shift_type === 'Ca 1' as any) sanitized.shift_type = 'Sáng';
    if (sanitized.shift_type === 'Ca 2' as any) sanitized.shift_type = 'Tối';
    const { error } = await supabase.from('shift_schedules').upsert(sanitized);
    if (error) logError('Error upserting schedule', error);
    return { error };
  },
  deleteSchedule: async (id: string) => {
    if (IS_USING_MOCK) return;
    const { error } = await supabase.from('shift_schedules').delete().eq('id', id);
    if (error) logError('Error deleting schedule', error);
  },

  getAdjustments: async (): Promise<AttendanceAdjustment[]> => {
    return safeFetch(supabase.from('attendance_adjustments').select('*'), [], 'attendance_adjustments');
  },
  upsertAdjustment: async (item: AttendanceAdjustment) => {
    if (IS_USING_MOCK) return;
    const { error } = await supabase.from('attendance_adjustments').upsert(item);
    if (error) logError('Error upserting adjustment', error);
  },

  getLeaveRequests: async (): Promise<LeaveRequest[]> => {
      const startYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
      return safeFetch(
          supabase.from('leave_requests').select('*').gte('created_at', startYear).order('created_at', { ascending: false }),
          [], 'leave_requests'
      );
  },
  addLeaveRequest: async (item: LeaveRequest) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('leave_requests').insert(item);
      if (error && !isTableMissingError(error)) logError('Error adding leave request', error);
      return { error };
  },
  updateLeaveRequest: async (item: LeaveRequest) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('leave_requests').update(item).eq('id', item.id);
      if (error && !isTableMissingError(error)) logError('Error updating leave request', error);
      return { error };
  },

  getSalaryAdvances: async (): Promise<SalaryAdvance[]> => {
      const limitDate = getDataStartDate();
      return safeFetch(
          supabase.from('salary_advances').select('*').gte('request_date', limitDate).order('request_date', { ascending: false }),
          [], 'salary_advances'
      );
  },
  addSalaryAdvance: async (item: SalaryAdvance) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('salary_advances').insert(item);
      if (error && !isTableMissingError(error)) logError('Error adding salary advance', error);
      return { error };
  },
  updateSalaryAdvance: async (item: SalaryAdvance) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('salary_advances').update(item).eq('id', item.id);
      if (error && !isTableMissingError(error)) logError('Error updating salary advance', error);
      return { error };
  },

  getViolations: async (): Promise<Violation[]> => {
      const limitDate = getDataStartDate();
      return safeFetch(
          supabase.from('violations').select('*').gte('date', limitDate).order('date', { ascending: false }),
          [], 'violations'
      );
  },
  addViolation: async (item: Violation) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('violations').insert(item);
      if (error && !isTableMissingError(error)) logError('Error adding violation', error);
      return { error };
  },

  getBookings: async (): Promise<Booking[]> => {
    const limitDate = getDataStartDate();
    
    const rawData = await safeFetch(
        supabase.from('bookings')
            .select('*')
            .or(`checkoutDate.gte.${limitDate},status.eq.Confirmed,status.eq.CheckedIn`),
        MOCK_BOOKINGS, 'bookings'
    );

    return rawData.map((b: any) => {
        const mappedBooking: Booking = {
            ...b,
            lendingJson: b.lendingjson || b.lendingJson || '[]',
            guestsJson: b.guestsjson || b.guestsJson || '[]',
            isDeclared: b.isdeclared ?? b.isDeclared ?? false,
            groupId: b.groupid || b.groupId,
            groupName: b.groupname || b.groupName,
            isGroupLeader: b.isgroupleader ?? b.isGroupLeader ?? false,
            facilityName: b.facilityName || b.facilityname,
            roomCode: b.roomCode || b.roomcode,
            customerName: b.customerName || b.customername,
        };

        let isDeclared = mappedBooking.isDeclared;
        if (isDeclared === undefined && mappedBooking.cleaningJson) {
            try {
                const cleanObj = JSON.parse(mappedBooking.cleaningJson);
                if (cleanObj && typeof cleanObj === 'object' && cleanObj.isDeclared === true) {
                    isDeclared = true;
                }
            } catch (e) { }
        }
        return { ...mappedBooking, isDeclared: !!isDeclared };
    });
  },

  addBooking: async (item: Booking) => {
    if (IS_USING_MOCK) return;
    const payload: any = { ...item };
    
    try {
        const cleanObj = payload.cleaningJson ? JSON.parse(payload.cleaningJson) : {};
        if (payload.isDeclared) cleanObj.isDeclared = true;
        else delete cleanObj.isDeclared;
        payload.cleaningJson = JSON.stringify(cleanObj);
    } catch (e) {
        payload.cleaningJson = JSON.stringify({ isDeclared: payload.isDeclared });
    }
    delete payload.isDeclared; 

    const dbPayload = {
        ...payload,
        lendingjson: payload.lendingJson,
        guestsjson: payload.guestsJson,
        isdeclared: item.isDeclared, 
        groupid: payload.groupId,
        groupname: payload.groupName,
        isgroupleader: payload.isGroupLeader
    };
    
    delete dbPayload.lendingJson;
    delete dbPayload.guestsJson;
    delete dbPayload.groupId;
    delete dbPayload.groupName;
    delete dbPayload.isGroupLeader;

    const { error } = await supabase.from('bookings').insert(dbPayload);
    if (error) logError('Error adding booking', error);
  },

  updateBooking: async (item: Booking) => {
    if (IS_USING_MOCK) return;
    const payload: any = { ...item };
    try {
        const cleanObj = payload.cleaningJson ? JSON.parse(payload.cleaningJson) : {};
        if (payload.isDeclared) cleanObj.isDeclared = true;
        else delete cleanObj.isDeclared;
        payload.cleaningJson = JSON.stringify(cleanObj);
    } catch (e) {
        payload.cleaningJson = JSON.stringify({ isDeclared: payload.isDeclared });
    }
    delete payload.isDeclared;

    const dbPayload = {
        ...payload,
        lendingjson: payload.lendingJson,
        guestsjson: payload.guestsJson,
        isdeclared: item.isDeclared,
        groupid: payload.groupId,
        groupname: payload.groupName,
        isgroupleader: payload.isGroupLeader
    };
    
    delete dbPayload.lendingJson;
    delete dbPayload.guestsJson;
    delete dbPayload.groupId;
    delete dbPayload.groupName;
    delete dbPayload.isGroupLeader;

    const { error } = await supabase.from('bookings').update(dbPayload).eq('id', item.id);
    if (error) logError('Error updating booking', error);
  },

  // --- REPLACED: FINANCE TRANSACTIONS ---
  getTransactions: async (): Promise<FinanceTransaction[]> => {
    const limitDate = getDataStartDate();
    const rawData = await safeFetch(
        supabase.from('finance_transactions').select('*').gte('transaction_date', limitDate).order('transaction_date', { ascending: false }),
        [], 'finance_transactions'
    );
    
    return rawData.map((t: any) => ({
        id: t.id,
        transactionDate: t.transaction_date,
        amount: t.amount,
        type: t.type,
        category: t.category,
        description: t.description,
        pic: t.pic,
        status: t.status,
        bookingId: t.booking_id,
        note: t.note,
        paymentMethod: t.payment_method,
        facilityId: t.facility_id,
        created_by: t.created_by
    }));
  },

  addTransaction: async (item: FinanceTransaction) => {
    if (IS_USING_MOCK) return;
    const dbPayload = {
        id: item.id,
        transaction_date: item.transactionDate,
        amount: item.amount,
        type: item.type,
        category: item.category,
        description: item.description,
        pic: item.pic,
        status: item.status,
        booking_id: item.bookingId,
        note: item.note,
        payment_method: item.paymentMethod,
        facility_id: item.facilityId,
        created_by: item.created_by
    };
    const { error } = await supabase.from('finance_transactions').insert(dbPayload);
    if (error) logError('Error adding transaction', error);
  },

  updateTransaction: async (item: FinanceTransaction) => {
    if (IS_USING_MOCK) return;
    const dbPayload = {
        transaction_date: item.transactionDate,
        amount: item.amount,
        type: item.type,
        category: item.category,
        description: item.description,
        pic: item.pic,
        status: item.status,
        booking_id: item.bookingId,
        note: item.note,
        payment_method: item.paymentMethod,
        facility_id: item.facilityId,
        created_by: item.created_by
    };
    const { error } = await supabase.from('finance_transactions').update(dbPayload).eq('id', item.id);
    if (error) logError('Error updating transaction', error);
  },

  deleteTransaction: async (id: string) => {
    if (IS_USING_MOCK) return;
    const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
    if (error) logError('Error deleting transaction', error);
  },

  // Legacy Expenses - kept for reference or migration fallback if needed, but not used actively
  getExpenses: async (): Promise<Expense[]> => {
    return []; // Return empty as we migrated
  },

  addExpense: async (item: Expense) => {
      // Compatibility wrapper: Convert Expense to Transaction and save
      if (IS_USING_MOCK) return;
      const trans: FinanceTransaction = {
          id: item.id,
          transactionDate: item.expenseDate,
          amount: item.amount,
          type: 'EXPENSE',
          category: item.expenseCategory,
          description: item.expenseContent,
          status: 'Verified',
          note: item.note,
          facilityName: item.facilityName,
          created_by: item.created_by
      };
      // We use addTransaction logic here (inserting into finance_transactions)
      const dbPayload = {
        id: trans.id,
        transaction_date: trans.transactionDate,
        amount: trans.amount,
        type: trans.type,
        category: trans.category,
        description: trans.description,
        status: trans.status,
        note: trans.note,
        facility_name: trans.facilityName,
        created_by: trans.created_by
      };
      
      // Look up facility_id
      if (trans.facilityName) {
          const { data: fac } = await supabase.from('facilities').select('id').eq('facilityName', trans.facilityName).single();
          if (fac) (dbPayload as any).facility_id = fac.id;
      }

      const { error } = await supabase.from('finance_transactions').insert(dbPayload);
      if (error) logError('Error adding expense (compat)', error);
  },

  getServices: async (): Promise<ServiceItem[]> => {
    const rawData = await safeFetch(supabase.from('service_items').select('*').order('name', { ascending: true }), MOCK_SERVICES, 'service_items');
    return rawData.map((s: any) => ({
        ...s,
        costPrice: s.costprice ?? s.costPrice ?? 0,
        minStock: s.minstock ?? s.minStock ?? 0,
        laundryStock: s.laundrystock ?? s.laundryStock ?? 0,
        vendor_stock: s.vendor_stock ?? 0,
        in_circulation: s.in_circulation ?? 0,
        totalassets: s.totalassets ?? 0,
        default_qty: s.default_qty ?? 0
    }));
  },
  addService: async (item: ServiceItem) => {
    if (IS_USING_MOCK) return { error: null };
    const dbPayload = {
        id: item.id,
        name: item.name,
        price: item.price,
        unit: item.unit,
        stock: item.stock,
        category: item.category,
        costprice: item.costPrice,
        minstock: item.minStock,
        laundrystock: item.laundryStock,
        vendor_stock: item.vendor_stock,
        in_circulation: item.in_circulation,
        totalassets: item.totalassets,
        default_qty: item.default_qty
    };

    const { error } = await supabase.from('service_items').insert(dbPayload);
    if (error) logError('Error adding service', error);
    return { error };
  },
  updateService: async (item: ServiceItem) => {
    if (IS_USING_MOCK) return { error: null };
    const dbPayload = {
        id: item.id,
        name: item.name,
        price: item.price,
        unit: item.unit,
        stock: item.stock,
        category: item.category,
        costprice: item.costPrice,
        minstock: item.minStock,
        laundrystock: item.laundryStock,
        vendor_stock: item.vendor_stock,
        in_circulation: item.in_circulation,
        totalassets: item.totalassets,
        default_qty: item.default_qty
    };

    const { error } = await supabase.from('service_items').upsert(dbPayload);
    if (error) logError('Error updating service', error);
    return { error };
  },
  deleteService: async (id: string) => {
    if (IS_USING_MOCK) return { error: null };
    const { error } = await supabase.from('service_items').delete().eq('id', id);
    return { error: error || null };
  },

  getInventoryTransactions: async (): Promise<InventoryTransaction[]> => {
    return safeFetch(
        supabase.from('inventory_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200), 
        [], 'inventory_transactions'
    );
  },
  addInventoryTransaction: async (item: InventoryTransaction) => {
    if (IS_USING_MOCK) return { error: null };
    const { error } = await supabase.from('inventory_transactions').insert(item);
    if (error) logError('Error adding inventory transaction', error);
    return { error };
  },

  getHousekeepingTasks: async (): Promise<HousekeepingTask[]> => {
    const limitDate = getDataStartDate();
    return safeFetch(
        supabase.from('housekeeping_tasks')
            .select('*')
            .or(`status.eq.Pending,status.eq.In Progress,created_at.gte.${limitDate}`),
        [], 'housekeeping_tasks'
    );
  },
  syncHousekeepingTasks: async (tasks: HousekeepingTask[]) => {
      if (IS_USING_MOCK) return;
      const sanitizedTasks = tasks.map(task => ({
          id: task.id,
          facility_id: task.facility_id,
          room_code: task.room_code,
          task_type: task.task_type,
          status: task.status,
          assignee: task.assignee,
          priority: task.priority,
          created_at: task.created_at,
          started_at: task.started_at, 
          completed_at: task.completed_at,
          note: task.note,
          points: task.points,
          checklist: task.checklist,
          photo_before: task.photo_before,
          photo_after: task.photo_after,
          linen_exchanged: task.linen_exchanged
      }));

      const { error } = await supabase.from('housekeeping_tasks').upsert(sanitizedTasks);
      if (error) logError('Error syncing tasks', error);
  },

  getWebhooks: async (): Promise<WebhookConfig[]> => {
      return safeFetch(supabase.from('webhooks').select('*'), [], 'webhooks');
  },
  addWebhook: async (item: WebhookConfig) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('webhooks').insert(item);
      if (error) logError('Error adding webhook', error);
  },
  updateWebhook: async (item: WebhookConfig) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('webhooks').update(item).eq('id', item.id);
      if (error) logError('Error updating webhook', error);
  },
  deleteWebhook: async (id: string) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      return { error: error || null };
  },

  addGuestProfile: async (item: GuestProfile) => {
      if (IS_USING_MOCK) return { error: null };
      const { error } = await supabase.from('guest_profiles').insert(item);
      if (error && !isTableMissingError(error)) logError('Error adding guest profile', error);
      return { error };
  },

  getShifts: async (): Promise<Shift[]> => {
      return safeFetch(
          supabase.from('shifts')
            .select('*')
            .order('start_time', { ascending: false })
            .limit(50), 
          [], 'shifts'
      );
  },
  addShift: async (item: Shift) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('shifts').insert(item);
      if (error) logError('Error adding shift', error);
  },
  updateShift: async (item: Shift) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('shifts').update(item).eq('id', item.id);
      if (error) logError('Error updating shift', error);
  },

  // --- SEASONS & SHIFTS ---
  getSeasons: async (): Promise<Season[]> => {
      return safeFetch(supabase.from('seasons').select('*'), MOCK_SEASONS, 'seasons');
  },
  upsertSeason: async (season: Season) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('seasons').upsert(season);
      if (error) logError('Error upserting season', error);
  },
  
  getShiftDefinitions: async (): Promise<ShiftDefinition[]> => {
      return safeFetch(supabase.from('shift_types').select('*'), MOCK_SHIFTS, 'shift_types');
  },
  upsertShiftDefinition: async (shift: ShiftDefinition) => {
      if (IS_USING_MOCK) return;
      const { error } = await supabase.from('shift_types').upsert(shift);
      if (error) logError('Error upserting shift definition', error);
  },

  seedDatabase: async () => {
     if (IS_USING_MOCK) return;
     const facilitiesPayload = MOCK_FACILITIES.map(({staff, ...rest}) => rest);
     await supabase.from('facilities').upsert(facilitiesPayload);
     await supabase.from('rooms').upsert(MOCK_ROOMS);
     await supabase.from('collaborators').upsert(MOCK_COLLABORATORS);
     await supabase.from('bookings').upsert(MOCK_BOOKINGS);
     
     const servicesWithDefault = MOCK_SERVICES.map(s => {
         let dqty = 0;
         if (s.name.includes('Nước')) dqty = 2;
         if (s.name.includes('Bàn chải')) dqty = 2;
         if (s.name.includes('Khăn')) dqty = 2;
         if (s.name.includes('Dầu gội')) dqty = 2;
         return { 
            id: s.id,
            name: s.name,
            price: s.price,
            costprice: s.costPrice,
            unit: s.unit,
            stock: s.stock,
            minstock: s.minStock,
            category: s.category,
            totalassets: s.stock || 100,
            laundrystock: 0,
            vendor_stock: 0,
            in_circulation: 0,
            default_qty: dqty
         };
     });
     await supabase.from('service_items').upsert(servicesWithDefault);
     await supabase.from('seasons').upsert(MOCK_SEASONS);
     await supabase.from('shift_types').upsert(MOCK_SHIFTS);
  }
};
