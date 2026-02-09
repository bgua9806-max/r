
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { FinanceTransaction } from '../types';
import { 
  format, isSameMonth, parseISO, startOfWeek, endOfWeek, 
  isWithinInterval, isSameDay, addDays, addWeeks, addMonths, 
  startOfMonth, endOfMonth 
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { TransactionModal } from '../components/TransactionModal';
import { Plus, Pencil, Trash2, Calendar, Search, History, Wallet, ArrowDownCircle, ArrowUpCircle, Filter, ChevronLeft, ChevronRight, CheckCircle2, User, Lock, AlertTriangle } from 'lucide-react';
import { ListFilter, FilterOption } from '../components/ListFilter';

type FilterMode = 'day' | 'week' | 'month';

export const Expenses: React.FC = () => {
  const { transactions, deleteTransaction, settings, shifts } = useAppContext();
  const [activeTab, setActiveTab] = useState<'transactions' | 'shifts'>('transactions');
  
  // --- TRANSACTION LOGIC ---
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'REVENUE' | 'EXPENSE'>('All');
  
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const typeOptions: FilterOption[] = [
      { label: 'Tất cả', value: 'All' },
      { label: 'Phiếu Thu', value: 'REVENUE' },
      { label: 'Phiếu Chi', value: 'EXPENSE' }
  ];

  const handleNavigate = (direction: number) => {
      if (filterMode === 'day') setCurrentDate(prev => addDays(prev, direction));
      else if (filterMode === 'week') setCurrentDate(prev => addWeeks(prev, direction));
      else setCurrentDate(prev => addMonths(prev, direction));
  };

  const getRangeLabel = () => {
      if (filterMode === 'day') return format(currentDate, 'dd/MM/yyyy');
      if (filterMode === 'month') return `Tháng ${format(currentDate, 'MM/yyyy')}`;
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM/yyyy')}`;
  };

  const filteredTransactions = useMemo(() => {
     let start: Date, end: Date;

     if (filterMode === 'day') {
         start = new Date(currentDate); start.setHours(0,0,0,0);
         end = new Date(currentDate); end.setHours(23,59,59,999);
     } else if (filterMode === 'week') {
         start = startOfWeek(currentDate, { weekStartsOn: 1 });
         end = endOfWeek(currentDate, { weekStartsOn: 1 });
     } else {
         start = startOfMonth(currentDate);
         end = endOfMonth(currentDate);
     }
     
     return transactions.filter(t => {
        const tDate = parseISO(t.transactionDate);
        
        let matchesTime = false;
        if (filterMode === 'day') matchesTime = isSameDay(tDate, currentDate);
        else matchesTime = isWithinInterval(tDate, { start, end });

        const matchesType = typeFilter === 'All' || t.type === typeFilter;
        
        const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (t.facilityName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (t.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (t.note || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchesTime && matchesType && matchesSearch;
     });
  }, [transactions, currentDate, filterMode, typeFilter, searchTerm]);

  const stats = useMemo(() => {
      let revenue = 0;
      let cashRevenue = 0;
      let transferRevenue = 0;
      
      let expense = 0;
      let cashExpense = 0;
      let transferExpense = 0;

      filteredTransactions.forEach(t => {
          const amt = Number(t.amount);
          // Default to Cash if not specified, consider Card/Transfer as non-cash
          const isCash = t.paymentMethod === 'Cash' || !t.paymentMethod;
          
          if (t.type === 'REVENUE') {
              revenue += amt;
              if (isCash) cashRevenue += amt; else transferRevenue += amt;
          } else {
              expense += amt;
              if (isCash) cashExpense += amt; else transferExpense += amt;
          }
      });
      return { revenue, expense, profit: revenue - expense, cashRevenue, transferRevenue, cashExpense, transferExpense };
  }, [filteredTransactions]);

  const handleAdd = () => {
    setEditingTransaction(null);
    setModalOpen(true);
  };

  const handleEdit = (t: FinanceTransaction) => {
    setEditingTransaction(t);
    setModalOpen(true);
  };

  const getPaymentMethodBadge = (method?: string) => {
      switch (method) {
          case 'Transfer': return <span className="bg-sky-100 text-sky-700 border-sky-200 border px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">CK</span>;
          case 'Card': return <span className="bg-purple-100 text-purple-700 border-purple-200 border px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Thẻ</span>;
          case 'Other': return <span className="bg-slate-100 text-slate-600 border-slate-200 border px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Khác</span>;
          default: return <span className="bg-emerald-100 text-emerald-700 border-emerald-200 border px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">TM</span>; // Cash
      }
  };

  return (
    <div className="space-y-6 animate-enter pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h1 className="text-2xl font-bold text-slate-900">Sổ Quỹ & Dòng Tiền</h1>
            <p className="text-sm text-slate-500">Quản lý thu chi và lịch sử giao ca.</p>
         </div>
         
         <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
             <button 
                onClick={() => setActiveTab('transactions')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'transactions' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <Wallet size={16}/> Sổ Quỹ
             </button>
             <button 
                onClick={() => setActiveTab('shifts')}
                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'shifts' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                 <History size={16}/> Lịch sử Giao Ca
             </button>
         </div>
      </div>

      {activeTab === 'transactions' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6">
            {/* STATS HEADER */}
            <div className="flex flex-col xl:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex gap-4 w-full xl:w-auto overflow-x-auto">
                    <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100"><ArrowUpCircle size={20}/></div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Thu</div>
                            <div className="text-lg font-black text-emerald-600">{stats.revenue.toLocaleString()} ₫</div>
                            <div className="text-[9px] font-bold text-slate-400 flex gap-2">
                                <span className="text-emerald-500">TM: {(stats.cashRevenue/1000).toFixed(0)}k</span>
                                <span className="text-sky-500">CK: {(stats.transferRevenue/1000).toFixed(0)}k</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
                        <div className="p-2 bg-red-50 rounded-lg text-red-600 border border-red-100"><ArrowDownCircle size={20}/></div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Chi</div>
                            <div className="text-lg font-black text-red-600">{stats.expense.toLocaleString()} ₫</div>
                            <div className="text-[9px] font-bold text-slate-400 flex gap-2">
                                <span className="text-red-400">TM: {(stats.cashExpense/1000).toFixed(0)}k</span>
                                <span className="text-sky-400">CK: {(stats.transferExpense/1000).toFixed(0)}k</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg border ${stats.profit >= 0 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                            <Wallet size={20}/>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lợi Nhuận (Kỳ)</div>
                            <div className={`text-lg font-black ${stats.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{stats.profit.toLocaleString()} ₫</div>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => setFilterMode('day')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'day' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Ngày</button>
                        <button onClick={() => setFilterMode('week')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'week' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tuần</button>
                        <button onClick={() => setFilterMode('month')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filterMode === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Tháng</button>
                    </div>

                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                        <button onClick={() => handleNavigate(-1)} className="p-2 hover:bg-white text-slate-500 border-r border-slate-200 transition-colors"><ChevronLeft size={18}/></button>
                        <div className="px-4 py-2 text-sm font-bold text-slate-700 min-w-[140px] text-center flex items-center justify-center gap-2">
                            <Calendar size={14} className="text-slate-400"/>
                            {getRangeLabel()}
                        </div>
                        <button onClick={() => handleNavigate(1)} className="p-2 hover:bg-white text-slate-500 border-l border-slate-200 transition-colors"><ChevronRight size={18}/></button>
                    </div>

                    <button onClick={handleAdd} className="w-full md:w-auto bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-700 transition-all shadow-lg shadow-brand-100 active:scale-95 whitespace-nowrap">
                        <Plus size={20} /> <span className="hidden md:inline">Tạo giao dịch</span>
                    </button>
                </div>
            </div>

            <ListFilter 
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                options={typeOptions}
                selectedFilter={typeFilter}
                onFilterChange={setTypeFilter as any}
                placeholder="Tìm kiếm giao dịch..."
            />

            {/* TRANSACTION LIST */}
            <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/50 border-b border-slate-100 text-slate-500 uppercase font-extrabold text-[10px] tracking-widest">
                        <tr>
                            <th className="p-4">Ngày</th>
                            <th className="p-4 text-center">Loại</th>
                            <th className="p-4">Danh mục / Cơ sở</th>
                            <th className="p-4">Nội dung</th>
                            <th className="p-4 text-center">Hình thức</th>
                            <th className="p-4 text-right">Số tiền</th>
                            <th className="p-4 text-center">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredTransactions.sort((a,b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()).map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="p-4">
                                    <div className="font-bold text-slate-700">{format(parseISO(t.transactionDate), 'dd/MM/yyyy')}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">ID: {t.id}</div>
                                </td>
                                <td className="p-4 text-center">
                                    {t.type === 'REVENUE' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
                                            <ArrowUpCircle size={10}/> THU
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black border border-red-100">
                                            <ArrowDownCircle size={10}/> CHI
                                        </span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="text-slate-800 font-bold text-xs">{t.facilityName || 'Toàn hệ thống'}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{t.category}</div>
                                </td>
                                <td className="p-4">
                                    <div className="text-slate-800 font-bold">{t.description}</div>
                                    {t.note && <div className="text-xs text-slate-400 mt-1 italic line-clamp-1">{t.note}</div>}
                                    <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1 uppercase font-bold tracking-wider">
                                        <User size={8}/> {t.pic || t.created_by || 'System'}
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    {getPaymentMethodBadge(t.paymentMethod)}
                                </td>
                                <td className={`p-4 text-right font-black text-lg ${t.type === 'REVENUE' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {t.type === 'REVENUE' ? '+' : '-'}{Number(t.amount).toLocaleString()} ₫
                                </td>
                                <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <button onClick={() => handleEdit(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Sửa">
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => { if(confirm('Xóa giao dịch này?')) deleteTransaction(t.id); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Xóa">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredTransactions.length === 0 && (
                            <tr>
                                <td colSpan={7} className="p-12 text-center text-slate-400 italic">Không tìm thấy giao dịch nào.</td>
                            </tr>
                        )}
                    </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'shifts' && (
          <div className="animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
                  <div className="p-4 border-b border-slate-100 text-sm font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Lịch sử giao ca & Bàn giao quỹ</div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="p-4 uppercase text-[10px] font-bold text-slate-500 tracking-wider">Thời gian (Ca)</th>
                              <th className="p-4 uppercase text-[10px] font-bold text-slate-500 tracking-wider">Nhân sự thực hiện</th>
                              <th className="p-4 uppercase text-[10px] font-bold text-slate-500 tracking-wider text-right">Dòng tiền trong ca</th>
                              <th className="p-4 uppercase text-[10px] font-bold text-slate-500 tracking-wider text-right">Kết sắt (Bàn giao)</th>
                              <th className="p-4 uppercase text-[10px] font-bold text-slate-500 tracking-wider text-center">Trạng thái</th>
                              <th className="p-4 uppercase text-[10px] font-bold text-slate-500 tracking-wider">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {shifts.filter(s => s.status === 'Closed').map(s => {
                               const start = parseISO(s.start_time);
                               const end = s.end_time ? parseISO(s.end_time) : new Date();
                               const diff = (s.difference || 0);
                               
                               return (
                                 <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-700 flex items-center gap-2">
                                            {format(start, 'HH:mm')} <span className="text-slate-400 text-[10px]">➜</span> {format(end, 'HH:mm')}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1 font-medium">{format(start, 'dd/MM/yyyy')}</div>
                                    </td>
                                    
                                    <td className="p-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2 text-xs">
                                                <div className="p-1 bg-blue-50 text-blue-600 rounded-full"><User size={12}/></div>
                                                <span className="text-slate-700">Mở: <span className="font-bold">{s.staff_name}</span></span>
                                            </div>
                                            {s.closed_by_name && (
                                                <div className="flex items-center gap-2 text-xs opacity-70">
                                                    <div className="p-1 bg-slate-100 text-slate-500 rounded-full"><Lock size={12}/></div>
                                                    <span className="text-slate-600">Chốt: <span className="font-bold">{s.closed_by_name}</span></span>
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="p-4 text-right">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-emerald-600 font-bold text-xs">+ {(s.total_revenue_cash || 0).toLocaleString()}</div>
                                            <div className="text-red-500 font-bold text-xs">- {(s.total_expense_cash || 0).toLocaleString()}</div>
                                        </div>
                                    </td>

                                    <td className="p-4 text-right">
                                        <div className="flex flex-col gap-1 items-end">
                                            <div className="text-[10px] text-slate-400 font-medium">Lý thuyết: {(s.end_cash_expected || 0).toLocaleString()}</div>
                                            <div className="text-base font-black text-slate-800">{(s.end_cash_actual || 0).toLocaleString()} ₫</div>
                                        </div>
                                    </td>

                                    <td className="p-4 text-center">
                                        {diff === 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black border border-emerald-100 uppercase tracking-wide">
                                                <CheckCircle2 size={12}/> Khớp
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black border border-red-100 uppercase tracking-wide">
                                                <AlertTriangle size={12}/> Lệch {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                            </span>
                                        )}
                                    </td>

                                    <td className="p-4">
                                        <div className={`text-xs ${s.note ? 'text-slate-600' : 'text-slate-300 italic'}`}>
                                            {s.note || 'Không có ghi chú'}
                                        </div>
                                    </td>
                                 </tr>
                               );
                            })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      <TransactionModal 
         isOpen={isModalOpen} 
         onClose={() => setModalOpen(false)} 
         transaction={editingTransaction} 
      />
    </div>
  );
};
