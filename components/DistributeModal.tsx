import React, { useState } from 'react';
import { Modal } from './Modal';
import { ServiceItem } from '../types';
import { useAppContext } from '../context/AppContext';
import { Save, ArrowRight, Package, Home, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: ServiceItem;
}

export const DistributeModal: React.FC<Props> = ({ isOpen, onClose, item }) => {
  const { distributeToRooms, notify } = useAppContext();
  const [qty, setQty] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDistribute = async () => {
    if (qty <= 0) {
      notify('error', 'Số lượng phải lớn hơn 0');
      return;
    }
    if (qty > (item.stock || 0)) {
      notify('error', 'Không đủ tồn kho để phân phối');
      return;
    }

    setIsSubmitting(true);
    try {
      await distributeToRooms([{ itemId: item.id, qty }], 'Kho Tổng');
      notify('success', `Đã chuyển ${qty} ${item.unit} vào các phòng.`);
      onClose();
    } catch (e) {
      notify('error', 'Lỗi khi phân phối.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Phân Phối Hàng Vào Phòng" size="sm">
      <div className="space-y-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
           <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vật tư</div>
              <div className="text-lg font-black text-slate-800">{item.name}</div>
           </div>
           <div className="text-right">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kho Sạch</div>
              <div className="text-xl font-black text-emerald-600">{item.stock}</div>
           </div>
        </div>

        <div className="flex items-center gap-4 justify-center py-4">
            <div className="flex flex-col items-center gap-2 text-slate-500">
                <Package size={32} className="text-emerald-500"/>
                <span className="text-xs font-bold uppercase">Kho Tổng</span>
            </div>
            <div className="flex flex-col items-center gap-1">
                <ArrowRight size={24} className="text-slate-300"/>
                <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">Chuyển</span>
            </div>
            <div className="flex flex-col items-center gap-2 text-slate-500">
                <Home size={32} className="text-blue-500"/>
                <span className="text-xs font-bold uppercase">Phòng (Tủ lạnh/Kệ)</span>
            </div>
        </div>

        <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Số lượng phân phối</label>
            <input 
                type="number" 
                className="w-full border-2 border-brand-200 rounded-xl p-3 text-center text-2xl font-black text-brand-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all"
                value={qty > 0 ? qty : ''}
                onChange={e => setQty(Number(e.target.value))}
                placeholder="0"
                autoFocus
            />
            <p className="text-center text-xs text-slate-400 mt-2 font-medium">
                Số lượng này sẽ được trừ khỏi Kho Sạch và cộng vào "Trong Phòng".
            </p>
        </div>

        <div className="flex gap-3 pt-2">
            <button onClick={onClose} disabled={isSubmitting} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-all">
                Hủy
            </button>
            <button 
                onClick={handleDistribute} 
                disabled={isSubmitting || qty <= 0}
                className="flex-[2] py-3 bg-brand-600 text-white font-black rounded-xl shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isSubmitting ? <Loader2 size={20} className="animate-spin"/> : <ArrowRight size={20}/>}
                Xác Nhận Chuyển
            </button>
        </div>
      </div>
    </Modal>
  );
};
