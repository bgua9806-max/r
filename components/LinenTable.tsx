
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { ServiceItem } from '../types';
import { ArrowRightLeft, AlertTriangle, CheckCircle2, AlertOctagon, HelpCircle, Pencil, Trash2, Save, Loader2, Search, List } from 'lucide-react';
import { LaundryTicketModal } from './LaundryTicketModal';
import { Modal } from './Modal';
import { LinenUsageDetailModal } from './LinenUsageDetailModal';

export const LinenTable: React.FC = () => {
  const { services, updateService, deleteService, addInventoryTransaction, currentUser, facilities, notify, refreshData, rooms, roomRecipes, bookings } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isLaundryModalOpen, setLaundryModalOpen] = useState(false);
  
  // Edit State
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ServiceItem>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drill-down Detail State
  const [selectedItemDetail, setSelectedItemDetail] = useState<ServiceItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // --- CALCULATION LOGIC ---
  const itemStats = useMemo(() => {
      const standards: Record<string, number> = {};
      const lendings: Record<string, number> = {};

      rooms.forEach(room => {
          if (room.type && roomRecipes[room.type]) {
              roomRecipes[room.type].items.forEach(i => {
                  standards[i.itemId] = (standards[i.itemId] || 0) + i.quantity;
              });
          }
      });

      bookings.filter(b => b.status === 'CheckedIn').forEach(b => {
          try {
              const items = JSON.parse(b.lendingJson || '[]');
              items.forEach((i: any) => {
                  if (i.quantity > 0) {
                      lendings[i.item_id] = (lendings[i.item_id] || 0) + i.quantity;
                  }
              });
          } catch(e) {}
      });

      return { standards, lendings };
  }, [rooms, roomRecipes, bookings]);

  const linenItems = useMemo(() => {
    return services.filter(s => 
        s.category === 'Linen' && 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [services, searchTerm]);

  const handleEditClick = (item: ServiceItem) => {
      setEditForm({ ...item });
      setEditModalOpen(true);
  };

  const handleDeleteClick = async (id: string, name: string) => {
      if (confirm(`CẢNH BÁO: Bạn có chắc muốn xóa vĩnh viễn "${name}" khỏi hệ thống?`)) {
          await deleteService(id);
          notify('success', `Đã xóa ${name}`);
      }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editForm.id || !editForm.name) return;
      
      setIsSubmitting(true);
      try {
          const payload: ServiceItem = {
              ...(editForm as ServiceItem),
              price: Number(editForm.price || 0),
              costPrice: Number(editForm.costPrice || 0),
              stock: Number(editForm.stock || 0),
              minStock: Number(editForm.minStock || 0),
              laundryStock: Number(editForm.laundryStock || 0),
              vendor_stock: Number(editForm.vendor_stock || 0),
              in_circulation: Number(editForm.in_circulation || 0),
              totalassets: Number(editForm.totalassets || 0),
              default_qty: Number(editForm.default_qty || 0)
          };

          await updateService(payload);
          notify('success', 'Đã cập nhật thông tin đồ vải.');
          setEditModalOpen(false);
      } catch (error) {
          notify('error', 'Lỗi khi lưu thay đổi.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleBulkLaundrySubmit = async (mode: 'SEND' | 'RECEIVE', items: { itemId: string; quantity: number; damage: number }[]) => {
      const batchId = `LAUNDRY-${mode}-${Date.now()}`;
      const timestamp = new Date().toISOString();

      for (const item of items) {
          const service = services.find(s => s.id === item.itemId);
          if (!service) continue;

          let newItem = { ...service };
          let transType: any = mode === 'SEND' ? 'LAUNDRY_SEND' : 'LAUNDRY_RECEIVE';
          let note = `${mode === 'SEND' ? 'Gửi đi giặt' : 'Nhận đồ sạch'} (Phiếu #${batchId})`;

          if (mode === 'SEND') {
               const qty = Math.min(item.quantity, service.laundryStock || 0); 
               if (qty <= 0) continue;

               newItem.laundryStock = (newItem.laundryStock || 0) - qty;
               newItem.vendor_stock = (newItem.vendor_stock || 0) + qty;

               await updateService(newItem);
               await addInventoryTransaction({
                   id: `TR-${batchId}-${item.itemId}`,
                   created_at: timestamp,
                   staff_id: currentUser?.id || 'SYS',
                   staff_name: currentUser?.collaboratorName || 'System',
                   item_id: newItem.id,
                   item_name: newItem.name,
                   type: transType,
                   quantity: qty,
                   price: newItem.costPrice || 0,
                   total: 0,
                   facility_name: facilities[0]?.facilityName,
                   note: note
               });
          } else {
               const qty = Math.min(item.quantity, service.vendor_stock || 0);
               if (qty <= 0) continue;

               const cleanReturn = qty - item.damage;
               
               newItem.vendor_stock = (newItem.vendor_stock || 0) - qty;
               newItem.stock = (newItem.stock || 0) + cleanReturn;
               
               if (item.damage > 0) {
                   newItem.totalassets = (newItem.totalassets || 0) - item.damage;
                   note += `. Hỏng/Rách: ${item.damage}`;
               }

               await updateService(newItem);
               await addInventoryTransaction({
                   id: `TR-${batchId}-${item.itemId}`,
                   created_at: timestamp,
                   staff_id: currentUser?.id || 'SYS',
                   staff_name: currentUser?.collaboratorName || 'System',
                   item_id: newItem.id,
                   item_name: newItem.name,
                   type: transType,
                   quantity: qty,
                   price: newItem.costPrice || 0,
                   total: 0, 
                   facility_name: facilities[0]?.facilityName,
                   note: note
               });
          }
      }
      notify('success', `Đã xử lý phiếu giặt là #${batchId}`);
      refreshData();
  };

  return (
    <div className="flex flex-col h-full">
        {/* Local Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white relative md:sticky md:top-0 z-0 md:z-20 shadow-sm md:shadow-none">
            <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                <input 
                    type="text" 
                    placeholder="Tìm tên đồ vải..." 
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-slate-50 focus:bg-white transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <button 
                onClick={() => setLaundryModalOpen(true)}
                className="w-full md:w-auto bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-brand-700 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
                <ArrowRightLeft size={16}/> Tạo Phiếu Giao/Nhận
            </button>
        </div>

        {/* DESKTOP TABLE VIEW */}
        <div className="hidden md:block flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-widest border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                        <th className="p-4 pl-6 w-[20%]">Tên Đồ Vải</th>
                        <th className="p-4 text-center bg-blue-50/50 text-blue-700 w-[15%]">Đang Dùng (Chi tiết)</th>
                        <th className="p-4 text-center bg-emerald-50/50 text-emerald-700 w-[10%]">Kho Sạch</th>
                        <th className="p-4 text-center bg-rose-50/50 text-rose-700 w-[10%]">Kho Bẩn</th>
                        <th className="p-4 text-center bg-purple-50/50 text-purple-700 w-[12%] border-x-2 border-purple-100">
                            <div className="flex flex-col items-center">
                                <span>Tại Xưởng</span>
                                <span className="text-[8px] opacity-70">(Công Nợ)</span>
                            </div>
                        </th>
                        <th className="p-4 text-center w-[12%]">Tổng Thực Tế</th>
                        <th className="p-4 text-center w-[12%]">Tổng DB</th>
                        <th className="p-4 text-center w-[8%]">Đối Soát</th>
                        <th className="p-4 text-center w-[6%] sticky right-0 bg-slate-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {linenItems.map(item => {
                        const inRoom = item.in_circulation || 0;
                        const clean = item.stock || 0;
                        const dirtyAtHotel = item.laundryStock || 0;
                        const atVendor = item.vendor_stock || 0;
                        
                        const actualTotal = inRoom + clean + dirtyAtHotel + atVendor;
                        const dbTotal = item.totalassets || 0;
                        const variance = actualTotal - dbTotal;

                        // Calculated Stats
                        const stdQty = itemStats.standards[item.id] || 0;
                        const lendingQty = itemStats.lendings[item.id] || 0;
                        const theoreticalInRoom = stdQty + lendingQty;
                        const missingInRoom = theoreticalInRoom - inRoom;

                        return (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-4 pl-6">
                                    <div className="font-bold text-slate-800 line-clamp-1" title={item.name}>{item.name}</div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">{item.unit}</div>
                                </td>
                                <td className="p-4 text-center bg-blue-50/20 relative group/cell">
                                    <div 
                                        onClick={() => { setSelectedItemDetail(item); setIsDetailModalOpen(true); }}
                                        className="flex flex-col items-center cursor-pointer p-1 rounded-lg hover:bg-blue-100/50 transition-colors"
                                        title="Bấm để xem chi tiết ai đang mượn"
                                    >
                                        <div className="flex items-center gap-1">
                                            <span className="font-black text-blue-700 text-lg">{inRoom}</span>
                                            <List size={12} className="text-blue-400 opacity-50 group-hover/cell:opacity-100"/>
                                        </div>
                                        <div className="flex flex-col items-center mt-1 space-y-1 w-full px-2">
                                            <div className="text-[10px] text-blue-400 font-medium">Chuẩn: {stdQty}</div>
                                            {lendingQty > 0 && (
                                                <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                                    +{lendingQty} Mượn
                                                </span>
                                            )}
                                            {missingInRoom > 0 && (
                                                <span className="text-[9px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full border border-rose-200 animate-pulse">
                                                    -{missingInRoom} Thiếu
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-center bg-emerald-50/20 font-bold text-emerald-700">
                                    {clean}
                                </td>
                                <td className="p-4 text-center bg-rose-50/20 font-bold text-rose-700">
                                    {dirtyAtHotel}
                                </td>
                                <td className="p-4 text-center bg-purple-50/20 border-x border-purple-100">
                                    <div className="font-black text-purple-700 text-lg">{atVendor}</div>
                                    {atVendor > 0 && <div className="text-[9px] text-purple-500 font-bold uppercase tracking-tighter">Chưa trả</div>}
                                </td>
                                <td className="p-4 text-center font-bold text-slate-700">
                                    {actualTotal}
                                </td>
                                <td className="p-4 text-center text-slate-500">
                                    {dbTotal}
                                </td>
                                <td className="p-4 text-center">
                                    {variance === 0 ? (
                                        <div className="flex justify-center"><CheckCircle2 size={16} className="text-emerald-500"/></div>
                                    ) : (
                                        <div className={`flex items-center justify-center gap-1 font-bold text-xs px-2 py-1 rounded-full ${variance < 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                            {variance < 0 ? <AlertTriangle size={12}/> : <AlertOctagon size={12}/>}
                                            {variance > 0 ? `+${variance}` : variance}
                                        </div>
                                    )}
                                </td>
                                <td className="p-2 text-center sticky right-0 bg-white group-hover:bg-slate-50 transition-colors shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                    <div className="flex items-center justify-center gap-1">
                                        <button 
                                            onClick={() => handleEditClick(item)}
                                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-all"
                                            title="Chỉnh sửa số lượng"
                                        >
                                            <Pencil size={14}/>
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteClick(item.id, item.name)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                            title="Xóa đồ vải"
                                        >
                                            <Trash2 size={14}/>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {linenItems.length === 0 && (
                        <tr>
                            <td colSpan={9} className="p-12 text-center text-slate-400 italic">Không tìm thấy đồ vải nào.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* MOBILE CARD VIEW */}
        <div className="md:hidden space-y-4 p-4 pb-20">
            {linenItems.map(item => {
                const inRoom = item.in_circulation || 0;
                const clean = item.stock || 0;
                const dirtyAtHotel = item.laundryStock || 0;
                const atVendor = item.vendor_stock || 0;
                
                const actualTotal = inRoom + clean + dirtyAtHotel + atVendor;
                const dbTotal = item.totalassets || 0;
                const variance = actualTotal - dbTotal;

                return (
                    <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-lg font-black text-slate-800">{item.name}</div>
                                <div className="text-xs text-slate-500 font-medium">{item.unit}</div>
                            </div>
                            <button onClick={() => handleEditClick(item)} className="p-2 bg-slate-50 rounded-full text-blue-600 border border-slate-100 shadow-sm">
                                <Pencil size={16}/>
                            </button>
                        </div>

                        {/* Grid Stats */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-emerald-50 p-2.5 rounded-xl text-center border border-emerald-100">
                                <div className="text-[10px] text-emerald-600 font-black uppercase mb-1">Kho Sạch</div>
                                <div className="text-2xl font-black text-emerald-700 leading-none">{clean}</div>
                            </div>
                            <div 
                                onClick={() => { setSelectedItemDetail(item); setIsDetailModalOpen(true); }}
                                className="bg-blue-50 p-2.5 rounded-xl text-center border border-blue-100 cursor-pointer active:scale-95 transition-transform"
                            >
                                <div className="text-[10px] text-blue-600 font-black uppercase mb-1 flex items-center justify-center gap-1">
                                    Đang Dùng <List size={10}/>
                                </div>
                                <div className="text-2xl font-black text-blue-700 leading-none">{inRoom}</div>
                            </div>
                            <div className="bg-rose-50 p-2.5 rounded-xl text-center border border-rose-100">
                                <div className="text-[10px] text-rose-600 font-black uppercase mb-1">Kho Bẩn</div>
                                <div className="text-2xl font-black text-rose-700 leading-none">{dirtyAtHotel}</div>
                            </div>
                            <div className="bg-purple-50 p-2.5 rounded-xl text-center border border-purple-100">
                                <div className="text-[10px] text-purple-600 font-black uppercase mb-1">Tại Xưởng</div>
                                <div className="text-2xl font-black text-purple-700 leading-none">{atVendor}</div>
                            </div>
                        </div>

                        {/* Footer / Variance */}
                        <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                             <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-bold">Tổng: {actualTotal}</span>
                                <span className="text-[10px] text-slate-400">(DB: {dbTotal})</span>
                             </div>
                             
                             {variance === 0 ? (
                                <div className="text-[10px] text-emerald-600 font-black uppercase flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-full">
                                    <CheckCircle2 size={12}/> Khớp
                                </div>
                             ) : (
                                <div className={`text-[10px] font-black uppercase flex items-center gap-1 px-2 py-1 rounded-full ${variance < 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {variance < 0 ? <AlertTriangle size={12}/> : <AlertOctagon size={12}/>}
                                    {variance > 0 ? `Thừa ${variance}` : `Thiếu ${Math.abs(variance)}`}
                                </div>
                             )}
                        </div>
                    </div>
                );
            })}
            
            {linenItems.length === 0 && (
                <div className="text-center py-10 text-slate-400 italic">Không tìm thấy đồ vải nào.</div>
            )}
        </div>

        <LaundryTicketModal 
            isOpen={isLaundryModalOpen}
            onClose={() => setLaundryModalOpen(false)}
            onConfirm={handleBulkLaundrySubmit}
        />

        <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Chỉnh Sửa Kho Đồ Vải" size="sm">
            <form id="editLinenForm" onSubmit={handleEditSubmit} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên Đồ Vải</label>
                    <input 
                        required 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-slate-50 font-bold text-slate-700 outline-none focus:border-brand-500 focus:bg-white"
                        value={editForm.name}
                        onChange={e => setEditForm({...editForm, name: e.target.value})}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Giá Vốn (Cost)</label>
                        <input 
                            type="number" 
                            className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold text-slate-700 outline-none focus:border-brand-500"
                            value={editForm.costPrice}
                            onChange={e => setEditForm({...editForm, costPrice: Number(e.target.value)})}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn Vị</label>
                        <input 
                            className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-bold text-slate-700 outline-none focus:border-brand-500"
                            value={editForm.unit}
                            onChange={e => setEditForm({...editForm, unit: e.target.value})}
                        />
                    </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                    <div className="col-span-2 text-xs font-black text-slate-500 uppercase border-b border-slate-200 pb-2 mb-2">
                        Điều chỉnh số lượng kho
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-600 uppercase">Kho Sạch (Stock)</label>
                        <input 
                            type="number" 
                            className="w-full border-2 border-emerald-100 rounded-lg p-2 font-black text-emerald-700 outline-none focus:border-emerald-500"
                            value={editForm.stock}
                            onChange={e => setEditForm({...editForm, stock: Number(e.target.value)})}
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-blue-600 uppercase">Đang Dùng (Room)</label>
                        <input 
                            type="number" 
                            className="w-full border-2 border-blue-100 rounded-lg p-2 font-black text-blue-700 outline-none focus:border-blue-500"
                            value={editForm.in_circulation}
                            onChange={e => setEditForm({...editForm, in_circulation: Number(e.target.value)})}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-rose-600 uppercase">Kho Bẩn (Dirty)</label>
                        <input 
                            type="number" 
                            className="w-full border-2 border-rose-100 rounded-lg p-2 font-black text-rose-700 outline-none focus:border-rose-500"
                            value={editForm.laundryStock}
                            onChange={e => setEditForm({...editForm, laundryStock: Number(e.target.value)})}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-purple-600 uppercase">Tại Xưởng (Vendor)</label>
                        <input 
                            type="number" 
                            className="w-full border-2 border-purple-100 rounded-lg p-2 font-black text-purple-700 outline-none focus:border-purple-500"
                            value={editForm.vendor_stock}
                            onChange={e => setEditForm({...editForm, vendor_stock: Number(e.target.value)})}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        Tổng Tài Sản (Database) <HelpCircle size={12}/>
                    </label>
                    <input 
                        type="number" 
                        className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-slate-800 outline-none focus:border-brand-500"
                        value={editForm.totalassets}
                        onChange={e => setEditForm({...editForm, totalassets: Number(e.target.value)})}
                    />
                    <p className="text-[10px] text-slate-400 italic">Tổng tài sản cố định dùng để đối soát lệch kho.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setEditModalOpen(false)} disabled={isSubmitting} className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all">
                        Hủy
                    </button>
                    <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-xl font-black text-xs uppercase bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 transition-all flex items-center gap-2">
                        {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} Lưu Thay Đổi
                    </button>
                </div>
            </form>
        </Modal>

        {/* Drill-down Modal */}
        <LinenUsageDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => setIsDetailModalOpen(false)}
            item={selectedItemDetail}
        />
    </div>
  );
};
