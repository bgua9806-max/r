
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Trash, Save, Check, X, ShoppingCart, Database, Globe, Send, AlertTriangle, Cpu, Lock, ChefHat, Pencil, CreditCard, QrCode, Building, CheckCircle2 } from 'lucide-react';
import { Settings as SettingsType, ServiceItem, ItemCategory, WebhookConfig, RoomRecipe, BankAccount } from '../types';
import { MOCK_SERVICES } from '../constants';
import { storageService } from '../services/storage';
import { RecipeModal } from '../components/RecipeModal';
import { Modal } from '../components/Modal';

export const Settings: React.FC = () => {
  const { 
      settings, updateSettings, services, addService, deleteService, notify, refreshData, 
      webhooks, addWebhook, deleteWebhook, updateWebhook, triggerWebhook, 
      getGeminiApiKey, setAppConfig, roomRecipes, deleteRoomRecipe,
      bankAccounts, addBankAccount, updateBankAccount, deleteBankAccount
  } = useAppContext();
  
  const [localSettings, setLocalSettings] = useState(settings);
  
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

  useEffect(() => {
      // Load current key on mount (masked for security if needed, but here simple retrieval)
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

  // --- BANK ACCOUNT LOGIC ---
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
          source: "Hotel Manager Pro",
          ho_va_ten: "NGUYEN VAN TEST",
          so_giay_to: "0123456789",
          thoi_gian_tu: new Date().toISOString(),
          data: {
              room: "P101 (Test Room)",
              facility: "Chi nhánh Trung Tâm (Demo)",
              customer: "Nguyễn Văn Test",
              timestamp: new Date().toISOString()
          }
      };

      // TÙY CHỈNH PAYLOAD CHO GOOGLE APPS SCRIPT (OTA)
      if (wh.event_type === 'ota_import') {
          mockPayload = {
              action: 'update_room',
              bookingCode: 'TEST-CONNECT-01',
              room: 'ADMIN_TEST',
              status: 'Connection Verified'
          };
      }
      
      // TÙY CHỈNH CHO GENERAL NOTIFICATION
      if (wh.event_type === 'general_notification') {
          mockPayload = {
              type: 'TEST_SIGNAL',
              message: 'Kiểm tra kết nối hệ thống thông báo chung.',
              timestamp: new Date().toISOString()
          };
      }
      
      triggerWebhook(wh.event_type, mockPayload);
      notify('info', `Đã gửi tín hiệu test đến ${wh.event_type}`);
  };

  const handleResetMenu = async () => {
     if(confirm('CẢNH BÁO: Hành động này sẽ GHI ĐÈ toàn bộ dịch vụ hiện có bằng danh sách Mẫu vào bảng "service_items" trên Supabase. Bạn có chắc chắn không?')) {
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

  const Section = ({ title, dataKey }: { title: string, dataKey: keyof SettingsType }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full">
       <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">{title}</h3>
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
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Cài Đặt Hệ Thống</h1>
           <p className="text-gray-500 text-sm">Quản lý các danh mục dữ liệu dùng chung</p>
        </div>
        <button onClick={handleSave} className="bg-brand-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-brand-700 shadow-md transition-transform active:scale-95">
           <Save size={20} /> Lưu thay đổi
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         
         {/* BANK CONFIGURATION (MULTIPLE ACCOUNTS) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:col-span-3">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h3 className="font-bold text-gray-800 flex items-center gap-2"><CreditCard size={20}/> Danh sách Tài khoản Ngân hàng (VietQR)</h3>
                   <p className="text-xs text-slate-500 mt-1">Quản lý các tài khoản nhận tiền chuyển khoản.</p>
                </div>
                <button 
                    onClick={() => handleOpenBankModal()} 
                    className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 text-sm font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                    <Plus size={16}/> Thêm tài khoản
                </button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {bankAccounts.map(bank => (
                     <div key={bank.id} className={`p-4 rounded-xl border-2 transition-all hover:shadow-md relative group ${bank.is_default ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-100 hover:border-brand-200'}`}>
                         <div className="flex justify-between items-start mb-2">
                             <div className="flex items-center gap-2">
                                 <Building size={20} className="text-slate-400"/>
                                 <span className="font-black text-lg text-slate-800">{bank.bankId}</span>
                             </div>
                             {bank.is_default && (
                                 <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-brand-200">
                                     <CheckCircle2 size={10}/> Mặc định
                                 </span>
                             )}
                         </div>
                         <div className="font-mono font-bold text-slate-700 text-lg tracking-wide mb-1">{bank.accountNo}</div>
                         <div className="text-xs font-bold text-slate-500 uppercase">{bank.accountName}</div>
                         
                         <div className="mt-4 pt-3 border-t border-slate-200/50 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                             {!bank.is_default && (
                                 <button onClick={() => handleSetDefaultBank(bank)} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors">
                                     Đặt mặc định
                                 </button>
                             )}
                             <button onClick={() => handleOpenBankModal(bank)} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"><Pencil size={14}/></button>
                             <button onClick={() => { if(confirm('Xóa tài khoản này?')) deleteBankAccount(bank.id); }} className="p-1.5 text-red-600 bg-red-50 rounded hover:bg-red-100"><Trash size={14}/></button>
                         </div>
                     </div>
                 ))}
                 {bankAccounts.length === 0 && (
                     <div className="col-span-full py-8 text-center text-slate-400 italic text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
                         Chưa có tài khoản nào. Hãy thêm mới để tạo mã QR.
                     </div>
                 )}
             </div>
         </div>

         {/* SYSTEM CONFIG (AI KEY) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:col-span-3">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h3 className="font-bold text-gray-800 flex items-center gap-2"><Cpu size={20}/> Cấu hình AI (Gemini API)</h3>
                   <p className="text-xs text-slate-500 mt-1">Quản lý API Key cho tính năng OCR và Chatbot.</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 text-xs text-blue-800">
                    <Lock size={14}/> <span>Key được lưu trong Database (Secure)</span>
                </div>
             </div>
             
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                 <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Gemini API Key</label>
                 <div className="flex gap-2">
                     <input 
                        type="password" 
                        className="flex-1 border-2 border-slate-200 rounded-lg p-2.5 text-sm font-mono text-slate-800 focus:border-brand-500 outline-none"
                        placeholder="AIzaSy..."
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                     />
                     <button 
                        onClick={handleSaveGeminiKey}
                        disabled={isSavingKey}
                        className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md hover:bg-brand-700 flex items-center gap-2"
                     >
                         {isSavingKey ? 'Đang lưu...' : 'Cập nhật Key'}
                     </button>
                 </div>
                 <p className="text-[10px] text-slate-400 mt-2 italic">Key này sẽ được ưu tiên sử dụng thay cho biến môi trường (Environment Variable).</p>
             </div>
         </div>

         {/* RECIPE CONFIG */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full lg:col-span-3">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h3 className="font-bold text-gray-800 flex items-center gap-2"><ChefHat size={20}/> Định Mức & Công Thức Phòng (Room Recipes)</h3>
                   <p className="text-xs text-slate-500 mt-1">Thiết lập các món đồ (Amenity, Minibar, Linen) mặc định cho từng loại phòng.</p>
                </div>
                <button 
                    onClick={() => { setEditingRecipeKey(undefined); setEditingRecipeData(null); setRecipeModalOpen(true); }}
                    className="bg-brand-50 text-brand-700 hover:bg-brand-100 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border border-brand-200"
                >
                    <Plus size={16}/> Tạo Công Thức Mới
                </button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {Object.entries(roomRecipes).map(([key, rawRecipe]) => {
                     const recipe = rawRecipe as RoomRecipe;
                     return (
                     <div key={key} className="bg-slate-50 rounded-xl border border-slate-200 p-4 hover:border-brand-300 transition-all hover:shadow-md group">
                         <div className="flex justify-between items-start mb-3">
                             <div>
                                 <div className="text-lg font-black text-slate-800">{key}</div>
                                 <div className="text-xs text-slate-500 font-medium">{recipe.description}</div>
                             </div>
                             <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button 
                                    onClick={() => { setEditingRecipeKey(key); setEditingRecipeData(recipe); setRecipeModalOpen(true); }}
                                    className="p-1.5 bg-white border border-slate-200 text-blue-600 rounded-lg hover:border-blue-300"
                                 >
                                     <Pencil size={14}/>
                                 </button>
                                 <button 
                                    onClick={() => { if(confirm(`Xóa định mức ${key}?`)) deleteRoomRecipe(key); }}
                                    className="p-1.5 bg-white border border-slate-200 text-rose-600 rounded-lg hover:border-rose-300"
                                 >
                                     <Trash size={14}/>
                                 </button>
                             </div>
                         </div>
                         
                         {/* Item Summary */}
                         <div className="flex flex-wrap gap-1.5">
                             {recipe.items.slice(0, 5).map((item, idx) => (
                                 <span key={idx} className="text-[10px] bg-white border border-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                                     {item.itemId} <b className="text-brand-600">x{item.quantity}</b>
                                 </span>
                             ))}
                             {recipe.items.length > 5 && (
                                 <span className="text-[10px] bg-slate-200 px-2 py-1 rounded text-slate-500 font-bold">
                                     +{recipe.items.length - 5}
                                 </span>
                             )}
                         </div>
                     </div>
                     );
                 })}
             </div>
         </div>

         {/* Webhooks Section */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full lg:col-span-3">
             <div className="flex justify-between items-center mb-4">
                <div>
                   <h3 className="font-bold text-gray-800 flex items-center gap-2"><Globe size={20}/> Webhooks Integration</h3>
                   <p className="text-xs text-slate-500 mt-1">Kết nối n8n/Google Apps Script. <b>Lưu ý:</b> Cấu hình Node nhận là <b>POST</b>.</p>
                </div>
                <div className="flex items-center gap-2 bg-yellow-50 px-3 py-2 rounded-lg border border-yellow-200 text-xs text-yellow-800">
                    <AlertTriangle size={14}/> <span>Nếu n8n lỗi, hãy kiểm tra Method = POST</span>
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
                    <div className="mt-4 p-4 bg-brand-50 rounded-xl border border-brand-100 animate-in fade-in">
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
                    <button onClick={() => setIsAddingWebhook(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 mt-4 font-medium">
                       <Plus size={18} /> Thêm Webhook
                    </button>
                 )}
             </div>
         </div>

         {/* Service Menu Section */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col h-full lg:col-span-2">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShoppingCart size={20}/> Menu Dịch Vụ / Minibar</h3>
                <button 
                    onClick={handleResetMenu}
                    className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium"
                    title="Khôi phục danh sách mẫu nếu dữ liệu trống"
                >
                    <Database size={14}/> Nạp dữ liệu mẫu
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
                    <div className="mt-4 p-4 bg-brand-50 rounded-xl border border-brand-100 animate-in fade-in">
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
                    <button onClick={() => setIsAddingService(true)} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all flex items-center justify-center gap-2 mt-4 font-medium">
                       <Plus size={18} /> Thêm dịch vụ
                    </button>
                 )}
             </div>
         </div>

         <Section title="Nguồn Khách" dataKey="sources" />
         <Section title="Hình Thức Thuê" dataKey="room_methods" />
         <Section title="Danh Mục Chi Phí" dataKey="expense_categories" />
         <Section title="Trạng Thái Phòng" dataKey="room_status" />
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
