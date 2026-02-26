
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  Package, Plus, AlertTriangle, Search, Repeat, ArrowRight, 
  Pencil, Save, DollarSign, Shirt, Ticket, X, RefreshCw, CheckCircle2, Minus, ArrowDownCircle, ArrowUpCircle, History, Info, LayoutGrid, Trash2, Camera, User, ExternalLink, Image as ImageIcon, Eye, HelpCircle, AlertOctagon,
  MoreVertical, Loader2, LayoutDashboard, TrendingUp, PieChart, Droplets, Calendar, DoorOpen, ListPlus, ScrollText, Tv,
  List, Share
} from 'lucide-react';
import { ServiceItem, Expense, ItemCategory, InventoryTransaction } from '../types';
import { Modal } from '../components/Modal';
import { BulkImportModal } from '../components/BulkImportModal';
import { LaundryTicketModal } from '../components/LaundryTicketModal';
import { LinenManager } from '../components/LinenManager';
import { DistributeModal } from '../components/DistributeModal';
import { format, parseISO } from 'date-fns';
import { useStandardInventory } from '../hooks/useStandardInventory';

export const Inventory: React.FC = () => {
  const { 
    services, updateService, addService, deleteService, addExpense, 
    facilities, notify, bookings, refreshData, isLoading, 
    inventoryTransactions, addInventoryTransaction, currentUser, rooms
  } = useAppContext();

  // Use the hook to get calculated stats
  const inventoryStats = useStandardInventory();
  
  // Create a lookup map for fast access in the table loop
  const statsMap = useMemo(() => {
      const map = new Map<string, typeof inventoryStats[0]>();
      inventoryStats.forEach(item => map.set(item.itemId, item));
      return map;
  }, [inventoryStats]);

  const isReadOnly = currentUser?.role === 'Buồng phòng';

  const [activeTab, setActiveTab] = useState<'Overview' | 'Consumable' | 'Linen' | 'Asset' | 'Service' | 'History'>('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  
  // History Filters
  const [historyDate, setHistoryDate] = useState('');
  const [historyRoom, setHistoryRoom] = useState('');

  // Modal States
  const [isTransModalOpen, setTransModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'Purchase' | 'SendLaundry' | 'ReceiveLaundry' | 'Liquidate'>('Purchase');
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Transaction Form States
  const [actionQty, setActionQty] = useState(0);
  const [actionPrice, setActionPrice] = useState(0);
  const [damageQty, setDamageQty] = useState(0); 
  const [selectedFacility, setSelectedFacility] = useState(facilities[0]?.facilityName || '');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [transNote, setTransNote] = useState('');

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isLaundryModalOpen, setLaundryModalOpen] = useState(false);
  
  // Distribute Modal State
  const [isDistributeModalOpen, setDistributeModalOpen] = useState(false);
  const [distributeItem, setDistributeItem] = useState<ServiceItem | null>(null);

  const [editForm, setEditForm] = useState<Partial<ServiceItem>>({});
  const [newServiceForm, setNewServiceForm] = useState<Partial<ServiceItem>>({
      name: '',
      price: 0,
      costPrice: 0,
      unit: 'Cái',
      stock: 0,
      minStock: 5,
      category: 'Minibar',
      laundryStock: 0,
      vendor_stock: 0,
      in_circulation: 0,
      totalassets: 0,
      default_qty: 0
  });

  // 1. Phân loại và lọc dữ liệu
  const filteredItems = useMemo(() => {
    return (services || []).filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesCategory = false;
      if (activeTab === 'Consumable') {
        matchesCategory = item.category === 'Minibar' || item.category === 'Amenity';
      } else if (activeTab === 'Asset') {
        matchesCategory = item.category === 'Asset';
      } else if (activeTab === 'Service') {
        matchesCategory = item.category === 'Service' || item.category === 'Voucher';
      } else {
        return true; 
      }

      return matchesSearch && matchesCategory;
    });
  }, [services, searchTerm, activeTab]);

  const filteredHistory = useMemo(() => {
    return (inventoryTransactions || []).filter(t => {
      const matchSearch = t.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.note || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = historyDate ? t.created_at.startsWith(historyDate) : true;
      const matchRoom = historyRoom ? (t.note || '').toLowerCase().includes(historyRoom.toLowerCase()) : true;
      return matchSearch && matchDate && matchRoom;
    });
  }, [inventoryTransactions, searchTerm, historyDate, historyRoom]);

  // Stats Logic
  const stats = useMemo(() => {
      const totalInventoryValue = services.reduce((sum, s) => {
          // Calculate using dynamic logic
          const calculatedInRoom = statsMap.get(s.id)?.requiredStandard || 0;
          const totalQty = (Number(s.stock) || 0) + calculatedInRoom + (Number(s.laundryStock) || 0) + (Number(s.vendor_stock) || 0);
          
          return sum + (totalQty * (Number(s.costPrice) || 0));
      }, 0);
      
      const lowStockList = services.filter(s => (s.stock || 0) <= (s.minStock || 0) && s.category !== 'Service');
      const outOfStockList = services.filter(s => (s.stock || 0) === 0 && s.category !== 'Service');

      const categoryValue: Record<string, number> = {};
      services.forEach(s => {
          if(s.category === 'Service') return;
          const calculatedInRoom = statsMap.get(s.id)?.requiredStandard || 0;
          const totalQty = (Number(s.stock) || 0) + calculatedInRoom + (Number(s.laundryStock) || 0) + (Number(s.vendor_stock) || 0);
          const val = totalQty * (Number(s.costPrice) || 0);
          categoryValue[s.category] = (categoryValue[s.category] || 0) + val;
      });

      // Linen Cycle Stats
      const linenItems = services.filter(s => s.category === 'Linen');
      const totalLinenClean = linenItems.reduce((sum, s) => sum + (Number(s.stock) || 0), 0);
      const totalLinenDirty = linenItems.reduce((sum, s) => sum + (Number(s.laundryStock) || 0), 0);
      const totalLinenVendor = linenItems.reduce((sum, s) => sum + (Number(s.vendor_stock) || 0), 0);
      const totalLinenInUse = linenItems.reduce((sum, s) => sum + (statsMap.get(s.id)?.requiredStandard || 0), 0); // Use calculated
      const totalLinenAssets = totalLinenClean + totalLinenDirty + totalLinenInUse + totalLinenVendor;

      return { 
          totalInventoryValue, 
          lowStockList, 
          outOfStockList, 
          categoryValue,
          linenStats: { clean: totalLinenClean, dirty: totalLinenDirty, vendor: totalLinenVendor, inUse: totalLinenInUse, total: totalLinenAssets }
      };
  }, [services, statsMap]);

  const openTransaction = (item: ServiceItem, mode: 'Purchase' | 'SendLaundry' | 'ReceiveLaundry' | 'Liquidate') => {
    setSelectedItem(item);
    setActionQty(mode === 'Purchase' ? 10 : 1);
    setDamageQty(0);
    setActionPrice(item.costPrice || 0);
    setEvidenceUrl('');
    setTransNote('');
    setModalMode(mode);
    setTransModalOpen(true);
  };

  const handleOpenDistribute = (item: ServiceItem) => {
      setDistributeItem(item);
      setDistributeModalOpen(true);
  };

  const handleDeleteItem = async (id: string, name: string) => {
      if(confirm(`CẢNH BÁO: Bạn có chắc muốn xóa vĩnh viễn "${name}" khỏi hệ thống?`)) {
          await deleteService(id);
          notify('success', `Đã xóa ${name}`);
      }
  };

  const handleTransactionSubmit = async () => {
    if (!selectedItem || actionQty <= 0) return;
    if (isSubmitting) return;

    if (!currentUser) {
        notify('error', 'Vui lòng đăng nhập để thực hiện giao dịch');
        return;
    }

    setIsSubmitting(true);
    try {
        let newItem = { ...selectedItem };
        let transType: InventoryTransaction['type'] = 'ADJUST';
        let expense: Expense | null = null;

        if (modalMode === 'Purchase') {
            transType = 'IN';
            newItem.stock = (Number(newItem.stock) || 0) + actionQty;
            
            // Just update totalassets for record, though display uses calculated sum
            newItem.totalassets = (Number(newItem.totalassets) || 0) + actionQty;
            newItem.costPrice = actionPrice;
            
            const totalCost = actionQty * actionPrice;
            if (totalCost > 0) {
                expense = {
                    id: `IMP${Date.now()}`,
                    expenseDate: new Date().toISOString().substring(0, 10),
                    facilityName: selectedFacility,
                    expenseCategory: 'Nhập hàng',
                    expenseContent: `Nhập kho ${actionQty} ${newItem.unit} ${newItem.name}`,
                    amount: totalCost,
                    note: `Bằng chứng: ${evidenceUrl || 'Không có link'}. Ghi chú: ${transNote}`
                };
            }
        } 
        else if (modalMode === 'Liquidate') {
            transType = 'OUT';
            if((Number(newItem.stock) || 0) < actionQty) {
                notify('error', 'Không đủ tồn kho để hủy');
                setIsSubmitting(false);
                return;
            }
            newItem.stock = (Number(newItem.stock) || 0) - actionQty;
            newItem.totalassets = (Number(newItem.totalassets) || 0) - actionQty;
        }

        const transaction: InventoryTransaction = {
            id: `TR-${Date.now()}`,
            created_at: new Date().toISOString(),
            staff_id: currentUser.id,
            staff_name: currentUser.collaboratorName,
            item_id: newItem.id,
            item_name: newItem.name,
            type: transType,
            quantity: actionQty,
            price: actionPrice,
            total: actionQty * actionPrice,
            evidence_url: evidenceUrl,
            note: transNote + (damageQty > 0 ? ` (Hỏng/Mất: ${damageQty})` : ''),
            facility_name: selectedFacility
        };

        await updateService(newItem);
        await addInventoryTransaction(transaction);
        if (expense) await addExpense(expense);

        setTransModalOpen(false);
        notify('success', 'Đã lưu giao dịch và cập nhật Tổng Kho.');
    } catch(err) {
        notify('error', 'Lỗi khi lưu giao dịch.');
    } finally {
        setIsSubmitting(false);
    }
  };

  // ... Handlers for Edit/Add ...
  const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (editForm.id && editForm.name) {
          setIsSubmitting(true);
          try {
             // ... logic same as before ...
             const formAny = editForm as any;
             const safeStock = formAny.stock !== undefined ? Number(formAny.stock) : Number(formAny.Stock ?? 0);

             const payload: ServiceItem = {
                 ...editForm as ServiceItem,
                 stock: safeStock,
                 minStock: Number(editForm.minStock ?? 0),
                 totalassets: Number(editForm.totalassets ?? 0),
             };
             
             await updateService(payload);
             setEditModalOpen(false);
             notify('success', 'Đã lưu thay đổi.');
          } catch(e) {
             notify('error', 'Lỗi khi lưu thay đổi.');
          } finally {
             setIsSubmitting(false);
          }
      }
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newServiceForm.name) {
          setIsSubmitting(true);
          try {
              const item: ServiceItem = {
                  ...(newServiceForm as ServiceItem),
                  id: `S${Date.now()}`,
                  totalassets: newServiceForm.stock || 0,
                  in_circulation: 0, 
              };
              await addService(item);
              setAddModalOpen(false);
              setNewServiceForm({
                  name: '',
                  price: 0,
                  costPrice: 0,
                  unit: 'Cái',
                  stock: 0,
                  minStock: 5,
                  category: 'Minibar',
                  laundryStock: 0,
                  vendor_stock: 0,
                  in_circulation: 0,
                  totalassets: 0,
                  default_qty: 0
              });
              notify('success', 'Đã thêm vật tư mới.');
          } finally {
              setIsSubmitting(false);
          }
      }
  };

  const getTransBadge = (type: InventoryTransaction['type']) => {
      switch(type) {
          case 'IN': return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-black border border-emerald-200 uppercase tracking-tighter">NHẬP KHO</span>;
          case 'OUT': return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-black border border-rose-200 uppercase tracking-tighter">XUẤT / HỦY</span>;
          case 'ADJUST': return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-black border border-orange-200 uppercase tracking-tighter">ĐIỀU CHỈNH</span>;
          default: return <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-black border border-slate-200 uppercase tracking-tighter">{type}</span>;
      }
  };

  const renderOverview = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          {/* ... Overview Cards same as before ... */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-4 opacity-10"><DollarSign size={80}/></div>
                  <div className="relative z-10">
                      <div className="flex items-center gap-2 text-emerald-100 mb-2 font-bold text-xs uppercase tracking-widest"><TrendingUp size={16}/> Tổng giá trị tài sản</div>
                      <div className="text-3xl font-black">{stats.totalInventoryValue.toLocaleString()} ₫</div>
                      <p className="text-xs text-emerald-100 mt-2 opacity-80">Tổng giá vốn (Kho sạch + Đang dùng + Đang giặt).</p>
                  </div>
              </div>
              <div className="hidden md:flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Cảnh báo nhập hàng</div>
                          <div className="text-3xl font-black text-rose-600">{stats.lowStockList.length}</div>
                      </div>
                      <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertTriangle size={24}/></div>
                  </div>
                  <div className="mt-4">
                      <div className="text-xs text-slate-500 font-medium">Trong đó có <b className="text-rose-600">{stats.outOfStockList.length}</b> mặt hàng đã hết sạch (Stock = 0).</div>
                  </div>
              </div>
              <div className="hidden md:flex bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-col justify-between">
                  <div className="flex justify-between items-start">
                      <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Chu trình đồ vải (Linen)</div>
                          <div className="text-3xl font-black text-blue-600">{((Number(stats.linenStats.clean) / (Number(stats.linenStats.total) || 1)) * 100).toFixed(0)}% <span className="text-sm text-slate-400 font-bold">Sạch</span></div>
                      </div>
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Shirt size={24}/></div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full mt-4 overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${(Number(stats.linenStats.clean) / (Number(stats.linenStats.total) || 1)) * 100}%` }}></div>
                      <div className="h-full bg-blue-500" style={{ width: `${(Number(stats.linenStats.inUse) / (Number(stats.linenStats.total) || 1)) * 100}%` }}></div>
                      <div className="h-full bg-rose-500" style={{ width: `${(Number(stats.linenStats.dirty) / (Number(stats.linenStats.total) || 1)) * 100}%` }}></div>
                  </div>
              </div>
          </div>
          {/* ... Lower section same ... */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col md:h-[400px]">
                  <div className="p-5 border-b border-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2"><AlertOctagon size={18} className="text-rose-500"/> Cần nhập hàng gấp</h3>
                      <button onClick={() => { setActiveTab('Consumable'); setSearchTerm(''); }} className="text-xs font-bold text-brand-600 hover:underline">Xem tất cả kho</button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {stats.lowStockList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10">
                                <CheckCircle2 size={40} className="mb-2 opacity-50"/>
                                <span className="text-sm font-medium">Kho hàng ổn định</span>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <thead className="text-slate-400 font-bold uppercase tracking-wider bg-slate-50 sticky top-0">
                                    <tr>
                                        <th className="p-3">Tên hàng</th>
                                        <th className="p-3 text-center">Tồn kho</th>
                                        <th className="p-3 text-center">Tối thiểu</th>
                                        <th className="p-3 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stats.lowStockList.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3 font-bold text-slate-700">{item.name}</td>
                                            <td className="p-3 text-center">
                                                <span className={`font-black px-2 py-1 rounded ${item.stock === 0 ? 'bg-rose-100 text-rose-600' : 'text-orange-600'}`}>
                                                    {item.stock} {item.unit}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center text-slate-400">{item.minStock}</td>
                                            <td className="p-3 text-right">
                                                {!isReadOnly && (
                                                <button onClick={() => openTransaction(item, 'Purchase')} className="text-[10px] font-bold bg-brand-50 text-brand-700 px-2 py-1 rounded hover:bg-brand-100 transition-colors">NHẬP NGAY</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                  </div>
              </div>
              {/* Pie Chart */}
              <div className="hidden md:flex bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex-col h-[400px]">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-6"><PieChart size={18} className="text-brand-600"/> Phân bổ giá trị kho</h3>
                  <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                      {Object.entries(stats.categoryValue).sort((a,b) => Number(b[1]) - Number(a[1])).map(([cat, val]) => {
                          const percent = (Number(val) / Number(stats.totalInventoryValue)) * 100;
                          return (
                              <div key={cat}>
                                  <div className="flex justify-between text-xs mb-1">
                                      <span className="font-bold text-slate-600">{cat}</span>
                                      <span className="font-mono font-bold text-slate-800">{val.toLocaleString()} ₫ ({percent.toFixed(1)}%)</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${cat === 'Linen' ? 'bg-blue-500' : cat === 'Asset' ? 'bg-purple-500' : cat === 'Minibar' ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${percent}%` }}></div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 animate-enter pb-20 md:pb-10 min-h-screen md:h-full flex flex-col">
      {/* HEADER & KPI */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
               <Package className="text-brand-600" /> Quản lý Kho & Vật tư
            </h1>
            <p className="text-slate-500 text-sm font-medium">Tự động tính toán lượng hàng trong phòng theo định mức (Par Stock).</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            {!isReadOnly && (
            <>
                <button onClick={() => setBulkModalOpen(true)} className="bg-indigo-600 text-white px-3 py-1.5 md:px-4 md:py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex-1 md:flex-none text-[10px] md:text-xs uppercase tracking-wider">
                    <ListPlus size={14} className="md:w-[18px] md:h-[18px]"/> Nhập Hàng
                </button>
                <button onClick={() => setAddModalOpen(true)} className="bg-brand-600 text-white px-3 py-1.5 md:px-4 md:py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 flex-1 md:flex-none text-[10px] md:text-xs uppercase tracking-wider">
                    <Plus size={14} className="md:w-[18px] md:h-[18px]"/> Thêm vật tư
                </button>
            </>
            )}
            <button onClick={() => refreshData()} disabled={isLoading} className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-brand-600 transition-all">
                <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''}/>
            </button>
        </div>
      </div>

      {/* TABS & SEARCH */}
      <div className="bg-[#f8fafc]/90 backdrop-blur-md sticky top-0 z-30 pb-2 -mx-4 px-4 md:static md:bg-transparent md:mx-0 md:px-0 md:pb-0 transition-all">
        <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
            <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('Overview')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Overview' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><LayoutDashboard size={14} className="block"/> Tổng quan</button>
                <button onClick={() => setActiveTab('Consumable')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'Consumable' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Đồ Tiêu Hao</button>
                <button onClick={() => setActiveTab('Linen')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Linen' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Shirt size={14} className="block"/> Đồ Vải (Linen)</button>
                <button onClick={() => setActiveTab('Asset')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'Asset' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><Tv size={14} className="block"/> Tài Sản (Asset)</button>
                <button onClick={() => setActiveTab('Service')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'Service' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>Dịch vụ</button>
                <button onClick={() => setActiveTab('History')} className={`px-4 md:px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'History' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}><History size={14} className="block"/> Lịch sử</button>
            </div>

            {activeTab === 'History' ? (
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                        <input type="text" placeholder="Tìm tên, NV..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full md:w-48 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    {/* ... Date filters ... */}
                </div>
            ) : (
                activeTab !== 'Overview' && activeTab !== 'Linen' && (
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input type="text" placeholder="Tìm tên vật tư, hàng hóa..." className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all bg-slate-50/50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                )
            )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {activeTab === 'Overview' ? renderOverview() : activeTab === 'Linen' ? <LinenManager /> : (
      <div className="flex-1 flex flex-col md:bg-white md:rounded-2xl md:shadow-soft md:border md:border-slate-100 md:overflow-hidden md:min-h-[300px]">
        {activeTab === 'History' ? (
            <div className="md:flex-1 md:overflow-x-auto md:overflow-y-auto md:custom-scrollbar">
                {/* ... History Table kept same as previous versions ... */}
                <div className="hidden md:block">
                    <table className="w-full text-left text-sm border-collapse">
                        {/* ... Table Content ... */}
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            <tr>
                                <th className="p-5">Thời gian</th>
                                <th className="p-5">Người thực hiện</th>
                                <th className="p-5">Vật tư / Hàng hóa</th>
                                <th className="p-5 text-center">Giao dịch</th>
                                <th className="p-5 text-center">Số lượng</th>
                                <th className="p-5">Bằng chứng Audit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredHistory.map(t => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-5">
                                        <div className="font-bold text-slate-800">{format(parseISO(t.created_at), 'HH:mm')}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase">{format(parseISO(t.created_at), 'dd/MM/yyyy')}</div>
                                    </td>
                                    <td className="p-5"><div className="font-bold text-slate-700">{t.staff_name}</div></td>
                                    <td className="p-5"><div className="font-black text-slate-800">{t.item_name}</div></td>
                                    <td className="p-5 text-center">{getTransBadge(t.type)}</td>
                                    <td className="p-5 text-center"><div className={`font-black text-lg ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'IN' ? '+' : '-'}{t.quantity}</div></td>
                                    <td className="p-5"><div className="text-xs text-slate-600 italic whitespace-normal break-words">{t.note}</div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile History View */}
                <div className="md:hidden space-y-3 p-4">
                    {filteredHistory.length === 0 ? (
                        <div className="text-center text-slate-400 py-10">
                            <History size={40} className="mx-auto mb-2 opacity-50"/>
                            <p className="text-sm font-medium">Chưa có lịch sử giao dịch.</p>
                        </div>
                    ) : (
                        filteredHistory.map(t => (
                            <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                                <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-2">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">{format(parseISO(t.created_at), 'HH:mm')} - {format(parseISO(t.created_at), 'dd/MM/yyyy')}</div>
                                        <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 flex items-center gap-1">
                                            <User size={10}/> {t.staff_name}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {getTransBadge(t.type)}
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center mb-2">
                                    <div className="font-black text-slate-800 text-base">{t.item_name}</div>
                                    <div className={`font-black text-xl ${t.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.type === 'IN' ? '+' : '-'}{t.quantity}
                                    </div>
                                </div>

                                {t.note && (
                                    <div className="bg-slate-50 p-2 rounded-lg text-xs text-slate-600 italic border border-slate-100 mt-2">
                                        {t.note}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        ) : (
            <div className="md:flex-1 md:overflow-x-auto md:overflow-y-auto md:custom-scrollbar">
                {/* Desktop Table - Main Inventory with Calculated Columns */}
                <div className="hidden md:block">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-100 sticky top-0 z-10">
                            {activeTab === 'Asset' || activeTab === 'Consumable' ? (
                                <tr>
                                    <th className="p-5">Tên Hàng Hóa / Tài Sản</th>
                                    <th className="p-5 text-center bg-blue-50/50 text-blue-700">
                                        Trong phòng (Định mức)
                                        <div className="text-[8px] opacity-70">Tự động tính từ Recipe</div>
                                    </th>
                                    <th className="p-5 text-center bg-emerald-50/50 text-emerald-700">
                                        Kho Dự Trữ (Stock)
                                        <div className="text-[8px] opacity-70">Thực tế trong kho</div>
                                    </th>
                                    <th className="p-5 text-center font-black text-slate-800">
                                        <div className="flex items-center justify-center gap-1">
                                            Tổng Tài Sản
                                            <span title="= Đang dùng (Định mức) + Kho Dự Trữ">
                                                <HelpCircle size={12} className="text-slate-400 cursor-help"/>
                                            </span>
                                        </div>
                                    </th>
                                    <th className="p-5 text-center">Cảnh Báo (Min Stock)</th>
                                    <th className="p-5 text-center">Thao tác</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-5">Tên Hàng Hóa / Amenity</th>
                                    <th className="p-5 text-center">ĐVT</th>
                                    <th className="p-5 text-center">Giá bán</th>
                                    <th className="p-5 text-center">Tồn Kho Hiện Tại</th>
                                    <th className="p-5 text-center">Tồn Tối Thiểu</th>
                                    <th className="p-5 text-center">Trạng thái</th>
                                    <th className="p-5 text-center">Thao tác</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredItems.map(item => {
                                const isLow = (item.stock || 0) <= (item.minStock || 0) && item.category !== 'Service';
                                
                                // NEW LOGIC: Calculate from Hook Data
                                const calculatedInRoom = statsMap.get(item.id)?.requiredStandard || 0;
                                const stock = item.stock || 0;
                                const totalReal = calculatedInRoom + stock;

                                if (activeTab === 'Asset' || activeTab === 'Consumable') return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <div className="font-black text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.category}</div>
                                        </td>
                                        <td className="p-5 text-center bg-blue-50/20">
                                            <div className="flex flex-col items-center">
                                                <span className="text-blue-700 font-bold text-base">{calculatedInRoom}</span>
                                                <span className="text-[9px] text-blue-400 font-black uppercase mt-1">Đang dùng</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center bg-emerald-50/20">
                                            <div className="flex flex-col items-center">
                                                <span className="text-emerald-700 font-black text-base">{stock}</span>
                                                <span className="text-[9px] text-emerald-400 font-bold uppercase mt-1">
                                                    Kho (Dư)
                                                </span>
                                            </div>
                                        </td>

                                        <td className="p-5 text-center">
                                            <div className="font-black text-lg text-slate-800">{totalReal}</div>
                                        </td>
                                        
                                        <td className="p-5 text-center">
                                            {isLow ? (
                                                <div className="text-[9px] text-rose-500 font-black uppercase flex items-center justify-center gap-1 bg-rose-50 py-1 px-2 rounded-full border border-rose-100 animate-pulse">
                                                    <AlertTriangle size={10}/> Cần nhập
                                                </div>
                                            ) : (
                                                <div className="text-[9px] text-emerald-500 font-black uppercase flex items-center justify-center gap-1 bg-emerald-50 py-1 px-2 rounded-full border border-emerald-100">
                                                    <CheckCircle2 size={10}/> Ổn định
                                                </div>
                                            )}
                                        </td>
                                        
                                        <td className="p-5 text-center">
                                            <div className="flex justify-center gap-2">
                                                {!isReadOnly && (
                                                <>
                                                <button onClick={() => openTransaction(item, 'Purchase')} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Nhập hàng mới / Tăng tài sản"><Plus size={18}/></button>
                                                
                                                {/* Keep Distribute button but visually secondary */}
                                                {activeTab === 'Consumable' && (
                                                    <button onClick={() => handleOpenDistribute(item)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Setup / Điều chuyển nội bộ (Optional)"><Share size={18}/></button>
                                                )}

                                                <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Xóa vật tư"><Trash2 size={18}/></button>
                                                <button onClick={() => { setEditForm(item); setEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"><Pencil size={18}/></button>
                                                </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );

                                // Service View
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="p-5">
                                            <div className="font-black text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.category}</div>
                                        </td>
                                        <td className="p-5 text-center text-slate-500 font-bold">{item.unit}</td>
                                        <td className="p-5 text-center text-slate-800 font-bold">{item.price.toLocaleString()}</td>
                                        <td className="p-5 text-center">
                                            <div className={`text-lg font-black ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>{item.stock || 0}</div>
                                        </td>
                                        <td className="p-5 text-center text-slate-400 font-bold">{item.minStock || 0}</td>
                                        <td className="p-5 text-center">
                                            {isLow ? <span className="text-rose-600 font-bold text-xs">Thấp</span> : <span className="text-emerald-600 font-bold text-xs">Đủ</span>}
                                        </td>
                                        <td className="p-5 text-center">
                                            {/* Actions for Service */}
                                            <div className="flex justify-center gap-2">
                                                {!isReadOnly && (
                                                <>
                                                <button onClick={() => { setEditForm(item); setEditModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"><Pencil size={18}/></button>
                                                <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={18}/></button>
                                                </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Smart Cards */}
                <div className="md:hidden space-y-3">
                   {filteredItems.map(item => {
                       const isLow = (item.stock || 0) <= (item.minStock || 0) && item.category !== 'Service';
                       const calculatedInRoom = statsMap.get(item.id)?.requiredStandard || 0;
                       const stock = item.stock || 0;
                       const totalReal = calculatedInRoom + stock;

                       return (
                           <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <div className="font-bold text-slate-800 text-lg line-clamp-1">{item.name}</div>
                                       <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">{item.category}</span>
                                   </div>
                                   {!isReadOnly && (
                                   <div className="flex gap-1">
                                       <button onClick={() => { setEditForm(item); setEditModalOpen(true); }} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                                           <Pencil size={18}/>
                                       </button>
                                       <button onClick={() => handleDeleteItem(item.id, item.name)} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg">
                                           <Trash2 size={18}/>
                                       </button>
                                   </div>
                                   )}
                               </div>
                               
                               {activeTab === 'Asset' || activeTab === 'Consumable' ? (
                                   <div className="grid grid-cols-2 gap-2 mb-4">
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">
                                               Kho Dự Trữ
                                           </div>
                                           <div className={`font-black text-sm ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>{stock}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Trong phòng (Auto)</div>
                                           <div className="font-bold text-blue-600 text-sm">{calculatedInRoom}</div>
                                       </div>
                                       <div className="col-span-2 bg-slate-100/50 p-2 rounded-lg flex justify-between items-center px-4">
                                            <span className="text-[10px] font-black text-slate-500 uppercase">Tổng Tài Sản:</span>
                                            <span className="font-black text-slate-800">{totalReal}</span>
                                       </div>
                                   </div>
                               ) : (
                                   <div className="grid grid-cols-3 gap-2 mb-4">
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Giá</div>
                                           <div className="font-bold text-slate-700 text-xs">{item.price > 0 ? `${item.price/1000}k` : '-'}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Kho Sạch</div>
                                           <div className={`font-black text-sm ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>{item.stock}</div>
                                       </div>
                                       <div className="bg-slate-50 p-2 rounded-lg text-center border border-slate-100">
                                           <div className="text-[10px] font-bold text-slate-400 uppercase">Đơn Vị</div>
                                           <div className="font-bold text-slate-700 text-xs">{item.unit}</div>
                                       </div>
                                   </div>
                               )}

                               {!isReadOnly && (
                               <div className="grid grid-cols-2 gap-2">
                                   <button onClick={() => openTransaction(item, 'Purchase')} className="py-3 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                                       <Plus size={18} strokeWidth={2.5}/> Nhập
                                   </button>
                                   
                                   {activeTab === 'Consumable' ? (
                                       <button onClick={() => handleOpenDistribute(item)} className="py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all">
                                           <Share size={18} strokeWidth={2.5}/> Setup
                                       </button>
                                   ) : (
                                       <button onClick={() => handleDeleteItem(item.id, item.name)} className={`py-3 bg-white text-rose-600 hover:bg-rose-50 border border-rose-100 font-bold text-xs rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all`}>
                                           <Trash2 size={18} strokeWidth={2.5}/> Xóa
                                       </button>
                                   )}
                                </div>
                               )}
                           </div>
                       );
                   })}
                </div>
            </div>
        )}
      </div>
      )}

      {/* --- MODALS --- */}
      {/* Distribute Modal */}
      {distributeItem && (
          <DistributeModal 
              isOpen={isDistributeModalOpen}
              onClose={() => setDistributeModalOpen(false)}
              item={distributeItem}
          />
      )}

      {/* Existing Transaction Modal */}
      <Modal isOpen={isTransModalOpen} onClose={() => setTransModalOpen(false)} 
        title={
            modalMode === 'Purchase' ? 'Nhập Hàng / Tăng Tài Sản' : 
            modalMode === 'SendLaundry' ? 'Gửi Đồ Đi Giặt (Sạch -> Bẩn)' : 
            modalMode === 'ReceiveLaundry' ? 'Nhận Đồ Sạch (Bẩn -> Sạch)' : 'Thanh Lý / Hủy Hàng'
        } 
        size="md"
      >
        {/* ... Modal Content kept same ... */}
        <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm border border-slate-200">
                        {modalMode === 'Purchase' ? <ArrowUpCircle className="text-emerald-500"/> : 
                         modalMode === 'SendLaundry' ? <Shirt className="text-blue-500"/> : 
                         modalMode === 'Liquidate' ? <Trash2 className="text-rose-500"/> :
                         <ArrowDownCircle className="text-brand-600"/>}
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Mặt hàng</div>
                        <div className="text-lg font-black text-slate-800">{selectedItem?.name}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Người thực hiện</div>
                    <div className="text-sm font-bold text-brand-600 flex items-center gap-1 justify-end"><User size={14}/> {currentUser?.collaboratorName}</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số lượng</label>
                        <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-xl font-black focus:border-brand-500 outline-none" value={actionQty} onChange={e => setActionQty(Number(e.target.value))} />
                    </div>
                    {modalMode === 'Purchase' ? (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn giá nhập</label>
                            <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-xl font-black text-emerald-600 focus:border-emerald-500 outline-none" value={actionPrice} onChange={e => setActionPrice(Number(e.target.value))} />
                        </div>
                    ) : (
                        <div className="space-y-1.5 opacity-40">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dòng tiền</label>
                            <div className="w-full border-2 border-slate-100 rounded-xl p-3 bg-slate-50 text-xl font-black text-slate-400">N/A</div>
                        </div>
                    )}
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ghi chú chi tiết</label>
                    <textarea 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-sm font-medium focus:border-brand-500 outline-none h-20"
                        placeholder="Ví dụ: Nhập hàng từ nhà cung cấp A..."
                        value={transNote}
                        onChange={e => setTransNote(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button onClick={() => setTransModalOpen(false)} disabled={isSubmitting} className="flex-1 py-3 text-slate-400 font-bold hover:bg-slate-50 rounded-xl transition-all">Hủy bỏ</button>
                <button onClick={handleTransactionSubmit} disabled={isSubmitting} className={`flex-[2] py-4 text-white rounded-2xl font-black shadow-xl hover:shadow-2xl active:scale-[0.98] transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${modalMode === 'Liquidate' ? 'bg-rose-600' : 'bg-brand-600'}`}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18}/>}
                    {modalMode === 'Liquidate' ? 'Xác nhận hủy' : 'Lưu giao dịch'}
                </button>
            </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Cấu hình Hàng hóa & Vật tư" size="sm">
          <form id="editInventoryForm" onSubmit={handleEditSubmit} className="space-y-5">
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên vật tư/hàng hóa</label>
                  <input required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" value={editForm.name || ''} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá bán (VND)</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-emerald-600 outline-none focus:border-brand-500" value={editForm.price || 0} onChange={e => setEditForm({...editForm, price: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn tối thiểu</label>
                    <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-rose-600 outline-none focus:border-brand-500" value={editForm.minStock || 0} onChange={e => setEditForm({...editForm, minStock: Number(e.target.value)})} />
                  </div>
              </div>

              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá Vốn (Cost Price)</label>
                  <input 
                      type="number" 
                      className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500" 
                      value={editForm.costPrice ?? 0} 
                      onChange={e => setEditForm({...editForm, costPrice: Number(e.target.value)})} 
                  />
              </div>

              {/* RESTORED: Manual Stock Correction Fields */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 space-y-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase border-b border-slate-200 pb-2">Điều chỉnh số lượng (Kiểm kê)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tồn kho (Kho Sạch)</label>
                          <input 
                              type="number" 
                              className="w-full border-2 border-emerald-100 rounded-lg p-2 font-black text-emerald-700 outline-none focus:border-emerald-500"
                              value={editForm.stock ?? 0}
                              onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})}
                          />
                      </div>
                      
                      <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tổng Tài Sản (Ghi sổ)</label>
                          <input 
                              type="number" 
                              className="w-full border-2 border-slate-200 rounded-lg p-2 font-bold text-slate-700 outline-none focus:border-brand-500"
                              value={editForm.totalassets ?? 0}
                              onChange={e => setEditForm({...editForm, totalassets: Number(e.target.value)})}
                          />
                      </div>
                  </div>
              </div>
          </form>
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
             <button type="button" onClick={() => setEditModalOpen(false)} disabled={isSubmitting} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Hủy</button>
             <button form="editInventoryForm" type="submit" disabled={isSubmitting} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                 {isSubmitting && <Loader2 size={16} className="animate-spin"/>} Lưu cấu hình
             </button>
          </div>
      </Modal>

      {/* Add Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} title="Thêm Vật Tư / Hàng Hóa Mới" size="sm">
          <form id="addInventoryForm" onSubmit={handleAddServiceSubmit} className="space-y-5">
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên vật tư/hàng hóa</label>
                  <input 
                    required 
                    className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" 
                    placeholder="Ví dụ: Nước suối, Khăn tắm..."
                    value={newServiceForm.name || ''} 
                    onChange={e => setNewServiceForm({...newServiceForm, name: e.target.value})} 
                  />
              </div>
              
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phân loại</label>
                  <select 
                    className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500"
                    value={newServiceForm.category || 'Minibar'}
                    onChange={e => setNewServiceForm({...newServiceForm, category: e.target.value as any})}
                  >
                      <option value="Minibar">Minibar (Đồ uống/Snack)</option>
                      <option value="Amenity">Amenity (Tiêu hao miễn phí)</option>
                      <option value="Linen">Linen (Đồ vải giặt ủi)</option>
                      <option value="Asset">Asset (Tài sản cố định)</option>
                      <option value="Service">Dịch vụ (Giặt ủi khách/Dọn thêm)</option>
                  </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn vị tính</label>
                    <input 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" 
                        placeholder="Lon, Chiếc..."
                        value={newServiceForm.unit || ''} 
                        onChange={e => setNewServiceForm({...newServiceForm, unit: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tồn đầu kỳ</label>
                    <input 
                        type="number" 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500" 
                        value={newServiceForm.stock || 0} 
                        onChange={e => setNewServiceForm({...newServiceForm, stock: Number(e.target.value)})} 
                    />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá bán (VND)</label>
                    <input 
                        type="number" 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-emerald-600 outline-none focus:border-brand-500" 
                        value={newServiceForm.price || 0} 
                        onChange={e => setNewServiceForm({...newServiceForm, price: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá vốn (Cost)</label>
                    <input 
                        type="number" 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-600 outline-none focus:border-brand-500" 
                        value={newServiceForm.costPrice || 0} 
                        onChange={e => setNewServiceForm({...newServiceForm, costPrice: Number(e.target.value)})} 
                    />
                  </div>
              </div>
              
              <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cảnh báo tồn thấp (Min Stock)</label>
                  <input 
                        type="number" 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold outline-none focus:border-brand-500" 
                        value={newServiceForm.minStock || 0} 
                        onChange={e => setNewServiceForm({...newServiceForm, minStock: Number(e.target.value)})} 
                  />
              </div>
          </form>
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
             <button type="button" onClick={() => setAddModalOpen(false)} disabled={isSubmitting} className="px-6 py-2.5 text-slate-400 font-bold uppercase text-[10px] tracking-widest">Hủy</button>
             <button form="addInventoryForm" type="submit" disabled={isSubmitting} className="px-8 py-3 bg-brand-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-100 active:scale-95 transition-all flex items-center justify-center gap-2">
                 {isSubmitting && <Loader2 size={16} className="animate-spin"/>} Thêm Mới
             </button>
          </div>
      </Modal>

      <BulkImportModal 
          isOpen={isBulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
      />
    </div>
  );
};
