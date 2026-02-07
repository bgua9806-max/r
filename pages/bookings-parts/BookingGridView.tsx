
import React from 'react';
import { ArrowRightLeft, Brush, CheckCircle, LogOut, ShieldCheck, ShoppingCart, Sparkles, Users, XCircle, BedDouble, Shirt, Utensils } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { Booking, Guest, Room } from '../../types';

interface BookingGridViewProps {
  roomMapData: {
      facility: { id: string; facilityName: string };
      rooms: (Room & { 
          currentStatus: string; 
          booking?: Booking; 
          nextBooking?: Booking; 
          task?: any;
          hasLending?: boolean;
          hasService?: boolean;
      })[];
  }[];
  now: Date;
  handleRoomClick: (room: any, facilityName: string) => void;
  handleSwapClick: (booking: Booking, e: React.MouseEvent) => void;
  openBookingAction: (booking: Booking, tab: 'services' | 'payment') => void;
  openBookingCancellation: (booking: Booking) => void;
  handleQuickClean: (room: Room) => void;
}

export const BookingGridView: React.FC<BookingGridViewProps> = ({
  roomMapData,
  now,
  handleRoomClick,
  handleSwapClick,
  openBookingAction,
  openBookingCancellation,
  handleQuickClean
}) => {
  return (
    <div className="flex-1 overflow-auto custom-scrollbar p-2 md:p-4 bg-slate-50">
       {/* ROOM MAP (GRID VIEW) */}
       <div className="space-y-6 md:space-y-8">
           {roomMapData.map((data) => (
               <div key={data.facility.id}>
                   <div className="flex items-center gap-3 mb-3 md:mb-4 sticky top-0 bg-slate-50 py-2 z-10">
                       <div className="w-1 h-6 bg-brand-500 rounded-full"></div>
                       <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm md:text-base">{data.facility.facilityName}</h3>
                       <span className="text-[10px] md:text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.rooms.length} phòng</span>
                   </div>
                   {/* MOBILE OPTIMIZATION: grid-cols-2 on small screens */}
                   <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-4">
                       {data.rooms.map(room => {
                           // Define Colors based on status
                           let headerColor = 'bg-slate-100 border-slate-200 text-slate-600';
                           let bodyBorder = 'border-slate-200';
                           let statusLabel = 'Phòng trống';
                           
                           if (room.currentStatus === 'Occupied') {
                               headerColor = 'bg-emerald-600 border-emerald-600 text-white';
                               bodyBorder = 'border-emerald-200';
                               statusLabel = 'Đang có khách';
                           } else if (room.currentStatus === 'Overdue') {
                               headerColor = 'bg-red-600 border-red-600 text-white animate-pulse';
                               bodyBorder = 'border-red-200 shadow-red-100';
                               statusLabel = 'Quá giờ trả';
                           } else if (room.currentStatus === 'Reserved') { // New Visual for Confirmed Today
                               headerColor = 'bg-blue-600 border-blue-600 text-white';
                               bodyBorder = 'border-blue-200';
                               statusLabel = 'Sắp đến';
                           } else if (room.currentStatus === 'Dirty') {
                               headerColor = 'bg-amber-100 border-amber-200 text-amber-800';
                               bodyBorder = 'border-amber-200';
                               statusLabel = 'Chưa dọn';
                           } else if (room.currentStatus === 'Cleanup') {
                               headerColor = 'bg-blue-100 border-blue-200 text-blue-800';
                               bodyBorder = 'border-blue-200';
                               statusLabel = 'Đang dọn';
                           }

                           const b = room.booking;
                           let percentTime = 0;
                           if (b) {
                               const start = parseISO(b.checkinDate);
                               const end = parseISO(b.checkoutDate);
                               if (isValid(start) && isValid(end)) {
                                   percentTime = Math.min(100, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime()) * 100));
                               }
                           }

                           // Logic tính số lượng khách
                           let guestStats = { total: 0, male: 0, female: 0, other: 0 };
                           if (b && b.guestsJson) {
                               try {
                                   const guests: Guest[] = JSON.parse(b.guestsJson);
                                   guestStats.total = guests.length;
                                   guests.forEach(g => {
                                       const gender = (g.gender || '').toLowerCase();
                                       if (gender.includes('nam')) guestStats.male++;
                                       else if (gender.includes('nữ')) guestStats.female++;
                                       else guestStats.other++;
                                   });
                               } catch (e) {}
                           }

                           return (
                               <div key={room.id} className={`bg-white rounded-xl border-2 shadow-sm flex flex-col overflow-hidden transition-all hover:shadow-lg group ${bodyBorder} relative min-h-[140px] md:min-h-[180px]`}>
                                   
                                   {/* Card Header - Updated with Action Buttons */}
                                   <div className={`px-2 py-2 md:px-4 md:py-3 flex justify-between items-start border-b ${headerColor} relative overflow-hidden`}>
                                       {/* GROUP BADGE */}
                                       {b?.groupName && (
                                           <div className="absolute top-0 left-0 bg-purple-600 text-white text-[8px] md:text-[9px] px-1.5 md:px-2 py-0.5 rounded-br-lg font-bold z-10 shadow-sm uppercase tracking-wider">
                                               {b.groupName}
                                           </div>
                                       )}

                                       <div className={b?.groupName ? 'mt-2 md:mt-3' : ''}>
                                           <div className="flex items-center gap-2">
                                              <div className="text-lg md:text-2xl font-black leading-none">{room.name}</div>
                                              {(room.hasLending || room.hasService) && (
                                                  <div className="flex items-center gap-1">
                                                      {room.hasLending && (
                                                          <div className="bg-blue-50 text-blue-600 p-1 rounded-md shadow-sm border border-blue-100" title="Đang mượn đồ">
                                                              <Shirt size={12} strokeWidth={2.5}/>
                                                          </div>
                                                      )}
                                                      {room.hasService && (
                                                          <div className="bg-orange-50 text-orange-600 p-1 rounded-md shadow-sm border border-orange-100" title="Có dùng dịch vụ">
                                                              <Utensils size={12} strokeWidth={2.5}/>
                                                          </div>
                                                      )}
                                                  </div>
                                              )}
                                           </div>
                                           <div className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1 flex items-center gap-1 whitespace-nowrap">
                                               {statusLabel}
                                               {b?.isDeclared && <ShieldCheck size={10} fill="currentColor" className="text-white hidden md:block"/>}
                                           </div>
                                       </div>
                                       <div className="text-right flex flex-col items-end gap-1">
                                           {/* ACTION GROUP (SWAP ONLY - VISIBLE ON HOVER) */}
                                           {b && (
                                               <div className="flex gap-1 mb-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                                                   <button 
                                                      onClick={(e) => handleSwapClick(b, e)}
                                                      className="p-1 md:p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition-colors shadow-sm"
                                                      title="Đổi phòng"
                                                   >
                                                       <ArrowRightLeft size={12} className="md:w-[14px] md:h-[14px]"/>
                                                   </button>
                                               </div>
                                           )}
                                           
                                           <div className="text-[8px] md:text-[10px] font-bold opacity-80 uppercase hidden md:block">{room.type}</div>
                                       </div>
                                   </div>

                                   {/* Card Body - CLICK TO BOOK */}
                                   <div className="p-2 md:p-4 flex-1 flex flex-col cursor-pointer" onClick={() => handleRoomClick(room, data.facility.facilityName)}>
                                       {b ? (
                                           <div className="space-y-1.5 md:space-y-3">
                                               <div>
                                                   <div className="font-bold text-slate-800 text-xs md:text-sm truncate" title={b.customerName}>{b.customerName}</div>
                                                   
                                                   {/* NEW: Guest Info Badge */}
                                                   {guestStats.total > 0 && (
                                                       <div className="flex items-center gap-2 mt-1 text-[9px] md:text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-md w-fit border border-slate-100 shadow-sm">
                                                           <div className="flex items-center gap-1" title={`${guestStats.total} Khách`}>
                                                               <Users size={10} className="text-slate-400 md:w-[12px] md:h-[12px]"/> {guestStats.total}
                                                           </div>
                                                           {/* Hide detail on mobile to save space */}
                                                           <div className="hidden md:flex items-center gap-0.5 text-blue-600 pl-2 border-l border-slate-200">
                                                               <span className="text-[9px]">Nam</span> {guestStats.male}
                                                           </div>
                                                           <div className="hidden md:flex items-center gap-0.5 text-rose-500 pl-2 border-l border-slate-200">
                                                               <span className="text-[9px]">Nữ</span> {guestStats.female}
                                                           </div>
                                                       </div>
                                                   )}

                                                   <div className="flex justify-between items-center text-[9px] md:text-[10px] text-slate-500 font-medium mt-1">
                                                       <span>{isValid(parseISO(b.checkinDate)) ? format(parseISO(b.checkinDate), 'dd/MM') : '--/--'}</span>
                                                       <span className="text-slate-300">➜</span>
                                                       <span>{isValid(parseISO(b.checkoutDate)) ? format(parseISO(b.checkoutDate), 'dd/MM') : '--/--'}</span>
                                                   </div>
                                               </div>
                                               
                                               {/* Time Progress */}
                                               <div className="h-1 md:h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                   <div className={`h-full ${room.currentStatus === 'Overdue' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width: `${percentTime}%`}}></div>
                                               </div>

                                               {/* Payment Status */}
                                               {b.remainingAmount > 0 ? (
                                                   <div className="bg-red-50 border border-red-100 rounded-lg p-1.5 md:p-2 flex items-center justify-between">
                                                       <div className="text-[9px] md:text-[10px] font-bold text-red-600 uppercase">Chưa TT</div>
                                                       <div className="text-[10px] md:text-xs font-black text-red-700">{(b.remainingAmount/1000).toFixed(0)}k</div>
                                                   </div>
                                               ) : (
                                                   <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-1.5 md:p-2 flex items-center justify-between">
                                                       <div className="text-[9px] md:text-[10px] font-bold text-emerald-600 uppercase">Đã TT</div>
                                                       <div className="text-[10px] md:text-xs font-black text-emerald-700"><CheckCircle size={12}/></div>
                                                   </div>
                                               )}
                                           </div>
                                       ) : (
                                           <div className="flex-1 flex flex-col items-center justify-center text-center py-2 opacity-50 hover:opacity-100 transition-opacity">
                                               {room.currentStatus === 'Dirty' ? (
                                                   <>
                                                       <Brush size={24} className="text-amber-400 mb-1 md:w-[32px] md:h-[32px] md:mb-2"/>
                                                       <span className="text-[10px] md:text-xs font-bold text-amber-600">Cần dọn</span>
                                                   </>
                                               ) : room.currentStatus === 'Cleanup' ? (
                                                   <>
                                                       <Sparkles size={24} className="text-blue-400 mb-1 animate-pulse md:w-[32px] md:h-[32px] md:mb-2"/>
                                                       <span className="text-[10px] md:text-xs font-bold text-blue-600">Đang dọn...</span>
                                                   </>
                                               ) : (
                                                   <>
                                                       <BedDouble size={24} className="text-slate-300 mb-1 md:w-[32px] md:h-[32px] md:mb-2"/>
                                                       <span className="text-[10px] md:text-xs font-bold text-slate-400">Sẵn sàng</span>
                                                       <span className="text-xs md:text-sm font-black text-brand-600 mt-0.5">{(room.price || 0).toLocaleString()}đ</span>
                                                   </>
                                               )}
                                           </div>
                                       )}
                                   </div>

                                   {/* Card Footer Actions */}
                                   <div className="border-t border-slate-100 p-1.5 md:p-2 bg-slate-50/50">
                                       {b ? (
                                           <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                                               <button 
                                                  onClick={(e) => { e.stopPropagation(); openBookingAction(b, 'services'); }}
                                                  className="flex items-center justify-center gap-1 px-1 py-1.5 md:px-2 md:py-2 bg-white border border-blue-100 text-blue-600 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm hover:bg-blue-50 transition-all hover:border-blue-200 uppercase tracking-tight"
                                               >
                                                   <ShoppingCart size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Dịch vụ</span>
                                               </button>
                                               
                                               {b.status === 'Confirmed' ? (
                                                   <button 
                                                      onClick={(e) => { e.stopPropagation(); openBookingCancellation(b); }}
                                                      className="flex items-center justify-center gap-1 px-1 py-1.5 md:px-2 md:py-2 bg-white border border-rose-100 text-rose-600 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm hover:bg-rose-50 transition-all hover:border-rose-200 uppercase tracking-tight"
                                                   >
                                                       <XCircle size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Hủy phòng</span>
                                                   </button>
                                               ) : (
                                                   <button 
                                                      onClick={(e) => { e.stopPropagation(); openBookingAction(b, 'payment'); }}
                                                      className="flex items-center justify-center gap-1 px-1 py-1.5 md:px-2 md:py-2 bg-white border border-rose-100 text-rose-600 rounded-lg text-[9px] md:text-[10px] font-bold shadow-sm hover:bg-rose-50 transition-all hover:border-rose-200 uppercase tracking-tight"
                                                   >
                                                       <LogOut size={12} className="md:w-[14px] md:h-[14px]"/> <span className="hidden sm:inline">Trả phòng</span>
                                                   </button>
                                               )}
                                           </div>
                                       ) : (
                                           <div className="flex">
                                               <button 
                                                  onClick={() => handleQuickClean(room)}
                                                  disabled={room.currentStatus === 'Vacant'}
                                                  className={`flex-1 text-[9px] md:text-[10px] font-bold uppercase py-1.5 rounded transition-all flex items-center justify-center gap-1
                                                      ${room.currentStatus === 'Vacant' ? 'text-slate-300 cursor-not-allowed' : 'bg-white text-emerald-600 shadow-sm border border-emerald-100 hover:bg-emerald-50'}
                                                  `}
                                               >
                                                   <CheckCircle size={12} className="md:w-[12px] md:h-[12px]"/> <span className="hidden sm:inline">Báo sạch</span>
                                               </button>
                                           </div>
                                       )}
                                   </div>
                               </div>
                           )
                       })}
                   </div>
               </div>
           ))}
       </div>
    </div>
  );
};
