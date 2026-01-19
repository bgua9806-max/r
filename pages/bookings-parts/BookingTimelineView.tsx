
import React, { LegacyRef } from 'react';
import { format, isSameDay, isWeekend, endOfDay, parseISO, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { Booking } from '../../types';
import { CalendarViewMode } from '../../hooks/useBookingLogic';

interface BookingTimelineViewProps {
  dateRange: { start: Date; end: Date; columns: Date[] };
  timelineRows: any[];
  viewConfig: { minWidth: number; colLabel: string };
  calendarMode: CalendarViewMode;
  now: Date;
  currentDate: Date;
  getBookingsForRow: (facility: string, room: string) => Booking[];
  getCurrentTimePositionPercent: () => number;
  getBookingStyle: (b: Booking, isActiveTime: boolean) => string;
  onBookingClick: (b: Booking) => void;
  scrollContainerRef: LegacyRef<HTMLDivElement>;
}

export const BookingTimelineView: React.FC<BookingTimelineViewProps> = ({
  dateRange,
  timelineRows,
  viewConfig,
  calendarMode,
  now,
  currentDate,
  getBookingsForRow,
  getCurrentTimePositionPercent,
  getBookingStyle,
  onBookingClick,
  scrollContainerRef
}) => {
  return (
    <div className="flex-1 overflow-auto relative custom-scrollbar" ref={scrollContainerRef}>
       {/* Sticky Header */}
       <div 
         className="sticky top-0 z-30 bg-white border-b border-slate-200 flex" 
         style={{ minWidth: `${viewConfig.minWidth}px` }}
       >
         {/* Corner Cell */}
         <div className="w-16 md:w-48 shrink-0 p-2 md:p-3 font-bold text-slate-700 border-r border-slate-200 bg-slate-50 sticky left-0 z-40 shadow-[4px_0_10px_rgba(0,0,0,0.02)] flex items-center justify-center">
            <span className="text-[10px] md:text-xs uppercase tracking-widest text-slate-400 text-center">Phòng<span className="hidden md:inline"> / Giờ</span></span>
         </div>

         {/* Time Columns Header */}
         <div className="flex-1 flex divide-x divide-slate-100">
           {dateRange.columns.map(col => {
             const isToday = isSameDay(col, new Date());
             const isWknd = isWeekend(col);
             const isCurrentHour = calendarMode === 'Day' && isToday && col.getHours() === now.getHours();

             return (
               <div 
                  key={col.toISOString()} 
                  className={`
                      flex-1 text-center py-2 text-xs font-bold border-b border-slate-100 relative group
                      ${isToday && calendarMode !== 'Day' ? 'bg-blue-50/30' : isWknd ? 'bg-slate-50/50' : ''} 
                      ${isCurrentHour ? 'bg-red-50 text-red-600' : 'text-slate-600'}
                  `}
               >
                 <div className="relative z-10">
                     {calendarMode === 'Day' ? format(col, 'HH:mm') : format(col, 'dd/MM')}
                     {calendarMode === 'Week' && <div className="text-[9px] font-normal text-slate-400 uppercase mt-0.5">{format(col, 'EEEE', {locale: vi})}</div>}
                 </div>
                 <div className="absolute top-full left-1/2 w-[1px] h-[1000px] bg-brand-500/20 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none z-0"></div>
               </div>
             );
           })}
         </div>
       </div>

       {/* Timeline Body */}
       <div 
          className="relative bg-[linear-gradient(90deg,transparent_49%,rgba(241,245,249,0.5)_50%,transparent_51%)] bg-[length:calc(100%/24)_100%]" 
          style={{ 
              minWidth: `${viewConfig.minWidth}px`,
              backgroundSize: calendarMode === 'Day' ? `calc(100% / 24) 100%` : 
                              calendarMode === 'Week' ? `calc(100% / 7) 100%` : 
                              `calc(100% / ${dateRange.columns.length}) 100%`
          }}
       >
         
         {/* GLOBAL CURRENT TIME RED LINE */}
         {isSameDay(currentDate, now) && (
            <div className="absolute inset-0 flex pointer-events-none z-20">
                <div className="w-16 md:w-48 shrink-0"></div>
                <div className="flex-1 relative h-full">
                    <div 
                      className="absolute top-0 bottom-0 w-[2px] bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] transition-all duration-1000 ease-linear"
                      style={{ left: `${getCurrentTimePositionPercent()}%` }}
                    >
                       <div className="absolute -top-[5px] -translate-x-1/2 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-50">
                          {format(now, 'HH:mm')}
                       </div>
                       <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>
                </div>
            </div>
         )}

         {timelineRows.map((row, idx) => {
           if(row.type === 'facility') return (
             <div key={idx} className="bg-slate-100/90 backdrop-blur-sm px-4 py-2 font-bold text-sm text-slate-800 border-y border-slate-200 sticky left-0 z-20 w-full text-left uppercase tracking-wider shadow-sm">
               {row.name}
             </div>
           );

           return (
             <div key={idx} className="flex border-b border-slate-100 min-h-[60px] md:min-h-[80px] hover:bg-slate-50/50 transition-colors group relative">
               <div className={`
                  w-16 md:w-48 shrink-0 border-r border-slate-200 p-1 md:p-3 flex flex-col justify-center sticky left-0 z-20 transition-all shadow-[4px_0_5px_rgba(0,0,0,0.01)] group-hover:bg-white text-center md:text-left
                  ${row.status === 'Đã dọn' ? 'bg-white' : row.status === 'Bẩn' ? 'bg-red-50/50' : row.status === 'Đang dọn' ? 'bg-blue-50/50' : 'bg-yellow-50/50'}
               `}>
                 <div className="flex flex-col md:flex-row md:justify-between items-center mb-1">
                    <span className="font-bold text-xs md:text-lg text-slate-800 break-all">{row.code}</span>
                    <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full mt-1 md:mt-0 ${row.status === 'Đã dọn' ? 'bg-green-500' : row.status === 'Bẩn' ? 'bg-red-500' : row.status === 'Đang dọn' ? 'bg-blue-500 animate-pulse' : 'bg-yellow-500'}`}></div>
                 </div>
                 <div className="flex justify-between items-baseline hidden md:flex">
                    <span className="text-[10px] text-slate-400 font-medium">Giá chuẩn:</span>
                    <span className="text-xs font-bold text-slate-600">{(row.price || 0).toLocaleString()}</span>
                 </div>
                 <span className={`text-[9px] px-1 py-0.5 rounded mt-1 w-fit font-bold uppercase tracking-wider hidden md:block
                      ${row.status === 'Đã dọn' ? 'bg-green-100 text-green-700' : 
                        row.status === 'Bẩn' ? 'bg-red-100 text-red-700' : 
                        row.status === 'Đang dọn' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}
                    `}>
                      {row.status}
                 </span>
               </div>
               
               <div className="flex-1 relative">
                   <div className="absolute inset-0 flex divide-x divide-slate-100 pointer-events-none">
                      {dateRange.columns.map((c, i) => <div key={i} className="flex-1"></div>)}
                   </div>

                   {getBookingsForRow(row.facility, row.code).map(booking => {
                        const bookingStart = parseISO(booking.checkinDate);
                        const bookingEnd = parseISO(booking.checkoutDate);
                        
                        // FIX: Safety check for invalid dates
                        if (!isValid(bookingStart) || !isValid(bookingEnd)) return null;

                        const isOverdue = booking.status === 'CheckedIn' && now > bookingEnd;
                        
                        let leftPercent = 0;
                        let widthPercent = 0;

                        if (calendarMode === 'Day') {
                            const dayStart = new Date(currentDate); dayStart.setHours(0,0,0,0);
                            const dayEnd = endOfDay(currentDate);
                            
                            if (bookingEnd <= dayStart || bookingStart >= dayEnd) return null;

                            const effectiveStart = bookingStart < dayStart ? dayStart : bookingStart;
                            const effectiveEnd = bookingEnd > dayEnd ? dayEnd : bookingEnd;

                            const startMins = (effectiveStart.getHours() * 60) + effectiveStart.getMinutes();
                            const durationMins = (effectiveEnd.getTime() - effectiveStart.getTime()) / 60000;
                            
                            leftPercent = (startMins / 1440) * 100;
                            widthPercent = (durationMins / 1440) * 100;
                        } else {
                            const viewStart = dateRange.start;
                            const viewEnd = dateRange.end;
                            const totalDuration = viewEnd.getTime() - viewStart.getTime();

                            if (bookingEnd <= viewStart || bookingStart >= viewEnd) return null;

                            const effectiveStart = bookingStart < viewStart ? viewStart : bookingStart;
                            const effectiveEnd = bookingEnd > viewEnd ? viewEnd : bookingEnd;

                            leftPercent = ((effectiveStart.getTime() - viewStart.getTime()) / totalDuration) * 100;
                            widthPercent = ((effectiveEnd.getTime() - effectiveStart.getTime()) / totalDuration) * 100;
                        }

                        const isActive = now >= bookingStart && now < bookingEnd;
                        const cardStyle = getBookingStyle(booking, isActive);

                        return (
                          <div 
                            key={booking.id}
                            className={`
                              absolute top-1 bottom-1 md:top-2 md:bottom-2 rounded-md md:rounded-lg border text-xs overflow-hidden z-10 cursor-pointer 
                              hover:z-50 hover:scale-[1.02] hover:shadow-xl transition-all duration-200 group/booking
                              flex flex-col justify-center px-1 md:px-2
                              ${cardStyle}
                            `}
                            style={{ 
                              left: `${leftPercent}%`, 
                              width: `max(4px, ${widthPercent}%)`,
                              zIndex: booking.status === 'CheckedOut' ? 5 : isOverdue ? 15 : 10
                            }}
                            onClick={() => onBookingClick(booking)}
                          >
                            {widthPercent > 2 && ( 
                                <>
                                    <div className="font-bold truncate text-[10px] md:text-[11px] leading-tight flex items-center gap-1">
                                      {isOverdue ? <AlertCircle size={10} className="shrink-0 animate-bounce" fill="white" stroke="red" /> : 
                                       booking.status === 'CheckedIn' ? <LogIn size={10} className="shrink-0"/> :
                                       booking.status === 'CheckedOut' ? <LogOut size={10} className="shrink-0"/> : null}
                                      <span className="truncate drop-shadow-md">{booking.customerName}</span>
                                      {booking.isDeclared && <ShieldCheck size={10} className="text-white fill-emerald-500 ml-1 shrink-0 hidden md:block" />}
                                    </div>
                                    {widthPercent > 5 && (
                                        <div className="text-[8px] md:text-[9px] opacity-90 truncate font-mono mt-0.5 flex justify-between hidden md:flex">
                                            <span>{format(bookingStart, 'HH:mm')}</span>
                                            <span>{format(bookingEnd, 'HH:mm')}</span>
                                        </div>
                                    )}
                                </>
                            )}
                            
                            {/* Tooltip */}
                            <div className="hidden group-hover/booking:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-2xl z-[60] text-xs pointer-events-none">
                               <div className="flex justify-between items-start mb-1">
                                   <div className="font-bold text-sm flex items-center gap-1">
                                       {booking.customerName}
                                       {booking.isDeclared && <ShieldCheck size={12} className="text-emerald-400" />}
                                   </div>
                                   <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                                      ${booking.status === 'CheckedIn' ? 'bg-green-50 text-white' : 
                                        booking.status === 'CheckedOut' ? 'bg-slate-500 text-slate-200' : 'bg-blue-50 text-white'}
                                   `}>{booking.status === 'CheckedIn' ? 'Đang ở' : booking.status === 'CheckedOut' ? 'Đã trả' : 'Đã đặt'}</span>
                               </div>
                               {booking.groupName && <div className="text-xs text-purple-200 font-bold mb-1">Đoàn: {booking.groupName}</div>}
                               <div className="text-slate-300 mb-2">{booking.customerPhone}</div>
                               <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 border-t border-slate-600 pt-2">
                                  <div>IN: {format(bookingStart, 'HH:mm dd/MM')}</div>
                                  <div>OUT: {format(bookingEnd, 'HH:mm dd/MM')}</div>
                               </div>
                               {isOverdue && <div className="text-red-400 font-bold mt-1 uppercase">⚠ Quá giờ trả phòng!</div>}
                               <div className="mt-2 text-right font-bold text-brand-400">{booking.totalRevenue.toLocaleString()} ₫</div>
                               <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                            </div>
                          </div>
                        )
                   })}
               </div>
             </div>
           )
         })}
       </div>
    </div>
  );
};
