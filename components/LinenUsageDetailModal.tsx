
import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { ServiceItem } from '../types';
import { useAppContext } from '../context/AppContext';
import { format, parseISO } from 'date-fns';
import { Shirt, ClipboardCheck, AlertTriangle, CheckCircle2, AlertOctagon, Search, BedDouble } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: ServiceItem | null;
}

export const LinenUsageDetailModal: React.FC<Props> = ({ isOpen, onClose, item }) => {
  const { bookings, rooms, roomRecipes } = useAppContext();
  const [activeTab, setActiveTab] = useState<'lending' | 'audit'>('lending');

  const lendingDetails = useMemo(() => {
    if (!item) return [];
    const details: { room: string; customer: string; qty: number; dates: string }[] = [];

    // Filter active bookings (CheckedIn)
    bookings.filter(b => b.status === 'CheckedIn').forEach(b => {
      try {
        const lends = JSON.parse(b.lendingJson || '[]');
        const found = lends.find((l: any) => l.item_id === item.id);
        if (found && Number(found.quantity) > 0) {
          details.push({
            room: b.roomCode,
            customer: b.customerName,
            qty: Number(found.quantity),
            dates: `${format(parseISO(b.checkinDate), 'dd/MM')} - ${format(parseISO(b.checkoutDate), 'dd/MM')}`
          });
        }
      } catch (e) {}
    });
    return details;
  }, [bookings, item]);

  const auditData = useMemo(() => {
    if (!item) return null;
    let standardDemand = 0;

    // Calculate Standard Demand based on Rooms & Recipes
    rooms.forEach(room => {
      if (room.type && roomRecipes[room.type]) {
        const recipeItem = roomRecipes[room.type].items.find(i => i.itemId === item.id);
        if (recipeItem) {
          standardDemand += Number(recipeItem.quantity);
        }
      }
    });

    const lendingTotal = lendingDetails.reduce((sum, d) => sum + d.qty, 0);
    const totalRequired = standardDemand + lendingTotal;
    const actualAssets = Number(item.totalassets) || 0;
    const variance = actualAssets - totalRequired; // > 0: Surplus, < 0: Shortage

    return { standardDemand, lendingTotal, totalRequired, actualAssets, variance };
  }, [rooms, roomRecipes, item, lendingDetails]);

  if (!item || !auditData) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Chi tiết: ${item.name}`} size="md">
       <div className="flex flex-col h-[500px]">
           {/* Item Summary Header */}
           <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4 shrink-0">
               <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                   <Shirt size={24}/>
               </div>
               <div>
                   <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{item.category}</div>
                   <div className="text-lg font-black text-slate-800">{item.name}</div>
               </div>
               <div className="ml-auto text-right">
                   <div className="text-xs font-bold text-slate-400 uppercase">Tổng Tài Sản</div>
                   <div className="text-xl font-black text-brand-600">{auditData.actualAssets}</div>
               </div>
           </div>

           {/* Tabs */}
           <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 mb-4">
               <button 
                   onClick={() => setActiveTab('lending')}
                   className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'lending' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                   <BedDouble size={14}/> Khách Mượn ({lendingDetails.length})
               </button>
               <button 
                   onClick={() => setActiveTab('audit')}
                   className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'audit' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
               >
                   <ClipboardCheck size={14}/> Đối Soát Định Mức
               </button>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-y-auto custom-scrollbar border rounded-xl bg-white border-slate-100 relative">
               {activeTab === 'lending' ? (
                   <table className="w-full text-left text-sm">
                       <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase sticky top-0 z-10">
                           <tr>
                               <th className="p-3">Phòng</th>
                               <th className="p-3">Khách hàng</th>
                               <th className="p-3 text-center">SL Mượn</th>
                               <th className="p-3 text-right">Thời gian</th>
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                           {lendingDetails.length === 0 ? (
                               <tr>
                                   <td colSpan={4} className="p-8 text-center text-slate-400 italic">
                                       <Search size={32} className="mx-auto mb-2 opacity-50"/>
                                       Hiện không có phòng nào mượn thêm món này.
                                   </td>
                               </tr>
                           ) : (
                               lendingDetails.map((detail, idx) => (
                                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                       <td className="p-3 font-black text-blue-600">{detail.room}</td>
                                       <td className="p-3 font-medium text-slate-700">{detail.customer}</td>
                                       <td className="p-3 text-center font-bold text-slate-800">{detail.qty}</td>
                                       <td className="p-3 text-right text-xs text-slate-500 font-mono">{detail.dates}</td>
                                   </tr>
                               ))
                           )}
                       </tbody>
                   </table>
               ) : (
                   <div className="p-4 space-y-4">
                       <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                           <div>
                               <div className="text-xs font-bold text-blue-600 uppercase">Nhu cầu chuẩn (Setup phòng)</div>
                               <div className="text-sm text-blue-800 mt-1">Tổng định mức tất cả phòng</div>
                           </div>
                           <div className="text-2xl font-black text-blue-700">{auditData.standardDemand}</div>
                       </div>

                       <div className="flex justify-center text-slate-300">
                           <span className="font-black text-xl">+</span>
                       </div>

                       <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex items-center justify-between">
                           <div>
                               <div className="text-xs font-bold text-purple-600 uppercase">Đang cho mượn thêm</div>
                               <div className="text-sm text-purple-800 mt-1">Tổng SL khách đang giữ (Tab bên)</div>
                           </div>
                           <div className="text-2xl font-black text-purple-700">{auditData.lendingTotal}</div>
                       </div>

                       <div className="h-px bg-slate-200 my-2"></div>

                       <div className="flex justify-between items-center px-2">
                           <span className="font-bold text-slate-600">Tổng cần thiết (Lý thuyết):</span>
                           <span className="font-black text-xl text-slate-800">{auditData.totalRequired}</span>
                       </div>

                       <div className="flex justify-between items-center px-2">
                           <span className="font-bold text-slate-600">Tổng tài sản (Thực tế):</span>
                           <span className="font-black text-xl text-brand-600">{auditData.actualAssets}</span>
                       </div>

                       <div className={`p-4 rounded-xl border-2 flex items-center gap-3 ${auditData.variance >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'}`}>
                           <div className={`p-2 rounded-full ${auditData.variance >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                               {auditData.variance >= 0 ? <CheckCircle2 size={24}/> : <AlertTriangle size={24}/>}
                           </div>
                           <div className="flex-1">
                               <div className="text-xs font-black uppercase tracking-wider">{auditData.variance >= 0 ? 'ĐỦ HÀNG / DƯ DỰ PHÒNG' : 'THIẾU SO VỚI NHU CẦU'}</div>
                               <div className="text-sm font-medium mt-0.5">
                                   {auditData.variance >= 0 
                                       ? `Hiện dư ${auditData.variance} cái so với nhu cầu tối đa.` 
                                       : `Đang thiếu ${Math.abs(auditData.variance)} cái. Cần nhập thêm!`}
                               </div>
                           </div>
                           <div className="text-3xl font-black">{auditData.variance > 0 ? '+' : ''}{auditData.variance}</div>
                       </div>
                   </div>
               )}
           </div>
       </div>
    </Modal>
  );
};
