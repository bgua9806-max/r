
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { addDays, format, parseISO, isSameDay, endOfDay, isWeekend, addMonths, endOfMonth, eachDayOfInterval, eachHourOfInterval, isValid } from 'date-fns';
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

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const customerName = b.customerName || '';
      const bookingId = b.id || '';
      const matchSearch = customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          bookingId.includes(searchTerm);
      const matchFacility = filterFacility ? b.facilityName === filterFacility : true;
      
      return matchSearch && matchFacility;
    });
  }, [bookings, searchTerm, filterFacility]);

  // --- ROOM MAP LOGIC ---
  const roomMapData = useMemo(() => {
      const displayFacilities = facilities.filter(f => !filterFacility || f.facilityName === filterFacility);
      
      return displayFacilities.map(fac => {
          const facilityRooms = rooms.filter(r => r.facility_id === fac.id).sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true}));
          
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
  }, [facilities, rooms, bookings, housekeepingTasks, filterFacility, now]);

  // --- STATS CALCULATION ---
  const roomStats = useMemo(() => {
      let total = 0;
      let available = 0;
      let occupied = 0;
      let dirty = 0;
      let incoming = 0;
      let outgoing = 0;

      roomMapData.forEach(fac => {
          fac.rooms.forEach(r => {
              total++;
              
              if (r.booking && r.booking.status === 'CheckedIn') {
                  occupied++;
                  if (isValid(parseISO(r.booking.checkoutDate)) && isSameDay(parseISO(r.booking.checkoutDate), now)) {
                      outgoing++;
                  }
              }

              if (r.booking && r.booking.status === 'Confirmed' && isValid(parseISO(r.booking.checkinDate)) && isSameDay(parseISO(r.booking.checkinDate), now)) {
                  incoming++;
              }
              else if (!r.booking && r.nextBooking && isValid(parseISO(r.nextBooking.checkinDate)) && isSameDay(parseISO(r.nextBooking.checkinDate), now)) {
                  incoming++;
              }

              if (r.currentStatus === 'Dirty' || r.currentStatus === 'Cleanup') {
                  dirty++;
              } else if (r.currentStatus === 'Vacant') {
                  available++;
              }
          });
      });

      return { total, available, occupied, dirty, incoming, outgoing };
  }, [roomMapData, now]);

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
      rows.push({ type: 'facility', name: facility.facilityName });
      
      const facilityRooms = rooms
        .filter(r => r.facility_id === facility.id)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

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
    });
    return rows;
  }, [facilities, rooms, filterFacility, housekeepingTasks]);

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
