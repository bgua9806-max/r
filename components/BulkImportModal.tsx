
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';
import { BulkImportItem, ServiceItem } from '../types';
import { Search, Plus, Trash2, Save, Loader2, DollarSign, Archive, Package, Building, FolderOpen, ChevronDown } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const BulkImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { services, processBulkImport, facilities, notify } = useAppContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<BulkImportItem[]>([]);
  const [note, setNote] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [selectedFacility, setSelectedFacility] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State cho Dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected facility
  useEffect(() => {
      if (isOpen && facilities.length > 0 && !selectedFacility) {
          setSelectedFacility(facilities[0].facilityName);
      }
      if (!isOpen) {
          // Reset form on close
          setSearchTerm('');
          setSelectedItems([]);
          setNote('');
          setEvidenceUrl('');
          setIsSubmitting(false);
          setIsDropdownOpen(false);
      }
  }, [isOpen, facilities]);

  // 1. Lọc danh sách (Bao gồm cả khi không gõ gì)
  const filteredServices = useMemo(() => {
      let matches = services;
      
      // Nếu có từ khóa thì lọc, không thì lấy hết
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          matches = services.filter(s => s.name.toLowerCase().includes(lowerTerm));
      }

      // Loại bỏ các món đã chọn
      return matches.filter(s => !selectedItems.some(item => item.itemId === s.id));
  }, [services, searchTerm, selectedItems]);

  // 2. Gom nhóm theo Category
  const groupedServices = useMemo(() => {
      const groups: Record<string, ServiceItem[]> = {};
      filteredServices.forEach(s => {
          const cat = s.category || 'Khác';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(s);
      });
      return groups;
  }, [filteredServices]);

  const totalAmount = useMemo(() => {
      return selectedItems.reduce((sum, item) => sum + (item.importQuantity * item.importPrice), 0);
  }, [selectedItems]);

  const handleAddItem = (service: ServiceItem) => {
      const newItem: BulkImportItem = {
          itemId: service.id,
          itemName: service.name,
          unit: service.unit,
          currentStock: service.stock || 0,
          importQuantity: 1,
          importPrice: service.costPrice || 0
      };
      setSelectedItems(prev => [...prev, newItem]);
      setSearchTerm(''); // Clear search after adding
      setIsDropdownOpen(false); // Close dropdown
      searchInputRef.current?.blur();
  };

  const handleRemoveItem = (itemId: string) => {
      setSelectedItems(prev => prev.filter(item => item.itemId !== itemId));
  };

  const handleUpdateItem = (itemId: string, field: keyof BulkImportItem, value: number) => {
      setSelectedItems(prev => prev.map(item => {
          if (item.itemId === itemId) {
              return { ...item, [field]: value };
          }
          return item;
      }));
  };

  const handleSubmit = async () => {
      if (selectedItems.length === 0) {
          notify('error', 'Chưa chọn mặt hàng nào để nhập.');
          return;
      }
      if (!selectedFacility) {
          notify('error', 'Vui lòng chọn cơ sở nhập kho.');
          return;
      }

      setIsSubmitting(true);
      try {
          await processBulkImport(selectedItems, totalAmount, note, selectedFacility, evidenceUrl);
          notify('success', `Đã nhập kho ${selectedItems.length} mặt hàng.`);
          onClose();
      } catch (e) {
          console.error(e);
          notify('error', 'Lỗi khi nhập kho hàng loạt.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleInputFocus = () => setIsDropdownOpen(true);
  const handleInputBlur = () => {
      // Delay đóng để kịp nhận sự kiện click vào item
      setTimeout(() => setIsDropdownOpen(false), 200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tạo Phiếu Nhập Kho (Hàng Loạt)" size="xl">
        <div className="flex flex-col h-[80vh] md:h-[700px]">
            {/* 1. Header Search & Info */}
            <div className="shrink-0 space-y-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Tìm kiếm & Thêm hàng</label>
                        <div className="relative group">
                            <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={18}/>
                            <input 
                                ref={searchInputRef}
                                className="w-full pl-10 pr-10 py-2 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-brand-500 font-medium transition-all"
                                placeholder="Nhập tên hoặc chọn từ danh sách..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                autoFocus
                            />
                            <ChevronDown className={`absolute right-3 top-2.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} size={16}/>
                            
                            {/* SMART DROPDOWN WITH CATEGORIES */}
                            {isDropdownOpen && (
                                <div className="absolute top-full left-0 w-full bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 z-50 max-h-[350px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2">
                                    {Object.keys(groupedServices).length === 0 ? (
                                        <div className="p-6 text-center flex flex-col items-center justify-center text-slate-400">
                                            <Package size={24} className="mb-2 opacity-50"/>
                                            <p className="text-xs font-medium">
                                                {searchTerm ? 'Không tìm thấy sản phẩm phù hợp.' : 'Đã chọn hết tất cả sản phẩm.'}
                                            </p>
                                        </div>
                                    ) : (
                                        Object.entries(groupedServices).map(([category, items]: [string, ServiceItem[]]) => (
                                            <div key={category}>
                                                <div className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm px-3 py-1.5 border-b border-slate-200 flex items-center gap-2">
                                                    <FolderOpen size={12} className="text-slate-500"/>
                                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{category} ({items.length})</span>
                                                </div>
                                                {items.map(s => (
                                                    <button 
                                                        key={s.id}
                                                        // Sử dụng onMouseDown thay vì onClick để tránh bị sự kiện onBlur của input chặn mất
                                                        onMouseDown={(e) => { e.preventDefault(); handleAddItem(s); }}
                                                        className="w-full text-left p-3 hover:bg-brand-50 flex justify-between items-center border-b border-slate-50 last:border-0 transition-colors group"
                                                    >
                                                        <div>
                                                            <div className="font-bold text-slate-700 text-sm group-hover:text-brand-700">{s.name}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 group-hover:text-brand-500">
                                                                Tồn kho: {s.stock} {s.unit} • Giá vốn: {s.costPrice?.toLocaleString() ?? 0}
                                                            </div>
                                                        </div>
                                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-brand-100 group-hover:text-brand-600 transition-all">
                                                            <Plus size={14}/>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Building size={12}/> Cơ sở / Kho nhập</label>
                        <select 
                            className="w-full border-2 border-slate-200 rounded-xl p-2 text-sm outline-none focus:border-brand-500 font-bold text-slate-700"
                            value={selectedFacility}
                            onChange={e => setSelectedFacility(e.target.value)}
                        >
                            {facilities.map(f => (
                                <option key={f.id} value={f.facilityName}>{f.facilityName}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. Main Table Area */}
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col relative">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    {selectedItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Archive size={48} className="mb-2 opacity-30"/>
                            <p className="text-sm font-medium">Chưa có mặt hàng nào trong phiếu nhập.</p>
                            <p className="text-xs opacity-70">Hãy tìm kiếm và thêm hàng ở trên.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm border-collapse">
                            <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                                <tr>
                                    <th className="p-3 pl-4">Tên hàng</th>
                                    <th className="p-3 text-center">Tồn</th>
                                    <th className="p-3 w-32">Giá nhập</th>
                                    <th className="p-3 w-24">SL Nhập</th>
                                    <th className="p-3 text-right">Thành tiền</th>
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {selectedItems.map((item, idx) => (
                                    <tr key={item.itemId} className="bg-white hover:bg-slate-50 group transition-colors">
                                        <td className="p-3 pl-4">
                                            <div className="font-bold text-slate-800">{item.itemName}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</div>
                                        </td>
                                        <td className="p-3 text-center text-slate-500 font-medium">
                                            {item.currentStock}
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="number" 
                                                className="w-full border border-slate-200 rounded-lg p-1.5 text-right font-medium focus:border-brand-500 outline-none focus:bg-white bg-slate-50 transition-all"
                                                value={item.importPrice}
                                                onChange={e => handleUpdateItem(item.itemId, 'importPrice', Number(e.target.value))}
                                                min={0}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="number" 
                                                className="w-full border border-slate-200 rounded-lg p-1.5 text-center font-black text-brand-700 bg-brand-50 focus:bg-white focus:border-brand-500 outline-none transition-all"
                                                value={item.importQuantity}
                                                onChange={e => handleUpdateItem(item.itemId, 'importQuantity', Number(e.target.value))}
                                                min={1}
                                            />
                                        </td>
                                        <td className="p-3 text-right font-bold text-slate-700">
                                            {(item.importQuantity * item.importPrice).toLocaleString()}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => handleRemoveItem(item.itemId)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                {/* Total Summary Footer inside Table */}
                <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 relative">
                    <div className="text-xs text-slate-500 font-medium">
                        Tổng số lượng: <b className="text-slate-800">{selectedItems.reduce((s, i) => s + i.importQuantity, 0)}</b>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">Tổng tiền hàng:</span>
                        <span className="text-xl font-black text-rose-600">{totalAmount.toLocaleString()} ₫</span>
                    </div>
                </div>
            </div>

            {/* 3. Footer Inputs & Action */}
            <div className="shrink-0 pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ghi chú / Nguồn nhập</label>
                        <input 
                            className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-brand-500 bg-white"
                            placeholder="VD: Nhập từ NPP ABC - Hóa đơn số..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Link ảnh hóa đơn (Evidence)</label>
                        <input 
                            className="w-full border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:border-brand-500 bg-white"
                            placeholder="https://..."
                            value={evidenceUrl}
                            onChange={e => setEvidenceUrl(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 pt-2">
                    <button 
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                    >
                        Hủy
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={selectedItems.length === 0 || isSubmitting}
                        className="flex-[2] py-3 bg-brand-600 text-white font-black rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}
                        LƯU PHIẾU NHẬP ({totalAmount.toLocaleString()} ₫)
                    </button>
                </div>
            </div>
        </div>
    </Modal>
  );
};
