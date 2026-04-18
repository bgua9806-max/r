
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Phone, Search, Star, Users, CreditCard, ChevronRight, Contact, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CustomerDetailModal } from '../components/CustomerDetailModal';

const CRM_TAGS = ['VIP', 'Loyal', 'New', 'Direct', 'OTA-Agoda', 'OTA-Booking', 'Referral', 'Blacklist'];

export const Customers: React.FC = () => {
  const { bookings, guestProfiles } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<{ name: string; phone: string } | null>(null);

  // Group bookings by phone number to create customer profiles
  const customers = useMemo(() => {
    const map = new Map<string, {
      name: string,
      phone: string,
      totalSpent: number,
      visits: number,
      lastVisit: string,
      history: any[]
    }>();

    bookings.forEach(b => {
       const phone = (b.customerPhone || '').trim();
       
       // BỎ QUA: Nếu không có SĐT hợp lệ (trống, quá ngắn, hoặc là số 0 mặc định)
       // Nghĩa là đây là khách vãng lai không để lại thông tin -> không đưa vào CRM
       if (!phone || phone.length < 5 || phone.toLowerCase() === 'unknown' || phone === '0') {
           return; 
       }

       if (!map.has(phone)) {
          map.set(phone, {
             name: b.customerName || 'Khách hàng',
             phone: phone,
             totalSpent: 0,
             visits: 0,
             lastVisit: '',
             history: []
          });
       }
       const cust = map.get(phone)!;
       cust.totalSpent += b.totalRevenue;
       cust.visits += 1;
       cust.history.push(b);
       
       if (!cust.lastVisit || new Date(b.checkinDate) > new Date(cust.lastVisit)) {
          cust.lastVisit = b.checkinDate;
       }
       // Update name if newest booking has different name (sometimes people change names)
       if (b.customerName && new Date(b.checkinDate) > new Date(cust.lastVisit)) {
          cust.name = b.customerName; 
       }
    });

    return Array.from(map.values())
       .map(c => {
           const profile = guestProfiles.find(p => p.phone === c.phone);
           return {
               ...c,
               tags: profile?.tags ? profile.tags.split(',').filter(t => t) : [],
           };
       })
       .sort((a, b) => b.totalSpent - a.totalSpent); // Sort by VIP (spending)

  }, [bookings, guestProfiles]);

  // Derived stats
  const totalCustomers = customers.length;
  const vipCustomers = customers.filter(c => c.totalSpent >= 5000000).length;
  const totalRevenueCRM = customers.reduce((acc, c) => acc + c.totalSpent, 0);

  // Filtered List
  const displayData = useMemo(() => {
      return customers.filter(c => {
          const matchSearch = (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone || '').includes(searchTerm);
          const matchTag = selectedTag ? c.tags.includes(selectedTag) : true;
          return matchSearch && matchTag;
      });
  }, [customers, searchTerm, selectedTag]);

  return (
    <div className="space-y-6 animate-enter pb-20">
       {/* HEADER */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
               <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                   <Contact className="text-brand-600" /> Quản lý Khách hàng
               </h1>
               <p className="text-slate-500 text-sm font-medium">Hồ sơ khách hàng, phân loại mức độ thân thiết và lịch sử lưu trú.</p>
           </div>
           
           <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 w-full md:w-auto">
               <div className="relative group w-full md:w-64 shrink-0">
                   <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-brand-500" size={16} />
                   <input 
                       type="text" 
                       placeholder="Tìm theo tên/SĐT..." 
                       className="pl-9 pr-4 py-2 flex-1 border border-slate-200 rounded-xl w-full text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all shadow-sm bg-white text-slate-900"
                       value={searchTerm}
                       onChange={e => setSearchTerm(e.target.value)}
                   />
               </div>
               
               <div className="relative w-full md:w-40 shrink-0">
                   <select
                       value={selectedTag}
                       onChange={(e) => setSelectedTag(e.target.value)}
                       className="appearance-none pl-4 pr-8 py-2 w-full bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 shadow-sm cursor-pointer text-slate-700 font-medium"
                   >
                       <option value="">Tất cả phân loại</option>
                       {CRM_TAGS.map(tag => (
                           <option key={tag} value={tag}>{tag}</option>
                       ))}
                   </select>
                   <Filter size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
               </div>
           </div>
       </div>

       {/* OVERVIEW DASHBOARD */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           <div className="bg-white p-5 rounded-2xl shadow-soft border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition-transform"><Users size={24}/></div>
               <div>
                   <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">Tổng Khách Hàng</p>
                   <h3 className="text-2xl font-black text-slate-800">{totalCustomers.toLocaleString()}</h3>
               </div>
           </div>
           <div className="bg-white p-5 rounded-2xl shadow-soft border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group ring-1 ring-yellow-400 ring-offset-2">
               <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl group-hover:scale-110 transition-transform"><Star size={24} fill="currentColor"/></div>
               <div>
                   <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">Khách VIP Hạng Thẻ</p>
                   <div className="flex items-baseline gap-2">
                       <h3 className="text-2xl font-black text-slate-800">{vipCustomers.toLocaleString()}</h3>
                       <span className="text-xs text-slate-400 font-medium">(&gt;5tr chi tiêu)</span>
                   </div>
               </div>
           </div>
           <div className="bg-white p-5 rounded-2xl shadow-soft border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group">
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform"><CreditCard size={24}/></div>
               <div>
                   <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-0.5">Tổng Doanh Thu Tệp</p>
                   <h3 className="text-2xl font-black text-emerald-600">{totalRevenueCRM.toLocaleString()} ₫</h3>
               </div>
           </div>
       </div>

       {/* DATA TABLE (DESKTOP) */}
       <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <div className="overflow-x-auto custom-scrollbar max-h-[600px]">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider w-[60px] text-center whitespace-nowrap">Xếp Hạng</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider min-w-[250px]">Khách Hàng</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center w-[120px]">Lượt Đến</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-right w-[180px]">Tổng Chi Tiêu</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider min-w-[200px]">Giao Dịch Gần Nhất</th>
                            <th className="p-4 text-[11px] font-black text-slate-400 uppercase tracking-wider text-center sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)] w-[120px]">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayData.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-12 text-center text-slate-400">
                                    <Contact size={48} className="mx-auto mb-2 opacity-30"/>
                                    <p className="text-sm font-medium">
                                        {searchTerm ? 'Không tìm thấy khách hàng nào phù hợp.' : 'Chưa có thông tin khách hàng.'}
                                    </p>
                                </td>
                            </tr>
                        ) : (
                            displayData.map((cust, idx) => {
                                const isVip = cust.totalSpent >= 5000000;
                                const lastTx = cust.history.sort((a, b) => new Date(b.checkinDate).getTime() - new Date(a.checkinDate).getTime())[0];

                                return (
                                    <tr key={cust.phone} className={`group transition-colors hover:bg-slate-50 ${isVip ? 'bg-amber-50/20' : ''}`}>
                                        <td className="p-4 text-center">
                                            <div className={`mx-auto w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${idx < 3 ? 'bg-gradient-to-tr from-yellow-400 to-amber-500 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
                                                {idx + 1}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-600 font-black text-sm shrink-0 group-hover:bg-brand-50 group-hover:text-brand-600 group-hover:border-brand-200 transition-colors">
                                                    {(cust.name || '?').charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-slate-800 whitespace-nowrap">{cust.name}</h3>
                                                        {isVip && (
                                                            <span className="bg-gradient-to-r from-yellow-200 to-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase flex items-center gap-0.5 shadow-sm border border-amber-300">
                                                                <Star size={8} fill="currentColor" /> VIP
                                                            </span>
                                                        )}
                                                        {cust.tags.map(tag => (
                                                            tag !== 'VIP' && (
                                                                <span key={tag} className="bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase shadow-sm">
                                                                    {tag}
                                                                </span>
                                                            )
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-0.5">
                                                        <Phone size={10} className="text-slate-400"/> {cust.phone}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-slate-100 rounded-lg text-slate-700 font-black text-sm ring-1 ring-slate-200 inset-0">
                                                {cust.visits}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="font-black text-[15px] text-brand-600">
                                                {cust.totalSpent.toLocaleString()} ₫
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {lastTx ? (
                                                <div className="flex flex-col gap-0.5 max-w-[200px]">
                                                    <span className="text-xs font-bold text-slate-700 truncate" title={`${lastTx.facilityName} - ${lastTx.roomCode}`}>
                                                        {lastTx.facilityName} - Phòng {lastTx.roomCode}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {format(parseISO(lastTx.checkinDate), 'dd/MM/yyyy')}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Chưa có lịch sử hợp lệ</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-50 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.02)] transition-colors">
                                            <button onClick={() => setSelectedCustomer({ name: cust.name, phone: cust.phone })} className="flex items-center justify-center gap-1 w-full bg-white border border-slate-200 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                                                Chi Tiết <ChevronRight size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
       </div>

       {/* RESPONSIVE CARDS (MOBILE) */}
       <div className="md:hidden space-y-4">
           {displayData.length === 0 ? (
               <div className="bg-white p-8 rounded-2xl text-center shadow-sm">
                   <Contact size={40} className="mx-auto mb-2 text-slate-300"/>
                   <p className="text-sm font-medium text-slate-500">
                       {searchTerm ? 'Không tìm thấy khách hàng nào.' : 'Chưa có thông tin.'}
                   </p>
               </div>
           ) : (
               displayData.map((cust, idx) => {
                   const isVip = cust.totalSpent >= 5000000;
                   
                   return (
                       <div key={cust.phone} className={`bg-white rounded-2xl shadow-sm border flex flex-col relative overflow-hidden transition-all ${isVip ? 'border-amber-200' : 'border-slate-200'}`}>
                           {isVip && <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-300 to-amber-500 z-10"></div>}
                           
                           <div className="p-4 pl-5">
                               <div className="flex items-start gap-3 mb-3">
                                   <div className="w-11 h-11 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-slate-600 font-black text-[15px] shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
                                       {(cust.name || '?').charAt(0)}
                                   </div>
                                   <div className="flex-1 min-w-0 pt-0.5">
                                       <h3 className="font-bold text-slate-800 leading-tight text-[15px] truncate">{cust.name}</h3>
                                       <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-1">
                                           <Phone size={10} className="text-slate-400"/> {cust.phone}
                                       </div>
                                   </div>
                               </div>

                               <div className="flex flex-wrap gap-1.5 mb-4">
                                   {isVip && (
                                       <span className="bg-gradient-to-r from-yellow-200 to-amber-200 text-amber-800 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase flex items-center gap-1 shadow-sm border border-amber-300">
                                           <Star size={8} fill="currentColor" /> VIP
                                       </span>
                                   )}
                                   {cust.tags.map(tag => (
                                       tag !== 'VIP' && (
                                          <span key={tag} className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase">
                                              {tag}
                                          </span>
                                       )
                                   ))}
                               </div>
                               
                               <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                   <div>
                                       <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Số lượt lưu trú</div>
                                       <div className="font-black text-slate-700 text-sm">{cust.visits} <span className="text-[10px] font-medium text-slate-500">lượt</span></div>
                                   </div>
                                   <div className="text-right border-l border-slate-200 pl-3">
                                       <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Tổng chi tiêu</div>
                                       <div className="font-black text-brand-600 text-sm truncate">{cust.totalSpent.toLocaleString()} ₫</div>
                                   </div>
                               </div>
                           </div>
                           
                           <button onClick={() => setSelectedCustomer({ name: cust.name, phone: cust.phone })} className="w-full py-3.5 bg-slate-50 border-t border-slate-100 text-brand-600 font-bold text-[13px] flex justify-center items-center gap-1.5 hover:bg-slate-100 active:bg-slate-200 transition-colors">
                               Chi Tiết Hồ Sơ <ChevronRight size={14}/>
                           </button>
                       </div>
                   );
               })
           )}
       </div>

       {/* CUSTOMER DETAIL MODAL */}
       {selectedCustomer && (
           <CustomerDetailModal
               isOpen={!!selectedCustomer}
               onClose={() => setSelectedCustomer(null)}
               customerPhone={selectedCustomer.phone}
               customerName={selectedCustomer.name}
           />
       )}
    </div>
  );
};
