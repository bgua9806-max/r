
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { useAppContext } from '../context/AppContext';
import { ServiceItem } from '../types';
import { ArrowRight, ArrowLeft, AlertTriangle, Loader2, Save, Shirt, Search, CheckCircle2, Truck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'SEND' | 'RECEIVE', items: { itemId: string; quantity: number; damage: number }[]) => Promise<void>;
}

export const LaundryTicketModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const { services, notify } = useAppContext();
  const [mode, setMode] = useState<'SEND' | 'RECEIVE'>('SEND');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [damages, setDamages] = useState<Record<string, number>>({}); // Only for RECEIVE
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Focus ref for search
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantities({});
      setDamages({});
      setSearchTerm('');
      setMode('SEND');
      setIsSubmitting(false);
      // Auto focus search
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const linenItems = useMemo(() => {
    return services.filter(s => 
      s.category === 'Linen' && 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [services, searchTerm]);

  const handleQuantityChange = (itemId: string, val: string, max: number) => {
    let qty = parseInt(val) || 0;
    if (qty < 0) qty = 0;
    // Cap at available stock
    if (qty > max) qty = max;
    
    setQuantities(prev => ({ ...prev, [itemId]: qty }));
  };

  const handleDamageChange = (itemId: string, val: string, maxReceived: number) => {
    let qty = parseInt(val) || 0;
    if (qty < 0) qty = 0;
    if (qty > maxReceived) qty = maxReceived;
    
    setDamages(prev => ({ ...prev, [itemId]: qty }));
  };

  const handleSubmit = async () => {
    const itemsToProcess = Object.entries(quantities)
      .map(([id, q]) => ({ id, qty: Number(q) }))
      .filter(({ qty }) => qty > 0)
      .map(({ id, qty }) => ({
        itemId: id,
        quantity: qty,
        damage: Number(damages[id] || 0)
      }));

    if (itemsToProcess.length === 0) {
      notify('error', 'Chưa chọn vật tư nào.');
      return;
    }

    setIsSubmitting(true);
    await onConfirm(mode, itemsToProcess);
    setIsSubmitting(false);
    onClose();
  };

  const totalSelected = (Object.values(quantities) as number[]).reduce((a, b) => a + b, 0);
  const totalDamaged = (Object.values(damages) as number[]).reduce((a, b) => a + b, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phiếu Giao Nhận Giặt Ủi (Công Nợ)" size="xl">
        <div className="flex flex-col h-[80vh] md:h-[700px]">
            {/* Header / Mode Switcher */}
            <div className="shrink-0 space-y-4 mb-4">
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => { setMode('SEND'); setQuantities({}); setDamages({}); }}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'SEND' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Truck size={18} /> Gửi đi giặt (Kho Bẩn &rarr; Nhà Giặt)
                    </button>
                    <button 
                        onClick={() => { setMode('RECEIVE'); setQuantities({}); setDamages({}); }}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${mode === 'RECEIVE' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <ArrowLeft size={18} /> Nhận đồ sạch (Nhà Giặt &rarr; Kho Sạch)
                    </button>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        ref={searchRef}
                        className="w-full pl-10 pr-4 py-2 border-2 border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-brand-500 transition-all bg-white"
                        placeholder="Tìm tên đồ vải..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* List Area */}
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col relative">
                <div className="overflow-y-auto custom-scrollbar flex-1">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 text-slate-500 font-black uppercase text-[10px] tracking-widest sticky top-0 z-10 shadow-sm border-b border-slate-200">
                            <tr>
                                <th className="p-3 pl-4 w-[40%]">Tên Đồ Vải</th>
                                <th className="p-3 text-center">
                                    {mode === 'SEND' ? 'Kho Bẩn (Tại KS)' : 'Tại Xưởng (Công Nợ)'}
                                </th>
                                <th className="p-3 text-center w-24">SL Giao/Nhận</th>
                                {mode === 'RECEIVE' && <th className="p-3 text-center w-24 text-rose-600">Hỏng/Rách</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {linenItems.map(item => {
                                // Updated Logic: 
                                // SEND: Max = laundryStock (Dirty items at Hotel)
                                // RECEIVE: Max = vendor_stock (Items held by Vendor)
                                const maxQty = mode === 'SEND' ? (item.laundryStock || 0) : (item.vendor_stock || 0);
                                const currentQty = quantities[item.id] || '';
                                const currentDmg = damages[item.id] || '';
                                const currentQtyValue = quantities[item.id] || 0;
                                const isSelected = currentQtyValue > 0;

                                return (
                                    <tr key={item.id} className={`transition-colors ${isSelected ? 'bg-white' : 'hover:bg-white/50'}`}>
                                        <td className="p-3 pl-4">
                                            <div className="font-bold text-slate-800">{item.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</div>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`font-mono font-bold text-xs px-2 py-1 rounded ${maxQty === 0 ? 'bg-slate-200 text-slate-500' : 'bg-white border border-slate-200 text-slate-700'}`}>
                                                {maxQty}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <input 
                                                type="number" 
                                                className={`w-full border-2 rounded-lg p-1.5 text-center font-bold outline-none transition-all ${isSelected ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white focus:border-brand-300'}`}
                                                placeholder="0"
                                                value={currentQty}
                                                onChange={e => handleQuantityChange(item.id, e.target.value, maxQty)}
                                                onFocus={(e) => e.target.select()}
                                                disabled={maxQty === 0}
                                            />
                                        </td>
                                        {mode === 'RECEIVE' && (
                                            <td className="p-3 text-center">
                                                <input 
                                                    type="number" 
                                                    className="w-full border-2 border-slate-200 rounded-lg p-1.5 text-center font-bold outline-none focus:border-rose-400 bg-white text-rose-600 placeholder-slate-300"
                                                    placeholder="0"
                                                    value={currentDmg}
                                                    onChange={e => handleDamageChange(item.id, e.target.value, quantities[item.id] || 0)}
                                                    disabled={!isSelected}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {linenItems.length === 0 && (
                                <tr>
                                    <td colSpan={mode === 'RECEIVE' ? 4 : 3} className="p-8 text-center text-slate-400 italic">
                                        Không tìm thấy đồ vải nào.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Summary Bar */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 relative">
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-500 font-medium">
                            Tổng món: <b className="text-slate-800 text-lg ml-1">{totalSelected}</b>
                        </div>
                        {mode === 'RECEIVE' && totalDamaged > 0 && (
                            <div className="text-xs text-rose-600 font-bold flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100">
                                <AlertTriangle size={12}/> Hỏng: {totalDamaged}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="shrink-0 pt-4 flex gap-3">
                <button 
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                    Hủy
                </button>
                <button 
                    onClick={handleSubmit}
                    disabled={totalSelected === 0 || isSubmitting}
                    className={`flex-[2] py-3 text-white font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${mode === 'SEND' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : (mode === 'SEND' ? <Truck size={20}/> : <CheckCircle2 size={20}/>)}
                    {mode === 'SEND' ? 'XÁC NHẬN GỬI ĐI' : 'XÁC NHẬN NHẬP KHO'}
                </button>
            </div>
        </div>
    </Modal>
  );
};
