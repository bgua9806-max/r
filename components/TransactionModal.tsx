
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { FinanceTransaction } from '../types';
import { useAppContext } from '../context/AppContext';
import { ArrowDownCircle, ArrowUpCircle, Wallet, CreditCard, Banknote } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transaction?: FinanceTransaction | null;
}

const REVENUE_CATEGORIES = [
    'Tiền phòng',
    'Tiền Minibar',
    'Tiền nâng cấp phòng',
    'Tiền mất thẻ',
    'Tiền cọc',
    'Tiền book thêm phòng',
    'Tiền giặt ủi',
    'Tiền phụ thu (In sớm/Out trễ)',
    'Thu khác'
];

export const TransactionModal: React.FC<Props> = ({ isOpen, onClose, transaction }) => {
  const { addTransaction, updateTransaction, facilities, settings, notify } = useAppContext();
  
  // Set default category to the first item in the detailed list if Revenue
  const [form, setForm] = useState<Partial<FinanceTransaction>>({
     transactionDate: new Date().toISOString().substring(0, 10),
     amount: 0,
     facilityId: '',
     category: REVENUE_CATEGORIES[0],
     description: '',
     note: '',
     type: 'EXPENSE',
     status: 'Verified',
     paymentMethod: 'Cash'
  });

  useEffect(() => {
    if (transaction) {
        setForm(transaction);
    } else {
        setForm({
            transactionDate: new Date().toISOString().substring(0, 10),
            amount: 0,
            facilityId: facilities[0]?.id || '',
            category: settings.expense_categories[0] || 'Khác',
            description: '',
            note: '',
            type: 'EXPENSE',
            status: 'Verified',
            paymentMethod: 'Cash'
        });
    }
  }, [transaction, isOpen, facilities, settings]);

  const handleTypeChange = (newType: 'REVENUE' | 'EXPENSE') => {
      setForm(prev => ({
          ...prev,
          type: newType,
          category: newType === 'REVENUE' ? REVENUE_CATEGORIES[0] : (settings.expense_categories[0] || 'Khác'),
          description: '' // Reset description when switching type
      }));
  };

  const handleCategoryChange = (newCategory: string) => {
      setForm(prev => ({
          ...prev,
          category: newCategory,
          // Auto-fill description based on category if it's currently empty or generic
          description: (prev.type === 'REVENUE' && (!prev.description || prev.description.startsWith('Thu ')))
              ? `Thu ${newCategory}`
              : prev.description
      }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.facilityId || !form.category) {
        notify('error', 'Vui lòng điền đủ thông tin bắt buộc');
        return;
    }

    const facilityName = facilities.find(f => f.id === form.facilityId)?.facilityName;

    // Ensure description is filled if empty
    const finalDescription = form.description || (form.type === 'REVENUE' ? `Thu ${form.category}` : `Chi ${form.category}`);

    const data: FinanceTransaction = {
      id: transaction?.id || `TR-${Date.now()}`,
      transactionDate: form.transactionDate!,
      amount: Number(form.amount),
      type: form.type!,
      category: form.category!,
      description: finalDescription,
      status: form.status || 'Verified',
      facilityId: form.facilityId!,
      facilityName: facilityName,
      note: form.note || '',
      paymentMethod: form.paymentMethod || 'Cash'
    };

    if (transaction) updateTransaction(data);
    else addTransaction(data);

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={transaction ? 'Sửa Giao Dịch' : 'Thêm Giao Dịch Mới'} size="md">
      <form id="transForm" onSubmit={handleSubmit} className="space-y-4">
        {/* Type Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
                type="button"
                onClick={() => handleTypeChange('REVENUE')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${form.type === 'REVENUE' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
            >
                <ArrowUpCircle size={16}/> Phiếu Thu
            </button>
            <button 
                type="button"
                onClick={() => handleTypeChange('EXPENSE')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${form.type === 'EXPENSE' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
            >
                <ArrowDownCircle size={16}/> Phiếu Chi
            </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ngày giao dịch</label>
              <input type="date" required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-bold outline-none focus:border-brand-500" value={form.transactionDate} onChange={e => setForm({...form, transactionDate: e.target.value})} />
           </div>
           <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số tiền</label>
              <input type="number" required className={`w-full border-2 border-slate-100 rounded-xl p-3 bg-white font-black text-lg outline-none focus:border-brand-500 ${form.type === 'REVENUE' ? 'text-emerald-600' : 'text-red-600'}`} value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
           </div>
        </div>

        {/* Payment Method Selector */}
        <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hình thức thanh toán</label>
            <div className="grid grid-cols-4 gap-2">
                {[
                    { id: 'Cash', label: 'Tiền mặt' },
                    { id: 'Transfer', label: 'CK' },
                    { id: 'Card', label: 'Thẻ' },
                    { id: 'Other', label: 'Khác' }
                ].map(m => (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => setForm({...form, paymentMethod: m.id})}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${form.paymentMethod === m.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
           <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cơ sở</label>
              <select required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-bold outline-none focus:border-brand-500" value={form.facilityId} onChange={e => setForm({...form, facilityId: e.target.value})}>
                 {facilities.map(f => <option key={f.id} value={f.id}>{f.facilityName}</option>)}
              </select>
           </div>
           <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Danh mục</label>
              {form.type === 'REVENUE' ? (
                  <select 
                    className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-bold outline-none focus:border-brand-500" 
                    value={form.category} 
                    onChange={e => handleCategoryChange(e.target.value)}
                  >
                      {REVENUE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                      ))}
                  </select>
              ) : (
                  <select required className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-bold outline-none focus:border-brand-500" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                     {settings.expense_categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
              )}
           </div>
        </div>

        <div>
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nội dung</label>
           <input 
                type="text" 
                className="w-full border-2 border-slate-100 rounded-xl p-3 bg-white text-slate-900 font-medium outline-none focus:border-brand-500" 
                placeholder={form.type === 'REVENUE' ? "VD: Thu tiền phòng 101..." : "Ví dụ: Mua nước tẩy rửa..."}
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
           />
        </div>

        <div>
           <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ghi chú thêm</label>
           <textarea className="w-full border-2 border-slate-100 rounded-xl p-3 h-20 bg-white text-slate-900 font-medium outline-none focus:border-brand-500" value={form.note} onChange={e => setForm({...form, note: e.target.value})}></textarea>
        </div>
      </form>
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
         <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl uppercase text-xs tracking-widest">Hủy</button>
         <button form="transForm" type="submit" className={`px-6 py-2.5 text-white rounded-xl hover:bg-opacity-90 font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all ${form.type === 'REVENUE' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-red-600 shadow-red-200'}`}>
             {form.type === 'REVENUE' ? 'Lưu Phiếu Thu' : 'Lưu Phiếu Chi'}
         </button>
      </div>
    </Modal>
  );
};
