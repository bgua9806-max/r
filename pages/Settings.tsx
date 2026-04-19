
import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Trash, Save, Check, X, ShoppingCart, Database, Globe, Send, AlertTriangle, Cpu, Lock, ChefHat, Pencil, CreditCard, QrCode, Building, CheckCircle2, RotateCw, Calculator, TrendingUp, TrendingDown, Equal, BedDouble, Calendar, Clock, Loader2, Users, Key, Wallet, Tags } from 'lucide-react';
import { Settings as SettingsType, ServiceItem, ItemCategory, WebhookConfig, RoomRecipe, BankAccount, Season, ShiftDefinition } from '../types';
import { MOCK_SERVICES } from '../constants';
import { storageService } from '../services/storage';
import { RecipeModal } from '../components/RecipeModal';
import { Modal } from '../components/Modal';
import { useStandardInventory } from '../hooks/useStandardInventory';

export const Settings: React.FC = () => {
  const { 
      settings, updateSettings, services, addService, deleteService, notify, refreshData, 
      webhooks, addWebhook, deleteWebhook, updateWebhook, triggerWebhook, 
      getGeminiApiKey, setAppConfig, roomRecipes, deleteRoomRecipe,
      bankAccounts, addBankAccount, updateBankAccount, deleteBankAccount, isLoading,
      rooms,
      seasons, shiftDefinitions, upsertSeason, upsertShiftDefinition
  } = useAppContext();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const inventoryAnalysis = useStandardInventory();
  
  // State for adding simple strings
  const [addingSection, setAddingSection] = useState<keyof SettingsType | null>(null);
  const [newItemValue, setNewItemValue] = useState('');

  // State for adding Service
  const [isAddingService, setIsAddingService] = useState(false);
  const [newService, setNewService] = useState<Partial<ServiceItem>>({ name: '', price: 0, unit: 'Cái', category: 'Service' });

  // State for adding Webhook
  const [isAddingWebhook, setIsAddingWebhook] = useState(false);
  const [newWebhook, setNewWebhook] = useState<Partial<WebhookConfig>>({ url: '', event_type: 'ota_import', description: '', is_active: true });

  // State for Recipes
  const [isRecipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingRecipeKey, setEditingRecipeKey] = useState<string | undefined>(undefined);
  const [editingRecipeData, setEditingRecipeData] = useState<RoomRecipe | null>(null);

  // State for Bank Accounts
  const [isBankModalOpen, setBankModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState<Partial<BankAccount>>({
      bankId: '',
      accountNo: '',
      accountName: '',
      branch: '',
      template: 'print',
      is_default: false
  });

  // State for Gemini Key
  const [geminiKey, setGeminiKey] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);

  // --- LOCAL STATE FOR SEASONS & SHIFTS (Prevent UI Jumping) ---
  const [localSeasons, setLocalSeasons] = useState<Season[]>([]);
  const [localShifts, setLocalShifts] = useState<ShiftDefinition[]>([]);
  const [isSavingShifts, setIsSavingShifts] = useState(false);

  // --- UI ZOOM STATE ---
  const [uiZoom, setUiZoom] = useState(localStorage.getItem('cf_ui_zoom') || '100%');
  const applyZoom = (zoomValue: string) => {
    setUiZoom(zoomValue);
    localStorage.setItem('cf_ui_zoom', zoomValue);
    document.body.style.zoom = zoomValue;
    document.documentElement.style.setProperty('--ui-zoom', (parseFloat(zoomValue) / 100).toString());
  };

  // --- TABS STATE ---
  const [activeTab, setActiveTab] = useState<'finance' | 'inventory' | 'operation' | 'system' | 'general'>('finance');

  const TABS = [
      { id: 'finance', label: 'Ngân Hàng', icon: CreditCard },
      { id: 'inventory', label: 'Kho & Menu', icon: ShoppingCart },
      { id: 'operation', label: 'Ca & Vận Hành', icon: Calendar },
      { id: 'system', label: 'Hệ Thống & AI', icon: Cpu },
      { id: 'general', label: 'Khác', icon: Globe }
  ] as const;

  // Sync context data to local state initially
  useEffect(() => {
      if (seasons.length > 0) setLocalSeasons(seasons);
      if (shiftDefinitions.length > 0) setLocalShifts(shiftDefinitions);
  }, [seasons, shiftDefinitions]);

  // --- CALCULATE ROOM TYPE COUNTS ---
  const roomTypeStats = useMemo(() => {
      const stats: Record<string, number> = {};
      rooms.forEach(r => {
          const type = r.type || 'Chưa phân loại';
          stats[type] = (stats[type] || 0) + 1;
      });
      return stats;
  }, [rooms]);

  useEffect(() => {
      const loadKey = async () => {
          const key = await getGeminiApiKey();
          if (key) setGeminiKey(key);
      };
      loadKey();
  }, []);

  const handleChange = (section: keyof SettingsType, value: any) => {
    setLocalSettings(prev => ({ ...prev, [section]: value }));
  };

  const startAdding = (section: keyof SettingsType) => {
    setAddingSection(section);
    setNewItemValue('');
  };

  const confirmAdd = () => {
    if (addingSection && newItemValue.trim()) {
       handleChange(addingSection, [...(localSettings[addingSection] as string[]), newItemValue.trim()]);
       setAddingSection(null);
       setNewItemValue('');
    }
  };

  const removeItem = (section: keyof SettingsType, index: number) => {
    if(confirm('Xóa mục này?')) {
       const arr = localSettings[section] as any[];
       const newArr = arr.filter((_, i) => i !== index);
       handleChange(section, newArr);
    }
  };
  
  const handleSaveGeminiKey = async () => {
      setIsSavingKey(true);
      try {
          await setAppConfig({
              key: 'GEMINI_API_KEY',
              value: geminiKey,
              description: 'API Key Google Gemini cho tính năng OCR và Chat AI'
          });
          notify('success', 'Đã lưu API Key thành công!');
      } catch (e) {
          notify('error', 'Lỗi khi lưu API Key');
      } finally {
          setIsSavingKey(false);
      }
  };

  const handleAddService = () => {
     if (newService.name && newService.price !== undefined) {
        const item: ServiceItem = {
           id: `S${Date.now()}`,
           name: newService.name || '',
           price: Number(newService.price),
           unit: newService.unit || 'Cái',
           category: newService.category || 'Service',
           costPrice: 0,
           stock: 0,
           minStock: 0
        };
        addService(item);
        setIsAddingService(false);
        setNewService({ name: '', price: 0, unit: 'Cái', category: 'Service' });
     }
  };

  const handleAddWebhook = () => {
      if (newWebhook.url) {
          const item: WebhookConfig = {
              id: `WH${Date.now()}`,
              url: newWebhook.url,
              event_type: newWebhook.event_type || 'ota_import',
              description: newWebhook.description || '',
              is_active: newWebhook.is_active ?? true,
              created_at: new Date().toISOString()
          };
          addWebhook(item);
          setIsAddingWebhook(false);
          setNewWebhook({ url: '', event_type: 'ota_import', description: '', is_active: true });
      }
  };

  const handleOpenBankModal = (bank?: BankAccount) => {
      if (bank) {
          setEditingBank(bank);
          setBankForm(bank);
      } else {
          setEditingBank(null);
          setBankForm({
              bankId: '',
              accountNo: '',
              accountName: '',
              branch: '',
              template: 'print',
              is_default: bankAccounts.length === 0
          });
      }
      setBankModalOpen(true);
  };

  const handleSaveBank = async () => {
      if (!bankForm.bankId || !bankForm.accountNo || !bankForm.accountName) {
          notify('error', 'Vui lòng điền đủ thông tin ngân hàng.');
          return;
      }

      const payload: BankAccount = {
          id: editingBank?.id || `BA${Date.now()}`,
          bankId: bankForm.bankId.toUpperCase(),
          accountNo: bankForm.accountNo,
          accountName: bankForm.accountName.toUpperCase(),
          branch: bankForm.branch || '',
          template: bankForm.template as any,
          is_default: bankForm.is_default || false,
          created_at: editingBank?.created_at || new Date().toISOString()
      };

      if (editingBank) {
          await updateBankAccount(payload);
          notify('success', 'Đã cập nhật tài khoản.');
      } else {
          await addBankAccount(payload);
          notify('success', 'Đã thêm tài khoản mới.');
      }
      setBankModalOpen(false);
  };

  const handleSetDefaultBank = async (bank: BankAccount) => {
      await updateBankAccount({ ...bank, is_default: true });
      notify('success', `Đã đặt ${bank.bankId} làm mặc định.`);
  };

  const handleTestWebhook = (wh: WebhookConfig) => {
      let mockPayload: any = {
          message: "Đây là tín hiệu kiểm tra (Test Signal)",
          test_id: Date.now(),
          event: wh.event_type,
      };
      
      triggerWebhook(wh.event_type, mockPayload);
      notify('info', `Đã gửi tín hiệu test đến ${wh.event_type}`);
  };

  const handleResetMenu = async () => {
     if(confirm('CẢNH BÁO: Hành động này sẽ GHI ĐÈ toàn bộ dịch vụ hiện có bằng danh sách Mẫu. Bạn có chắc chắn không?')) {
        notify('info', 'Đang nạp dữ liệu vào bảng SQL...');
        for(const item of MOCK_SERVICES) {
            await storageService.addService(item);
        }
        await refreshData();
        notify('success', 'Đã nạp danh sách mẫu vào Database.');
     }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    notify('success', 'Đã lưu cấu hình chung');
  };

  // --- SEASONS & SHIFTS HANDLERS (LOCAL STATE) ---
  const handleUpdateLocalSeason = (code: string, field: keyof Season, val: any) => {
      setLocalSeasons(prev => prev.map(s => s.code === code ? { ...s, [field]: val } : s));
  };

  const handleUpdateLocalShift = (id: string, field: keyof ShiftDefinition, val: any) => {
      setLocalShifts(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
  };

  const handleSaveSeasonsAndShifts = async () => {
      setIsSavingShifts(true);
      try {
          // Save Seasons
          for (const s of localSeasons) {
              await upsertSeason(s);
          }
          // Save Shifts
          for (const sh of localShifts) {
              await upsertShiftDefinition(sh);
          }
          await refreshData(); // Refresh global context
          notify('success', 'Đã lưu cấu hình Mùa & Ca làm việc!');
      } catch (e) {
          console.error(e);
          notify('error', 'Lỗi khi lưu cấu hình.');
      } finally {
          setIsSavingShifts(false);
      }
  };

  const Section = ({ title, dataKey, icon: Icon }: { title: string, dataKey: keyof SettingsType, icon: any }) => (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full hover:shadow transition-shadow">
       <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <div className="text-slate-500"><Icon size={18}/></div>
              {title}
          </h3>
       </div>
       <div className="space-y-2 flex-1 overflow-y-auto max-h-60 custom-scrollbar pr-1">
          {(localSettings[dataKey] as string[]).map((item, idx) => (
             <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded group hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all">
                <span className="text-gray-700 font-medium">{item}</span>
                <button onClick={() => removeItem(dataKey, idx)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                   <Trash size={16} />
                </button>
             </div>
          ))}
          
          {addingSection === dataKey ? (
             <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-1">
                <input 
                  autoFocus
                  className="flex-1 border border-brand-300 rounded p-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-white text-slate-900"
                  value={newItemValue}
                  onChange={e => setNewItemValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmAdd()}
                  placeholder="Nhập tên..."
                />
                <button onClick={confirmAdd} className="bg-green-500 text-white p-2 rounded hover:bg-green-600"><Check size={16}/></button>
                <button onClick={() => setAddingSection(null)} className="bg-gray-200 text-gray-600 p-2 rounded hover:bg-gray-300"><X size={16}/></button>
             </div>
          ) : (
            <button onClick={() => startAdding(dataKey)} className="w-full py-2 border-2 border-dashed border-gray-200 rounded text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 mt-2">
               <Plus size={16} /> Thêm mới
            </button>
          )}
       </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12 px-2 md:px-0">

      {/* TABS NAVIGATION */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 pb-4 mb-2 md:mb-6 border-b border-slate-100 w-full">
         {TABS.map(tab => {
             const Icon = tab.icon;
             return (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                 >
                     <Icon size={16}/>
                     {tab.label}
                 </button>
             );
         })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
         
         {activeTab === 'finance' && (
           <>
               {/* BANK CONFIGURATION */}
               <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col lg:col-span-3 hover:shadow-md transition-shadow">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                         <h3 className="font-bold text-slate-800 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><CreditCard size={20}/></div>
                      Danh sách Tài khoản Ngân hàng (VietQR)
                   </h3>
                   <p className="text-sm text-slate-500 mt-1 ml-11">Quản lý các tài khoản nhận tiền chuyển khoản.</p>
                </div>
                <button 
                    onClick={() => handleOpenBankModal()} 
                    className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-sm font-bold text-blue-700 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                >
                    <Plus size={16}/> Thêm tài khoản
                </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                 {bankAccounts.map(bank => (
                     <div key={bank.id} className={`p-5 rounded-lg border-2 transition-all hover:shadow-lg relative group overflow-hidden ${bank.is_default ? 'bg-gradient-to-br from-brand-50 to-white border-brand-300' : 'bg-white border-slate-100 hover:border-brand-200'}`}>
                         {/* Accent Strip */}
                         <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${bank.is_default ? 'bg-brand-500' : 'bg-slate-200 group-hover:bg-brand-300'} transition-colors`}></div>
                         <div className="pl-2">
                             <div className="flex justify-between items-start mb-3">
                                 <div className="flex items-center gap-2">
                                     <Building size={20} className="text-slate-400 group-hover:text-brand-500 transition-colors"/>
                                     <span className="font-black text-lg text-slate-800 tracking-tight">{bank.bankId}</span>
                                 </div>
                                 {bank.is_default && (
                                     <span className="bg-brand-100 text-brand-700 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 border border-brand-200 shadow-sm animate-in fade-in">
                                         <CheckCircle2 size={12}/> MẶC ĐỊNH
                                     </span>
                                 )}
                             </div>
                             <div className="font-mono font-bold text-slate-700 text-xl tracking-wider mb-1">{bank.accountNo}</div>
                             <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Users size={12} className="text-slate-400"/> {bank.accountName}</div>
                             
                             <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                 {!bank.is_default && (
                                     <button onClick={() => handleSetDefaultBank(bank)} className="text-xs bg-white border border-slate-200 font-bold px-3 py-1.5 rounded-lg hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm">
                                         Đặt mặc định
                                     </button>
                                 )}
                                 <button onClick={() => handleOpenBankModal(bank)} className="p-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white transition-colors shadow-sm"><Pencil size={16}/></button>
                                 <button onClick={() => { if(confirm('Xóa tài khoản này?')) deleteBankAccount(bank.id); }} className="p-1.5 text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-600 hover:text-white transition-colors shadow-sm"><Trash size={16}/></button>
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
         </div>

           </>
         )}

         {activeTab === 'operation' && (
           <>
               {/* --- SEASON & SHIFT CONFIGURATION (UPDATED) --- */}
               <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col lg:col-span-3 hover:shadow-md transition-shadow">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                         <h3 className="font-bold text-slate-800 flex items-center gap-3">
                      <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><Calendar size={20}/></div>
                      Cấu Hình Mùa & Ca Làm Việc
                   </h3>
                   <p className="text-sm text-slate-500 mt-1 ml-11">Thiết lập thời gian Mùa Cao Điểm/Thấp Điểm và giờ làm việc tương ứng.</p>
                </div>
                <button 
                    onClick={handleSaveSeasonsAndShifts}
                    disabled={isSavingShifts}
                    className="bg-brand-600 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-brand-700 hover:shadow-md disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                    {isSavingShifts ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                    Lưu Cấu Hình Ca
                </button>
             </div>

             {/* Seasons List (Local State) */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 {localSeasons.map(season => (
                     <div key={season.code} className={`border rounded-lg p-5 transition-all ${season.code === 'PEAK' ? 'bg-gradient-to-br from-rose-50/50 to-white border-rose-100' : 'bg-gradient-to-br from-blue-50/50 to-white border-blue-100'}`}>
                         <div className="flex justify-between items-center mb-4">
                             <h4 className="font-black text-slate-700 uppercase tracking-tight">{season.name}</h4>
                             <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shadow-sm border ${season.code === 'PEAK' ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>{season.code}</span>
                         </div>
                         <div className="grid grid-cols-2 gap-5 text-sm">
                             <div>
                                 <label className="text-slate-500 font-bold block mb-2 text-xs uppercase">Bắt đầu (Tháng/Ngày)</label>
                                 <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-fit">
                                     <input type="number" min="1" max="12" className="w-10 border-transparent rounded text-center font-bold text-slate-700 focus:ring-0" value={season.start_month} onChange={e => handleUpdateLocalSeason(season.code, 'start_month', Number(e.target.value))} />
                                     <span className="text-slate-300 font-light text-xl">/</span>
                                     <input type="number" min="1" max="31" className="w-10 border-transparent rounded text-center font-bold text-slate-700 focus:ring-0" value={season.start_day} onChange={e => handleUpdateLocalSeason(season.code, 'start_day', Number(e.target.value))} />
                                 </div>
                             </div>
                             <div>
                                 <label className="text-slate-500 font-bold block mb-2 text-xs uppercase">Kết thúc (Tháng/Ngày)</label>
                                 <div className="flex gap-2 items-center bg-white p-1 rounded-lg border border-slate-200 shadow-sm w-fit">
                                     <input type="number" min="1" max="12" className="w-10 border-transparent rounded text-center font-bold text-slate-700 focus:ring-0" value={season.end_month} onChange={e => handleUpdateLocalSeason(season.code, 'end_month', Number(e.target.value))} />
                                     <span className="text-slate-300 font-light text-xl">/</span>
                                     <input type="number" min="1" max="31" className="w-10 border-transparent rounded text-center font-bold text-slate-700 focus:ring-0" value={season.end_day} onChange={e => handleUpdateLocalSeason(season.code, 'end_day', Number(e.target.value))} />
                                 </div>
                             </div>
                         </div>
                     </div>
                 ))}
             </div>

             {/* Shift Definitions Table (Local State) */}
             <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-inner">
                 <table className="w-full text-left border-collapse text-sm">
                     <thead className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                         <tr>
                             <th className="p-4 border-b border-slate-200">Tên Ca</th>
                             <th className="p-4 border-b border-slate-200">Mùa Áp Dụng</th>
                             <th className="p-4 text-center border-b border-slate-200">Giờ Bắt Đầu</th>
                             <th className="p-4 text-center border-b border-slate-200">Giờ Kết Thúc</th>
                             <th className="p-4 text-center border-b border-slate-200">Hệ Số</th>
                             <th className="p-4 text-center border-b border-slate-200">Cho phép trễ (Phút)</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 bg-white">
                         {localShifts.map(shift => (
                             <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="p-4 font-bold text-slate-800">{shift.name}</td>
                                 <td className="p-4">
                                     <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-wide border ${shift.season_code === 'PEAK' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{shift.season_code}</span>
                                 </td>
                                 <td className="p-4 text-center">
                                     <div className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5 w-fit mx-auto shadow-sm focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400 transition-all">
                                         <Clock size={14} className="text-brand-500"/>
                                         <input type="time" className="bg-transparent outline-none font-mono text-[13px] font-bold w-20 text-center text-slate-700" value={shift.start_time} onChange={e => handleUpdateLocalShift(shift.id, 'start_time', e.target.value + ':00')} />
                                     </div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <div className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5 w-fit mx-auto shadow-sm focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400 transition-all">
                                         <Clock size={14} className="text-slate-400"/>
                                         <input type="time" className="bg-transparent outline-none font-mono text-[13px] font-bold w-20 text-center text-slate-700" value={shift.end_time} onChange={e => handleUpdateLocalShift(shift.id, 'end_time', e.target.value + ':00')} />
                                     </div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <input type="number" step="0.1" className="w-16 border border-slate-200 rounded-lg text-center p-2 font-bold text-brand-700 bg-white shadow-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all" value={shift.coefficient} onChange={e => handleUpdateLocalShift(shift.id, 'coefficient', Number(e.target.value))} />
                                 </td>
                                 <td className="p-4 text-center">
                                     <input type="number" className="w-16 border border-slate-200 rounded-lg text-center p-2 font-bold text-slate-700 bg-white shadow-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-400 outline-none transition-all" value={shift.grace_period_minutes} onChange={e => handleUpdateLocalShift(shift.id, 'grace_period_minutes', Number(e.target.value))} />
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             </div>
         </div>

           </>
         )}

         {activeTab === 'system' && (
           <>
               {/* SYSTEM CONFIG (AI KEY) */}
               <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col lg:col-span-3 hover:shadow-md transition-shadow">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                         <h3 className="font-bold text-slate-800 flex items-center gap-3">
                       <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><Cpu size={20}/></div>
                       Cấu hình AI (Gemini API)
                   </h3>
                   <p className="text-sm text-slate-500 mt-1 ml-11">Quản lý API Key cho tính năng AI và Chatbot thông minh.</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                    <Lock size={14} className="text-emerald-500"/> <span>Key mã hóa trong Database</span>
                </div>
             </div>
             
             <div className="bg-gradient-to-br from-slate-50 to-white p-5 rounded-lg border border-slate-100 shadow-inner">
                 <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 block">Cấp phép Gemini API Key</label>
                 <div className="flex flex-col sm:flex-row gap-3">
                     <input 
                        type="password" 
                        className="flex-1 w-full border-2 border-slate-200 rounded-lg p-3 text-sm font-mono tracking-widest text-slate-800 focus:border-purple-400 focus:ring-4 focus:ring-purple-100 outline-none transition-all shadow-sm"
                        placeholder="Nhập chuỗi khóa AIzaSy..."
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                     />
                     <button 
                        onClick={handleSaveGeminiKey}
                        disabled={isSavingKey}
                        className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold text-sm shadow-md shadow-purple-500/20 hover:bg-purple-700 hover:shadow-lg focus:ring-4 focus:ring-purple-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shrink-0 w-full sm:w-auto"
                     >
                         {isSavingKey ? <Loader2 className="animate-spin" size={18}/> : 'Cập nhật Key'}
                     </button>
                 </div>
                 <p className="text-[11px] text-slate-500 mt-3 flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500"/> Yêu cầu làm mới trang (F5) nếu các tính năng AI vẫn chưa hoạt động sau khi cập nhật.</p>
             </div>
         </div>

         {/* SYSTEM CONFIG (UI ZOOM) */}
         <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col lg:col-span-3 hover:shadow-md transition-shadow mt-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                 <div>
                     <h3 className="font-bold text-slate-800 flex items-center gap-3">
                         <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Globe size={20}/></div>
                         Tỷ lệ hiển thị hệ thống (UI Zoom)
                     </h3>
                     <p className="text-sm text-slate-500 mt-1 ml-11">Thu nhỏ giao diện để hiển thị được nhiều thông tin hơn (Chỉ áp dụng trên máy tính).</p>
                 </div>
             </div>
             <div className="flex flex-wrap gap-3">
                 {['80%', '90%', '100%', '110%', '120%'].map((zoom) => (
                     <button
                         key={zoom}
                         onClick={(e) => {
                             e.preventDefault();
                             applyZoom(zoom);
                         }}
                         className={`px-5 py-2.5 rounded-lg font-bold transition-all border-2 ${uiZoom === zoom ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-slate-50'}`}
                     >
                         {zoom}
                     </button>
                 ))}
             </div>
         </div>

           </>
         )}

         {activeTab === 'inventory' && (
           <>
               {/* RECIPE CONFIG */}
               <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full lg:col-span-3 hover:shadow-md transition-shadow">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                         <h3 className="font-bold text-slate-800 flex items-center gap-3">
                       <div className="bg-red-100 p-2 rounded-lg text-red-600"><ChefHat size={20}/></div>
                       Định Mức & Công Thức Phòng (Room Recipes)
                   </h3>
                   <p className="text-sm text-slate-500 mt-1 ml-11">Thiết lập các món đồ (Amenity, Minibar, Linen) mặc định cho từng loại phòng.</p>
                </div>
                <button 
                    onClick={() => { setEditingRecipeKey(undefined); setEditingRecipeData(null); setRecipeModalOpen(true); }}
                    className="bg-red-50 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-red-200 hover:border-red-600 shadow-sm"
                >
                    <Plus size={16}/> Tạo Công Thức Mới
                </button>
             </div>

             {/* Room Type Statistics Summary */}
             <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100 animate-in fade-in shadow-inner">
                 <div className="flex items-center gap-2 pr-4 border-r-2 border-slate-200 py-1">
                     <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><BedDouble size={16} className="text-slate-500"/> Tổng:</span>
                     <span className="text-lg font-black text-slate-700">{rooms.length} phòng</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                     {Object.entries(roomTypeStats).sort((a,b) => Number(b[1]) - Number(a[1])).map(([type, count]) => (
                         <div key={type} className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-sm hover:border-brand-300 transition-colors cursor-default">
                             <span className="text-slate-500 font-medium">{type}:</span>
                             <span className="font-black text-brand-600">{count}</span>
                         </div>
                     ))}
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                 {Object.entries(roomRecipes).map(([key, rawRecipe]) => {
                     const recipe = rawRecipe as RoomRecipe;
                     const roomCount = roomTypeStats[key] || 0;
                     return (
                     <div key={key} className="bg-white rounded-lg border-2 border-slate-100 p-5 hover:border-red-300 transition-all hover:shadow-lg group relative overflow-hidden">
                         <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-red-50 to-transparent opacity-50 pointer-events-none"></div>
                         <div className="flex justify-between items-start mb-4 relative z-10">
                             <div>
                                 <div className="text-xl font-black text-slate-800 flex items-center gap-2 mb-1 tracking-tight">
                                     {key}
                                     {roomCount > 0 && <span className="bg-blue-100 text-blue-700 text-[10px] px-2.5 py-1 rounded-full font-black tracking-wider border border-blue-200 shadow-sm">{roomCount} phòng</span>}
                                 </div>
                                 <div className="text-sm text-slate-500 font-medium">{recipe.description}</div>
                             </div>
                             <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                    onClick={() => { setEditingRecipeKey(key); setEditingRecipeData(recipe); setRecipeModalOpen(true); }}
                                    className="p-2 bg-white border border-slate-200 text-blue-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors shadow-sm"
                                 >
                                     <Pencil size={14}/>
                                 </button>
                                 <button 
                                    onClick={() => { if(confirm(`Xóa định mức ${key}?`)) deleteRoomRecipe(key); }}
                                    className="p-2 bg-white border border-slate-200 text-rose-600 rounded-lg hover:border-rose-400 hover:bg-rose-50 transition-colors shadow-sm"
                                 >
                                     <Trash size={14}/>
                                 </button>
                             </div>
                         </div>
                         
                         {/* Item Summary */}
                         <div className="flex flex-wrap gap-2 relative z-10 pt-3 border-t border-slate-100">
                             {(recipe.items || []).slice(0, 6).map((item, idx) => (
                                 <span key={idx} className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md text-slate-600 font-medium flex gap-1.5 items-center">
                                     {item.itemId} <b className="text-brand-600 bg-brand-50 px-1 py-0.5 rounded">x{item.quantity}</b>
                                 </span>
                             ))}
                             {(recipe.items?.length ?? 0) > 6 && (
                                 <span className="text-xs bg-slate-200 px-2.5 py-1 rounded-md text-slate-600 font-black flex items-center">
                                     +{((recipe.items?.length ?? 0) - 6)}
                                 </span>
                             )}
                         </div>
                     </div>
                     );
                 })}
             </div>
         </div>

         {/* ... INVENTORY ANALYSIS ... */}
         <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col lg:col-span-3 hover:shadow-md transition-shadow">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                   <h3 className="font-bold text-slate-800 flex items-center gap-3">
                       <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><Calculator size={20}/></div>
                       Kiểm Tra Cân Đối Kho & Định Mức
                   </h3>
                   <p className="text-sm text-slate-500 mt-1 ml-11">So sánh tổng nhu cầu (dựa trên số lượng phòng và công thức) với tài sản thực tế.</p>
                </div>
                <button 
                    onClick={() => refreshData()}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold transition-all shadow-sm"
                >
                    <RotateCw size={16} className={isLoading ? 'animate-spin' : ''}/> Làm mới dữ liệu
                </button>
             </div>

             <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left text-sm border-collapse">
                     <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200">
                         <tr>
                             <th className="p-4 w-[30%]">Tên Vật Tư</th>
                             <th className="p-4 text-center">Phân loại</th>
                             <th className="p-4 text-center bg-blue-50/50 text-blue-700">Định Mức Tổng (Calculated)</th>
                             <th className="p-4 text-center bg-slate-100/50 text-slate-700">Tổng Tài Sản (Database)</th>
                             <th className="p-4 text-center w-[15%]">Trạng Thái</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                         {inventoryAnalysis.map((item) => (
                             <tr key={item.itemId} className="hover:bg-slate-50 transition-colors group">
                                 <td className="p-4">
                                     <div className="font-bold text-slate-800">{item.itemName}</div>
                                     <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.itemId}</div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-bold uppercase border border-slate-200">{item.category}</span>
                                 </td>
                                 <td className="p-4 text-center bg-blue-50/20">
                                     <div className="font-bold text-blue-700">{item.requiredStandard}</div>
                                     <div className="text-[9px] text-blue-400 font-medium">({item.unit})</div>
                                 </td>
                                 <td className="p-4 text-center bg-slate-50/30">
                                     <div className="font-bold text-slate-700">{item.currentTotalAssets}</div>
                                 </td>
                                 <td className="p-4 text-center">
                                     {item.status === 'Thieu' ? (
                                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-xs font-bold animate-pulse">
                                             <TrendingDown size={14}/> Thiếu {Math.abs(item.variance)}
                                         </div>
                                     ) : item.status === 'Du' ? (
                                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 text-xs font-bold">
                                             <TrendingUp size={14}/> Dư {item.variance}
                                         </div>
                                     ) : (
                                         <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-xs font-bold">
                                             <Equal size={14}/> Chuẩn
                                         </div>
                                     )}
                                 </td>
                             </tr>
                         ))}
                         {inventoryAnalysis.length === 0 && (
                             <tr>
                                 <td colSpan={5} className="p-8 text-center text-slate-400 italic text-xs">
                                     Chưa có dữ liệu phân tích. Hãy đảm bảo đã cấu hình Phòng và Định mức (Recipes).
                                 </td>
                             </tr>
                         )}
                     </tbody>
                 </table>
             </div>
         </div>

           </>
         )}

         {activeTab === 'system' && (
           <>
               {/* Webhooks Section */}
               <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full lg:col-span-3 hover:shadow-md transition-shadow">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                         <h3 className="font-bold text-slate-800 flex items-center gap-3">
                       <div className="bg-teal-100 p-2 rounded-lg text-teal-600"><Globe size={20}/></div>
                       Webhooks Integration
                   </h3>
                   <p className="text-sm text-slate-500 mt-1 ml-11">Kết nối n8n/Google Apps Script. <b>Lưu ý:</b> Cấu hình Node nhận là <b className="text-teal-600 bg-teal-50 px-1 rounded">POST</b>.</p>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
                 <div className="space-y-2">
                     {webhooks.map((wh, idx) => (
                        <div key={wh.id} className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-100 hover:border-brand-200 transition-colors gap-4">
                           <div className="flex-1 w-full">
                              <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${wh.is_active ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                  <div className="font-bold text-slate-700 font-mono text-sm break-all">{wh.url}</div>
                              </div>
                              <div className="text-xs text-slate-500 mt-1 flex gap-4">
                                  <span>Event: <b className="text-brand-600">{wh.event_type}</b></span>
                                  {wh.description && <span>Note: {wh.description}</span>}
                              </div>
                           </div>
                           <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                               <button 
                                  onClick={() => handleTestWebhook(wh)}
                                  className="px-3 py-1.5 text-xs rounded-lg font-bold border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                                  title="Gửi dữ liệu mẫu để kiểm tra"
                               >
                                   <Send size={12}/> Test Tín Hiệu
                               </button>
                               <button 
                                  onClick={() => updateWebhook({ ...wh, is_active: !wh.is_active })}
                                  className={`px-3 py-1.5 text-xs rounded font-bold border min-w-[70px] ${wh.is_active ? 'border-green-200 text-green-700 bg-green-50' : 'border-slate-200 text-slate-500 bg-white'}`}
                               >
                                   {wh.is_active ? 'Active' : 'Stopped'}
                               </button>
                               <button onClick={() => { if(confirm('Xóa Webhook này?')) deleteWebhook(wh.id); }} className="text-slate-400 hover:text-red-500 transition-colors p-2 bg-white border border-slate-200 rounded"><Trash size={16}/></button>
                           </div>
                        </div>
                     ))}
                 </div>
                 
                 {isAddingWebhook ? (
                    <div className="mt-4 p-4 bg-brand-50 rounded-lg border border-brand-100 animate-in fade-in">
                       <h4 className="font-bold text-xs text-brand-700 uppercase mb-2">Thêm Webhook mới</h4>
                       <div className="flex gap-2 mb-2 flex-wrap">
                          <input className="flex-[3] min-w-[200px] border rounded p-2 text-sm bg-white text-slate-900" placeholder="https://script.google.com/..." value={newWebhook.url} onChange={e => setNewWebhook({...newWebhook, url: e.target.value})} />
                          <select className="flex-1 min-w-[120px] border rounded p-2 text-sm bg-white text-slate-900 font-bold" value={newWebhook.event_type} onChange={e => setNewWebhook({...newWebhook, event_type: e.target.value as any})}>
                             <option value="ota_import">Đồng bộ Booking OTA (Google Sheet)</option>
                             <option value="residence_declaration">Khai báo lưu trú (Google Sheet)</option>
                             <option value="checkout">Checkout</option>
                             <option value="housekeeping_assign">Housekeeping Assign</option>
                             <option value="leave_update">Cập nhật nghỉ phép (Zalo)</option>
                             <option value="general_notification">Thông báo chung (Master)</option>
                          </select>
                          <input className="flex-[2] min-w-[150px] border rounded p-2 text-sm bg-white text-slate-900" placeholder="Mô tả (GG Sheet, Zalo...)" value={newWebhook.description} onChange={e => setNewWebhook({...newWebhook, description: e.target.value})} />
                       </div>
                       <div className="flex justify-end gap-2">
                          <button onClick={() => setIsAddingWebhook(false)} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-sm">Hủy</button>
                          <button onClick={handleAddWebhook} className="px-3 py-1 bg-brand-600 text-white rounded text-sm font-medium">Lưu</button>
                       </div>
                    </div>
                 ) : (
                    <button onClick={() => setIsAddingWebhook(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 mt-4 font-medium">
                       <Plus size={18} /> Thêm Webhook
                    </button>
                 )}
             </div>
         </div>

           </>
         )}

         {activeTab === 'inventory' && (
           <>
               {/* Service Menu Section */}
               <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full lg:col-span-3 hover:shadow-md transition-shadow">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                      <div>
                          <h3 className="font-bold text-slate-800 flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><ShoppingCart size={20}/></div>
                        Menu Dịch Vụ / Minibar
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 ml-11">Quản lý danh sách các dịch vụ cung cấp cho khách.</p>
                </div>
                <button 
                    onClick={handleResetMenu}
                    className="text-sm flex items-center gap-2 text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg transition-all font-bold shadow-sm"
                    title="Khôi phục danh sách mẫu nếu dữ liệu trống"
                >
                    <Database size={16}/> Nạp dữ liệu mẫu
                </button>
             </div>
             
             {(!services || services.length === 0) && (
                 <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-4 rounded-lg mb-4 text-sm flex items-center gap-3">
                     <Database className="shrink-0"/>
                     <div>
                         <b>Chưa có dữ liệu menu!</b>
                         <p>Nếu bạn chưa tạo bảng `service_items` trên Supabase, hãy chạy lệnh SQL. Sau đó bấm "Nạp dữ liệu mẫu".</p>
                     </div>
                 </div>
             )}

             <div className="flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {services.map((s, idx) => (
                        <div key={s.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100 hover:border-brand-200 transition-colors">
                           <div>
                              <div className="font-bold text-slate-700">{s.name}</div>
                              <div className="text-xs text-slate-500">{s.price.toLocaleString()} đ / {s.unit} - {s.category}</div>
                           </div>
                           <button onClick={() => { if(confirm('Xóa dịch vụ này?')) deleteService(s.id); }} className="text-slate-300 hover:text-red-500 transition-colors"><Trash size={16}/></button>
                        </div>
                     ))}
                 </div>
                 
                 {isAddingService ? (
                    <div className="mt-4 p-4 bg-brand-50 rounded-lg border border-brand-100 animate-in fade-in">
                       <h4 className="font-bold text-xs text-brand-700 uppercase mb-2">Thêm món mới</h4>
                       <div className="flex gap-2 mb-2 flex-wrap">
                          <input className="flex-[2] min-w-[150px] border rounded p-2 text-sm bg-white text-slate-900" placeholder="Tên món (vd: Nước suối)" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} />
                          
                          <select className="flex-1 min-w-[100px] border rounded p-2 text-sm bg-white text-slate-900" value={newService.category} onChange={e => setNewService({...newService, category: e.target.value as ItemCategory})}>
                             <option value="Minibar">Minibar</option>
                             <option value="Amenity">Amenity</option>
                             <option value="Linen">Linen</option>
                             <option value="Voucher">Voucher</option>
                             <option value="Service">Service</option>
                          </select>

                          <input className="flex-1 min-w-[80px] border rounded p-2 text-sm bg-white text-slate-900" placeholder="ĐVT (Lon)" value={newService.unit} onChange={e => setNewService({...newService, unit: e.target.value})} />
                          <input type="number" className="flex-1 min-w-[100px] border rounded p-2 text-sm bg-white text-slate-900" placeholder="Giá bán" value={newService.price} onChange={e => setNewService({...newService, price: Number(e.target.value)})} />
                       </div>
                       <div className="flex justify-end gap-2">
                          <button onClick={() => setIsAddingService(false)} className="px-3 py-1 text-slate-500 hover:bg-slate-200 rounded text-sm">Hủy</button>
                          <button onClick={handleAddService} className="px-3 py-1 bg-brand-600 text-white rounded text-sm font-medium">Thêm</button>
                       </div>
                    </div>
                 ) : (
                    <button onClick={() => setIsAddingService(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 mt-4 font-medium">
                       <Plus size={18} /> Thêm dịch vụ
                    </button>
                 )}
             </div>
         </div>

           </>
         )}

         {activeTab === 'general' && (
           <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-3 animate-in fade-in">
                   <Section title="Nguồn Khách" dataKey="sources" icon={Globe} />
             <Section title="Hình Thức Thuê" dataKey="room_methods" icon={Clock} />
             <Section title="Danh Mục Chi Phí" dataKey="expense_categories" icon={CreditCard} />
             <Section title="Trạng Thái Phòng" dataKey="room_status" icon={TrendingUp} />
          </div>
               <div className="lg:col-span-3 flex justify-end mt-2">
                   <button onClick={handleSave} className="bg-brand-600 text-white px-8 py-3 rounded-lg flex items-center gap-2 font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95 group">
                       <Save size={20} className="group-hover:scale-110 transition-transform" /> Lưu thay đổi
                   </button>
               </div>
           </>
         )}
      </div>

      <RecipeModal 
          isOpen={isRecipeModalOpen} 
          onClose={() => setRecipeModalOpen(false)}
          recipeKey={editingRecipeKey}
          existingRecipe={editingRecipeData}
      />

      {/* BANK ACCOUNT MODAL */}
      <Modal isOpen={isBankModalOpen} onClose={() => setBankModalOpen(false)} title={editingBank ? "Sửa Tài Khoản" : "Thêm Tài Khoản Mới"} size="md">
          <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã Ngân Hàng</label>
                      <input 
                          className="w-full border rounded p-2.5 text-sm bg-slate-50 uppercase font-bold"
                          placeholder="MB, VCB..."
                          value={bankForm.bankId}
                          onChange={e => setBankForm({...bankForm, bankId: e.target.value.toUpperCase()})}
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Số Tài Khoản</label>
                      <input 
                          className="w-full border rounded p-2.5 text-sm bg-white font-mono font-bold"
                          placeholder="0123456789"
                          value={bankForm.accountNo}
                          onChange={e => setBankForm({...bankForm, accountNo: e.target.value})}
                      />
                  </div>
              </div>
              
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tên Chủ Tài Khoản</label>
                  <input 
                      className="w-full border rounded p-2.5 text-sm bg-white uppercase font-bold"
                      placeholder="NGUYEN VAN A"
                      value={bankForm.accountName}
                      onChange={e => setBankForm({...bankForm, accountName: e.target.value.toUpperCase()})}
                  />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mẫu VietQR</label>
                      <select 
                          className="w-full border rounded p-2.5 text-sm bg-white"
                          value={bankForm.template}
                          onChange={e => setBankForm({...bankForm, template: e.target.value as any})}
                      >
                          <option value="print">Print (In)</option>
                          <option value="compact">Compact</option>
                          <option value="qr_only">QR Only</option>
                      </select>
                  </div>
                  <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-gray-300"
                              checked={bankForm.is_default}
                              onChange={e => setBankForm({...bankForm, is_default: e.target.checked})}
                          />
                          <span className="text-sm font-bold text-slate-700">Đặt làm mặc định</span>
                      </label>
                  </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button onClick={() => setBankModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold text-sm">Hủy</button>
                  <button onClick={handleSaveBank} className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-brand-700">Lưu Tài Khoản</button>
              </div>
          </div>
      </Modal>
    </div>
  );
};
