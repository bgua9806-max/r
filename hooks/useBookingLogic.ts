
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { addDays, format, parseISO, isSameDay, endOfDay, isWeekend, addMonths, endOfMonth, eachDayOfInterval, eachHourOfInterval, isValid, isWithinInterval, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Booking, Room, Guest, HousekeepingTask } from '../types';

export type CalendarViewMode = 'Day' | 'Week' | 'Month';

export const useBookingLogic = () => {
  const { bookings, facilities, rooms, housekeepingTasks, refreshData, upsertRoom, syncHousekeepingTasks, notify } = useAppContext();
  
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('grid');
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>('Day');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [swappingBooking, setSwappingBooking] = useState<Booking | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'info' | 'services' | 'payment'>('info');
  const [isCancellationMode, setIsCancellationMode] = useState(false);
  
  const [defaultBookingData, setDefaultBookingData] = useState<Partial<Booking>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFacility, setFilterFacility] = useState('');
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());

  // Force Refresh on Mount to ensure DB sync
  useEffect(() => {
      refreshData();
      const interval = setInterval(() => setNow(new Date()), 60000); 
      return () => clearInterval(interval);
  }, []);

  // --- Date Range Calculation ---
  const dateRange = useMemo(() => {
      let start: Date, end: Date, columns: Date[];
      
      if (calendarMode === 'Day') {
          start = new Date(currentDate); start.setHours(0,0,0,0);
          end = endOfDay(currentDate);
          columns = eachHourOfInterval({ start, end }); // 24 hours
      } else if (calendarMode === 'Month') {
          start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          end = endOfMonth(currentDate);
          columns = eachDayOfInterval({ start, end });
      } else {
          // Week Default
          start = new Date(currentDate);
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          start.setHours(0,0,0,0);

          end = addDays(start, 6);
          columns = eachDayOfInterval({ start, end });
      }
      return { start, end, columns };
  }, [currentDate, calendarMode]);

  const navigateDate = (direction: number) => {
      if (calendarMode === 'Day') setCurrentDate(addDays(currentDate, direction));
      else if (calendarMode === 'Month') setCurrentDate(addMonths(currentDate, direction));
      else setCurrentDate(addDays(currentDate, direction * 7));
  };

  // --- OMNI-SEARCH LOGIC ---
  // Helper: Check if a room matches the search term (Text OR Date)
  const checkSearchMatch = (room: Room, facilityName: string) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase().trim();

      // 1. Check Room Info (Name, Type)
      if (room.name.toLowerCase().includes(term)) return true;
      if ((room.type || '').toLowerCase().includes(term)) return true;

      // 2. Check Date Logic (DD/MM)
      // Regex: Match "25/10" or "25-10" or "2023-10-25"
      const dateMatch = term.match(/^(\d{1,2})[\/\-\.](\d{1,2})/) || term.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
      let searchDateObj: Date | null = null;

      if (dateMatch) {
          const now = new Date();
          if (term.length <= 5) {
             // DD/MM format -> assume current year
             const day = parseInt(dateMatch[1]);
             const month = parseInt(dateMatch[2]) - 1;
             searchDateObj = new Date(now.getFullYear(), month, day);
          } else {
             // Full date
             const d = new Date(term); // Try standard parse
             if (isValid(d)) searchDateObj = d;
          }
      }

      // 3. Check Bookings in this room
      const roomBookings = bookings.filter(b => b.roomCode === room.name && b.facilityName === facilityName);
      
      const hasBookingMatch = roomBookings.some(b => {
          // A. Text Match
          const customerName = (b.customerName || '').toLowerCase();
          const bookingId = (b.id || '').toLowerCase();
          const phone = (b.customerPhone || '').toLowerCase();
          const note = (b.note || '').toLowerCase();

          if (customerName.includes(term) || 
              bookingId.includes(term) || 
              phone.includes(term) || 
              note.includes(term)) {
              return true;
          }

          // B. Date Match (If term is a date)
          if (searchDateObj && isValid(searchDateObj)) {
              const checkin = parseISO(b.checkinDate);
              const checkout = parseISO(b.checkoutDate);
              if (isValid(checkin) && isValid(checkout)) {
                  // Check if the search date falls within the booking range
                  // Using startOfDay to compare purely on date
                  const sDate = startOfDay(searchDateObj);
                  const bStart = startOfDay(checkin);
                  const bEnd = startOfDay(checkout);
                  
                  return isWithinInterval(sDate, { start: bStart, end: bEnd });
              }
          }

          return false;
      });

      return hasBookingMatch;
  };

  const filteredBookings = useMemo(() => {
    // This list filters bookings directly (used for Timeline Bars)
    if (!searchTerm) return bookings;
    
    // We reuse the logic: A booking is valid if it matches text OR date
    return bookings.filter(b => {
        const term = searchTerm.toLowerCase().trim();
        const customerName = (b.customerName || '').toLowerCase();
        const bookingId = (b.id || '').toLowerCase();
        const phone = (b.customerPhone || '').toLowerCase();
        const note = (b.note || '').toLowerCase();
        const roomCode = (b.roomCode || '').toLowerCase(); // Also search by room code here

        // Text Match
        if (customerName.includes(term) || bookingId.includes(term) || phone.includes(term) || note.includes(term) || roomCode.includes(term)) return true;

        // Date Match
        const dateMatch = term.match(/^(\d{1,2})[\/\-\.](\d{1,2})/);
        if (dateMatch) {
             // Simplified date logic just for list filtering
             const checkin = parseISO(b.checkinDate);
             const checkout = parseISO(b.checkoutDate);
             const formattedIn = format(checkin, 'dd/MM/yyyy');
             const formattedOut = format(checkout, 'dd/MM/yyyy');
             // String match the date for simplicity in list view
             if (formattedIn.includes(term) || formattedOut.includes(term)) return true;
        }

        return false;
    });
  }, [bookings, searchTerm, filterFacility]);

  // --- ROOM MAP LOGIC (GRID VIEW) ---
  const roomMapData = useMemo(() => {
      const displayFacilities = facilities.filter(f => !filterFacility || f.facilityName === filterFacility);
      
      return displayFacilities.map(fac => {
          // FILTER ROOMS HERE based on Search Term
          const facilityRooms = rooms
            .filter(r => r.facility_id === fac.id)
            .filter(r => checkSearchMatch(r, fac.facilityName)) // <--- Apply Omni-Search
            .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
          
          const roomsWithStatus = facilityRooms.map(room => {
              // 1. Find active booking
              const activeBooking = bookings.find(b => {
                  if (b.facilityName !== fac.facilityName || b.roomCode !== room.name) return false;
                  if (b.status === 'Cancelled' || b.status === 'CheckedOut') return false; 

                  if (b.status === 'CheckedIn') return true;

                  if (b.status === 'Confirmed') {
                      const checkin = parseISO(b.checkinDate);
                      const checkout = parseISO(b.checkoutDate);
                      if (!isValid(checkin) || !isValid(checkout)) return false;
                      return isSameDay(checkin, now) || (checkin <= now && checkout >= now);
                  }
                  return false;
              });

              // 2. Find pending booking (Next arrival)
              const nextBooking = !activeBooking ? bookings
                  .filter(b => {
                      if (b.facilityName !== fac.facilityName || b.roomCode !== room.name || b.status !== 'Confirmed') return false;
                      const checkin = parseISO(b.checkinDate);
                      return isValid(checkin) && checkin > now;
                  })
                  .sort((a,b) => {
                      const da = parseISO(a.checkinDate);
                      const db = parseISO(b.checkinDate);
                      return (isValid(da) ? da.getTime() : 0) - (isValid(db) ? db.getTime() : 0);
                  })[0] : null;

              // 3. Find active housekeeping task
              const activeTask = housekeepingTasks.find(t => 
                  t.facility_id === fac.id && 
                  t.room_code === room.name && 
                  t.status !== 'Done'
              );

              // 4. Determine Display Status
              let status: 'Vacant' | 'Occupied' | 'Reserved' | 'Dirty' | 'Cleanup' | 'Overdue' = 'Vacant';
              
              if (activeBooking) {
                  if (activeBooking.status === 'CheckedIn') {
                      status = 'Occupied';
                      const checkout = parseISO(activeBooking.checkoutDate);
                      if (isValid(checkout) && now > checkout) {
                          status = 'Overdue';
                      }
                  } else {
                      status = 'Reserved'; 
                  }
              } else {
                  if (room.status === 'Bẩn') status = 'Dirty';
                  else if (room.status === 'Đang dọn' || activeTask?.status === 'In Progress') status = 'Cleanup';
              }

              return {
                  ...room,
                  currentStatus: status,
                  booking: activeBooking,
                  nextBooking,
                  task: activeTask
              };
          });

          return {
              facility: fac,
              rooms: roomsWithStatus
          };
      });
  }, [facilities, rooms, bookings, housekeepingTasks, filterFacility, now, searchTerm]); // Add searchTerm dependency

  // --- STATS CALCULATION ---
  const roomStats = useMemo(() => {
      let total = 0;
      let available = 0;
      let occupied = 0;
      let dirty = 0;
      let incoming = 0;
      let outgoing = 0;

      // Stats should reflect the FILTERED view or Global? 
      // Usually Stats reflect the Global state unless specifically filtering.
      // Let's calculate based on Global (Unfiltered by search, filtered by Facility) to show overall health.
      const statsFacilities = facilities.filter(f => !filterFacility || f.facilityName === filterFacility);

      statsFacilities.forEach(fac => {
          const facilityRooms = rooms.filter(r => r.facility_id === fac.id);
          facilityRooms.forEach(r => {
              total++;
              // Simplified logic for stats (reusing activeBooking logic would be cleaner but this is fast)
              const activeBooking = bookings.find(b => b.facilityName === fac.facilityName && b.roomCode === r.name && (b.status === 'CheckedIn' || (b.status === 'Confirmed' && isSameDay(parseISO(b.checkinDate), now))));
              
              if (activeBooking && activeBooking.status === 'CheckedIn') {
                  occupied++;
                  if (isValid(parseISO(activeBooking.checkoutDate)) && isSameDay(parseISO(activeBooking.checkoutDate), now)) {
                      outgoing++;
                  }
              } else {
                  // Check incoming
                  const incomingBooking = bookings.find(b => b.facilityName === fac.facilityName && b.roomCode === r.name && b.status === 'Confirmed' && isSameDay(parseISO(b.checkinDate), now));
                  if (incomingBooking) incoming++;
              }

              if (r.status === 'Bẩn' || r.status === 'Đang dọn') {
                  dirty++;
              } else if (!activeBooking && r.status === 'Đã dọn') {
                  available++;
              }
          });
      });

      return { total, available, occupied, dirty, incoming, outgoing };
  }, [facilities, rooms, bookings, now, filterFacility]);

  // --- ACTIONS ---
  const handleQuickClean = async (room: Room) => {
      if (!confirm(`Xác nhận phòng ${room.name} đã dọn xong?`)) return;
      await upsertRoom({ ...room, status: 'Đã dọn' });
      
      const tasks = housekeepingTasks.filter(t => t.facility_id === room.facility_id && t.room_code === room.name && t.status !== 'Done');
      if (tasks.length > 0) {
          const closedTasks = tasks.map(t => ({ ...t, status: 'Done' as const, completed_at: new Date().toISOString() }));
          await syncHousekeepingTasks(closedTasks);
      }
      notify('success', `Đã cập nhật phòng ${room.name} sạch.`);
  };

  const handleRoomClick = (room: any, facilityName: string) => {
      if (room.booking) {
          setEditingBooking(room.booking);
          setModalInitialTab('info');
          setDefaultBookingData({});
          setIsCancellationMode(false);
          setIsModalOpen(true);
      } else {
          setEditingBooking(null);
          setModalInitialTab('info');
          
          const checkin = new Date();
          const checkout = new Date();
          checkout.setDate(checkout.getDate() + 1);
          checkout.setHours(12, 0, 0, 0);

          setDefaultBookingData({
              facilityName: facilityName,
              roomCode: room.name,
              price: room.price || 0,
              checkinDate: checkin.toISOString(),
              checkoutDate: checkout.toISOString(),
              status: 'Confirmed'
          });
          setIsCancellationMode(false);
          setIsModalOpen(true);
      }
  };

  const openBookingAction = (booking: Booking, tab: 'services' | 'payment') => {
      setEditingBooking(booking);
      setModalInitialTab(tab);
      setIsCancellationMode(false);
      setIsModalOpen(true);
  };

  const openBookingCancellation = (booking: Booking) => {
      setEditingBooking(booking);
      setIsCancellationMode(true);
      setModalInitialTab('info'); 
      setIsModalOpen(true);
  };

  const handleSwapClick = (booking: Booking, e: React.MouseEvent) => {
      e.stopPropagation();
      setSwappingBooking(booking);
      setIsSwapModalOpen(true);
  };

  const timelineRows = useMemo(() => {
    let rows: any[] = [];
    const displayFacilities = facilities.filter(f => !filterFacility || f.facilityName === filterFacility);

    displayFacilities.forEach(facility => {
      // Filter rooms for Timeline too
      const facilityRooms = rooms
        .filter(r => r.facility_id === facility.id)
        .filter(r => checkSearchMatch(r, facility.facilityName)) // <--- Apply Omni-Search
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      // Only show facility header if there are matching rooms
      if (facilityRooms.length > 0) {
          rows.push({ type: 'facility', name: facility.facilityName });
          
          facilityRooms.forEach((room) => {
            let displayStatus = room.status;
            const activeTask = housekeepingTasks.find(t => 
                t.facility_id === facility.id && 
                t.room_code === room.name && 
                t.status === 'In Progress'
            );
            if (activeTask && room.status !== 'Đã dọn') {
                displayStatus = 'Đang dọn';
            }

            rows.push({ 
              type: 'room', 
              facility: facility.facilityName,
              code: room.name,
              status: displayStatus, 
              price: room.price || facility.facilityPrice
            });
          });
      }
    });
    return rows;
  }, [facilities, rooms, filterFacility, housekeepingTasks, searchTerm]); // Add searchTerm dependency

  const getBookingsForRow = (facility: string, room: string) => {
    return filteredBookings.filter(b => b.facilityName === facility && b.roomCode === room);
  };

  const getViewConfig = () => {
      switch (calendarMode) {
          case 'Day': return { minWidth: 2400, colLabel: 'HH:mm' }; 
          case 'Week': return { minWidth: 1400, colLabel: 'dd/MM' }; 
          case 'Month': return { minWidth: 1800, colLabel: 'dd' }; 
      }
  };
  const viewConfig = getViewConfig();

  const getCurrentTimePositionPercent = () => {
    if (calendarMode === 'Day') {
        const minutes = now.getHours() * 60 + now.getMinutes();
        return (minutes / 1440) * 100;
    } 
    return -1; 
  };
  
  const getBookingStyle = (b: Booking, isActiveTime: boolean) => {
      const status = b.status || 'Confirmed';
      const checkout = parseISO(b.checkoutDate);
      const isOverdue = status === 'CheckedIn' && isValid(checkout) && now > checkout;
      
      if (status === 'CheckedOut') {
          return "bg-slate-400 border-slate-500 text-slate-100 opacity-70 grayscale";
      } else if (isOverdue) {
          return "bg-red-600 border-red-700 text-white animate-pulse shadow-red-500/50";
      } else if (status === 'CheckedIn') {
          return "bg-green-600 border-green-700 text-white shadow-green-500/30";
      } else {
          return "bg-blue-600 border-blue-700 text-white";
      }
  };

  return {
    viewMode, setViewMode,
    calendarMode, setCalendarMode,
    currentDate, setCurrentDate,
    searchTerm, setSearchTerm,
    filterFacility, setFilterFacility,
    isModalOpen, setIsModalOpen,
    isSwapModalOpen, setIsSwapModalOpen,
    editingBooking, setEditingBooking,
    swappingBooking, setSwappingBooking,
    modalInitialTab, setModalInitialTab,
    isCancellationMode, setIsCancellationMode,
    defaultBookingData, setDefaultBookingData,
    now,
    scrollContainerRef,
    
    // Calculated Data
    dateRange,
    filteredBookings,
    roomMapData,
    roomStats,
    timelineRows,
    viewConfig,
    facilities,
    
    // Handlers
    navigateDate,
    handleQuickClean,
    handleRoomClick,
    openBookingAction,
    openBookingCancellation,
    handleSwapClick,
    getBookingsForRow,
    getCurrentTimePositionPercent,
    getBookingStyle,
    refreshData
  };
};
